import * as GenerateImagePlugin from "./models/generateImage";
import * as EditImagePlugin from "./models/editImage";
import * as BrowsePlugin from "./models/browse";
import * as MulmocastPlugin from "./models/mulmocast";
import * as MapPlugin from "./models/map";
import * as ExaPlugin from "./models/exa";
import * as OthelloPlugin from "./models/othello";
import * as GoPlugin from "./models/go";
import * as CanvasPlugin from "./models/canvas";
import * as MarkdownPlugin from "./models/markdown";
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
import type { StartApiResponse } from "../../server/types";
import { v4 as uuidv4 } from "uuid";
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
  BrowsePlugin,
  MulmocastPlugin,
  MapPlugin,
  ExaPlugin,
  OthelloPlugin,
  GoPlugin,
  CanvasPlugin,
  MarkdownPlugin,
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
];

export const getPluginList = () => pluginList;

export const pluginTools = (
  startResponse?: StartApiResponse,
  enabledPlugins?: Record<string, boolean>,
) => {
  return pluginList
    .filter((plugin) => {
      const toolName = plugin.plugin.toolDefinition.name;
      // Check if plugin is enabled in user settings (default to true if not set)
      const isEnabledByUser = enabledPlugins?.[toolName] ?? true;
      // Check if plugin is enabled based on API response
      const isEnabledByApi = plugin.plugin.isEnabled(startResponse);
      return isEnabledByUser && isEnabledByApi;
    })
    .map((plugin) => plugin.plugin.toolDefinition);
};

export const getPluginSystemPrompts = (
  startResponse?: StartApiResponse,
  enabledPlugins?: Record<string, boolean>,
): string => {
  const prompts = pluginList
    .filter((plugin) => {
      const toolName = plugin.plugin.toolDefinition.name;
      // Check if plugin is enabled in user settings (default to true if not set)
      const isEnabledByUser = enabledPlugins?.[toolName] ?? true;
      // Check if plugin is enabled based on API response
      const isEnabledByApi = plugin.plugin.isEnabled(startResponse);
      return isEnabledByUser && isEnabledByApi && plugin.plugin.systemPrompt;
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
    toolName: name,
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

export const getPluginsWithConfig = () => {
  return pluginList.filter((plugin) => plugin.plugin.config);
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
