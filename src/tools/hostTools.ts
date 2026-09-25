// Tools the server provides itself (server/plugins/dispatch.ts,
// hostToolDefinitions): renderShapeScript and the X tools. Their definitions
// live in Node-only entries or depend on the server's credentials, so the
// server sends them (GET /api/plugin-host-tools) and loadHostToolDefinitions()
// fills them in at startup. A tool the server doesn't send stays disabled.
import type { ToolDefinition } from "gui-chat-protocol/vue";

interface HostTool {
  toolDefinition: ToolDefinition;
  loaded: boolean;
}

const hostTools = new Map<string, HostTool>();

/**
 * A host tool's definition, a placeholder until the server's arrives, and
 * whether it has arrived (the plugin's isEnabled).
 */
export function hostToolDefinition(
  name: string,
  description: string,
): { toolDefinition: ToolDefinition; isLoaded: () => boolean } {
  const tool: HostTool = {
    toolDefinition: {
      type: "function",
      name,
      description,
      parameters: { type: "object", properties: {}, required: [] },
    },
    loaded: false,
  };
  hostTools.set(name, tool);
  return { toolDefinition: tool.toolDefinition, isLoaded: () => tool.loaded };
}

/** Fetch the definitions of the tools the server provides itself. */
export async function loadHostToolDefinitions(): Promise<void> {
  try {
    const response = await fetch("/api/plugin-host-tools");
    if (!response.ok) return;
    const { tools } = (await response.json()) as { tools?: unknown };
    if (!Array.isArray(tools)) return;
    for (const definition of tools) {
      if (typeof definition !== "object" || definition === null) continue;
      const tool = hostTools.get((definition as ToolDefinition).name);
      if (!tool) continue;
      Object.assign(tool.toolDefinition, definition);
      tool.loaded = true;
    }
  } catch (error) {
    console.warn("[host tools] definitions unavailable", error);
  }
}
