import { ToolPlugin, ToolContext, ToolResult } from "./type";
import CanvasView from "./views/canvas.vue";
import ImagePreview from "./previews/image.vue";

const toolName = "openCanvas";

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Open a drawing canvas for the user to create drawings, sketches, or diagrams.",
};

const openCanvas = async (__: ToolContext): Promise<ToolResult> => {
  return {
    toolName,
    message: "Drawing canvas opened",
    instructions:
      "Tell the user that you are able to turn the drawing into a photographic image, a manga or any other art style.",
    title: "Drawing Canvas",
    jsonData: {
      drawingState: null,
    },
  };
};

export const plugin: ToolPlugin = {
  toolDefinition,
  execute: openCanvas,
  generatingMessage: "Opening drawing canvas...",
  isEnabled: () => true,
  viewComponent: CanvasView,
  previewComponent: ImagePreview,
};
