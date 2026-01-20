/**
 * Shared image generation functions used across multiple plugins
 */

import type { ToolContext, ToolResult } from "gui-chat-protocol/vue";
import type { ImageToolData } from "../utils/imageTypes";
import type { ImageGenerationConfigValue } from "./types";
import { getRawPluginConfig } from "./config";

type ImageBackend = "gemini" | "openai" | "comfyui";

export type NormalizedImageConfig = Required<ImageGenerationConfigValue>;

const IMAGE_CONFIG_KEY = "imageGenerationBackend";

export function getRawImageConfig(context?: ToolContext) {
  return getRawPluginConfig(context, IMAGE_CONFIG_KEY);
}

export function normalizeImageConfig(
  config: string | ImageGenerationConfigValue | undefined,
): NormalizedImageConfig {
  if (typeof config === "string") {
    return {
      backend: config as ImageBackend,
      styleModifier: "",
      geminiModel: "gemini-2.5-flash-image",
      openaiModel: "gpt-image-1",
    };
  }
  return {
    backend: config?.backend || "gemini",
    styleModifier: config?.styleModifier || "",
    geminiModel: config?.geminiModel || "gemini-2.5-flash-image",
    openaiModel: config?.openaiModel || "gpt-image-1",
  };
}

function getImageGenerationEndpoint(backend: ImageBackend): string {
  if (backend === "comfyui") {
    return "/api/generate-image/comfy";
  }
  if (backend === "openai") {
    return "/api/generate-image/openai";
  }
  return "/api/generate-image";
}

export interface ImageGenerationOptions {
  config: NormalizedImageConfig;
  comfyuiModel?: string;
}

/**
 * Shared function to generate images with backend selection support.
 * Can be used by any plugin that needs image generation.
 *
 * @param prompt - The image generation prompt
 * @param images - Array of base64 image strings (without data URL prefix)
 * @param options - Config and optional settings
 * @returns Normalized response with success status and imageData
 */
export async function generateImageWithBackend(
  prompt: string,
  images: string[],
  options: ImageGenerationOptions,
): Promise<{ success: boolean; imageData?: string; message?: string }> {
  try {
    const { config, comfyuiModel } = options;

    const finalPrompt = config.styleModifier.trim()
      ? `${prompt}, ${config.styleModifier}`
      : prompt;

    const endpoint = getImageGenerationEndpoint(config.backend);

    const requestBody: Record<string, unknown> = {
      prompt: finalPrompt,
      images,
    };

    if (config.backend === "gemini") {
      requestBody.model = config.geminiModel;
    } else if (config.backend === "openai") {
      requestBody.model = config.openaiModel;
    } else if (config.backend === "comfyui") {
      requestBody.model = comfyuiModel || "flux1-schnell-fp8.safetensors";
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
      config.backend === "comfyui" &&
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

export interface ImageGenerationContext {
  currentImageData?: string; // base64 with data URL prefix
  options: ImageGenerationOptions;
}

export async function generateImageCommon(
  imageContext: ImageGenerationContext,
  prompt: string,
  isEditImage: boolean,
): Promise<ToolResult<ImageToolData>> {
  try {
    // Prepare images array for the shared function
    const images =
      isEditImage && imageContext.currentImageData
        ? [
            imageContext.currentImageData.replace(
              /^data:image\/[^;]+;base64,/,
              "",
            ),
          ]
        : [];

    const result = await generateImageWithBackend(
      prompt,
      images,
      imageContext.options,
    );

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

export async function generateImage(
  imageContext: ImageGenerationContext,
  prompt: string,
): Promise<ToolResult<ImageToolData>> {
  return generateImageCommon(imageContext, prompt, false);
}

export async function editImage(
  imageContext: ImageGenerationContext,
  prompt: string,
): Promise<ToolResult<ImageToolData>> {
  return generateImageCommon(imageContext, prompt, true);
}
