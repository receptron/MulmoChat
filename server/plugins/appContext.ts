// Host backends handed to server-run plugins as gui-chat-protocol's
// ToolContext.app. Built per request from the settings the browser sends
// (the image backend, models and style are per-user browser preferences).
import type { ToolContextApp, ToolResult } from "gui-chat-protocol";
import { generateGeminiImage, generateOpenAIImage } from "../routes/image";
import { generateComfyImage } from "../routes/comfyui";
import { logger } from "../utils/logger";
import { createMarkdownHostApp } from "./markdownHost";
import {
  DEFAULT_GEMINI_IMAGE_MODEL,
  DEFAULT_OPENAI_IMAGE_MODEL,
} from "../utils/imageModelDefaults";
import {
  ImageGenerationError,
  errorMessageOf,
} from "../utils/imageGenerationError";

type ImageBackend = "gemini" | "openai" | "comfyui";

export interface ImageGenerationSettings {
  backend: ImageBackend;
  styleModifier: string;
  geminiModel: string;
  openaiModel: string;
  comfyuiModel: string;
}

export interface PluginRequestConfig {
  imageGeneration: ImageGenerationSettings;
}

const IMAGE_BACKENDS: readonly ImageBackend[] = ["gemini", "openai", "comfyui"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringOr = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim() ? value : fallback;

// Defaults match the browser's normalizeImageConfig (src/tools/backend/imageGeneration.ts).
function parseImageSettings(raw: unknown): ImageGenerationSettings {
  const settings = isRecord(raw) ? raw : {};
  const backend = IMAGE_BACKENDS.find((b) => b === settings.backend);
  return {
    backend: backend ?? "gemini",
    styleModifier:
      typeof settings.styleModifier === "string" ? settings.styleModifier : "",
    geminiModel: stringOr(settings.geminiModel, DEFAULT_GEMINI_IMAGE_MODEL),
    openaiModel: stringOr(settings.openaiModel, DEFAULT_OPENAI_IMAGE_MODEL),
    comfyuiModel: stringOr(
      settings.comfyuiModel,
      "flux1-schnell-fp8.safetensors",
    ),
  };
}

/** Parse the untrusted `config` field of a plugin request. */
export function parsePluginRequestConfig(raw: unknown): PluginRequestConfig {
  const config = isRecord(raw) ? raw : {};
  return { imageGeneration: parseImageSettings(config.imageGeneration) };
}

// Returns the raw base64 image (no data URL prefix) or a failure message.
async function runImageBackend(
  prompt: string,
  settings: ImageGenerationSettings,
): Promise<{ imageData?: string; message?: string }> {
  switch (settings.backend) {
    case "openai":
      return generateOpenAIImage({ prompt, model: settings.openaiModel });
    case "comfyui": {
      const result = await generateComfyImage({
        prompt,
        model: settings.comfyuiModel,
      });
      return { imageData: result.images[0] };
    }
    default:
      return generateGeminiImage({ prompt, model: settings.geminiModel });
  }
}

/**
 * gui-chat-protocol ToolContext.app.generateImage contract: (prompt) -> ToolResult.
 * Same result shape as the browser's generateImageCommon, with the image as a
 * data URL so the existing ImageView renders it unchanged.
 */
async function generateImage(
  prompt: string,
  settings: ImageGenerationSettings,
): Promise<ToolResult> {
  const finalPrompt = settings.styleModifier.trim()
    ? `${prompt}, ${settings.styleModifier}`
    : prompt;
  try {
    const { imageData, message } = await runImageBackend(finalPrompt, settings);
    if (imageData) {
      return {
        data: { imageData: `data:image/png;base64,${imageData}`, prompt },
        message: "image generation succeeded",
        instructions:
          "Acknowledge that the image was generated and has been already presented to the user.",
      };
    }
    return {
      message: message || "image generation failed",
      instructions: "Acknowledge that the image generation failed.",
    };
  } catch (error) {
    // Keep the reason (e.g. a missing API key, or a content-policy rejection in
    // `details`) so the model can tell the user what to fix.
    const reason =
      error instanceof ImageGenerationError && error.details
        ? `${error.message}: ${error.details}`
        : errorMessageOf(error);
    logger.error("Image generation for plugin failed", {
      backend: settings.backend,
      error: reason,
    });
    return {
      message: `image generation failed: ${reason}`,
      instructions:
        "Acknowledge that the image generation failed and briefly tell the user the reason.",
    };
  }
}

export function createAppContext(config: PluginRequestConfig): ToolContextApp {
  const generate = (prompt: string) =>
    generateImage(prompt, config.imageGeneration);
  return {
    // No server-run plugin reads or writes host config yet; settings arrive
    // per request, and user preferences stay owned by the browser.
    getConfig: () => undefined,
    setConfig: () => {},
    generateImage: generate,
    // presentDocument: load/save/create documents, PDF export, image fill
    ...createMarkdownHostApp(generate),
  };
}
