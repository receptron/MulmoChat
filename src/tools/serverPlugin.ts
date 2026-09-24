import type { ToolContext, ToolResult } from "gui-chat-protocol/vue";
import type { ToolPlugin } from "./types";
import { publishFileChanges } from "./pluginRuntime";

/** Per-user settings the server needs to build the plugin's context.app. */
export type ServerPluginConfigBuilder = (
  context: ToolContext,
) => Record<string, unknown>;

const isToolResult = (value: unknown): value is ToolResult =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { message?: unknown }).message === "string";

/**
 * Run a plugin's execute() on the server instead of in the browser.
 * The call is forwarded to POST /api/plugin/:toolName with the tool arguments
 * and the settings from `buildConfig`; the server runs the same package's
 * execute() with server-side host backends (server/plugins/). The plugin's
 * views, input handlers and system prompt are unchanged.
 */
export function runOnServer<T, J, A extends object>(
  plugin: ToolPlugin<T, J, A>,
  buildConfig: ServerPluginConfigBuilder,
): ToolPlugin<T, J, A> {
  const toolName = plugin.toolDefinition.name;
  return {
    ...plugin,
    execute: async (context, args) => {
      const response = await fetch(
        `/api/plugin/${encodeURIComponent(toolName)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ args, config: buildConfig(context) }),
        },
      );
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(
          `Server plugin ${toolName} failed: ${response.status} ${detail}`,
        );
      }
      const result: unknown = await response.json();
      publishFileChanges(response);
      if (!isToolResult(result)) {
        throw new Error(`Server plugin ${toolName} returned an invalid result`);
      }
      return result as ToolResult<T, J>;
    },
  };
}
