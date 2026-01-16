/**
 * Backend API calls for HTML generation plugins
 */

import type { ToolContext } from "../types";

export type HtmlBackend = "claude" | "gemini";

export function getRawHtmlConfig(context?: ToolContext) {
  return (
    context?.getPluginConfig?.("htmlGenerationBackend") ||
    context?.userPreferences?.pluginConfigs?.["htmlGenerationBackend"] ||
    context?.userPreferences?.htmlGenerationBackend
  );
}

export function normalizeHtmlConfig(
  config: string | undefined,
): HtmlBackend {
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
  const response = await fetch("/api/generate-html", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.statusText}`);
  }

  return response.json();
}
