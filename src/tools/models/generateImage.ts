import { ToolPlugin, ToolContext, ToolResult } from "../types";
import ImageView from "../views/image.vue";
import ImagePreview from "../previews/image.vue";
import ImageGenerationConfig, {
  type ImageGenerationConfigValue,
} from "../configs/ImageGenerationConfig.vue";
import { type ImageToolData } from "../utils";

const toolName = "generateImage";

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description: "Generate an image from a text prompt.",
  parameters: {
    type: "object" as const,
    properties: {
      prompt: {
        type: "string",
        description: "Description of the desired image in English",
      },
    },
    required: ["prompt"],
  },
};

const generateImage = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ToolResult<ImageToolData>> => {
  const prompt = args.prompt as string;
  if (!context.app?.generateImage) {
    return { message: "generateImage function not available" };
  }
  return context.app.generateImage(context, prompt);
};

export function createUploadedImageResult(
  imageData: string,
  fileName: string,
  prompt: string,
): ToolResult<ImageToolData> {
  return {
    toolName,
    data: { imageData, prompt },
    message: "",
    title: fileName,
  };
}

export const plugin: ToolPlugin<ImageToolData> = {
  toolDefinition,
  execute: generateImage,
  generatingMessage: "Generating image...",
  isEnabled: () => true,
  viewComponent: ImageView,
  previewComponent: ImagePreview,
  fileUpload: {
    acceptedTypes: ["image/png", "image/jpeg"],
    handleUpload: createUploadedImageResult as any,
  },
  systemPrompt: `When you are talking about places, objects, people, movies, books and other things, you MUST use the ${toolName} API to draw pictures to make the conversation more engaging.`,
  config: {
    key: "imageGenerationBackend",
    defaultValue: {
      backend: "gemini",
      styleModifier: "",
      geminiModel: "gemini-2.5-flash-image",
      openaiModel: "gpt-image-1",
    } as ImageGenerationConfigValue,
    component: ImageGenerationConfig,
  },
};
