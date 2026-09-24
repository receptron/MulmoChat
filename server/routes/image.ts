import express, { Request, Response, Router } from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import OpenAI, { toFile } from "openai";
import { Buffer } from "node:buffer";
import { sendApiError, logApiRequest } from "../utils/logger";
import {
  ImageGenerationError,
  errorMessageOf,
} from "../utils/imageGenerationError";
dotenv.config({ quiet: true });

const router: Router = express.Router();

export interface GeminiImageResult {
  success: boolean;
  message: string | undefined;
  imageData: string | undefined;
}

export interface OpenAIImageResult {
  success: true;
  imageData: string;
  message: string | undefined;
}

interface ImageRequest {
  prompt: string;
  images?: string[];
  model?: string;
}

/**
 * Generate (or edit, when images are given) an image with Gemini.
 * Throws ImageGenerationError for configuration errors; other errors propagate.
 */
export async function generateGeminiImage({
  prompt,
  images,
  model,
}: ImageRequest): Promise<GeminiImageResult> {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    throw new ImageGenerationError(
      500,
      "GEMINI_API_KEY environment variable not set",
    );
  }

  const ai = new GoogleGenAI({ apiKey: geminiKey });
  const modelName = model || "gemini-2.5-flash-image";

  // Log API call with backend settings
  logApiRequest("generate-image", {
    path: "/api/generate-image",
    backend: "gemini",
    model: modelName,
  });

  const contents: {
    text?: string;
    inlineData?: { mimeType: string; data: string };
  }[] = [{ text: prompt }];
  for (const image of images ?? []) {
    contents.push({ inlineData: { mimeType: "image/png", data: image } });
  }

  const response = await ai.models.generateContent({
    model: modelName,
    contents,
  });
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  const returnValue: GeminiImageResult = {
    success: false,
    message: undefined,
    imageData: undefined,
  };
  console.log(
    "*** Gemini image generation response parts:",
    parts.length,
    prompt,
  );

  for (const part of parts) {
    if (part.text) {
      console.log("*** Gemini image generation response:", part.text);
      returnValue.message = part.text;
    }
    if (part.inlineData) {
      const imageData = part.inlineData.data;
      if (imageData) {
        console.log("*** Image generation succeeded");
        returnValue.success = true;
        returnValue.imageData = imageData;
      } else {
        console.log("*** the part has inlineData, but no image data", part);
      }
    }
  }
  if (!returnValue.message) {
    returnValue.message = returnValue.imageData
      ? "image generation succeeded"
      : "no image data found in response";
  }
  return returnValue;
}

// Generate image endpoint
router.post(
  "/generate-image",
  async (req: Request, res: Response): Promise<void> => {
    const { prompt, images, model } = req.body;

    if (!prompt) {
      sendApiError(res, req, 400, "Prompt is required");
      return;
    }

    try {
      res.json(await generateGeminiImage({ prompt, images, model }));
    } catch (error: unknown) {
      if (error instanceof ImageGenerationError) {
        sendApiError(res, req, error.status, error.message, error.details);
        return;
      }
      console.error("*** Image generation failed", error);
      sendApiError(
        res,
        req,
        500,
        "Failed to generate image",
        errorMessageOf(error),
      );
    }
  },
);

/**
 * Generate (or edit, when images are given) an image with the OpenAI Images API.
 * Throws ImageGenerationError for configuration and API errors; other errors propagate.
 */
export async function generateOpenAIImage({
  prompt,
  images = [],
  model,
  size = "1024x1024",
}: ImageRequest & { size?: string }): Promise<OpenAIImageResult> {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new ImageGenerationError(
      500,
      "OPENAI_API_KEY environment variable not set",
    );
  }

  const modelName = model || "gpt-image-1";
  // Only DALL-E accepts response_format; GPT Image models always return
  // base64 and reject the parameter
  const shouldIncludeResponseFormat = modelName.startsWith("dall-e");

  // Log API call with backend settings
  logApiRequest("generate-image/openai", {
    path: "/api/generate-image/openai",
    backend: "openai",
    model: modelName,
  });

  const client = new OpenAI({ apiKey: openaiKey });
  const hasEditImage = Array.isArray(images) && images.length > 0;
  const responseFormat = shouldIncludeResponseFormat
    ? { response_format: "b64_json" as const }
    : {};

  let data: OpenAI.Images.ImagesResponse;
  try {
    data = hasEditImage
      ? await client.images.edit({
          model: modelName,
          prompt,
          size,
          image: await toFile(Buffer.from(images[0], "base64"), "image.png", {
            type: "image/png",
          }),
          ...responseFormat,
        })
      : await client.images.generate({
          model: modelName,
          prompt,
          size,
          ...responseFormat,
        });
  } catch (error: unknown) {
    if (error instanceof OpenAI.APIError) {
      console.error("*** OpenAI image generation failed", error.message);
      throw new ImageGenerationError(
        error.status ?? 500,
        "Failed to generate image with OpenAI",
        error.message,
      );
    }
    throw error;
  }

  let imageData = data.data?.[0]?.b64_json;
  const firstItem = data.data?.[0];

  if (!imageData && firstItem?.url) {
    try {
      const imageResponse = await fetch(firstItem.url);
      if (!imageResponse.ok) {
        throw new Error(
          `Failed to fetch image URL: ${imageResponse.status} ${imageResponse.statusText}`,
        );
      }
      const arrayBuffer = await imageResponse.arrayBuffer();
      imageData = Buffer.from(arrayBuffer).toString("base64");
    } catch (fetchError) {
      console.error("*** Failed to download image URL", fetchError);
      throw new ImageGenerationError(
        500,
        "Failed to download image provided by OpenAI",
        errorMessageOf(fetchError),
      );
    }
  }

  if (!imageData) {
    throw new ImageGenerationError(500, "No image data returned from OpenAI");
  }

  return {
    success: true,
    imageData,
    message: firstItem?.revised_prompt,
  };
}

// OpenAI image generation endpoint
router.post(
  "/generate-image/openai",
  async (req: Request, res: Response): Promise<void> => {
    const { prompt, images, model, size } = req.body;

    if (!prompt) {
      sendApiError(res, req, 400, "Prompt is required");
      return;
    }

    try {
      res.json(await generateOpenAIImage({ prompt, images, model, size }));
    } catch (error: unknown) {
      if (error instanceof ImageGenerationError) {
        sendApiError(res, req, error.status, error.message, error.details);
        return;
      }
      console.error("*** OpenAI image generation encountered an error", error);
      sendApiError(
        res,
        req,
        500,
        "Failed to generate image with OpenAI",
        errorMessageOf(error),
      );
    }
  },
);

export default router;
