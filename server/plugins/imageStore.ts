// Generated images in the workspace: every image a server-run plugin makes is
// saved as artifacts/images/<YYYY>/<MM>/<id>.<ext>, and a plugin can pass
// saved images back as references (context.app.editImages).
//
// Matches MulmoClaude's server/utils/files/image-store.ts and its
// /api/edit-image route (the same workspace, ~/mulmoclaude, is shared): UTC
// year/month folders, a 16-hex id, at most 8 source images, the same refusal
// wording. Deliberate differences:
//   - The file takes the extension of the image's real type. MulmoClaude
//     names every image `.png`, although Gemini returns JPEG.
//   - `.jpg` and `.webp` sources are accepted as well as `.png`. MulmoClaude's
//     isImagePath accepts `.png` only, so it can't edit MulmoChat's `.jpg`
//     images until it accepts them too.
//   - Only artifacts/images/; MulmoChat has no data/attachments/.
import { randomUUID } from "node:crypto";
import path from "node:path";
import { Buffer } from "node:buffer";
import { artifactsFileOps } from "./workspace";
import { logger } from "../utils/logger";
import {
  IMAGE_EXTENSIONS,
  imageMimeOfBytes,
  type InputImage,
} from "../utils/imageMime";

const IMAGES_DIR = "images";
const ARTIFACTS_PREFIX = "artifacts/";
const SHORT_ID_HEX_LEN = 16;
/** MulmoClaude's MAX_EDIT_IMAGES. */
export const MAX_EDIT_IMAGES = 8;
const SOURCE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

const yearMonthUtc = (now = new Date()): string =>
  `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

/**
 * Save a generated image (base64). Returns its workspace path
 * (`artifacts/images/…`), or null when it can't be saved: the picture is
 * still shown, just without a path.
 */
export async function saveGeneratedImage(
  base64: string,
): Promise<string | null> {
  try {
    const bytes = new Uint8Array(Buffer.from(base64, "base64"));
    const mime = imageMimeOfBytes(bytes);
    if (!mime) return null;
    const id = randomUUID().replaceAll("-", "").slice(0, SHORT_ID_HEX_LEN);
    const rel = `${IMAGES_DIR}/${yearMonthUtc()}/${id}.${IMAGE_EXTENSIONS[mime]}`;
    await artifactsFileOps.write(rel, bytes);
    return `${ARTIFACTS_PREFIX}${rel}`;
  } catch (error) {
    logger.warn("Could not save a generated image", { error: String(error) });
    return null;
  }
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.every((entry) => typeof entry === "string" && entry.length > 0);

/**
 * Load saved images for an edit. Throws an error the model can act on for
 * anything that isn't 1 to 8 images under artifacts/images/. The rooted
 * FileOps refuses `..` and symlinks out of artifacts/.
 */
export async function loadSourceImages(
  imagePaths: unknown,
): Promise<InputImage[]> {
  if (!isStringArray(imagePaths) || imagePaths.length === 0) {
    throw new Error(
      "imagePaths must be a non-empty array of workspace-relative paths",
    );
  }
  if (imagePaths.length > MAX_EDIT_IMAGES) {
    throw new Error(
      `imagePaths exceeds the maximum of ${MAX_EDIT_IMAGES} entries`,
    );
  }
  return Promise.all(imagePaths.map(loadSourceImage));
}

async function loadSourceImage(imagePath: string): Promise<InputImage> {
  const lower = imagePath.toLowerCase();
  // Normalized must equal the input: "artifacts/images/../documents/x.png"
  // stays inside artifacts/ (the FileOps allows it) but not inside images/.
  if (
    path.posix.normalize(imagePath) !== imagePath ||
    !imagePath.startsWith(`${ARTIFACTS_PREFIX}${IMAGES_DIR}/`) ||
    !SOURCE_EXTENSIONS.some((ext) => lower.endsWith(ext))
  ) {
    throw new Error(
      `imagePath must be a .png, .jpg or .webp image under artifacts/images/: ${imagePath}`,
    );
  }
  let bytes: Uint8Array;
  try {
    bytes = await artifactsFileOps.readBytes(
      imagePath.slice(ARTIFACTS_PREFIX.length),
    );
  } catch (error) {
    // The FileOps' refusals name only workspace-relative paths; a missing
    // file's error names the absolute one, which the model needn't see.
    const reason =
      (error as { code?: unknown }).code === "ENOENT"
        ? "no such image"
        : String(error);
    throw new Error(`could not read ${imagePath}: ${reason}`, {
      cause: error,
    });
  }
  const mimeType = imageMimeOfBytes(bytes);
  if (!mimeType) throw new Error(`not an image: ${imagePath}`);
  return { mimeType, data: Buffer.from(bytes).toString("base64") };
}
