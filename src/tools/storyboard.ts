// defineStoryboard and presentPanel: a story told in pictures, with
// characters who look the same in every panel. From MulmoGlass
// (src/tools/storyboard.ts).
//
// defineStoryboard draws a reference sheet for each character and shows the
// cast; presentPanel then draws one panel at a time with the sheets of the
// characters in it as reference images, which kept a character's face, hair
// and clothes on Gemini, OpenAI and xAI alike (a description repeated in
// every prompt did not). The server draws and saves the storyboard
// (server/plugins/sequenceHost.ts). Panels go on like slides (./sequence.ts,
// src/composables/useSequence.ts); a panel with choices waits for the user's
// pick, which is held here, where the user's speech is known.
import { defineComponent, h, markRaw, type PropType } from "vue";
import type { ToolResult } from "gui-chat-protocol/vue";
import type { ToolPlugin } from "./types";
import { postToServer } from "./serverPlugin";
import {
  createRepeatGuard,
  fittedImageView,
  imageOf,
  imagePreview,
  imageSettingsOf,
  userSpokeSince,
  type SequenceStep,
} from "./sequence";
import {
  DEFINE_STORYBOARD,
  DEFINE_STORYBOARD_DEFINITION,
  PRESENT_PANEL,
  PRESENT_PANEL_DEFINITION,
  STORYBOARD_PROMPT,
  parsePanelArgs,
  type CastData,
} from "../../server/plugins/sequenceTools";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// An identical panel asked for twice (Gemini Live) is shown once.
const repeats = createRepeatGuard();

// The panel waiting for the user's choice, by storyboard, and when it
// appeared. Grok sometimes went on to the next panel in the reply that read
// the choices out (MulmoGlass); the host holds such a panel back until the
// user speaks. A panel being drawn is here too, with shownAt Infinity: its
// choices aren't known yet, so a later panel waits for it.
const awaitingChoice = new Map<string, { panel: number; shownAt: number }>();

async function presentPanel(
  context: Parameters<ToolPlugin["execute"]>[0],
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const config = imageSettingsOf(context);
  const parsed = parsePanelArgs(args);
  // The server says what is wrong with the arguments.
  if (!parsed) return postToServer(PRESENT_PANEL, args, config);
  const { storyboardId, panel } = parsed;

  const waiting = awaitingChoice.get(storyboardId);
  if (waiting && panel > waiting.panel && !userSpokeSince(waiting.shownAt)) {
    console.info(`[sequence] holding panel ${panel} for the user`);
    // No instructions: they would start another reply.
    return {
      message:
        waiting.shownAt === Infinity
          ? `panel ${panel} was not shown: panel ${waiting.panel} is still being drawn. Wait for it before going on.`
          : `panel ${panel} was not shown: the user hasn't picked a choice yet, and panel ${waiting.panel} is still on the screen. Wait for their answer.`,
      cancelled: true,
    };
  }

  const key = JSON.stringify(parsed);
  if (await repeats.alreadyShown(key)) {
    // Not shown again, and no instructions: the model goes on by itself.
    return {
      message: `panel ${panel} is already on the screen`,
      cancelled: true,
    };
  }
  const settle = repeats.begin(key);
  const pending = { panel, shownAt: Infinity };
  const before = awaitingChoice.get(storyboardId);
  awaitingChoice.set(storyboardId, pending);
  // Whether this panel is still the latest one asked for.
  const latest = () => awaitingChoice.get(storyboardId) === pending;

  let shown = false;
  try {
    const image = await postToServer(PRESENT_PANEL, args, config);
    shown = !!imageOf(image).imageData;
    const data = isRecord(image.data) ? image.data : {};
    // The server keeps choices only where they count (not on the last panel).
    const choices = Array.isArray(data.choices) ? data.choices : [];
    if (shown && latest()) {
      if (choices.length) {
        awaitingChoice.set(storyboardId, { panel, shownAt: performance.now() });
      } else {
        awaitingChoice.delete(storyboardId);
      }
    }
    // A failure keeps the image host's message and instructions.
    return image;
  } finally {
    settle(shown);
    // The panel before it is still the one waiting, if one was.
    if (!shown && latest()) {
      if (before) awaitingChoice.set(storyboardId, before);
      else awaitingChoice.delete(storyboardId);
    }
  }
}

