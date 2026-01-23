import type { StartApiResponse } from "../../server/types";
import type {
  BackendType,
  FileInputHandler,
  ClipboardImageInputHandler,
} from "gui-chat-protocol/vue";
import { v4 as uuidv4 } from "uuid";
import { getRole, ROLES } from "../config/roles";
import type { ToolPlugin, ToolExecuteFn, GetToolPluginFn } from "./types";
import { createToolDefinition as createSwitchRoleToolDefinition } from "@gui-chat-plugin/switch-role/vue";

// External plugins from npm packages
import QuizPlugin from "@mulmochat-plugin/quiz/vue";
import GenerateImagePlugin from "@mulmochat-plugin/generate-image/vue";
import FormPlugin from "@mulmochat-plugin/form/vue";
import SummarizePdfPlugin from "@mulmochat-plugin/summarize-pdf/vue";
import SpreadsheetPlugin from "@gui-chat-plugin/spreadsheet/vue";
import TodoPlugin from "@gui-chat-plugin/todo/vue";
import TextResponsePlugin from "@gui-chat-plugin/text-response/vue";
import OthelloPlugin from "@gui-chat-plugin/othello/vue";
import TicTacToePlugin from "@gui-chat-plugin/tictactoe/vue";
import GoPlugin from "@gui-chat-plugin/go/vue";
import WeatherPlugin from "@gui-chat-plugin/weather/vue";
import MusicPlugin from "@gui-chat-plugin/music/vue";
import BrowsePlugin from "@gui-chat-plugin/browse/vue";
import MapPlugin from "@gui-chat-plugin/map/vue";
import ExaPlugin from "@gui-chat-plugin/exa/vue";
import MarkdownPlugin from "@gui-chat-plugin/markdown/vue";
import EditImagePlugin from "@gui-chat-plugin/edit-image/vue";
import MulmocastPlugin from "@gui-chat-plugin/mulmocast/vue";
import Present3DPlugin from "@gui-chat-plugin/present3d/vue";
import CameraPlugin from "@gui-chat-plugin/camera/vue";
import CanvasPlugin from "@gui-chat-plugin/canvas/vue";
import HtmlPlugin from "@gui-chat-plugin/html/vue";
import GenerateHtmlPlugin from "@gui-chat-plugin/generate-html/vue";
import EditHtmlPlugin from "@gui-chat-plugin/edit-html/vue";
import SwitchRolePlugin from "@gui-chat-plugin/switch-role/vue";
import SetImageStylePlugin from "@gui-chat-plugin/set-image-style/vue";
import ScrollToAnchorPlugin from "@gui-chat-plugin/scroll-to-anchor/vue";
import AkinatorPlugin from "guichat-plugin-akinator/vue";

const pluginList = [
  // External plugins from npm packages
  QuizPlugin,
  GenerateImagePlugin,
  FormPlugin,
  SummarizePdfPlugin,
  SpreadsheetPlugin,
  TodoPlugin,
  TextResponsePlugin,
  OthelloPlugin,
  TicTacToePlugin,
  GoPlugin,
  WeatherPlugin,
  MusicPlugin,
  BrowsePlugin,
  MapPlugin,
  ExaPlugin,
  MarkdownPlugin,
  EditImagePlugin,
  MulmocastPlugin,
  Present3DPlugin,
  CameraPlugin,
  CanvasPlugin,
  HtmlPlugin,
  GenerateHtmlPlugin,
  EditHtmlPlugin,
  SwitchRolePlugin,
  SetImageStylePlugin,
  ScrollToAnchorPlugin,
  AkinatorPlugin,
];

export const getPluginList = () => pluginList;

/**
 * Gets the list of available plugins for a given role
 * @param roleId - The current role ID
 * @returns Array of plugin names available in this role, or null if all plugins available
 */
