import express, { Request, Response, Router } from "express";
import dotenv from "dotenv";
import { puppeteerCrawlerAgent } from "mulmocast";
import { defaultTestContext } from "graphai";
import { fetchPdfText } from "../utils/pdfText";
import { publicHttpUrl } from "../utils/publicUrl";
import { resolveVoice } from "../utils/voices";
import {
  ELEVENLABS_SAMPLE_RATE,
  resolveElevenLabsModel,
} from "../utils/elevenLabsRealtime";
import { localClientOnly, requireTrustedOrigin } from "../utils/trustedOrigin";
import { StartApiResponse } from "../types";
import { exaSearch, hasExaApiKey } from "../exaSearch";
import { sendApiError } from "../utils/logger";
import movieRouter from "./movie";
import pdfRouter from "./pdf";
import htmlRouter from "./html";
import textRouter from "./textLLM";
import comfyRouter from "./comfyui";
import imageRouter from "./image";
import pluginRouter from "./plugins";
import { pluginEventsRouter } from "../plugins/events";
import { mulmoScriptMediaRouter } from "../plugins/mulmoscriptHost";
dotenv.config({ quiet: true });

const router: Router = express.Router();

// Mount image saving route (/save-images)
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

// Mount server-side plugin routes (execution, events, mulmoscript media)
router.use(pluginRouter);
router.use(pluginEventsRouter);
router.use(mulmoScriptMediaRouter);

const DEFAULT_REALTIME_MODEL = "gpt-realtime-2.1";
const REALTIME_MODEL_PATTERN = /^gpt-realtime[a-z0-9.-]*$/;

// The ephemeral key is bound to a model, so mint it for the one the client selected
const resolveRealtimeModel = (model: unknown): string =>
  typeof model === "string" && REALTIME_MODEL_PATTERN.test(model)
    ? model
    : DEFAULT_REALTIME_MODEL;

// Grok voice: a short-lived client secret, so XAI_API_KEY stays on the server.
// It only has to last until the browser opens the WebSocket.
const GROK_CLIENT_SECRET_TTL_SECONDS = 300;

async function mintGrokClientSecret(xaiKey: string): Promise<string> {
  const response = await fetch("https://api.x.ai/v1/realtime/client_secrets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${xaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expires_after: { seconds: GROK_CLIENT_SECRET_TTL_SECONDS },
    }),
  });
  if (!response.ok) {
    throw new Error(`xAI API error: ${response.statusText}`);
  }
  const data = (await response.json()) as { value?: unknown };
  if (typeof data.value !== "string") {
    throw new Error("xAI API returned no client secret");
  }
  return data.value;
}

// ElevenLabs Realtime: the model, voice and audio are fixed in the secret
// (ElevenLabs takes the minted session as the authoritative initial one); the
// browser sends instructions and tools with session.update, as for Grok.
const ELEVENLABS_CLIENT_SECRET_TTL_SECONDS = 300;

async function mintElevenLabsClientSecret(
  apiKey: string,
  model: string,
  voice: string,
): Promise<string> {
  const response = await fetch(
    "https://api.elevenlabs.io/v1/convai/realtime/client_secrets",
    {
      method: "POST",
      headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model,
          output_modalities: ["audio"],
          audio: {
            input: {
              format: { type: "audio/pcm", rate: ELEVENLABS_SAMPLE_RATE },
              // ElevenLabs refuses server_vad (422).
              turn_detection: { type: "semantic_vad", eagerness: "medium" },
            },
            output: { format: { type: "audio/pcm" }, voice },
          },
        },
        expires_after: {
          anchor: "created_at",
          seconds: ELEVENLABS_CLIENT_SECRET_TTL_SECONDS,
        },
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`ElevenLabs API error: ${response.statusText}`);
  }
  const data = (await response.json()) as { value?: unknown };
  if (typeof data.value !== "string") {
    throw new Error("ElevenLabs API returned no client secret");
  }
  return data.value;
}

// The flags every start response carries; plugins read them in isEnabled().
const startFlags = () => ({
  success: true,
  message: "Session started",
  googleMapKey: process.env.GOOGLE_MAP_API_KEY,
  hasExaApiKey,
  hasAnthropicApiKey: !!process.env.ANTHROPIC_API_KEY,
  googleApiKey: process.env.GEMINI_API_KEY,
  hasGoogleApiKey: !!process.env.GEMINI_API_KEY,
  hasXaiApiKey: !!process.env.XAI_API_KEY,
  hasTypesafeApiKey: !!process.env.TYPESAFE_API_KEY?.trim(),
});

