// presentSlide: one slide of a spoken slideshow, a generated picture per
// slide. The model calls it once per slide, in order, and explains each slide
// when it appears. With the slide number and the total as arguments, the host
// knows where a slideshow is and can ask the model to go on
// (src/composables/useSequence.ts). From MulmoGlass (src/tools/presentSlide.ts).
//
// A slideshow is a presentation (the default: it goes on by itself) or a
// step-by-step guide (mode "steps": a how-to the user follows along with).
// A step waits for the user to say they're ready, is drawn with the previous
// step's picture as a reference so the object stays the same, and a step
// shown earlier ("go back to step 2") is shown again as it was, not redrawn.
//
// The server draws the slide and saves the slideshow
// (server/plugins/sequenceHost.ts); what depends on the user (holding a step,
// showing an earlier one again, dropping a repeated call) is decided here.
import type { ToolResult } from "gui-chat-protocol/vue";
import { v4 as uuidv4 } from "uuid";
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
  PRESENT_SLIDE,
  PRESENT_SLIDE_DEFINITION,
  PRESENT_SLIDE_PROMPT,
  SLIDE_ARGS_ERROR,
  parseSlideArgs,
  slideShownInstructions,
  type SlideArgs,
  type SlideMode,
  type SlideRequestConfig,
} from "../../server/plugins/sequenceTools";

/** The slideshow's place after a slide was shown, or null. */
export function slideSequenceStep(
  args: Record<string, unknown>,
  result: ToolResult,
): SequenceStep | null {
  const slide = parseSlideArgs(args);
  if (!slide || !imageOf(result).imageData) return null;
  const { slide: step, totalSlides: total } = slide;
  if (slide.mode === "steps") {
    return {
      step,
      total,
      kind: "guide",
      label: `Step ${step} of ${total}`,
      onShown: "explain it",
      nextCall: `call presentSlide for step ${step + 1} of ${total} with mode "steps"`,
      waitsForUser: true,
    };
  }
  return {
    step,
    total,
    kind: "slideshow",
    label: `Slide ${step} of ${total}`,
    onShown: "explain it",
    nextCall: `call presentSlide for slide ${step + 1} of ${total}`,
  };
}

// An identical slide asked for twice (Gemini Live) is shown once.
const repeats = createRepeatGuard();

// With the slideshow's ID: the same slide asked for in a new slideshow is
// drawn again, so that slideshow's record has it.
const slideKey = (
  slideshowId: string,
  { slide, totalSlides, title, imagePrompt }: SlideArgs,
) => JSON.stringify([slideshowId, slide, totalSlides, title, imagePrompt]);

// The slideshow being shown. Slides carry no ID, so a slideshow is known by
// its mode, its length and its first slide's title: slide 1 with another
// title, or another mode or length, starts a new one. Its ID names the file
// the server saves it in (artifacts/slideshows/<id>.json).
let slideshow: {
  id: string;
  mode: SlideMode;
  totalSlides: number;
  firstTitle: string;
  /** The slides shown so far, by number. */
  slides: Map<number, ToolResult>;
  /** The slide on the screen, or being made. */
  current: number;
  /** When the current slide appeared; Infinity while it is being drawn, so
   *  no later step of a guide passes until it has appeared and the user has
   *  spoken. */
  shownAt: number;
} | null = null;

function slideshowFor(slide: SlideArgs) {
  const same =
    slideshow?.mode === slide.mode &&
    slideshow.totalSlides === slide.totalSlides &&
    (slide.slide !== 1 || slideshow.firstTitle === slide.title);
  if (!slideshow || !same) {
    slideshow = {
      id: uuidv4().replace(/-/g, "").slice(0, 12),
      mode: slide.mode,
      totalSlides: slide.totalSlides,
      firstTitle: slide.slide === 1 ? slide.title : "",
      slides: new Map(),
      current: 0,
      shownAt: -Infinity,
    };
  }
  return slideshow;
}

