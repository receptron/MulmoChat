import express, { Request, Response, Router } from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { Buffer } from "node:buffer";
dotenv.config();

const router: Router = express.Router();

// Generate image endpoint
router.post(
  "/generate-image",
  async (req: Request, res: Response): Promise<void> => {
    const { prompt, images, model } = req.body;

    if (!prompt) {
      res.status(400).json({ error: "Prompt is required" });
      return;
    }

    const geminiKey = process.env.GEMINI_API_KEY;

    if (!geminiKey) {
      res
        .status(500)
        .json({ error: "GEMINI_API_KEY environment variable not set" });
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: geminiKey });
      const modelName = model || "gemini-2.5-flash-image";
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
      const returnValue: {
        success: boolean;
        message: string | undefined;
        imageData: string | undefined;
      } = {
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

      res.json(returnValue);
    } catch (error: unknown) {
      console.error("*** Image generation failed", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        error: "Failed to generate image",
        details: errorMessage,
      });
    }
  },
);

// OpenAI image generation endpoint
router.post(
  "/generate-image/openai",
  async (req: Request, res: Response): Promise<void> => {
    const { prompt, images = [], model, size = "1024x1024" } = req.body;

    if (!prompt) {
      res.status(400).json({ error: "Prompt is required" });
      return;
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      res
        .status(500)
        .json({ error: "OPENAI_API_KEY environment variable not set" });
      return;
    }

    const modelName = (model as string) || "gpt-image-1";
    const shouldIncludeResponseFormat =
      modelName !== "gpt-image-1" && modelName !== "gpt-image-latest";

    try {
      const hasEditImage = Array.isArray(images) && images.length > 0;
      const endpoint = hasEditImage
        ? "https://api.openai.com/v1/images/edits"
        : "https://api.openai.com/v1/images/generations";

      let fetchResponse: globalThis.Response;

      if (hasEditImage) {
        const firstImage = images[0];
        const buffer = Buffer.from(firstImage, "base64");
        const blob = new Blob([buffer], { type: "image/png" });
        const formData = new FormData();
        formData.append("prompt", prompt);
        formData.append("model", modelName);
        formData.append("size", size);
        if (shouldIncludeResponseFormat) {
          formData.append("response_format", "b64_json");
        }
        formData.append("image", blob, "image.png");

        fetchResponse = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
          },
          body: formData,
        });
      } else {
        fetchResponse = await fetch(endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prompt,
            model: modelName,
            size,
            ...(shouldIncludeResponseFormat
              ? { response_format: "b64_json" }
              : {}),
          }),
        });
      }

      if (!fetchResponse.ok) {
        const errorText = await fetchResponse.text();
        console.error("*** OpenAI image generation failed", errorText);
        res.status(fetchResponse.status).json({
          error: "Failed to generate image with OpenAI",
          details: errorText,
        });
        return;
      }

      const data = (await fetchResponse.json()) as {
        data?: Array<{
          b64_json?: string;
          url?: string;
          revised_prompt?: string;
        }>;
        error?: { message?: string };
      };

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
          res.status(500).json({
            error: "Failed to download image provided by OpenAI",
            details:
              fetchError instanceof Error
                ? fetchError.message
                : "Unknown error",
          });
          return;
        }
      }

      if (!imageData) {
        res.status(500).json({
          error: "No image data returned from OpenAI",
          details: data.error?.message,
        });
        return;
      }

      res.json({
        success: true,
        imageData,
        message: firstItem?.revised_prompt,
      });
    } catch (error: unknown) {
      console.error("*** OpenAI image generation encountered an error", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        error: "Failed to generate image with OpenAI",
        details: errorMessage,
      });
    }
  },
);

export default router;
