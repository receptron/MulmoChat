// An image's type from its first bytes. The browser sends input images as raw
// base64 with no type, and MulmoClaude saves every image under a `.png` name
// whatever the image model returned (Gemini returns JPEG), so the bytes
// decide, not the name.
import { Buffer } from "node:buffer";

export type ImageMime = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

/** The file extension each type is saved with. */
export const IMAGE_EXTENSIONS: Readonly<Record<ImageMime, string>> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const startsWith = (bytes: Uint8Array, prefix: readonly number[], at = 0) =>
  prefix.every((byte, i) => bytes[at + i] === byte);

export function imageMimeOfBytes(bytes: Uint8Array): ImageMime | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  // RIFF....WEBP
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "image/webp";
  }
  return null;
}

/** An input image as the image APIs take it. */
export interface InputImage {
  mimeType: ImageMime;
  /** Base64, without a data URL prefix. */
  data: string;
}

const DATA_URL = /^data:[^;,]+;base64,/;

/**
 * An image the browser or a plugin sent: raw base64 or a data URL. The type
 * comes from its bytes; an image of no known type is sent as PNG, as before.
 */
export function toInputImage(image: string): InputImage {
  const data = image.replace(DATA_URL, "");
  // 16 base64 characters decode to the 12 bytes the checks read.
  const head = new Uint8Array(Buffer.from(data.slice(0, 16), "base64"));
  return { mimeType: imageMimeOfBytes(head) ?? "image/png", data };
}