/** The story's place after the cast or a panel was shown, or null. */
export function storyboardSequenceStep(
  name: string,
  result: ToolResult,
): SequenceStep | null {
  const data = isRecord(result.data) ? result.data : {};
  const id = data.storyboardId;
  const total = data.totalPanels;
  if (typeof id !== "string" || typeof total !== "number") return null;
  if (name === DEFINE_STORYBOARD && typeof data.imageData === "string") {
    return {
      step: 0,
      total,
      kind: "story",
      label: `The cast of "${String(data.title ?? "")}"`,
      onShown: "introduce the characters",
      nextCall: `call presentPanel for panel 1 of ${total} with storyboardId "${id}"`,
    };
  }
  const panel = data.panel;
  if (
    name === PRESENT_PANEL &&
    typeof panel === "number" &&
    typeof data.imageData === "string"
  ) {
    return {
      step: panel,
      total,
      kind: "story",
      label: `Panel ${panel} of ${total}`,
      onShown: "tell that part of the story",
      nextCall: `call presentPanel for panel ${panel + 1} of ${total} with storyboardId "${id}"`,
      // A panel with choices waits for the user's pick.
      waitsForUser: Array.isArray(data.choices) && data.choices.length > 0,
    };
  }
  return null;
}

const CastView = markRaw(
  defineComponent({
    name: "StoryboardCastView",
    props: {
      selectedResult: {
        type: Object as PropType<ToolResult<CastData>>,
        required: true,
      },
    },
    setup(props) {
      return () => {
        const data = props.selectedResult.data;
        const characters = data?.characters ?? [];
        return h("div", { class: "h-full w-full flex flex-col bg-white p-4" }, [
          h(
            "h2",
            { class: "text-center text-xl font-semibold text-gray-800 mb-3" },
            data?.title ?? "",
          ),
          h(
            "div",
            {
              class: `flex-1 min-h-0 grid gap-3 ${characters.length > 1 ? "grid-cols-2" : "grid-cols-1"} auto-rows-fr`,
            },
            characters.map((character) =>
              h("figure", { class: "min-h-0 flex flex-col items-center" }, [
                character.imageData
                  ? h("img", {
                      src: character.imageData,
                      alt: character.name,
                      class: "flex-1 min-h-0 max-w-full object-contain",
                    })
                  : h("div", { class: "flex-1" }),
                h(
                  "figcaption",
                  { class: "text-lg text-gray-800 mt-1" },
                  character.name,
                ),
              ]),
            ),
          ),
        ]);
      };
    },
  }),
);

const defineStoryboardPlugin: ToolPlugin = {
  toolDefinition: DEFINE_STORYBOARD_DEFINITION,
  systemPrompt: STORYBOARD_PROMPT,
  generatingMessage: "Drawing the characters...",
  isEnabled: () => true,
  viewComponent: CastView,
  previewComponent: imagePreview("StoryboardCastPreview"),
  execute: (context, args) =>
    postToServer(DEFINE_STORYBOARD, args, imageSettingsOf(context)),
};

const presentPanelPlugin: ToolPlugin = {
  toolDefinition: PRESENT_PANEL_DEFINITION,
  generatingMessage: "Drawing the panel...",
  isEnabled: () => true,
  viewComponent: fittedImageView("PresentPanelView", (data) => ({
    caption: typeof data.caption === "string" ? data.caption : "",
    choices: Array.isArray(data.choices)
      ? data.choices.filter((c): c is string => typeof c === "string")
      : [],
  })),
  previewComponent: imagePreview("PresentPanelPreview"),
  execute: (context, args) =>
    presentPanel(context, args as Record<string, unknown>),
};

export const DefineStoryboardPlugin = { plugin: defineStoryboardPlugin };
export const PresentPanelPlugin = { plugin: presentPanelPlugin };
