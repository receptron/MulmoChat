// Host backends handed to server-run plugins as gui-chat-protocol's
// ToolContext.app. Built per request from the settings the browser sends
// (the image backend, models and style are per-user browser preferences).
import type {
  ToolContext,
  ToolContextApp,
  ToolResult,
} from "gui-chat-protocol";
import { generateGeminiImage, generateOpenAIImage } from "../routes/image";
import { generateComfyImage } from "../routes/comfyui";
import { logger } from "../utils/logger";
import { createMarkdownHostApp } from "./markdownHost";
import { loadSourceImages, saveImage } from "./imageStore";
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

/** The image selected on the screen, which editImage edits: its saved path,
 *  or, for one never saved (an upload), its data. */
export interface CurrentImage {
  imagePath?: string;
  imageData?: string;
}

export interface PluginRequestConfig {
  imageGeneration: ImageGenerationSettings;
  currentImage?: CurrentImage;
  /** When the user last spoke (ms since the epoch), for gui-chat-protocol's
   *  ToolContext.userSpokeAt: the sequence tools hold a step that waits for
   *  the user until they have spoken. */
  userSpokeAt?: number;
  /** Which browser tab the call comes from, for gui-chat-protocol's
   *  ToolContext.conversationId: packages that keep state between calls
   *  (the sequence tools) keep it per tab, since tabs share this server. */
  conversationId?: string;
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

function parseCurrentImage(raw: unknown): CurrentImage | undefined {
  if (!isRecord(raw)) return undefined;
  const { imagePath, imageData } = raw;
  if (typeof imagePath === "string" && imagePath) return { imagePath };
  if (typeof imageData === "string" && imageData) return { imageData };
  return undefined;
}

/** Parse the untrusted `config` field of a plugin request. */
export function parsePluginRequestConfig(raw: unknown): PluginRequestConfig {
  const config = isRecord(raw) ? raw : {};
  return {
    imageGeneration: parseImageSettings(config.imageGeneration),
    currentImage: parseCurrentImage(config.currentImage),
    ...(typeof config.userSpokeAt === "number" &&
      Number.isFinite(config.userSpokeAt) && {
        userSpokeAt: config.userSpokeAt,
      }),
    ...(typeof config.conversationId === "string" &&
      CONVERSATION_ID.test(config.conversationId) && {
        conversationId: config.conversationId,
      }),
  };
}

// A tab's ID, as the browser makes it (a UUID); anything else is ignored.
const CONVERSATION_ID = /^[0-9a-zA-Z-]{1,64}$/;

/**
 * The rest of gui-chat-protocol's ToolContext for a server-run plugin, from
 * what the browser sent: `userSpokeAt`, `conversationId` (its tab), and
 * `currentResult` as the picture on the screen, by its saved path only (the
 * sequence tools compare pictures by path, so a step's data doesn't travel
 * back with every call).
 */
export function requestToolContext({
  currentImage,
  userSpokeAt,
  conversationId,
}: PluginRequestConfig): Pick<
  ToolContext,
  "currentResult" | "userSpokeAt" | "conversationId"
> {
  return {
    ...(currentImage?.imagePath && {
      currentResult: {
        message: "",
        data: { imagePath: currentImage.imagePath },
      },
    }),
    ...(userSpokeAt !== undefined && { userSpokeAt }),
    ...(conversationId !== undefined && { conversationId }),
  };
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
      const imagePath = await saveImage(imageData);
      // A failed save (a full disk, say) still shows the picture; the model
      // is told there is no path, so it doesn't look for one.
      const savedTo = imagePath
        ? `; saved to ${imagePath}`
        : "; it could not be saved, so it has no path";
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
 * sends Gemini only; here every backend but ComfyUI takes them.
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

/**
 * context.app.editImage: (prompt) -> ToolResult, for @gui-chat-plugin/edit-image
 * ("edit the previously generated image"). It edits the image selected on the
 * screen from its saved file, and the result is saved too, so an edit of an
 * edit works the same way. A selected image that was never saved (an upload,
 * an older result) is saved first, so the edit still starts from a file.
 */
async function editCurrentImage(
  prompt: unknown,
  current: CurrentImage | undefined,
  settings: ImageGenerationSettings,
): Promise<ToolResult> {
  let imagePath = current?.imagePath;
  if (!imagePath && current?.imageData) {
    imagePath = (await saveImage(toInputImage(current.imageData).data)) ?? "";
    if (!imagePath) {
      return { message: "image edit failed: the image could not be saved" };
    }
  }
  if (!imagePath) {
    return {
      message:
        "image edit failed: no image is selected on the screen; generate or select one first",
    };
  }
  return editImages(prompt, [imagePath], settings);
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
    editImage: (prompt: unknown) =>
      editCurrentImage(prompt, config.currentImage, config.imageGeneration),
    editImages: (prompt: unknown, imagePaths: unknown) =>
      editImages(prompt, imagePaths, config.imageGeneration),
    // presentDocument: load/save/create documents, PDF export, image fill
    ...createMarkdownHostApp(generate),
  };
}
