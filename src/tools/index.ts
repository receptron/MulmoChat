import * as GenerateImagePlugin from "./models/generateImage";
import * as EditImagePlugin from "./models/editImage";
import * as CameraPlugin from "./models/camera";
import * as BrowsePlugin from "./models/browse";
import * as MulmocastPlugin from "./models/mulmocast";
import * as MapPlugin from "./models/map";
import * as ExaPlugin from "./models/exa";
import * as OthelloPlugin from "./models/othello";
import * as GoPlugin from "./models/go";
import * as CanvasPlugin from "./models/canvas";
import * as MarkdownPlugin from "./models/markdown";
import * as SpreadsheetPlugin from "./models/spreadsheet";
import * as Present3DPlugin from "./models/present3D";
import * as QuizPlugin from "./models/quiz";
import * as FormPlugin from "./models/form";
import * as MusicPlugin from "./models/music";
// import * as HtmlPlugin from "./models/html";
import * as GenerateHtmlPlugin from "./models/generateHtml";
import * as EditHtmlPlugin from "./models/editHtml";
import * as PdfPlugin from "./models/pdf";
import * as TodoPlugin from "./models/todo";
import * as SwitchModePlugin from "./models/switchMode";
import * as TextResponsePlugin from "./models/textResponse";
import * as SetImageStylePlugin from "./models/setImageStyle";
import * as ScrollToAnchorPlugin from "./models/scrollToAnchor";
import type { StartApiResponse } from "../../server/types";
import { v4 as uuidv4 } from "uuid";
import { getMode } from "../config/modes";
import type {
  ToolContext,
  ToolResult,
  ToolResultComplete,
  ToolPlugin,
} from "./types";

export type { ToolContext, ToolResult, ToolResultComplete, ToolPlugin };

const pluginList = [
  GenerateImagePlugin,
  EditImagePlugin,
  CameraPlugin,
  BrowsePlugin,
  MulmocastPlugin,
  MapPlugin,
  ExaPlugin,
  OthelloPlugin,
  GoPlugin,
  CanvasPlugin,
  MarkdownPlugin,
  SpreadsheetPlugin,
  Present3DPlugin,
  QuizPlugin,
  FormPlugin,
  MusicPlugin,
  // HtmlPlugin,
  GenerateHtmlPlugin,
  EditHtmlPlugin,
  PdfPlugin,
  TodoPlugin,
  SwitchModePlugin,
  TextResponsePlugin,
  SetImageStylePlugin,
  ScrollToAnchorPlugin,
];

export const getPluginList = () => pluginList;

/**
 * Gets the list of available plugins for a given mode
 * @param modeId - The current mode ID
 * @returns Array of plugin names available in this mode, or null if all plugins available
 */
export function getAvailablePluginsForMode(modeId: string): string[] | null {
  const mode = getMode(modeId);

  // If mode not found, default to all available
  if (!mode) {
    return null;
  }

  // Customizable mode: all plugins available for user to choose
  if (mode.pluginMode === "customizable") {
    return null;
  }

  // Fixed mode: return the exact list
  if (mode.pluginMode === "fixed") {
    return mode.availablePlugins || [];
  }

  // Fallback: all available
  return null;
}

/**
 * Checks if a plugin is available in the given mode
 * @param pluginName - The name of the plugin
 * @param modeId - The current mode ID
 * @returns true if plugin is available in the mode
 */
export function isPluginAvailableInMode(
  pluginName: string,
  modeId: string,
): boolean {
  const availablePlugins = getAvailablePluginsForMode(modeId);

  // null means all plugins available (customizable mode)
  if (availablePlugins === null) {
    return true;
  }

  // Check if plugin is in the fixed list
  return availablePlugins.includes(pluginName);
}

/**
 * Checks if the current mode allows user customization of plugins
 * @param modeId - The current mode ID
 * @returns true if user can toggle plugins in this mode
 */
export function isModeCustomizable(modeId: string): boolean {
  const mode = getMode(modeId);
  return mode?.pluginMode === "customizable";
}

