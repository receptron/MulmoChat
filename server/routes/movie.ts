import express, { Request, Response, Router } from "express";
import path from "path";
import fs from "fs/promises";
import { sendApiError } from "../utils/logger";

// /api/save-images: stores images the browser generated (useToolResults'
// saveImages) under output/images/<uuid>/, served from /output. The movie
// routes that used to live here served @gui-chat-plugin/mulmocast, which
// presentMulmoScript replaced (server/plugins/mulmoscriptHost.ts).

const router: Router = express.Router();

// Save images to disk
async function saveImages(
  outputDir: string,
  uuid: string,
  images: Record<string, string>,
): Promise<Record<string, string>> {
  const imageUrls: Record<string, string> = {};

  if (images && Object.keys(images).length > 0) {
    const imagesDir = path.join(outputDir, "images", uuid);
    await fs.mkdir(imagesDir, { recursive: true });

    // Save each image as PNG file
    await Promise.all(
      Object.entries(images).map(async ([beatId, base64Data]) => {
        const imagePath = path.join(imagesDir, `${beatId}.png`);
        // Remove data:image/png;base64, prefix if present
        const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Image, "base64");
        await fs.writeFile(imagePath, imageBuffer);
        imageUrls[beatId] = `/output/images/${uuid}/${beatId}.png`;
      }),
    );
  }

  return imageUrls;
}

// Save images endpoint
router.post(
  "/save-images",
  async (req: Request, res: Response): Promise<void> => {
    const { uuid, images } = req.body as {
      uuid: string;
      images: Record<string, string>;
    };

    if (!uuid) {
      sendApiError(res, req, 400, "UUID is required");
      return;
    }

    if (!images) {
      sendApiError(res, req, 400, "Images are required");
      return;
    }

    try {
      // Ensure output directory exists
      const outputDir = path.join(process.cwd(), "output");
      await fs.mkdir(outputDir, { recursive: true });

      // Save images and get URLs
      const imageUrls = await saveImages(outputDir, uuid, images);

      res.json({
        success: true,
        imageUrls,
      });
    } catch (error: unknown) {
      console.error("Image saving failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      sendApiError(res, req, 500, "Failed to save images", errorMessage);
    }
  },
);

export default router;