// ElevenLabs voice start. Unlike /start (CLAUDE.md, "Known gap"), it takes
// requests only from this machine and from no other site, as a new route
// with a secret and a cost must: a JSON POST, so the trusted-origin check
// sees every cross-site attempt (a GET can be sent by an <img>).
router.post(
  "/start/elevenlabs",
  localClientOnly("ElevenLabs voice is"),
  requireTrustedOrigin,
  async (req: Request, res: Response): Promise<void> => {
    const { model, voice } = (req.body ?? {}) as {
      model?: unknown;
      voice?: unknown;
    };
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      sendApiError(
        res,
        req,
        500,
        "ELEVENLABS_API_KEY environment variable not set",
      );
      return;
    }
    try {
      const responseData: StartApiResponse = {
        ...startFlags(),
        ephemeralKey: "",
        elevenLabsClientSecret: await mintElevenLabsClientSecret(
          apiKey,
          resolveElevenLabsModel(model),
          resolveVoice("elevenlabs", voice),
        ),
      };
      res.set("Cache-Control", "no-store");
      res.json(responseData);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      sendApiError(
        res,
        req,
        500,
        "Failed to generate ElevenLabs client secret",
        errorMessage,
      );
    }
  },
);

// Session start endpoint. `?voice=grok` mints an xAI client secret for the
// Grok voice transport instead of the OpenAI ephemeral key.
router.get("/start", async (req: Request, res: Response): Promise<void> => {
  const openaiKey = process.env.OPENAI_API_KEY;
  const xaiKey = process.env.XAI_API_KEY;

  if (req.query.voice === "grok") {
    if (!xaiKey) {
      sendApiError(res, req, 500, "XAI_API_KEY environment variable not set");
      return;
    }
    try {
      const responseData: StartApiResponse = {
        ...startFlags(),
        ephemeralKey: "",
        grokClientSecret: await mintGrokClientSecret(xaiKey),
      };
      res.json(responseData);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      sendApiError(
        res,
        req,
        500,
        "Failed to generate Grok client secret",
        errorMessage,
      );
    }
    return;
  }

  if (!openaiKey) {
    sendApiError(res, req, 500, "OPENAI_API_KEY environment variable not set");
    return;
  }

  try {
    const sessionConfig = JSON.stringify({
      session: {
        type: "realtime",
        model: resolveRealtimeModel(req.query.model),
        audio: {
          output: { voice: resolveVoice("openai", req.query.voice) },
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
      ...startFlags(),
      ephemeralKey: data.value,
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

// Browse endpoint using mulmocast puppeteerCrawlerAgent
router.post("/browse", async (req: Request, res: Response): Promise<void> => {
  const { url: requested } = req.body as { url?: unknown };

  if (!requested || typeof requested !== "string") {
    sendApiError(res, req, 400, "URL is required");
    return;
  }
  // Only public http(s) pages: the server opens the URL itself (publicUrl.ts).
  const target = await publicHttpUrl(requested);
  if (!target) {
    sendApiError(res, req, 400, "Only public http(s) URLs can be browsed");
    return;
  }
  const url = target.href;

  try {
    const result = (await puppeteerCrawlerAgent.agent({
      ...defaultTestContext,
      namedInputs: { url },
    })) as { content?: unknown } | null;
    if (typeof result?.content === "string" && result.content.trim()) {
      res.json({ success: true, data: result });
      return;
    }
    // No text from the crawler: a PDF (see fetchPdfText), or a page with
    // none. The crawler's empty result had null fields, which the browse
    // plugin took for "an unrecognized response".
    const pdf = await fetchPdfText(url);
    if (!pdf) {
      res.json({ success: false, error: "The page has no readable text" });
      return;
    }
    const note = pdf.fullLength
      ? `\n\n[The first ${pdf.text.length} of ${pdf.fullLength} characters of this ${pdf.pages}-page PDF.]`
      : "";
    const content = `${pdf.text}${note}`;
    res.json({
      success: true,
      data: {
        data: { url, title: pdf.title, textContent: content },
        content,
      },
    });
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
