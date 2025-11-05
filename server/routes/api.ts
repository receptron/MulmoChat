import express, { Request, Response, Router } from "express";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { puppeteerCrawlerAgent } from "mulmocast";
import { StartApiResponse } from "../types";
import { exaSearch, hasExaApiKey } from "../exaSearch";
import movieRouter from "./movie";
import pdfRouter from "./pdf";
import htmlRouter from "./html";
import textRouter from "./textLLM";
import comfyRouter from "./comfyui";
dotenv.config();

const router: Router = express.Router();

// Mount movie routes
router.use(movieRouter);

// Mount PDF routes
router.use(pdfRouter);

// Mount HTML routes
router.use(htmlRouter);

// Mount text LLM routes
router.use(textRouter);

// Mount ComfyUI routes
router.use(comfyRouter);

// Session start endpoint
router.get("/start", async (req: Request, res: Response): Promise<void> => {
  const openaiKey = process.env.OPENAI_API_KEY;
  const googleMapKey = process.env.GOOGLE_MAP_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const hasAnthropicApiKey = !!anthropicApiKey;
  const hasGoogleApiKey = !!geminiApiKey;

  if (!openaiKey) {
    res
      .status(500)
      .json({ error: "OPENAI_API_KEY environment variable not set" });
    return;
  }

  try {
    const sessionConfig = JSON.stringify({
      session: {
        type: "realtime",
        model: "gpt-realtime",
        audio: {
          output: { voice: "shimmer" },
        },
      },
    });

    const response = await fetch(
      "https://api.openai.com/v1/realtime/client_secrets",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": "application/json",
        },
        body: sessionConfig,
      },
    );

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const responseData: StartApiResponse = {
      success: true,
      message: "Session started",
      ephemeralKey: data.value,
      googleMapKey,
      hasExaApiKey,
      hasAnthropicApiKey,
      googleApiKey: geminiApiKey,
      hasGoogleApiKey,
    };
    res.json(responseData);
  } catch (error: unknown) {
    console.error("Failed to generate ephemeral key:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      error: "Failed to generate ephemeral key",
      details: errorMessage,
    });
  }
});

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

// Browse endpoint using mulmocast puppeteerCrawlerAgent
router.post("/browse", async (req: Request, res: Response): Promise<void> => {
  const { url } = req.body;

  if (!url) {
    res.status(400).json({ error: "URL is required" });
    return;
  }

  try {
    const result = await puppeteerCrawlerAgent.agent({ namedInputs: { url } });
    res.json({
      success: true,
      data: result,
    });
  } catch (error: unknown) {
    console.error("Browse failed:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({
      error: "Failed to browse URL",
      details: errorMessage,
    });
  }
});

// Exa search endpoint
router.post(
  "/exa-search",
  async (req: Request, res: Response): Promise<void> => {
    const {
      query,
      numResults = 3,
      includeText = true,
      includeDomains,
      excludeDomains,
      startPublishedDate,
      endPublishedDate,
      fetchHighlights = false,
    } = req.body;

    if (!query) {
      res.status(400).json({ error: "Query is required" });
      return;
    }

    try {
      const results = await exaSearch(query, {
        numResults: Math.min(numResults, 10),
        fetchText: includeText,
        fetchHighlights,
        includeDomains,
        excludeDomains,
        startPublishedDate,
        endPublishedDate,
      });

      console.log("*** Exa search results:", results.length, results[0]);

      res.json({
        success: true,
        results,
      });
    } catch (error: unknown) {
      console.error("Exa search failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        error: "Failed to search with Exa",
        details: errorMessage,
      });
    }
  },
);

// Twitter oEmbed proxy endpoint
router.get(
  "/twitter-embed",
  async (req: Request, res: Response): Promise<void> => {
    const { url } = req.query;

    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "URL query parameter is required" });
      return;
    }

    try {
      // Validate that it's a Twitter/X URL
      const urlObj = new URL(url);
      const isValidTwitterUrl = [
        "twitter.com",
        "www.twitter.com",
        "x.com",
        "www.x.com",
      ].includes(urlObj.hostname);

      if (!isValidTwitterUrl) {
        res.status(400).json({ error: "URL must be a Twitter/X URL" });
        return;
      }

      const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&theme=light&maxwidth=500&hide_thread=false&omit_script=false`;

      const response = await fetch(oembedUrl);

      if (!response.ok) {
        throw new Error(
          `Twitter oEmbed API error: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();
      res.json({
        success: true,
        html: data.html,
        author_name: data.author_name,
        author_url: data.author_url,
        url: data.url,
      });
    } catch (error: unknown) {
      console.error("Twitter embed failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        error: "Failed to fetch Twitter embed",
        details: errorMessage,
      });
    }
  },
);

export default router;
