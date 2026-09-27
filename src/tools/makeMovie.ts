// makeMovie: a narrated movie of a storyboard or a slideshow, from the
// pictures already shown. The server writes the narration and starts the
// movie (server/plugins/movieHost.ts); its result is presentMulmoScript's
// (toolName), so presentMulmoScript's View shows the movie's progress and
// plays it.
import type { ToolPlugin } from "./types";
import { postToServer } from "./serverPlugin";
import { getPluginLocale } from "./pluginRuntime";
import {
  MAKE_MOVIE,
  MAKE_MOVIE_DEFINITION,
  MAKE_MOVIE_PROMPT,
} from "../../server/plugins/sequenceTools";

const plugin: ToolPlugin = {
  toolDefinition: MAKE_MOVIE_DEFINITION,
  systemPrompt: MAKE_MOVIE_PROMPT,
  generatingMessage: "Writing the narration...",
  isEnabled: () => true,
  // The narration's language when the model doesn't name one.
  execute: (_context, args) =>
    postToServer(MAKE_MOVIE, args, { language: getPluginLocale() }),
};

export const MakeMoviePlugin = { plugin };
