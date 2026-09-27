// makeMovie: a narrated movie of a storyboard or a slideshow, from the
// pictures already made (./sequenceHost.ts saved them and their records).
//
// 1. Load the record and check every picture: a saved image under
//    artifacts/images/ that still exists.
// 2. Ask a text model for the narration, one entry per panel or slide, in the
//    user's language. The voice model's own words aren't available on every
//    transport, and asking it to pass narration with every panel would slow
//    the story down.
// 3. Build a MulmoScript, one beat per panel or slide showing its picture,
//    and hand it to presentMulmoScript's host (./mulmoscriptHost.ts) with
//    autoGenerateMovie: it saves the script in artifacts/stories/, starts the
//    movie, and the result shows in presentMulmoScript's View, which follows
//    the movie's progress.
//
// mulmocast resolves a `path` source against the script's directory, so a
// picture at artifacts/images/2026/09/x.jpg is `../images/2026/09/x.jpg` from
// artifacts/stories/. Only paths checked here are written.
import path from "node:path";
import type { ToolResult } from "gui-chat-protocol";
import { artifactsFileOps } from "./workspace";
import { movieUnavailable, saveScript } from "./mulmoscriptHost";
import { loadRecord, SLIDESHOWS_DIR, STORYBOARDS_DIR } from "./sequenceHost";
import {
  MAKE_MOVIE,
  parseMovieArgs,
  type Slideshow,
  type Storyboard,
} from "./sequenceTools";
import { generateText, getProviderAvailability } from "../llm/textService";
import type { TextLLMProviderId } from "../llm/types";
import { errorMessageOf } from "../utils/imageGenerationError";
import { logger } from "../utils/logger";

const IMAGES_PREFIX = "artifacts/images/";
const PICTURE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

