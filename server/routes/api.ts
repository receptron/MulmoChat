import express, { Request, Response, Router } from "express";

import puppeteer from "puppeteer";
// @ts-expect-error - jsdom types not installed (indirect dependency via mulmocast)
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { GoogleGenAI } from "@google/genai";
import { StartApiResponse } from "../types";
import { exaSearch, hasExaApiKey } from "../exaSearch";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";
import { sendApiError } from "../utils/logger";

const execFileAsync = promisify(execFile);
import movieRouter from "./movie";
import pdfRouter from "./pdf";
import htmlRouter from "./html";
import textRouter from "./textLLM";
import comfyRouter from "./comfyui";
import imageRouter from "./image";

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
    sendApiError(res, req, 500, "OPENAI_API_KEY environment variable not set");
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
    sendApiError(
      res,
      req,
      500,
      "Failed to generate ephemeral key",
      errorMessage,
    );
  }
});

// Check if URL is a YouTube video
function isYouTubeUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com\/watch|youtu\.be\/|youtube\.com\/shorts\/)/.test(
    url,
  );
}

// Browse endpoint using mulmocast puppeteerCrawlerAgent
router.post("/browse", async (req: Request, res: Response): Promise<void> => {
  const { url } = req.body;

  if (!url) {
    sendApiError(res, req, 400, "URL is required");
    return;
  }

  // YouTube URLs: fetch transcript then analyze with Gemini
  if (isYouTubeUrl(url)) {
    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) {
      sendApiError(
        res,
        req,
        500,
        "GEMINI_API_KEY environment variable not set",
      );
      return;
    }
    try {
      // Step 1: Fetch YouTube transcript via yt-dlp
      let transcriptText = "";
      try {
        const tmpDir = os.tmpdir();
        const tmpFile = path.join(tmpDir, `yt_sub_${Date.now()}`);
        await execFileAsync(
          "yt-dlp",
          [
            "--write-auto-sub",
            "--sub-lang",
            "ja",
            "--skip-download",
            "--sub-format",
            "vtt",
            "-o",
            tmpFile,
            url,
          ],
          { timeout: 30000 },
        );
        const vttPath = tmpFile + ".ja.vtt";
        if (fs.existsSync(vttPath)) {
          const vtt = fs.readFileSync(vttPath, "utf-8");
          // Parse VTT: extract text lines, remove duplicates
          const lines = vtt.split("\n");
          const texts: string[] = [];
          let prev = "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (
              !trimmed ||
              trimmed.startsWith("WEBVTT") ||
              trimmed.startsWith("Kind:") ||
              trimmed.startsWith("Language:") ||
              trimmed.includes("-->") ||
              trimmed.match(/^\d+$/)
            )
              continue;
            // Remove positioning tags
            const clean = trimmed
              .replace(/<\/?[a-z][^>]*>/gi, "")
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .replace(/&#39;/g, "'")
              .replace(/&quot;/g, '"');
            if (clean && clean !== prev) {
              texts.push(clean);
              prev = clean;
            }
          }
          transcriptText = texts.join(" ");
          fs.unlinkSync(vttPath);
        }
      } catch (e) {
        console.warn(
          "yt-dlp transcript extraction failed, falling back to Gemini video analysis:",
          e,
        );
      }

      const ai = new GoogleGenAI({ apiKey: geminiKey });

      if (transcriptText) {
        // Step 2a: Analyze transcript with Gemini
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              parts: [
                {
                  text: `以下はYouTube動画の字幕テキストです。この内容を深く理解し、詳細に説明してください。簡潔にまとめず、重要なポイントや具体的な内容、説明の流れをしっかり網羅してください。内容の省略はしないでください。\n\n---\n${transcriptText}`,
                },
              ],
            },
          ],
        });
        const analysis = response.text || "";
        res.json({
          success: true,
          data: {
            title: "YouTube Video Content",
            textContent: analysis,
            excerpt: analysis.substring(0, 200) + "...",
          },
        });
      } else {
        // Step 2b: Fallback to Gemini video analysis if no transcript available
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              parts: [
                {
                  fileData: {
                    fileUri: url,
                    mimeType: "video/*",
                  },
                },
                {
                  text: "この動画の内容を深く理解し、詳細に説明してください。簡潔にまとめず、重要なポイントや具体的な内容、説明の流れをしっかり網羅してください。内容の省略はしないでください。",
                },
              ],
            },
          ],
        });
        const analysis = response.text || "";
        res.json({
          success: true,
          data: {
            title: "YouTube Video Content",
            textContent: analysis,
            excerpt: analysis.substring(0, 200) + "...",
          },
        });
      }
    } catch (error: unknown) {
      console.error("YouTube analysis failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      sendApiError(
        res,
        req,
        500,
        "Failed to analyze YouTube video",
        errorMessage,
      );
    }
    return;
  }

  try {
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
      ],
    });
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    );
    await page.setViewport({ width: 1366, height: 900 });

    try {
      await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 });
      await new Promise((r) => setTimeout(r, 1500));
      const html = await page.content();
      const dom = new JSDOM(html, { url: page.url() });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      const title = article?.title || (await page.title()) || "Untitled";
      const textContent = (article?.textContent || "")
        .replace(/[\n\t]{2,}/g, "\n")
        .trim();

      // Convert relative URLs to absolute in Readability HTML content
      let htmlContent = article?.content || null;
      if (htmlContent) {
        const baseUrl = new URL(url);
        const origin = baseUrl.origin;
        // Convert relative src/href to absolute
        htmlContent = htmlContent
          .replace(/src="\/\//g, `src="https://`)
          .replace(/src="\//g, `src="${origin}/`)
          .replace(/srcset="\/\//g, `srcset="https://`)
          .replace(/srcset="\//g, `srcset="${origin}/`)
          .replace(/href="\//g, `href="${origin}/`);
      }

      console.log(
        "[Browse] title:",
        title,
        "textContent length:",
        textContent.length,
        "htmlContent:",
        !!htmlContent,
      );

      res.json({
        success: true,
        data: {
          url,
          title,
          byline: article?.byline || null,
          excerpt: article?.excerpt || null,
          length: textContent.length,
          textContent,
          htmlContent,
        },
      });
    } finally {
      await page.close().catch(() => {});
      await browser.close().catch(() => {});
    }
  } catch (error: unknown) {
    console.error("Browse failed:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    sendApiError(res, req, 500, "Failed to browse URL", errorMessage);
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
      sendApiError(res, req, 400, "Query is required");
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
      sendApiError(res, req, 500, "Failed to search with Exa", errorMessage);
    }
  },
);

// Twitter oEmbed proxy endpoint
router.get(
  "/twitter-embed",
  async (req: Request, res: Response): Promise<void> => {
    const { url } = req.query;

    if (!url || typeof url !== "string") {
      sendApiError(res, req, 400, "URL query parameter is required");
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
        sendApiError(res, req, 400, "URL must be a Twitter/X URL");
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
      sendApiError(
        res,
        req,
        500,
        "Failed to fetch Twitter embed",
        errorMessage,
      );
    }
  },
);

export default router;
