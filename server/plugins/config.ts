import { artifactsFileOps, workspaceFileOps } from "./workspace.js";

// gui-chat-protocol plugin packages whose execute() runs on the server.
// The browser forwards these tools' calls to POST /api/plugin/:toolName
// (see src/tools/serverPlugin.ts).
export const PLUGIN_PACKAGES: readonly string[] = [
  "@mulmochat-plugin/generate-image",
  "@gui-chat-plugin/edit-image",
  "@mulmoclaude/chart-plugin",
  "@mulmoclaude/markdown-plugin",
  "@mulmoclaude/html-plugin",
  "@gui-chat-plugin/shapescript",
  "@gui-chat-plugin/jinglescript",
  // manageKenteiScript; the package has no "." export, only subpaths
  "kenteiscript/plugin",
  "@mulmoclaude/mulmoscript-plugin",
  // presentSlide, defineStoryboard, presentPanel (one core per tool)
  "@gui-chat-plugin/sequence",
];

// What a plugin's execute() gets in its context beyond the protocol's, by tool
// name: capabilities this host turns on for that plugin.
//   - manageJingleScript, deferredAudio: every View has a runtime here
//     (src/tools/index.ts wraps them all), so a render that takes more than a
//     moment answers at once with a card that shows the score, and the View
//     collects the audio through its dispatch (POST /api/plugin/manageJingleScript
//     with { kind: "collectRenderedAudio" }, answered by the same execute()).
//   - manageJingleScript, files.byPath: a score may be given as `path`, a
//     .json file in the workspace (e.g. one MulmoClaude or MulmoTerminal
//     wrote), read through the same rooted FileOps as presentDocument's
//     documents. `files` replaces the protocol's, so artifacts stays in it.
export const PLUGIN_EXTRA_CONTEXT: Readonly<
  Record<string, Readonly<Record<string, unknown>>>
> = {
  manageJingleScript: {
    deferredAudio: true,
    files: { artifacts: artifactsFileOps, byPath: workspaceFileOps },
  },
};
