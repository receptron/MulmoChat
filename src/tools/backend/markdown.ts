/**
 * Backend API calls for markdown plugin
 */

export interface SaveImagesParams {
  uuid: string;
  images: Record<string, string>; // imageId -> base64 data URL
}

export interface SaveImagesResponse {
  success: boolean;
  imageUrls?: Record<string, string>; // imageId -> URL
  error?: string;
}

export async function saveImages(
  params: SaveImagesParams,
): Promise<SaveImagesResponse> {
  const response = await fetch("/api/save-images", {
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