async function presentSlide(
  context: Parameters<ToolPlugin["execute"]>[0],
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const slide = parseSlideArgs(args);
  if (!slide) return { message: SLIDE_ARGS_ERROR };
  const show = slideshowFor(slide);
  const guide = slide.mode === "steps";
  // A guide waits for the user. Gemini Live went on to the next step in the
  // reply that explained the current one, whatever the instructions said
  // (MulmoGlass); the host holds such a step back.
  if (
    guide &&
    slide.slide > show.current &&
    show.current > 0 &&
    !userSpokeSince(show.shownAt)
  ) {
    console.info(`[sequence] holding step ${slide.slide} for the user`);
    const state =
      show.shownAt === Infinity
        ? "is still being drawn"
        : "is still on the screen";
    return {
      // No instructions: they would start another reply, and the status
      // says what to do.
      message: `step ${slide.slide} was not shown: the user hasn't said they're ready yet, and step ${show.current} ${state}. Wait for them before calling presentSlide for step ${slide.slide}.`,
      cancelled: true,
    };
  }
  const earlier = guide ? show.slides.get(slide.slide) : undefined;
  if (earlier) {
    // What is on the screen, not the guide's last step: another tool's
    // result may have replaced it since.
    const current = context.currentResult;
    const onScreen =
      !!current && imageOf(current).imageData === imageOf(earlier).imageData;
    if (onScreen) {
      // It is on the screen; the model explains it again by itself.
      return {
        message: `step ${slide.slide} of ${slide.totalSlides} is already on the screen`,
        cancelled: true,
      };
    }
    // Going back (or forward again): the step as it was, at once.
    show.current = slide.slide;
    show.shownAt = performance.now();
    return {
      ...earlier,
      uuid: undefined,
      message: `step ${slide.slide} of ${slide.totalSlides} is on the screen again, as it was`,
      instructions: slideShownInstructions(slide),
    };
  }
  const key = slideKey(show.id, slide);
  if (await repeats.alreadyShown(key)) {
    // Not shown again, and no instructions: the model goes on by itself.
    return {
      message: `slide ${slide.slide} of ${slide.totalSlides} is already on the screen`,
      cancelled: true,
    };
  }
  const settle = repeats.begin(key);
  // Pending while it is drawn: a later step asked for meanwhile is held.
  const before = { current: show.current, shownAt: show.shownAt };
  show.current = slide.slide;
  show.shownAt = Infinity;
  const previousSlide = guide ? show.slides.get(slide.slide - 1) : undefined;
  const previousImagePath = previousSlide && imageOf(previousSlide).imagePath;
  const config: SlideRequestConfig = {
    slideshowId: show.id,
    ...(previousImagePath && { previousImagePath }),
  };
  let shown = false;
  try {
    const image = await postToServer(PRESENT_SLIDE, args, {
      ...imageSettingsOf(context),
      ...config,
    });
    shown = !!imageOf(image).imageData;
    if (shown) {
      show.slides.set(slide.slide, image);
      show.current = slide.slide;
      show.shownAt = performance.now();
    }
    // A failure keeps the image host's message and instructions.
    return image;
  } finally {
    // A failure may be tried again.
    settle(shown);
    if (!shown && show.current === slide.slide) {
      // The slide before it is still the one on the screen.
      show.current = before.current;
      show.shownAt = before.shownAt;
    }
  }
}

const plugin: ToolPlugin = {
  toolDefinition: PRESENT_SLIDE_DEFINITION,
  systemPrompt: PRESENT_SLIDE_PROMPT,
  generatingMessage: "Making the slide...",
  isEnabled: () => true,
  viewComponent: fittedImageView("PresentSlideView"),
  previewComponent: imagePreview("PresentSlidePreview"),
  execute: (context, args) =>
    presentSlide(context, args as Record<string, unknown>),
};

export const PresentSlidePlugin = { plugin };
