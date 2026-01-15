/**
 * Shared image generation functions used across multiple plugins
 */

import type { ToolContext, ToolResult } from "../types";
import type { ImageToolData } from "./imageTypes";
import type { ImageGenerationConfigValue } from "../configs/ImageGenerationConfig.vue";

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
    let backend: "gemini" | "openai" | "comfyui";
    let styleModifier = "";
    let geminiModel = "gemini-2.5-flash-image";
    let openaiModel = "gpt-image-1";

    if (typeof config === "string") {
      backend = config as typeof backend;
    } else {
      const typedConfig = config as ImageGenerationConfigValue;
      backend = typedConfig.backend || "gemini";
      styleModifier = typedConfig.styleModifier || "";
      geminiModel = typedConfig.geminiModel || "gemini-2.5-flash-image";
      openaiModel = typedConfig.openaiModel || "gpt-image-1";
    }

    // Append style modifier to prompt if provided
    const finalPrompt = styleModifier.trim()
      ? `${prompt}, ${styleModifier}`
      : prompt;

    const endpoint =
      backend === "comfyui"
        ? "/api/generate-image/comfy"
        : backend === "openai"
          ? "/api/generate-image/openai"
          : "/api/generate-image";

    // Get ComfyUI model if using ComfyUI backend
    const comfyuiModel =
      backend === "comfyui"
        ? context?.userPreferences?.comfyuiModel ||
          "flux1-schnell-fp8.safetensors"
        : undefined;

    const requestBody: Record<string, unknown> = {
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

    // Add model parameter for OpenAI
    if (backend === "openai") {
      requestBody.model = openaiModel;
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
    // Handle Gemini/OpenAI response (single image)
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
    const currentImageData = context.currentResult?.data as
      | ImageToolData
      | undefined;
    const images =
      editImage && currentImageData?.imageData
        ? [currentImageData.imageData.replace(/^data:image\/[^;]+;base64,/, "")]
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
