/**
 * Backend API calls for HTML generation plugins
 */

import type { ToolContext } from "gui-chat-protocol/vue";
import { getRawPluginConfig } from "./config";
import { postJson } from "./postJson";

export type HtmlBackend = "claude" | "gemini";

const HTML_CONFIG_KEY = "htmlGenerationBackend";

export function getRawHtmlConfig(context?: ToolContext) {
  return getRawPluginConfig(context, HTML_CONFIG_KEY);
}

export function normalizeHtmlConfig(config: string | undefined): HtmlBackend {
  if (config === "gemini") {
    return "gemini";
  }
  return "claude"; // default
}

export interface HtmlGenerationParams {
  prompt: string;
  html?: string; // Existing HTML for editing
  backend?: "claude" | "gemini";
}

export interface HtmlGenerationResponse {
  success: boolean;
  html?: string;
  error?: string;
}

export async function generateHtml(
  params: HtmlGenerationParams,
): Promise<HtmlGenerationResponse> {
  return postJson("/api/generate-html", params);
}
