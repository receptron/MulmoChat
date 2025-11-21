import express, { Request, Response, Router } from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
dotenv.config();

const router: Router = express.Router();

// Generate image endpoint
router.post(
  "/generate-image",
  async (req: Request, res: Response): Promise<void> => {
    const { prompt, images } = req.body;

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
      const model = "gemini-2.5-flash-image-preview";
      const contents: {
        text?: string;
        inlineData?: { mimeType: string; data: string };
      }[] = [{ text: prompt }];
      for (const image of images ?? []) {
        contents.push({ inlineData: { mimeType: "image/png", data: image } });
      }
      const response = await ai.models.generateContent({ model, contents });
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

export default router;
