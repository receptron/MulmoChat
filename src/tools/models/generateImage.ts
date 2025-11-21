import { ToolPlugin, ToolContext, ToolResult } from "../types";
import ImageView from "../views/image.vue";
import ImagePreview from "../previews/image.vue";
import ImageGenerationConfig, {
  type ImageGenerationConfigValue,
} from "../configs/ImageGenerationConfig.vue";

const toolName = "generateImage";

export interface ImageToolData {
  imageData: string;
  prompt: string;
}

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

/**
 * Shared function to generate images with backend selection support.
 * Can be used by any plugin that needs image generation.
 *
 * @param prompt - The image generation prompt
 * @param images - Array of base64 image strings (without data URL prefix)
 * @param context - Optional ToolContext for backend configuration
 * @returns Normalized response with success status and imageData
 */
export async function generateImageWithBackend(
  prompt: string,
  images: string[],
  context?: ToolContext,
): Promise<{ success: boolean; imageData?: string; message?: string }> {
  try {
    // Get config (can be legacy string or new object format)
    const config =
      context?.getPluginConfig?.("imageGenerationBackend") ||
      context?.userPreferences?.pluginConfigs?.["imageGenerationBackend"] ||
      context?.userPreferences?.imageGenerationBackend ||
      "gemini";

    // Handle legacy string format vs new object format
    let backend: "gemini" | "comfyui";
    let styleModifier = "";
    let geminiModel = "gemini-2.5-flash-image";

    if (typeof config === "string") {
      backend = config;
    } else {
      backend = (config as ImageGenerationConfigValue).backend || "gemini";
      styleModifier =
        (config as ImageGenerationConfigValue).styleModifier || "";
      geminiModel =
        (config as ImageGenerationConfigValue).geminiModel ||
        "gemini-2.5-flash-image";
    }

    // Append style modifier to prompt if provided
    const finalPrompt = styleModifier.trim()
      ? `${prompt}, ${styleModifier}`
      : prompt;

    const endpoint =
      backend === "comfyui"
        ? "/api/generate-image/comfy"
        : "/api/generate-image";

    // Get ComfyUI model if using ComfyUI backend
    const comfyuiModel =
      backend === "comfyui"
        ? context?.userPreferences?.comfyuiModel ||
          "flux1-schnell-fp8.safetensors"
        : undefined;

    const requestBody: any = {
      prompt: finalPrompt,
      images,
    };

    // Add model parameter for Gemini
    if (backend === "gemini") {
      requestBody.model = geminiModel;
    }

    // Add model parameter for ComfyUI
    if (backend === "comfyui" && comfyuiModel) {
      requestBody.model = comfyuiModel;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }

    const data = await response.json();

    // Handle ComfyUI response (array of images)
    if (
      backend === "comfyui" &&
      data.success &&
      data.images &&
      data.images.length > 0
    ) {
      return {
        success: true,
        imageData: data.images[0],
      };
    }
    // Handle Gemini response (single image)
    else if (data.success && data.imageData) {
      return {
        success: true,
        imageData: data.imageData,
      };
    } else {
      console.error("ERR:1\n no image data", data);
      return {
        success: false,
        message: data.message || "image generation failed",
      };
    }
  } catch (error) {
    console.error("ERR: exception\n Image generation failed", error);
    return {
      success: false,
      message: "image generation failed",
    };
  }
}

export async function generateImageCommon(
  context: ToolContext,
  prompt: string,
  editImage: boolean,
): Promise<ToolResult<ImageToolData>> {
  try {
    // Prepare images array for the shared function
    const images =
      editImage && context.currentResult?.data?.imageData
        ? [
            context.currentResult.data.imageData.replace(
              /^data:image\/[^;]+;base64,/,
              "",
            ),
          ]
        : [];

    const result = await generateImageWithBackend(prompt, images, context);

    if (result.success && result.imageData) {
      return {
        data: {
          imageData: `data:image/png;base64,${result.imageData}`,
          prompt,
        },
        message: "image generation succeeded",
        instructions:
          "Acknowledge that the image was generated and has been already presented to the user.",
      };
    } else {
      return {
        message: result.message || "image generation failed",
        instructions: "Acknowledge that the image generation failed.",
      };
    }
  } catch (error) {
    console.error("ERR: exception\n Image generation failed", error);
    return {
      message: "image generation failed",
      instructions: "Acknowledge that the image generation failed.",
    };
  }
}

const generateImage = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ToolResult<ImageToolData>> => {
  const prompt = args.prompt as string;
  return generateImageCommon(context, prompt, false);
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
    handleUpload: createUploadedImageResult,
  },
  systemPrompt: `When you are talking about places, objects, people, movies, books and other things, you MUST use the ${toolName} API to draw pictures to make the conversation more engaging.`,
  config: {
    key: "imageGenerationBackend",
    defaultValue: {
      backend: "gemini",
      styleModifier: "",
      geminiModel: "gemini-2.5-flash-image",
    } as ImageGenerationConfigValue,
    component: ImageGenerationConfig,
  },
};
