import { ToolPlugin, ToolContext, ToolResult } from "../types";
import { generateImageCommon, ImageToolData } from "./generateImage";
import ImageView from "../views/image.vue";
import ImagePreview from "../previews/image.vue";

const toolName = "editImage";

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description: "Edit the previously generated image based on a text prompt.",
  systemPrompt:
    `When the user asks 'turn this image into ...', call ${toolName} API to generate a new image.`,
  parameters: {
    type: "object" as const,
    properties: {
      prompt: {
        type: "string",
        description:
          "Description of the edits to be made to the image in English",
      },
    },
    required: ["prompt"],
  },
};

const editImage = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ToolResult<ImageToolData>> => {
  const prompt = args.prompt as string;
  return generateImageCommon(context, prompt, true);
};

export const plugin: ToolPlugin<ImageToolData> = {
  toolDefinition,
  execute: editImage,
  generatingMessage: "Editing image...",
  isEnabled: () => true,
  viewComponent: ImageView,
  previewComponent: ImagePreview,
};