export function getAvailablePluginsForRole(roleId: string): string[] | null {
  const role = getRole(roleId);

  // If role not found, default to all available
  if (!role) {
    return null;
  }

  // Customizable role: all plugins available for user to choose
  if (role.pluginMode === "customizable") {
    return null;
  }

  // Fixed role: return the exact list
  if (role.pluginMode === "fixed") {
    return role.availablePlugins || [];
  }

  // Fallback: all available
  return null;
}

/**
 * Checks if a plugin is available in the given role
 * @param pluginName - The name of the plugin
 * @param roleId - The current role ID
 * @returns true if plugin is available in the role
 */
export function isPluginAvailableInRole(
  pluginName: string,
  roleId: string,
): boolean {
  const availablePlugins = getAvailablePluginsForRole(roleId);

  // null means all plugins available (customizable role)
  if (availablePlugins === null) {
    return true;
  }

  // Check if plugin is in the fixed list
  return availablePlugins.includes(pluginName);
}

/**
 * Checks if the current role allows user customization of plugins
 * @param roleId - The current role ID
 * @returns true if user can toggle plugins in this role
 */
export function isRoleCustomizable(roleId: string): boolean {
  const role = getRole(roleId);
  return role?.pluginMode === "customizable";
}

// Pre-compute switchRole tool definition with app roles
const switchRoleToolDefinition = createSwitchRoleToolDefinition(
  ROLES.map((r) => ({ id: r.id, name: r.name })),
);

export const pluginTools = (
  startResponse?: StartApiResponse | null,
  enabledPlugins?: Record<string, boolean>,
  roleId?: string,
) => {
  return pluginList
    .filter((plugin) => {
      const toolName = plugin.plugin.toolDefinition.name;

      // Server-level: Does plugin have required API credentials?
      if (!plugin.plugin.isEnabled(startResponse)) {
        return false;
      }

      // If no role specified, default to enabled
      if (!roleId) {
        return enabledPlugins?.[toolName] ?? true;
      }

      // Role-level filtering
      const availableInRole = isPluginAvailableInRole(toolName, roleId);
      if (!availableInRole) {
        return false;
      }

      // User-level: Only applies to customizable roles
      if (isRoleCustomizable(roleId)) {
        return enabledPlugins?.[toolName] ?? true;
      }

      // Fixed role: plugin is in the list, so it's enabled
      return true;
    })
    .map((plugin) => {
      // Use dynamic tool definition for switchRole with app roles
      if (plugin.plugin.toolDefinition.name === "switchRole") {
        return switchRoleToolDefinition;
      }
      return plugin.plugin.toolDefinition;
    });
};

export const getPluginSystemPrompts = (
  startResponse?: StartApiResponse | null,
  enabledPlugins?: Record<string, boolean>,
  roleId?: string,
): string => {
  const prompts = pluginList
    .filter((plugin) => {
      const toolName = plugin.plugin.toolDefinition.name;

      // Same filtering logic as pluginTools
      if (!plugin.plugin.isEnabled(startResponse)) {
        return false;
      }

      if (!roleId) {
        return enabledPlugins?.[toolName] ?? true;
      }

      const availableInRole = isPluginAvailableInRole(toolName, roleId);
      if (!availableInRole) {
        return false;
      }

      if (isRoleCustomizable(roleId)) {
        return enabledPlugins?.[toolName] ?? true;
      }

      return true;
    })
    .map((plugin) => plugin.plugin.systemPrompt)
    .filter((prompt): prompt is string => !!prompt);

  return prompts.length > 0 ? ` ${prompts.join("\n")}` : "";
};

const plugins = pluginList.reduce(
  (acc, plugin) => {
    acc[plugin.plugin.toolDefinition.name] = plugin.plugin as ToolPlugin<
      unknown,
      unknown,
      object
    >;
    return acc;
  },
  {} as Record<string, ToolPlugin<unknown, unknown, object>>,
);

