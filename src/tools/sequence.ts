// What slideshows (presentSlide) and storyboards (defineStoryboard,
// presentPanel) share in the browser: numbered steps the model shows one at a
// time, each a picture the server draws (server/plugins/sequenceHost.ts),
// which the host keeps going (src/composables/useSequence.ts). The tools that
// are sequences are listed in ./sequences.ts. From MulmoGlass
// (src/tools/sequence.ts).
import { defineComponent, h, markRaw, type PropType } from "vue";
import type { ToolContext, ToolResult } from "gui-chat-protocol/vue";
import {
  ImagePreview,
  type ImageToolData,
  type ToolResult as ImageResult,
} from "@mulmochat-plugin/ui-image";

/** Where a sequence is after a step was shown. */
export interface SequenceStep {
  /** 0 for a storyboard's cast, which comes before its first panel. */
  step: number;
  total: number;
  /** "slideshow", "guide" or "story", for what the host says to the model. */
  kind: string;
  /** What is on the screen: "Slide 2 of 5". */
  label: string;
  /** What the model does with it: "explain it". */
  onShown: string;
  /** The call for the next step: `call presentSlide for slide 3 of 5`. */
  nextCall: string;
  /** The next step waits for the user (a how-to step they are doing, a
   *  story choice), so the host doesn't ask the model to go on. */
  waitsForUser?: boolean;
}

// When the user last spoke or sent a message (performance.now()), told by the
// host (src/composables/useSequence.ts). A step that waits for the user isn't
// passed until they have spoken since it appeared.
let lastUserSpeech = -Infinity;

export const noteUserSpoke = (): void => {
  lastUserSpeech = performance.now();
};

export const userSpokeSince = (time: number): boolean => lastUserSpeech > time;

/** For a step that arrived after the user spoke (asked while they did). */
export const stepAfterUserSpokeInstructions = ({
  label,
  kind,
}: SequenceStep): string =>
  `${label} is now on the screen, but the user spoke while it was being made. Respond to what they said; go on with the ${kind} only if they want you to.`;

/** The host's request to go on, when the model ended a reply mid-sequence. */
export const continueInstructions = ({
  kind,
  nextCall,
  onShown,
}: SequenceStep) =>
  `Continue the ${kind}: ${nextCall} now, and ${onShown} when it appears. If the user has just asked you to stop or asked something else, answer them instead.`;

/** The image settings the server draws with (see runOnServer). */
export const imageSettingsOf = (context: ToolContext) => ({
  imageGeneration: context.app?.getImageGenerationSettings?.(),
});

/** The picture a result carries, and where it was saved. */
export function imageOf(result: ToolResult): {
  imageData?: string;
  imagePath?: string;
} {
  const data = result.data as
    { imageData?: unknown; imagePath?: unknown } | undefined;
  return {
    imageData: typeof data?.imageData === "string" ? data.imageData : undefined,
    imagePath: typeof data?.imagePath === "string" ? data.imagePath : undefined,
  };
}

// Gemini Live sometimes calls the next step twice: once in the reply it
// starts by itself after the tool output, once in the reply the instructions
// start. The two calls are identical, so a step asked for in the last minute
// with the same arguments is not made again; a later "show slide 2 again" is
// outside the minute. A repeat that arrives while the first is still being
// made waits for it: it may yet fail.
const DUPLICATE_WINDOW_MS = 60_000;

/** Drops a repeat of a request made in the last minute. */
export function createRepeatGuard() {
  const recent = new Map<string, { at: number; shown: Promise<boolean> }>();

  /** Whether an identical recent request showed its picture. */
  const alreadyShown = async (key: string): Promise<boolean> => {
    const now = Date.now();
    for (const [k, entry] of recent) {
      if (now - entry.at > DUPLICATE_WINDOW_MS) recent.delete(k);
    }
    const earlier = recent.get(key);
    return !!earlier && (await earlier.shown);
  };

  /** Start a request; call the result with whether it was shown. A failed
   *  one may be tried again. */
  const begin = (key: string): ((shown: boolean) => void) => {
    let settle: (shown: boolean) => void = () => {};
    const shown = new Promise<boolean>((resolve) => (settle = resolve));
    recent.set(key, { at: Date.now(), shown });
    return (wasShown) => {
      if (!wasShown && recent.get(key)?.shown === shown) recent.delete(key);
      settle(wasShown);
    };
  };

  return { alreadyShown, begin };
}

/** What a View shows under the picture. */
export interface ImageFooter {
  caption?: string;
  /** A story's choices, numbered, for the user to pick by voice. */
  choices?: string[];
}

function footer({ caption, choices }: ImageFooter) {
  const children = [];
  if (caption) {
    children.push(
      h("p", { class: "text-center text-lg text-gray-800 px-4" }, caption),
    );
  }
  if (choices?.length) {
    children.push(
      h(
        "ol",
        { class: "flex flex-wrap justify-center gap-3 px-4" },
        choices.map((choice, i) =>
          h(
            "li",
            {
              class:
                "rounded-full bg-indigo-600 text-white text-xl px-5 py-2 font-medium",
            },
            `${i + 1}. ${choice}`,
          ),
        ),
      ),
    );
  }
  return children.length
    ? h("div", { class: "flex flex-col gap-2 pb-2" }, children)
    : null;
}

/**
 * A View that fits the whole picture in the canvas, as a slide or a panel
 * should be seen (ui-image's ImageView, which generateImage's View uses, fits
 * a wide picture to the width and scrolls), with a caption and choices under
 * it when the result has them.
 */
export function fittedImageView(
  name: string,
  footerOf: (data: Record<string, unknown>) => ImageFooter = () => ({}),
) {
  return markRaw(
    defineComponent({
      name,
      props: {
        selectedResult: {
          type: Object as PropType<ImageResult<ImageToolData>>,
          required: true,
        },
      },
      setup(props) {
        return () => {
          const data = props.selectedResult.data;
          if (!data?.imageData) return h("div", { class: "h-full bg-white" });
          return h(
            "div",
            { class: "h-full w-full flex flex-col bg-white p-2 gap-2" },
            [
              h(
                "div",
                {
                  class: "flex-1 min-h-0 flex items-center justify-center",
                },
                [
                  h("img", {
                    src: data.imageData,
                    alt: data.prompt ?? "",
                    class: "max-w-full max-h-full object-contain",
                  }),
                ],
              ),
              footer(footerOf(data as unknown as Record<string, unknown>)),
            ],
          );
        };
      },
    }),
  );
}

/** ui-image's thumbnail of the result's picture. */
export function imagePreview(name: string) {
  return markRaw(
    defineComponent({
      name,
      props: {
        result: {
          type: Object as PropType<ImageResult<ImageToolData>>,
          required: true,
        },
      },
      setup(props) {
        return () => h(ImagePreview, { result: props.result });
      },
    }),
  );
}