/** One scene of the movie: its picture, and what the narration is about. */
interface Scene {
  imagePath: string;
  about: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Entries are keyed by their number ("1", "2", …): in that order.
const inOrder = <T>(entries: Record<string, T>): [number, T][] =>
  Object.entries(entries)
    .map(([n, entry]): [number, T] => [Number(n), entry])
    .filter(([n]) => Number.isInteger(n))
    .sort(([a], [b]) => a - b);

function storyboardScenes(storyboard: Storyboard) {
  const scenes: Scene[] = [];
  const skipped: number[] = [];
  for (const [n, panel] of inOrder(storyboard.panels)) {
    if (!panel.imagePath) {
      skipped.push(n);
      continue;
    }
    scenes.push({
      imagePath: panel.imagePath,
      about: {
        panel: n,
        caption: panel.caption,
        scene: panel.imagePrompt,
        characters: panel.characters,
        ...(panel.choices && { choicesOfferedAfterIt: panel.choices }),
      },
    });
  }
  return { scenes, skipped };
}

function slideshowScenes(slideshow: Slideshow) {
  const scenes: Scene[] = [];
  const skipped: number[] = [];
  for (const [n, slide] of inOrder(slideshow.slides)) {
    if (!slide.imagePath) {
      skipped.push(n);
      continue;
    }
    scenes.push({
      imagePath: slide.imagePath,
      about: { slide: n, title: slide.title, picture: slide.imagePrompt },
    });
  }
  return { scenes, skipped };
}

/** The picture's path from artifacts/stories/, or why it can't be used. */
async function scriptPathOf(imagePath: string): Promise<string | Error> {
  const lower = imagePath.toLowerCase();
  if (
    path.posix.normalize(imagePath) !== imagePath ||
    !imagePath.startsWith(IMAGES_PREFIX) ||
    !PICTURE_EXTENSIONS.some((ext) => lower.endsWith(ext))
  ) {
    return new Error(`not a saved picture: ${imagePath}`);
  }
  const rel = imagePath.slice("artifacts/".length);
  if (!(await artifactsFileOps.exists(rel))) {
    return new Error(`the picture ${imagePath} is missing`);
  }
  return `../${rel}`;
}

// --- Narration -----------------------------------------------------------------

// Gemini first: its key also voices the movie.
const PROVIDER_ORDER: TextLLMProviderId[] = [
  "google",
  "openai",
  "anthropic",
  "grok",
];

function narrationModel() {
  const available = getProviderAvailability();
  for (const provider of PROVIDER_ORDER) {
    const entry = available.find((p) => p.provider === provider);
    if (entry?.hasCredentials && entry.defaultModel) {
      return { provider, model: entry.defaultModel };
    }
  }
  return null;
}

function narrationRequest(
  kind: "storyboard" | "slideshow",
  record: Storyboard | Slideshow,
  scenes: Scene[],
  language: string,
): string {
  const whole =
    kind === "storyboard"
      ? {
          story: record.title,
          characters: (record as Storyboard).characters.map(
            ({ name, description }) => ({ name, description }),
          ),
        }
      : {
          slideshow: record.title,
          ...((record as Slideshow).mode === "steps" && {
            kind: "a step-by-step guide",
          }),
        };
  const what = kind === "storyboard" ? "panel" : "slide";
  const lines = [
    `Write the narration for a narrated movie made from the pictures of this ${kind}, in the language with the code "${language}".`,
    `For each ${what}, write what the narrator says while its picture is shown: two to four full sentences (never a single word or a fragment, which the voice can't read), flowing from one ${what} to the next as one ${kind === "storyboard" ? "story" : "presentation"}.`,
  ];
  if (kind === "storyboard") {
    lines.push(
      "When choices were offered after a panel, the next panel shows the one that was taken: tell it as one story, without mentioning the choices.",
    );
  }
  lines.push(
    `Reply with only a JSON array of exactly ${scenes.length} strings, in order, and nothing else.`,
    "",
    JSON.stringify({ ...whole, [`${what}s`]: scenes.map((s) => s.about) }),
  );
  return lines.join("\n");
}

/** The narration lines, one per scene, or why there are none. */
async function writeNarration(
  prompt: string,
  count: number,
): Promise<string[] | Error> {
  const model = narrationModel();
  if (!model) {
    return new Error(
      "no text model is set up to write the narration (GEMINI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY or XAI_API_KEY)",
    );
  }
  try {
    const { text } = await generateText({
      ...model,
      messages: [{ role: "user", content: prompt }],
    });
    const json = text.slice(text.indexOf("["), text.lastIndexOf("]") + 1);
    const lines: unknown = JSON.parse(json);
    if (
      !Array.isArray(lines) ||
      lines.length !== count ||
      !lines.every((line) => typeof line === "string" && line.trim())
    ) {
      return new Error(
        `the narration came back in the wrong shape (${count} lines expected)`,
      );
    }
    return lines.map((line: string) => line.trim());
  } catch (error) {
    logger.warn("Narration failed", { ...model, error: errorMessageOf(error) });
    return new Error(
      `the narration couldn't be written: ${errorMessageOf(error)}`,
    );
  }
}

// --- The movie -------------------------------------------------------------------

// Gemini's voices when its key is set (as presentMulmoScript's own scripts
// use), OpenAI's otherwise.
const narrator = () =>
  process.env.GEMINI_API_KEY
    ? { provider: "gemini", voiceId: "Kore" }
    : { provider: "openai", voiceId: "shimmer" };

async function makeMovie(
  args: Record<string, unknown>,
  rawConfig: unknown,
): Promise<ToolResult> {
  const parsed = parseMovieArgs(args);
  if (typeof parsed === "string") return { message: parsed };
  // Before the narration is written: without ffmpeg there is no movie.
  const unavailable = movieUnavailable();
  if (unavailable) {
    return {
      message: `the movie couldn't be made: ${unavailable}`,
      instructions:
        "Tell the user the movie couldn't be made, and briefly why.",
    };
  }
  const config = isRecord(rawConfig) ? rawConfig : {};
  const language =
    parsed.language ??
    (typeof config.language === "string" && config.language
      ? config.language
      : "en");

  const record =
    parsed.kind === "storyboard"
      ? await loadRecord<Storyboard>(STORYBOARDS_DIR, parsed.id)
      : await loadRecord<Slideshow>(SLIDESHOWS_DIR, parsed.id);
  if (!record) {
    return { message: `there is no ${parsed.kind} "${parsed.id}"` };
  }
  const { scenes, skipped } =
    parsed.kind === "storyboard"
      ? storyboardScenes(record as Storyboard)
      : slideshowScenes(record as Slideshow);
  if (!scenes.length) {
    return {
      message: `${parsed.kind} "${parsed.id}" has no saved pictures to make a movie from`,
    };
  }
  const paths: string[] = [];
  for (const scene of scenes) {
    const scriptPath = await scriptPathOf(scene.imagePath);
    if (scriptPath instanceof Error) {
      return {
        message: `the movie couldn't be made: ${scriptPath.message}`,
        instructions:
          "Tell the user the movie couldn't be made, and briefly why.",
      };
    }
    paths.push(scriptPath);
  }

  const narration = await writeNarration(
    narrationRequest(parsed.kind, record, scenes, language),
    scenes.length,
  );
  if (narration instanceof Error) {
    return {
      message: `the movie couldn't be made: ${narration.message}`,
      instructions:
        "Tell the user the movie couldn't be made, and briefly why.",
    };
  }

  const title = record.title || `Movie of ${parsed.kind} ${parsed.id}`;
  const script = {
    $mulmocast: { version: "1.1" },
    title,
    description: `A narrated movie of the ${parsed.kind} "${title}" (${parsed.kind} ${parsed.id}).`,
    lang: language,
    speechParams: {
      speakers: {
        Narrator: {
          ...narrator(),
          displayName: { [language]: "Narrator" },
        },
      },
    },
    beats: scenes.map((_, i) => ({
      speaker: "Narrator",
      text: narration[i],
      image: {
        type: "image",
        source: { kind: "path", path: paths[i] },
      },
    })),
  };
  const { result: shown, movieStarted } = await saveScript({
    script,
    filename: title,
    autoGenerateMovie: true,
  });
  if (!shown.data) return shown;
  const left = skipped.length
    ? `; left out, with no saved picture: ${skipped.join(", ")}`
    : "";
  return {
    ...shown,
    // Shown with presentMulmoScript's View, which follows the movie.
    toolName: "presentMulmoScript",
    message: `a movie of ${parsed.kind} "${parsed.id}" with ${scenes.length} scenes: ${shown.message}${left}`,
    instructions: movieStarted
      ? "Tell the user the movie is being made from the pictures they saw, that it takes a few minutes, and that it will play on the screen when it is ready."
      : "Tell the user the movie's script is on the screen but the movie didn't start, and briefly why (the message says).",
  };
}

/** The route's handler (./dispatch.ts). */
export const movieHandlers = {
  [MAKE_MOVIE]: { execute: makeMovie },
};
