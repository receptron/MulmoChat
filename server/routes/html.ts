import express, { Request, Response, Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { sendApiError } from "../utils/logger";

dotenv.config();

const router: Router = express.Router();

/**
 * Extracts clean HTML from AI-generated response that may include
 * explanatory text and markdown code blocks.
 */
function extractHtmlFromResponse(text: string): string {
  // Try to find HTML within markdown code blocks first
  // Pattern 1: ```html ... ``` (use split to avoid backtracking)
  const htmlBlockStart = text.search(/```html\s*\n/i);
  if (htmlBlockStart !== -1) {
    const afterStart = text.substring(htmlBlockStart + 7); // Skip ```html\n
    const blockEnd = afterStart.indexOf("```");
    if (blockEnd !== -1) {
      return afterStart.substring(0, blockEnd).trim();
    }
  }

  // Pattern 2: ``` ... ``` (without language specifier)
  const genericBlockStart = text.indexOf("```");
  if (genericBlockStart !== -1) {
    const afterStart = text.substring(genericBlockStart + 3);
    const blockEnd = afterStart.indexOf("```");
    if (blockEnd !== -1) {
      const content = afterStart.substring(0, blockEnd).trim();
      // Check if it looks like HTML (starts with <!DOCTYPE or <html or <!)
      if (
        content.match(/^\s*<!DOCTYPE/i) ||
        content.match(/^\s*<html/i) ||
        content.match(/^\s*<!/)
      ) {
        return content;
      }
    }
  }

  // Pattern 3: Look for HTML document structure without code blocks
  // Find the first occurrence of <!DOCTYPE, <html>, or <!
  const doctypeIndex = text.search(/<!DOCTYPE/i);
  const htmlTagIndex = text.search(/<html/i);
  const commentIndex = text.search(/<!(?!DOCTYPE)/i);

  const indices = [doctypeIndex, htmlTagIndex, commentIndex].filter(
    (i) => i !== -1,
  );
  if (indices.length > 0) {
    const htmlStart = Math.min(...indices);
    return text.substring(htmlStart).trim();
  }

  // Fallback: Remove common markdown code block markers
  const cleaned = text
    .replace(/^```html\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "");

  return cleaned.trim();
}

// Generate HTML with Claude or Gemini endpoint
router.post(
  "/generate-html",
  async (req: Request, res: Response): Promise<void> => {
    const { prompt, html: existingHtml, backend = "claude" } = req.body;

    if (!prompt) {
      sendApiError(res, req, 400, "Prompt is required");
      return;
    }

    // Validate backend parameter
    if (backend !== "claude" && backend !== "gemini") {
      sendApiError(
        res,
        req,
        400,
        "Invalid backend. Must be 'claude' or 'gemini'",
      );
      return;
    }

    // Log API call with backend settings
    const model =
      backend === "claude"
        ? "claude-sonnet-4-20250514"
        : "models/gemini-3-pro-preview";
    console.log(
      `[${new Date().toISOString()}] /api/generate-html: backend=${backend}, model=${model}`,
    );

    // Check for appropriate API key based on backend
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (backend === "claude" && !anthropicApiKey) {
      sendApiError(
        res,
        req,
        500,
        "ANTHROPIC_API_KEY environment variable not set",
      );
      return;
    }

    if (backend === "gemini" && !geminiApiKey) {
      sendApiError(
        res,
        req,
        500,
        "GEMINI_API_KEY environment variable not set",
      );
      return;
    }

    try {
      // Choose system prompt based on whether we're modifying existing HTML
      const systemPrompt = existingHtml
        ? `You are an expert HTML developer. Modify the provided HTML based on the user's request.
The HTML must include:
- All styles in a <style> tag within the <head>
- All JavaScript in a <script> tag (can be in <head> or before </body>)
- No external dependencies unless absolutely necessary
- Clean, semantic HTML5
- Responsive design
- Modern CSS

Preserve the existing structure and functionality where possible, only changing what the user requests.
Return ONLY the complete modified HTML code, nothing else. Do not include markdown code blocks or explanations.`
        : `You are an expert HTML developer. Generate a complete, standalone HTML page based on the user's request.
The HTML must include:
- All styles in a <style> tag within the <head>
- All JavaScript in a <script> tag (can be in <head> or before </body>)
- No external dependencies unless absolutely necessary
- Clean, semantic HTML5
- Responsive design
- Modern CSS

Return ONLY the HTML code, nothing else. Do not include markdown code blocks or explanations.`;

      // Build user message with existing HTML if provided
      const userContent = existingHtml
        ? `Here is the existing HTML to modify:\n\n${existingHtml}\n\nModification request: ${prompt}`
        : prompt;

      let html: string;

      if (backend === "claude") {
        // Use Claude (Anthropic)
        const anthropic = new Anthropic({
          apiKey: anthropicApiKey,
        });

        const message = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8192,
          messages: [
            {
              role: "user",
              content: userContent,
            },
          ],
          system: systemPrompt,
        });

        // Extract the HTML from the response
        const content = message.content[0];
        if (content.type === "text") {
          html = content.text;
        } else {
          throw new Error("Unexpected response type from Claude");
        }
      } else {
        // Use Gemini
        const ai = new GoogleGenAI({ apiKey: geminiApiKey });

        const response = await ai.models.generateContent({
          model: "models/gemini-3-pro-preview",
          contents: [{ text: `${systemPrompt}\n\n${userContent}` }],
          config: {
            maxOutputTokens: 8192,
          },
        });

        // Extract text from Gemini response
        const candidates = response.candidates;
        if (!Array.isArray(candidates) || candidates.length === 0) {
          throw new Error("No response from Gemini");
        }

        const parts = candidates[0]?.content?.parts;
        if (!Array.isArray(parts) || parts.length === 0) {
          throw new Error("Unexpected response structure from Gemini");
        }

        const textPart = parts.find((part: { text?: string }) => part.text);
        if (!textPart || !textPart.text) {
          throw new Error("No text content in Gemini response");
        }

        html = textPart.text;
      }

      // Extract HTML from markdown code blocks and remove explanatory text
      html = extractHtmlFromResponse(html);

      res.json({
        success: true,
        html: html.trim(),
      });
    } catch (error: unknown) {
      console.error("HTML generation failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      sendApiError(res, req, 500, "Failed to generate HTML", errorMessage);
    }
  },
);

export default router;
