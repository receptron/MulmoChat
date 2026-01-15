import { ToolPlugin, ToolContext, ToolResult } from "../types";
import CanvasView from "../views/canvas.vue";
import ImagePreview from "../previews/image.vue";
import type { ImageToolData } from "../utils";

const toolName = "openCanvas";

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Open a drawing canvas for the user to create drawings, sketches, or diagrams.",
  parameters: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

const openCanvas = async (
  __: ToolContext,
): Promise<ToolResult<ImageToolData>> => {
  return {
    message: "Drawing canvas opened",
    instructions:
      "Tell the user that you are able to turn the drawing into a photographic image, a manga or any other art style.",
    title: "Drawing Canvas",
  };
};

export const plugin: ToolPlugin = {
  toolDefinition,
  execute: openCanvas,
  generatingMessage: "Opening drawing canvas...",
  isEnabled: () => true,
  viewComponent: CanvasView,
  previewComponent: ImagePreview,
  systemPrompt: `When the user asks 'I want to drawn an image.', call ${toolName} API to open the canvas.`,
};
