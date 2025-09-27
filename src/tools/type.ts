import * as GenerateImagePlugin from "./generateImage";
import * as EditImagePlugin from "./editImage";
import * as BrowsePlugin from "./browse";
import * as MulmocastPlugin from "./mulmocast";
import * as MapPlugin from "./map";
import * as ExaPlugin from "./exa";
import * as OthelloPlugin from "./othello";
import * as CanvasPlugin from "./canvas";
import type { StartApiResponse } from "../../server/types";

export interface ToolContext {
  images: string[];
}

export interface ToolResult {
  toolName: string;
  message: string;
  title?: string;
  imageData?: string;
  url?: string;
  jsonData?: any;
  instructions?: string;
  htmlData?: string;
  location?: string | { lat: number; lng: number };
}

export interface ToolPlugin {
  toolDefinition: {
    type: "function";
    name: string;
    description: string;
    parameters?: {
      type: "object";
      properties: {
        [key: string]: any;
      };
      required: string[];
    };
  };
  execute: (
    context: ToolContext,
    args: Record<string, any>,
  ) => Promise<ToolResult>;
  generatingMessage: string;
  waitingMessage?: string;
  isEnabled: (startResponse?: StartApiResponse) => boolean;
  delayAfterExecution?: number;
  viewComponent?: any; // Vue component for rendering results
  previewComponent?: any; // Vue component for sidebar preview
}

const pluginList = [
  GenerateImagePlugin,
  EditImagePlugin,
  BrowsePlugin,
  MulmocastPlugin,
  MapPlugin,
  ExaPlugin,
  OthelloPlugin,
  CanvasPlugin,
];

export const pluginTools = (startResponse?: StartApiResponse) => {
  return pluginList
    .filter((plugin) => plugin.plugin.isEnabled(startResponse))
    .map((plugin) => plugin.plugin.toolDefinition);
};

const plugins = pluginList.reduce(
  (acc, plugin) => {
    acc[plugin.plugin.toolDefinition.name] = plugin.plugin;
    return acc;
  },
  {} as Record<string, ToolPlugin>,
);

export const pluginExecute = (
  context: ToolContext,
  name: string,
  args: Record<string, any>,
) => {
  console.log(`EXE:${name}\n`, args);
  const plugin = plugins[name];
  if (!plugin) {
    throw new Error(`Plugin ${name} not found`);
  }
  return plugin.execute(context, args);
};

export const getPlugin = (name: string) => {
  return plugins[name] || null;
};
