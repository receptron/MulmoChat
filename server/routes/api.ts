import express, { Request, Response, Router } from "express";
import dotenv from "dotenv";
import { puppeteerCrawlerAgent } from "mulmocast";
import { defaultTestContext } from "graphai";
import { StartApiResponse } from "../types";
import { exaSearch, hasExaApiKey } from "../exaSearch";
import movieRouter from "./movie";
import pdfRouter from "./pdf";
import htmlRouter from "./html";
import textRouter from "./textLLM";
import comfyRouter from "./comfyui";
import imageRouter from "./image";
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

// Mount image routes
router.use(imageRouter);

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

// Browse endpoint using mulmocast puppeteerCrawlerAgent
router.post("/browse", async (req: Request, res: Response): Promise<void> => {
  const { url } = req.body;

  if (!url) {
    res.status(400).json({ error: "URL is required" });
    return;
  }

  try {
    const result = await puppeteerCrawlerAgent.agent({
      ...defaultTestContext,
      namedInputs: { url },
    });
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
