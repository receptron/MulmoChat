// Images a user message carries to the model (TextMessage.images), as data
// URLs. The browser attaches one when a tool result shows the model something,
// such as renderShapeScript's render of the 3D model it wrote.
const IMAGE_DATA_URL =
  /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]+=*)$/;

/** Most images one message may carry. */
export const MAX_MESSAGE_IMAGES = 4;

export interface ParsedImage {
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  /** Base64 without the data URL prefix. */
  data: string;
}

/** The media type and base64 of an image data URL, or null for anything else. */
export function parseImageDataUrl(url: string): ParsedImage | null {
  const match = IMAGE_DATA_URL.exec(url);
  if (!match) return null;
  return { mediaType: match[1] as ParsedImage["mediaType"], data: match[2] };
}
