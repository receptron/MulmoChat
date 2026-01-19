/**
 * Shared config utilities for plugins
 */

import type { ToolContext } from "gui-chat-protocol/vue";

/**
 * Get raw plugin config from context via app.getConfig
 */
export function getRawPluginConfig(context?: ToolContext, key?: string) {
  if (!key) return undefined;
  return context?.app?.getConfig?.(key);
}