export const toolExecute: ToolExecuteFn = async (context, name, args) => {
  console.log(`EXE:${name}\n`, args);
  const plugin = plugins[name];
  if (!plugin) {
    throw new Error(`Plugin ${name} not found`);
  }
  const result = await plugin.execute(context, args);

  // When updating existing result, preserve the original UUID to avoid race conditions
  const uuid =
    result.updating && context.currentResult?.uuid
      ? context.currentResult.uuid
      : result.uuid || uuidv4();

  return {
    ...result,
    toolName: result.toolName ?? name,
    uuid,
  };
};

export const getToolPlugin: GetToolPluginFn = (name) => {
  return plugins[name] || null;
};

/**
 * Gets plugins that have file input handlers
 */
export const getFileInputPlugins = () => {
  return pluginList
    .filter((plugin) =>
      plugin.plugin.inputHandlers?.some((h) => h.type === "file"),
    )
    .map((plugin) => {
      const fileHandler = plugin.plugin.inputHandlers!.find(
        (h) => h.type === "file",
      )!;
      return {
        toolName: plugin.plugin.toolDefinition.name,
        handler: fileHandler as FileInputHandler,
      };
    });
};

/**
 * Gets plugins that have clipboard-image input handlers
 */
export const getClipboardImagePlugins = () => {
  return pluginList
    .filter((plugin) =>
      plugin.plugin.inputHandlers?.some((h) => h.type === "clipboard-image"),
    )
    .map((plugin) => {
      const handler = plugin.plugin.inputHandlers!.find(
        (h) => h.type === "clipboard-image",
      )!;
      return {
        toolName: plugin.plugin.toolDefinition.name,
        handler: handler as ClipboardImageInputHandler,
      };
    });
};

/**
 * Gets all accepted file types across all plugins with file handlers
 */
export const getAcceptedFileTypes = () => {
  const filePlugins = getFileInputPlugins();
  const allTypes = filePlugins.flatMap(
    (plugin) => plugin.handler.acceptedTypes,
  );
  return Array.from(new Set(allTypes));
};

export const getPluginsWithConfig = (roleId?: string) => {
  return pluginList.filter((plugin) => {
    if (!plugin.plugin?.config?.component) return false;
    if (!roleId) return true;
    return isPluginAvailableInRole(plugin.plugin.toolDefinition.name, roleId);
  });
};

export const hasAnyPluginConfig = () => {
  return pluginList.some((plugin) => plugin.plugin.config?.component);
};

export const getPluginConfigValue = (
  configs: Record<string, unknown>,
  toolName: string,
  configKey: string,
): unknown => {
  const plugin = plugins[toolName];
  if (!plugin?.config || plugin.config.key !== configKey) return undefined;
  return configs[configKey] ?? plugin.config.defaultValue;
};

export const initializePluginConfigs = (): Record<string, unknown> => {
  const configs: Record<string, unknown> = {};
  pluginList.forEach((plugin) => {
    if (plugin.plugin.config) {
      configs[plugin.plugin.config.key] = plugin.plugin.config.defaultValue;
    }
  });
  return configs;
};

/**
 * Gets the set of backend types used by enabled plugins
 * Used to show only relevant backend settings in the UI
 * Note: Unlike pluginTools, this does NOT check isEnabled() because we want to show
 * backend settings even when API keys are not configured yet.
 */
export const getEnabledBackends = (
  enabledPlugins?: Record<string, boolean>,
  roleId?: string,
): Set<BackendType> => {
  const backends = new Set<BackendType>();

  pluginList.forEach((plugin) => {
    const toolName = plugin.plugin.toolDefinition.name;

    if (roleId) {
      const availableInRole = isPluginAvailableInRole(toolName, roleId);
      if (!availableInRole) {
        return;
      }

      if (isRoleCustomizable(roleId)) {
        if (!(enabledPlugins?.[toolName] ?? true)) {
          return;
        }
      }
    } else {
      if (!(enabledPlugins?.[toolName] ?? true)) {
        return;
      }
    }

    // Add backends from this plugin
    const pluginBackends = (plugin.plugin as ToolPlugin).backends;
    if (pluginBackends) {
      pluginBackends.forEach((backend: BackendType) => backends.add(backend));
    }
  });

  return backends;
};
