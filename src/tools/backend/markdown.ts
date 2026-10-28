/**
 * Backend API calls for markdown plugin
 */

import { postJson } from "./postJson";

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
  return postJson("/api/save-images", params);
}
