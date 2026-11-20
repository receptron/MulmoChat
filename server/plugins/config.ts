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
  // presentBrep. Its script is JavaScript run in this process, unsandboxed
  // (node:vm in the server's own realm): the model can run code on this
  // machine through it.
  "@gui-chat-plugin/brep",
  "@gui-chat-plugin/jinglescript",
  // manageAvatarScript: renders video with headless Chrome (puppeteer) and ffmpeg
  "@gui-chat-plugin/avatarscript",
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
//     With it the plugin also keeps every render's audio and timing map as
//     jinglescript/<stem>.mp3 and .timing.json, and tells the model the paths.
//   - manageAvatarScript, files.byPath: sing reads those two files by the
//     paths the model passes on, and every video that is made is kept as
//     avatarscript/<stem>.mp4. Without it the plugin refuses to sing.
//   - manageAvatarScript, liveAvatar: every View has a runtime here, so the
//     avatar performs in the View itself (the mesh engine in the browser) and
//     the call answers at once with nothing rendered. The View asks this
//     server for the avatar when it is shown, and for a video only when the
//     user presses Download, through its dispatch (answered by the same
//     execute()).
export const PLUGIN_EXTRA_CONTEXT: Readonly<
  Record<string, Readonly<Record<string, unknown>>>
> = {
  manageJingleScript: {
    deferredAudio: true,
    files: { artifacts: artifactsFileOps, byPath: workspaceFileOps },
  },
  manageAvatarScript: {
    liveAvatar: true,
    files: { artifacts: artifactsFileOps, byPath: workspaceFileOps },
  },
};
