// Slideshows (presentSlide) and storyboards (defineStoryboard, presentPanel):
// what the browser and the server both need, so it is defined once. This
// module is browser-safe: src/tools/ imports it.
//
// The tools come from MulmoGlass (receptron/mulmoglass, src/tools/), with the
// same names, arguments and saved files. Here the work is split by where it
// must run: the server draws the pictures and keeps the records
// (./sequenceHost.ts); the browser holds a step that waits for the user and
// keeps the sequence going (src/tools/presentSlide.ts, storyboard.ts,
// src/composables/useSequence.ts), since only the browser knows when the user
// spoke.
import type { ToolDefinition } from "gui-chat-protocol";

export const PRESENT_SLIDE = "presentSlide";
export const DEFINE_STORYBOARD = "defineStoryboard";
export const PRESENT_PANEL = "presentPanel";

export const MAX_CHARACTERS = 4;
export const MAX_PANELS = 12;
export const MAX_CHOICES = 3;

/** A slideshow's or storyboard's ID: 12 hex digits, also its file name. */
export const SEQUENCE_ID = /^[0-9a-f]{12}$/;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

export const sameName = (a: string, b: string) =>
  a.toLowerCase() === b.toLowerCase();

const isWholeNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value);

// --- presentSlide ------------------------------------------------------------

export type SlideMode = "presentation" | "steps";

export interface SlideArgs {
  slide: number;
  totalSlides: number;
  title: string;
  imagePrompt: string;
  mode: SlideMode;
}

export const SLIDE_ARGS_ERROR =
  "presentSlide needs slide and totalSlides (whole numbers, slide from 1 to totalSlides) and an imagePrompt";

/** The slide arguments, or null when the model sent something else. */
export function parseSlideArgs(
  args: Record<string, unknown>,
): SlideArgs | null {
  const { slide, totalSlides, title, imagePrompt } = args;
  if (
    !isWholeNumber(slide) ||
    !isWholeNumber(totalSlides) ||
    slide < 1 ||
    totalSlides < slide ||
    typeof imagePrompt !== "string" ||
    !imagePrompt.trim()
  ) {
    return null;
  }
  return {
    slide,
    totalSlides,
    title: typeof title === "string" ? title : "",
    imagePrompt,
    mode: args.mode === "steps" ? "steps" : "presentation",
  };
}

/** What the model does once a slide is on the screen. */
export const slideShownInstructions = ({
  slide,
  totalSlides,
  title,
  mode,
}: SlideArgs): string => {
  const titled = title ? ` ("${title}")` : "";
  if (mode === "steps") {
    const label = `Step ${slide} of ${totalSlides}${titled}`;
    return slide < totalSlides
      ? `${label} is now on the screen. Explain what to do in this step, then stop and wait while the user does it. When they say they're ready (next, done, go on), call presentSlide for step ${slide + 1} with mode "steps". If they ask to go back or to see a step again, call presentSlide for that step.`
      : `${label}, the last one, is now on the screen. Explain what to do, then wrap up the guide once the user is done.`;
  }
  const label = `Slide ${slide} of ${totalSlides}${titled}`;
  // The length of each explanation is the model's call: some slides need a
  // sentence, some a paragraph. The "stop" clause is for when the host missed
  // the user's speech (Gemini can report it too late): the model heard it.
  return slide < totalSlides
    ? `${label} is now on the screen. Explain it, then, in this same reply and without waiting for the user, call presentSlide for slide ${slide + 1}. If the user has asked you to stop, or asked something else, since the slideshow began, answer them instead of going on.`
    : `${label}, the last one, is now on the screen. Explain it, then wrap up the slideshow.`;
};

/** A slideshow as saved in artifacts/slideshows/<id>.json. */
export interface Slideshow {
  id: string;
  /** The first slide's title. */
  title: string;
  mode: SlideMode;
  totalSlides: number;
  slides: Record<
    string,
    { title: string; imagePrompt: string; imagePath?: string }
  >;
}

/** A shown slide's result data. */
export interface SlideData {
  imageData: string;
  imagePath?: string;
  prompt: string;
  slideshowId: string;
  slide: number;
  totalSlides: number;
  title: string;
  mode: SlideMode;
}

export const PRESENT_SLIDE_PROMPT =
  'When the user asks for a slideshow (or to explain something with slides), plan four to six slides, then show them one at a time with presentSlide: slide 1 first, and each next slide only after you have explained the one on the screen. Go on to the last slide without asking whether to continue. When the user wants to be shown how to do something they will do along with you (cooking, folding, fixing, an exercise), make it a step-by-step guide instead: mode "steps", one slide per step, and after each step wait for the user to say they are ready. Use generateImage for a single picture, not for slides.';

