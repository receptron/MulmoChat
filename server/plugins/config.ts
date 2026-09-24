// gui-chat-protocol plugin packages whose execute() runs on the server.
// The browser forwards these tools' calls to POST /api/plugin/:toolName
// (see src/tools/serverPlugin.ts).
export const PLUGIN_PACKAGES: readonly string[] = [
  "@mulmochat-plugin/generate-image",
  "@mulmoclaude/chart-plugin",
];
