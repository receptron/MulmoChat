import express, { Request, Response, Router } from "express";
import puppeteer from "puppeteer";
import { marked } from "marked";
import path from "path";
import fs from "fs/promises";
import { createReadStream } from "fs";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import { sendApiError } from "../utils/logger";

dotenv.config();

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

// PDF generation endpoint
router.post(
  "/generate-pdf",
  async (req: Request, res: Response): Promise<void> => {
    const { markdown, title, uuid } = req.body as {
      markdown: string;
      title: string;
      uuid: string;
    };

    if (!markdown) {
      sendApiError(res, req, 400, "Markdown content is required");
      return;
    }

    if (!uuid) {
      sendApiError(res, req, 400, "UUID is required");
      return;
    }

    try {
      // Generate HTML from markdown
      const htmlContent = marked(markdown);

      // Create complete HTML document with styling
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title || "Document"}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem;
    }
    h1 {
      font-size: 2rem;
      font-weight: bold;
      margin-top: 1em;
      margin-bottom: 0.5em;
    }
    h2 {
      font-size: 1.75rem;
      font-weight: bold;
      margin-top: 1em;
      margin-bottom: 0.5em;
    }
    h3 {
      font-size: 1.5rem;
      font-weight: bold;
      margin-top: 1em;
      margin-bottom: 0.5em;
    }
    h4 {
      font-size: 1.25rem;
      font-weight: bold;
      margin-top: 1em;
      margin-bottom: 0.5em;
    }
    h5 {
      font-size: 1.125rem;
      font-weight: bold;
      margin-top: 1em;
      margin-bottom: 0.5em;
    }
    h6 {
      font-size: 1rem;
      font-weight: bold;
      margin-top: 1em;
      margin-bottom: 0.5em;
    }
    p {
      margin-bottom: 1em;
    }
    code {
      background-color: #f5f5f5;
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
    }
    pre {
      background-color: #f5f5f5;
      padding: 1em;
      border-radius: 5px;
      overflow-x: auto;
    }
    pre code {
      background-color: transparent;
      padding: 0;
    }
    blockquote {
      border-left: 4px solid #ddd;
      padding-left: 1em;
      margin-left: 0;
      color: #666;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 1em 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 0.5em;
      text-align: left;
    }
    th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    ul, ol {
      margin-bottom: 1em;
    }
    a {
      color: #0066cc;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    img {
      max-width: 80%;
      height: auto;
      display: block;
      margin: 1em auto;
    }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>
`;

      // Ensure output directory exists
      const outputDir = path.join(process.cwd(), "output");
      await fs.mkdir(outputDir, { recursive: true });

      // Create PDF and HTML file paths with UUID
      const sanitizedTitle = (title || "document")
        .replace(/[^a-z0-9]/gi, "_")
        .toLowerCase();
      const pdfPath = path.join(outputDir, `${uuid}_${sanitizedTitle}.pdf`);
      const htmlPath = path.join(outputDir, `${uuid}_${sanitizedTitle}.html`);

      // Write HTML file to output directory
      await fs.writeFile(htmlPath, html, "utf-8");

      // Launch puppeteer and generate PDF
      const browser = await puppeteer.launch({
        args: isCI ? ["--no-sandbox"] : [],
      });

      try {
        const page = await browser.newPage();
        // Navigate to the HTML file via HTTP server
        const port = process.env.PORT || 3001;
        const htmlFilename = path.basename(htmlPath);
        await page.goto(`http://localhost:${port}/output/${htmlFilename}`, {
          waitUntil: "networkidle0",
        });
        await page.pdf({
          path: pdfPath,
          format: "A4",
          printBackground: true,
          margin: {
            top: "20mm",
            right: "20mm",
            bottom: "20mm",
            left: "20mm",
          },
        });

        console.log("PDF generated:", pdfPath);

        res.json({
          success: true,
          message: "PDF generated successfully",
          pdfPath,
        });
      } finally {
        await browser.close();
      }
    } catch (error: unknown) {
      console.error("PDF generation failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      sendApiError(res, req, 500, "Failed to generate PDF", errorMessage);
    }
  },
);

// PDF save endpoint - saves PDF data to output folder
router.post("/save-pdf", async (req: Request, res: Response): Promise<void> => {
  const { pdfData, uuid, fileName } = req.body as {
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
});

// PDF download endpoint
router.post(
  "/download-pdf",
  async (req: Request, res: Response): Promise<void> => {
    const { pdfPath } = req.body as { pdfPath: string };

    if (!pdfPath) {
      sendApiError(res, req, 400, "PDF path is required");
      return;
    }

    try {
      // Check if file exists
      await fs.access(pdfPath);

      // Get the filename from the path
      const filename = path.basename(pdfPath);

      // Set headers for file download
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );

      // Stream the file
      const fileStream = createReadStream(pdfPath);
      fileStream.pipe(res);
    } catch (error: unknown) {
      console.error("PDF download failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      sendApiError(res, req, 500, "Failed to download PDF", errorMessage);
    }
  },
);

export default router;
