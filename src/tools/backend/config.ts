/**
 * Shared config utilities for plugins
 */

import type { ToolContext } from "../types";

/**
 * Get raw plugin config from context with fallback chain:
 * 1. getPluginConfig(key) - preferred method
 * 2. userPreferences.pluginConfigs[key] - direct access
 * 3. userPreferences[key] - legacy format
 */
export function getRawPluginConfig(context?: ToolContext, key?: string) {
  if (!key) return undefined;
  return (
    context?.getPluginConfig?.(key) ||
    context?.userPreferences?.pluginConfigs?.[key] ||
    context?.userPreferences?.[key]
  );
}
