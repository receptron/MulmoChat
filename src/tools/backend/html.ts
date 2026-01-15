/**
 * Backend API calls for HTML generation plugins
 */

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
