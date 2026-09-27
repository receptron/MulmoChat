// Host backends handed to server-run plugins as gui-chat-protocol's
// ToolContext.app. Built per request from the settings the browser sends
// (the image backend, models and style are per-user browser preferences).
import type { ToolContextApp, ToolResult } from "gui-chat-protocol";
import { generateGeminiImage, generateOpenAIImage } from "../routes/image";
import { generateComfyImage } from "../routes/comfyui";
import { logger } from "../utils/logger";
import { createMarkdownHostApp } from "./markdownHost";
import { loadSourceImages, saveGeneratedImage } from "./imageStore";
import { toInputImage, type InputImage } from "../utils/imageMime";
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
// `images` are input images (data URLs); ComfyUI's workflow takes none.
async function runImageBackend(
  prompt: string,
  settings: ImageGenerationSettings,
  images: string[],
): Promise<{ imageData?: string; message?: string }> {
  switch (settings.backend) {
    case "openai":
      return generateOpenAIImage({
        prompt,
        images,
        model: settings.openaiModel,
      });
    case "comfyui": {
      const result = await generateComfyImage({
        prompt,
        model: settings.comfyuiModel,
      });
      return { imageData: result.images[0] };
    }
    default:
      return generateGeminiImage({
        prompt,
        images,
        model: settings.geminiModel,
      });
  }
}

/**
 * gui-chat-protocol ToolContext.app.generateImage contract: (prompt) -> ToolResult,
 * and editImages', with its input images. Same result shape as the browser's
 * generateImageCommon, with the image as a data URL so the existing ImageView
 * renders it unchanged. The image is also saved (./imageStore.ts), and the
 * result says where (`data.imagePath`, "saved to …"), so a later call can
 * refer to it.
 */
async function generateImage(
  prompt: string,
  settings: ImageGenerationSettings,
  inputImages: InputImage[] = [],
): Promise<ToolResult> {
  const finalPrompt = settings.styleModifier.trim()
    ? `${prompt}, ${settings.styleModifier}`
    : prompt;
  // ComfyUI draws from the prompt alone; say so rather than pretend.
  const ignoredInputs =
    inputImages.length > 0 && settings.backend === "comfyui"
      ? "; ComfyUI takes no input images, so it was made from the prompt alone"
      : "";
  try {
    const { imageData, message } = await runImageBackend(
      finalPrompt,
      settings,
      inputImages.map(
        ({ mimeType, data }) => `data:${mimeType};base64,${data}`,
      ),
    );
    if (imageData) {
      const { mimeType } = toInputImage(imageData);
      const imagePath = await saveGeneratedImage(imageData);
      const savedTo = imagePath ? `; saved to ${imagePath}` : "";
      return {
        data: {
          imageData: `data:${mimeType};base64,${imageData}`,
          prompt,
          ...(imagePath && { imagePath }),
        },
        message: `image generation succeeded${savedTo}${ignoredInputs}`,
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

/**
 * context.app.editImages: (prompt, imagePaths) -> ToolResult. A new image from
 * saved images (artifacts/images/…, at most 8) and a prompt: one image to
 * restyle, or references such as character sheets to draw with. The same
 * arguments as MulmoClaude's editImages tool and /api/edit-image, which
 * sends Gemini only; here every backend but ComfyUI takes them. (Not the
 * browser's context.app.editImage(prompt), which edits the selected image for
 * @gui-chat-plugin/edit-image.)
 */
async function editImages(
  prompt: unknown,
  imagePaths: unknown,
  settings: ImageGenerationSettings,
): Promise<ToolResult> {
  if (typeof prompt !== "string" || !prompt.trim()) {
    return { message: "image edit failed: prompt is required" };
  }
  let inputImages: InputImage[];
  try {
    inputImages = await loadSourceImages(imagePaths);
  } catch (error) {
    return {
      message: `image edit failed: ${errorMessageOf(error)}`,
      instructions:
        "Acknowledge that the image edit failed and briefly tell the user the reason.",
    };
  }
  return generateImage(prompt, settings, inputImages);
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
    editImages: (prompt: unknown, imagePaths: unknown) =>
      editImages(prompt, imagePaths, config.imageGeneration),
    // presentDocument: load/save/create documents, PDF export, image fill
    ...createMarkdownHostApp(generate),
  };
}
