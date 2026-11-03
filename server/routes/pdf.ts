import express, { Request, Response, Router } from "express";
import puppeteer from "puppeteer";
import path from "path";
import fs from "fs/promises";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import { sendApiError } from "../utils/logger.js";
import { fileRouteRateLimit } from "../utils/rateLimit.js";
import { isUuid } from "../utils/outputNames.js";

dotenv.config({ quiet: true });

const router: Router = express.Router();

const isCI = process.env.CI === "true";

// PDF summarization endpoint using Claude
router.get("/check-pdf", async (req: Request, res: Response): Promise<void> => {
  let browser = null;
  let available = true;
  try {
    browser = await puppeteer.launch({
      args: isCI ? ["--no-sandbox"] : [],
    });
  } catch (error) {
    console.error("PDF capability check failed:", error);
    available = false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
  res.json({ available });
});

router.post(
  "/summarize-pdf",
  async (req: Request, res: Response): Promise<void> => {
    const { prompt, pdfData } = req.body as {
      prompt: string;
      pdfData: string;
    };

    if (!prompt) {
      sendApiError(res, req, 400, "Prompt is required");
      return;
    }

    if (!pdfData) {
      sendApiError(res, req, 400, "PDF data is required");
      return;
    }

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

    if (!anthropicApiKey) {
      sendApiError(
        res,
        req,
        500,
        "ANTHROPIC_API_KEY environment variable not set",
      );
      return;
    }

    try {
      const anthropic = new Anthropic({
        apiKey: anthropicApiKey,
      });

      // Extract base64 data if it includes the data URL prefix
      const base64Data = pdfData.includes(",")
        ? pdfData.split(",")[1]
        : pdfData;

      const message = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: base64Data,
                },
              },
              {
                type: "text",
                text: prompt,
              },
            ],
          },
        ],
      });

      // Extract text content from response
      const textContent = message.content
        .filter((block) => block.type === "text")
        .map((block) => ("text" in block ? block.text : ""))
        .join("\n");

      console.log(
        "PDF summarization completed:",
        textContent.substring(0, 100),
      );

      res.json({
        success: true,
        summary: textContent,
      });
    } catch (error: unknown) {
      console.error("PDF summarization failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      sendApiError(res, req, 500, "Failed to summarize PDF", errorMessage);
    }
  },
);

// PDF save endpoint - saves PDF data to output folder
const savePdf = async (req: Request, res: Response): Promise<void> => {
  const { pdfData, uuid, fileName } = (req.body ?? {}) as {
    pdfData: string;
    uuid: string;
    fileName: string;
  };

  if (!pdfData) {
    sendApiError(res, req, 400, "PDF data is required");
    return;
  }

  if (!uuid) {
    sendApiError(res, req, 400, "UUID is required");
    return;
  }

  if (!isUuid(uuid)) {
    sendApiError(res, req, 400, "UUID must be a UUID");
    return;
  }

  try {
    // Ensure output directory exists
    const outputDir = path.join(process.cwd(), "output");
    await fs.mkdir(outputDir, { recursive: true });

    // Extract base64 data if it includes the data URL prefix
    const base64Data = pdfData.includes(",") ? pdfData.split(",")[1] : pdfData;

    // Convert base64 to buffer
    const pdfBuffer = Buffer.from(base64Data, "base64");

    // Create file path with UUID
    const sanitizedFileName = (fileName || "document")
      .replace(/\.pdf$/i, "")
      .replace(/[^a-z0-9]/gi, "_")
      .toLowerCase();
    const pdfPath = path.join(outputDir, `${uuid}_${sanitizedFileName}.pdf`);

    // Write the PDF file
    await fs.writeFile(pdfPath, pdfBuffer);

    console.log("PDF saved:", pdfPath);

    // Return the URL path for the client to access
    const pdfUrl = `/output/${uuid}_${sanitizedFileName}.pdf`;

    res.json({
      success: true,
      pdfUrl,
    });
  } catch (error: unknown) {
    console.error("PDF save failed:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    sendApiError(res, req, 500, "Failed to save PDF", errorMessage);
  }
};
router.post("/save-pdf", fileRouteRateLimit(), savePdf);

export default router;