export const pluginTools = (
  startResponse?: StartApiResponse,
  enabledPlugins?: Record<string, boolean>,
  modeId?: string,
) => {
  return pluginList
    .filter((plugin) => {
      const toolName = plugin.plugin.toolDefinition.name;

      // Server-level: Does plugin have required API credentials?
      if (!plugin.plugin.isEnabled(startResponse)) {
        return false;
      }

      // If no mode specified, default to enabled
      if (!modeId) {
        return enabledPlugins?.[toolName] ?? true;
      }

      // Mode-level filtering
      const availableInMode = isPluginAvailableInMode(toolName, modeId);
      if (!availableInMode) {
        return false;
      }

      // User-level: Only applies to customizable modes
      if (isModeCustomizable(modeId)) {
        return enabledPlugins?.[toolName] ?? true;
      }

      // Fixed mode: plugin is in the list, so it's enabled
      return true;
    })
    .map((plugin) => plugin.plugin.toolDefinition);
};

export const getPluginSystemPrompts = (
  startResponse?: StartApiResponse,
  enabledPlugins?: Record<string, boolean>,
  modeId?: string,
): string => {
  const prompts = pluginList
    .filter((plugin) => {
      const toolName = plugin.plugin.toolDefinition.name;

      // Same filtering logic as pluginTools
      if (!plugin.plugin.isEnabled(startResponse)) {
        return false;
      }

      if (!modeId) {
        return enabledPlugins?.[toolName] ?? true;
      }

      const availableInMode = isPluginAvailableInMode(toolName, modeId);
      if (!availableInMode) {
        return false;
      }

      if (isModeCustomizable(modeId)) {
        return enabledPlugins?.[toolName] ?? true;
      }

      return true;
    })
    .map((plugin) => plugin.plugin.systemPrompt)
    .filter((prompt): prompt is string => !!prompt);

  return prompts.length > 0 ? ` ${prompts.join(" ")}` : "";
};

const plugins = pluginList.reduce(
  (acc, plugin) => {
    acc[plugin.plugin.toolDefinition.name] = plugin.plugin;
    return acc;
  },
  {} as Record<string, ToolPlugin>,
);

export const toolExecute = async (
  context: ToolContext,
  name: string,
  args: Record<string, any>,
): Promise<ToolResultComplete> => {
  console.log(`EXE:${name}\n`, args);
  const plugin = plugins[name];
  if (!plugin) {
    throw new Error(`Plugin ${name} not found`);
  }
  const result = await plugin.execute(context, args);
  return {
    ...result,
    toolName: result.toolName ?? name,
    uuid: result.uuid || uuidv4(),
  };
};

export const getToolPlugin = (name: string) => {
  return plugins[name] || null;
};

export const getFileUploadPlugins = () => {
  return pluginList
    .filter((plugin) => plugin.plugin.fileUpload)
    .map((plugin) => ({
      toolName: plugin.plugin.toolDefinition.name,
      fileUpload: plugin.plugin.fileUpload!,
    }));
};

export const getAcceptedFileTypes = () => {
  const uploadPlugins = getFileUploadPlugins();
  const allTypes = uploadPlugins.flatMap(
    (plugin) => plugin.fileUpload.acceptedTypes,
  );
  return Array.from(new Set(allTypes));
};

export const getPluginsWithConfig = (modeId?: string) => {
  return pluginList.filter((plugin) => {
    if (!plugin.plugin.config) return false;
    if (!modeId) return true;
    return isPluginAvailableInMode(plugin.plugin.toolDefinition.name, modeId);
  });
};

export const hasAnyPluginConfig = () => {
  return pluginList.some((plugin) => plugin.plugin.config);
};

export const getPluginConfigValue = (
  configs: Record<string, any>,
  toolName: string,
  configKey: string,
): any => {
  const plugin = plugins[toolName];
  if (!plugin?.config || plugin.config.key !== configKey) return undefined;
  return configs[configKey] ?? plugin.config.defaultValue;
};

export const initializePluginConfigs = (): Record<string, any> => {
  const configs: Record<string, any> = {};
  pluginList.forEach((plugin) => {
    if (plugin.plugin.config) {
      configs[plugin.plugin.config.key] = plugin.plugin.config.defaultValue;
    }
  });
  return configs;
};
