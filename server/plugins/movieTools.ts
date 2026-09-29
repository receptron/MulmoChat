// makeMovie: what the browser and the server both need, so it is defined
// once. Browser-safe: src/tools/makeMovie.ts imports it. The slideshows and
// storyboards it makes a movie of come from @gui-chat-plugin/sequence.
import type { ToolDefinition } from "gui-chat-protocol";

const text = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

export const MAKE_MOVIE = "makeMovie";

export interface MovieArgs {
  kind: "storyboard" | "slideshow";
  id: string;
  /** The narration's language; the user's language setting when not given. */
  language?: string;
}

/** The arguments, or what is wrong with them (said to the model). */
export function parseMovieArgs(
  args: Record<string, unknown>,
): MovieArgs | string {
  const storyboardId = text(args.storyboardId);
  const slideshowId = text(args.slideshowId);
  if (!storyboardId === !slideshowId) {
    return "makeMovie needs either a storyboardId or a slideshowId";
  }
  const language = text(args.language);
  return {
    kind: storyboardId ? "storyboard" : "slideshow",
    id: storyboardId || slideshowId,
    ...(language && { language }),
  };
}

export const MAKE_MOVIE_PROMPT =
  "When the user asks for a movie or a video of a story or a slideshow you showed, call makeMovie with its storyboardId or slideshowId (the ID in the result that showed it). It uses the slides and pictures already made and writes the narration itself; the movie takes a few minutes and appears on the screen when it is ready.";

export const MAKE_MOVIE_DEFINITION: ToolDefinition = {
  type: "function",
  name: MAKE_MOVIE,
  description:
    "Make a narrated movie of a storyboard (defineStoryboard, presentPanel) or a slideshow (presentSlide) from the pictures and slides already shown: one scene per panel or slide. Pass exactly one of storyboardId or slideshowId.",
  parameters: {
    type: "object",
    properties: {
      storyboardId: {
        type: "string",
        description: "The storyboard's ID, as defineStoryboard returned it.",
      },
      slideshowId: {
        type: "string",
        description: "The slideshow's ID, as presentSlide's result named it.",
      },
      language: {
        type: "string",
        description:
          'The narration\'s language as a code, such as "en" or "ja": the language you are speaking with the user.',
      },
    },
    required: [],
  },
};