export const PRESENT_SLIDE_DEFINITION: ToolDefinition = {
  type: "function",
  name: PRESENT_SLIDE,
  description:
    'Show one slide of a slideshow: a picture generated from imagePrompt, full screen. Call it once per slide, in order, starting with slide 1. With mode "steps" it is a step-by-step guide: one slide per step, and the next step waits for the user.',
  parameters: {
    type: "object",
    properties: {
      slide: {
        type: "integer",
        description: "This slide's number, starting at 1.",
      },
      totalSlides: {
        type: "integer",
        description:
          "How many slides the slideshow has. Keep it the same for every slide.",
      },
      title: { type: "string", description: "The slide's title." },
      imagePrompt: {
        type: "string",
        description:
          "The picture for this slide: a clear illustration or diagram of its point, with the title as its only large text. Be concrete. For a step, show the action: hands, tools and the object.",
      },
      mode: {
        type: "string",
        enum: ["presentation", "steps"],
        description:
          '"presentation" (the default) goes on by itself; "steps" is a how-to the user does along with you, and waits for them after each step. Keep it the same for every slide.',
      },
    },
    required: ["slide", "totalSlides", "title", "imagePrompt"],
  },
};

// --- defineStoryboard --------------------------------------------------------

export interface Character {
  name: string;
  description: string;
  /** Its reference sheet, when one was made and saved. */
  imagePath?: string;
}

export interface Panel {
  caption: string;
  characters: string[];
  imagePrompt: string;
  imagePath?: string;
  /** In an interactive story, what the user chose between after it. */
  choices?: string[];
}

/** A storyboard as saved in artifacts/storyboards/<id>.json. It maps onto a
 *  MulmoScript: each character (name and sheet) an entry in
 *  imageParams.images, each panel a beat, a panel's characters its
 *  imageNames. */
export interface Storyboard {
  id: string;
  title: string;
  style: string;
  totalPanels: number;
  characters: Character[];
  /** The user chooses what happens at some panels; the panels saved are the
   *  path the story took. */
  interactive: boolean;
  panels: Record<string, Panel>;
}

export interface StoryboardArgs {
  title: string;
  style: string;
  totalPanels: number;
  characters: Character[];
  interactive: boolean;
}

/** The arguments, or what is wrong with them (said to the model). */
export function parseStoryboardArgs(
  args: Record<string, unknown>,
): StoryboardArgs | string {
  const { totalPanels } = args;
  if (
    !isWholeNumber(totalPanels) ||
    totalPanels < 1 ||
    totalPanels > MAX_PANELS
  ) {
    return `totalPanels must be a whole number from 1 to ${MAX_PANELS}`;
  }
  const characters: Character[] = [];
  for (const item of Array.isArray(args.characters) ? args.characters : []) {
    const name = isRecord(item) ? text(item.name) : "";
    const description = isRecord(item) ? text(item.description) : "";
    if (!name || !description) {
      return "every character needs a name and a description";
    }
    if (characters.some((c) => sameName(c.name, name))) {
      return `two characters are named ${name}`;
    }
    characters.push({ name, description });
  }
  if (characters.length < 1 || characters.length > MAX_CHARACTERS) {
    return `a storyboard has 1 to ${MAX_CHARACTERS} characters`;
  }
  return {
    title: text(args.title),
    style: text(args.style),
    totalPanels,
    characters,
    interactive: args.interactive === true,
  };
}

export const castShownInstructions = ({ title, id }: Storyboard): string =>
  `The cast of "${title}" is now on the screen. Introduce the characters briefly, then, in this same reply and without waiting for the user, call presentPanel for panel 1 with storyboardId "${id}". If the user has asked you to stop, or asked something else, answer them instead of going on.`;

/** The cast's result data. */
export interface CastData {
  storyboardId: string;
  title: string;
  totalPanels: number;
  /** The first sheet, for the preview. */
  imageData?: string;
  characters: { name: string; imageData?: string; imagePath?: string }[];
}

// --- presentPanel ------------------------------------------------------------

export interface PanelArgs {
  storyboardId: string;
  panel: number;
  characters: string[];
  imagePrompt: string;
  caption: string;
  choices: string[];
}

export const PANEL_ARGS_ERROR =
  "presentPanel needs a storyboardId, a panel number (from 1) and an imagePrompt";

export function parsePanelArgs(
  args: Record<string, unknown>,
): PanelArgs | null {
  const { panel } = args;
  const storyboardId = text(args.storyboardId);
  const imagePrompt = text(args.imagePrompt);
  if (!storyboardId || !imagePrompt || !isWholeNumber(panel) || panel < 1) {
    return null;
  }
  const strings = (value: unknown) =>
    (Array.isArray(value) ? value : []).map(text).filter(Boolean);
  return {
    storyboardId,
    panel,
    characters: strings(args.characters),
    imagePrompt,
    caption: text(args.caption),
    choices: strings(args.choices).slice(0, MAX_CHOICES),
  };
}

