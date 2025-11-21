import express, { Request, Response, Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const router: Router = express.Router();

// Generate HTML with Claude or Gemini endpoint
router.post(
  "/generate-html",
  async (req: Request, res: Response): Promise<void> => {
    const { prompt, html: existingHtml, backend = "claude" } = req.body;

    if (!prompt) {
      res.status(400).json({ error: "Prompt is required" });
      return;
    }

    // Validate backend parameter
    if (backend !== "claude" && backend !== "gemini") {
      res
        .status(400)
        .json({ error: "Invalid backend. Must be 'claude' or 'gemini'" });
      return;
    }

    // Check for appropriate API key based on backend
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (backend === "claude" && !anthropicApiKey) {
      res
        .status(500)
        .json({ error: "ANTHROPIC_API_KEY environment variable not set" });
      return;
    }

    if (backend === "gemini" && !geminiApiKey) {
      res
        .status(500)
        .json({ error: "GEMINI_API_KEY environment variable not set" });
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
          contents: [{ text: userContent }],
          systemInstruction: systemPrompt,
          config: {
            generationConfig: {
              maxOutputTokens: 8192,
            },
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

        const textPart = parts.find((part: any) => part.text);
        if (!textPart || !textPart.text) {
          throw new Error("No text content in Gemini response");
        }

        html = textPart.text;
      }

      // Remove markdown code blocks if present
      html = html.replace(/^```html\n?/i, "").replace(/\n?```$/i, "");

      res.json({
        success: true,
        html: html.trim(),
      });
    } catch (error: unknown) {
      console.error("HTML generation failed:", error);
      res.status(500).json({
        error: "Failed to generate HTML",
        details: error,
      });
    }
  },
);

export default router;
