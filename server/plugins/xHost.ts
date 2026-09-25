// readXPost and searchX: X (Twitter) API v2 tools from @mulmoclaude/x-plugin,
// the package MulmoClaude and MulmoTerminal register as MCP tools. It is
// server-only (it reads X_BEARER_TOKEN and has no View), so MulmoChat runs it
// as a host tool: the server sends the definitions (GET /api/plugin-host-tools)
// and runs the calls (POST /api/plugin/:toolName).
//
// Like MulmoClaude's MCP registry (server/agent/mcp-tools/index.ts), a tool is
// offered only when its `requiredEnv` is set. The model gets the package's text
// as the result message, the same text MulmoClaude's agent reads; the View
// shows it too (src/tools/xTools.ts).
//
// Unlike Claude Code's agent loop, MulmoChat's transports give the model a turn
// after a tool only when the result carries instructions (Realtime and Grok
// send response.create with them; the text transport takes a follow-up turn
// for required ones). The package's text has none, since its MCP hosts don't
// need them, so the host adds them here: required, because the posts are what
// the user asked for and the model hasn't read them yet.
import { readXPost, searchX, type XTool } from "@mulmoclaude/x-plugin";
import type { ToolDefinition } from "gui-chat-protocol";

const X_TOOLS: readonly XTool[] = [readXPost, searchX];

// What the model does with each tool's text, success or failure.
const INSTRUCTIONS: Readonly<Record<string, string>> = {
  [readXPost.definition.name]:
    "Tell the user briefly what the X post says and who posted it. If it couldn't be read, tell the user why.",
  [searchX.definition.name]:
    "Give the user a short summary of what the X posts found say. If the search failed or found nothing, tell the user.",
};

const hasRequiredEnv = (tool: XTool): boolean =>
  tool.requiredEnv.every((key) => Boolean(process.env[key]));

const toToolDefinition = (tool: XTool): ToolDefinition => ({
  type: "function",
  name: tool.definition.name,
  description: tool.definition.description,
  prompt: tool.prompt,
  parameters: tool.definition.inputSchema as ToolDefinition["parameters"],
});

/** The X tools whose credentials are set, for GET /api/plugin-host-tools. */
export const xToolDefinitions = (): ToolDefinition[] =>
  X_TOOLS.filter(hasRequiredEnv).map(toToolDefinition);

/** What the View shows: the call's arguments and the package's text. */
export interface XToolData {
  url?: string;
  query?: string;
  text: string;
}

const run =
  (tool: XTool) =>
  async (args: Record<string, unknown>): Promise<unknown> => {
    // The package turns API and network failures into text for the model.
    const text = await tool.handler(args);
    const data: XToolData = {
      url: typeof args.url === "string" ? args.url : undefined,
      query: typeof args.query === "string" ? args.query : undefined,
      text,
    };
    return {
      message: text,
      data,
      instructions: INSTRUCTIONS[tool.definition.name],
      instructionsRequired: true,
    };
  };

/** pluginHostHandlers entries (server/plugins/dispatch.ts). */
export const xToolHandlers = Object.fromEntries(
  X_TOOLS.map((tool) => [tool.definition.name, { execute: run(tool) }]),
);