export function panelShownInstructions(
  storyboard: Pick<Storyboard, "id" | "totalPanels">,
  panel: number,
  choices: string[],
): string {
  const { id, totalPanels } = storyboard;
  if (choices.length) {
    const listed = choices.map((choice, i) => `${i + 1}. ${choice}`).join(" ");
    return `Panel ${panel} of ${totalPanels} is now on the screen, with the user's choices: ${listed} Tell this part of the story, then read the choices out and ask the user which one they pick, and wait for their answer. Then call presentPanel for panel ${panel + 1} with storyboardId "${id}", going on the way they chose.`;
  }
  return panel < totalPanels
    ? `Panel ${panel} of ${totalPanels} is now on the screen. Tell this part of the story, then, in this same reply and without waiting for the user, call presentPanel for panel ${panel + 1} with storyboardId "${id}". If the user has asked you to stop, or asked something else, since the story began, answer them instead of going on.`
    : `Panel ${panel} of ${totalPanels}, the last one, is now on the screen. Tell this part of the story, then bring it to an end.`;
}

/** A shown panel's result data. */
export interface PanelData {
  imageData: string;
  imagePath?: string;
  prompt: string;
  storyboardId: string;
  panel: number;
  totalPanels: number;
  caption: string;
  choices?: string[];
}

export const STORYBOARD_PROMPT =
  "When the user asks for a story, a picture book, a comic or a storyboard, tell it in pictures: first call defineStoryboard with the art style and the characters who appear more than once (it draws a reference sheet for each, so they look the same in every panel), then show the panels one at a time with presentPanel, naming the characters in each, and tell each part of the story when its panel appears. Go on to the last panel without asking whether to continue, unless the story is interactive. When the user wants to decide what happens (an adventure, a story for a child who wants to choose), set interactive, and give two or three choices on two or three of the panels: the story waits there for the user's pick and goes on their way; it still ends at the last panel whichever way it goes. Use presentSlide to explain a topic, not to tell a story.";

export const DEFINE_STORYBOARD_DEFINITION: ToolDefinition = {
  type: "function",
  name: DEFINE_STORYBOARD,
  description:
    "Start a story told in pictures: set its art style and draw a reference sheet for each recurring character, shown as the cast. Then call presentPanel for each panel, in order.",
  parameters: {
    type: "object",
    properties: {
      title: { type: "string", description: "The story's title." },
      style: {
        type: "string",
        description:
          "The art style of every picture, in one sentence (for example: soft watercolor, children's picture book).",
      },
      totalPanels: {
        type: "integer",
        description: `How many panels the story has, at most ${MAX_PANELS}; four to eight is usual.`,
      },
      interactive: {
        type: "boolean",
        description:
          "The user chooses what happens: panels can offer choices, and the story waits for the pick.",
      },
      characters: {
        type: "array",
        description: `The characters who appear in more than one panel, 1 to ${MAX_CHARACTERS}.`,
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "A short name, used in presentPanel.",
            },
            description: {
              type: "string",
              description:
                "How they look: age, build, face, hair, clothes and colors. Be concrete: it is drawn once and reused in every panel.",
            },
          },
          required: ["name", "description"],
        },
      },
    },
    required: ["title", "style", "totalPanels", "characters"],
  },
};

export const PRESENT_PANEL_DEFINITION: ToolDefinition = {
  type: "function",
  name: PRESENT_PANEL,
  description:
    "Show one panel of a storyboard made with defineStoryboard: a picture of the scene with its characters drawn as in their reference sheets, and a caption. Call it once per panel, in order, starting with panel 1.",
  parameters: {
    type: "object",
    properties: {
      storyboardId: {
        type: "string",
        description: "The storyboardId defineStoryboard returned.",
      },
      panel: {
        type: "integer",
        description: "This panel's number, starting at 1.",
      },
      characters: {
        type: "array",
        items: { type: "string" },
        description:
          "The names (as in defineStoryboard) of the characters in this panel.",
      },
      imagePrompt: {
        type: "string",
        description:
          "What the panel shows: the setting, what happens, expressions and the camera angle. Refer to characters by name; don't describe their looks again.",
      },
      caption: {
        type: "string",
        description: "One short line shown under the picture.",
      },
      choices: {
        type: "array",
        items: { type: "string" },
        description:
          "Only in an interactive story, and not on the last panel: two or three short options for what happens next. The story waits for the user's pick.",
      },
    },
    required: ["storyboardId", "panel", "characters", "imagePrompt"],
  },
};

// --- What the browser sends --------------------------------------------------

/** presentSlide's request config, besides the image settings: the slideshow
 *  the slide belongs to (the browser knows which, see
 *  src/tools/presentSlide.ts), and for a guide step, the step before it, drawn
 *  on as a reference. */
export interface SlideRequestConfig {
  slideshowId: string;
  previousImagePath?: string;
}
