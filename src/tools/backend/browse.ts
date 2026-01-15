/**
 * Backend API calls for browse plugin
 */

export interface BrowseResponse {
  success: boolean;
  data?: {
    title?: string;
    description?: string;
    content?: string;
    textContent?: string;
    text?: string;
    byline?: string;
    excerpt?: string;
    [key: string]: unknown;
  };
  error?: string;
}

export async function browseUrl(url: string): Promise<BrowseResponse> {
  const response = await fetch("/api/browse", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    throw new Error(`Server error: ${response.statusText}`);
  }

  return response.json();
}

export async function getTwitterEmbed(url: string): Promise<string | null> {
  try {
    const response = await fetch(
      `/api/twitter-embed?url=${encodeURIComponent(url)}`,
    );

    if (!response.ok) {
      throw new Error(`Twitter embed API error: ${response.status}`);
    }

    const data = await response.json();
    return data.success ? data.html : null;
  } catch (error) {
    console.error("Failed to fetch Twitter embed:", error);
    return null;
  }
}
