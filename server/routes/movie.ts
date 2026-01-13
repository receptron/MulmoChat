import express, { Request, Response, Router } from "express";
import {
  movie,
  audio,
  translate,
  images as imagesAction,
  captions,
  mulmoViewerBundle,
  movieFilePath,
  initializeContext,
  bundleTargetLang,
} from "mulmocast";
import type { MulmoScript } from "mulmocast";
import path from "path";
import fs from "fs/promises";
import { createReadStream } from "fs";

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

// Movie generation endpoint
router.post(
  "/generate-movie",
  async (req: Request, res: Response): Promise<void> => {
    const {
      mulmoScript,
      uuid,
      images: beatImages,
    } = req.body as {
      mulmoScript: MulmoScript;
      uuid: string;
      images?: Record<string, string>;
    };

    if (!mulmoScript) {
      res.status(400).json({ error: "MulmoScript is required" });
      return;
    }

    if (!uuid) {
      res.status(400).json({ error: "UUID is required" });
      return;
    }

    try {
      // Ensure output directory exists
      const outputDir = path.join(process.cwd(), "output");
      await fs.mkdir(outputDir, { recursive: true });

      // Create script file with UUID
      const scriptPath = path.join(outputDir, `${uuid}.json`);
      await fs.writeFile(scriptPath, JSON.stringify(mulmoScript, null, 2));

      // Save images if provided
      const imageUrls = await saveImages(outputDir, uuid, beatImages || {});

      // Initialize context from the script file
      const context = await initializeContext(
        {
          _: [],
          $0: "",
          file: scriptPath,
          o: outputDir,
          v: true,
        },
        true,
      );

      if (!context) {
        throw new Error("Failed to initialize MulmoStudioContext");
      }

      // Generate the movie
      await audio(context)
        .then(imagesAction)
        .then(captions)
        .then(movie)
        .then(async () => {
          await translate(context, { targetLangs: bundleTargetLang });
        })
        .then(async () => {
          await mulmoViewerBundle(context);
        })
        .then(async () => {
          const outputPath = movieFilePath(context);
          const viewerJsonPath = path.join(
            path.dirname(outputPath),
            "mulmo_view.json"
          );

          res.json({
            success: true,
            message: "Movie generated successfully",
            outputPath,
            viewerJsonPath,
            imageUrls,
          });
        });
    } catch (error: unknown) {
      console.error("Movie generation failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        error: "Failed to generate movie",
        details: errorMessage,
      });
    }
  },
);

// Save images endpoint
router.post(
  "/save-images",
  async (req: Request, res: Response): Promise<void> => {
    const { uuid, images } = req.body as {
      uuid: string;
      images: Record<string, string>;
    };

    if (!uuid) {
      res.status(400).json({ error: "UUID is required" });
      return;
    }

    if (!images) {
      res.status(400).json({ error: "Images are required" });
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
      res.status(500).json({
        error: "Failed to save images",
        details: errorMessage,
      });
    }
  },
);

// Movie download endpoint
router.post(
  "/download-movie",
  async (req: Request, res: Response): Promise<void> => {
    const { moviePath } = req.body as { moviePath: string };

    if (!moviePath) {
      res.status(400).json({ error: "Movie path is required" });
      return;
    }

    try {
      // Check if file exists
      await fs.access(moviePath);

      // Get the filename from the path
      const filename = path.basename(moviePath);

      // Set headers for file download
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );

      // Stream the file
      const fileStream = createReadStream(moviePath);
      fileStream.pipe(res);
    } catch (error: unknown) {
      console.error("Movie download failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        error: "Failed to download movie",
        details: errorMessage,
      });
    }
  },
);

// Viewer JSON endpoint
router.post(
  "/viewer-json",
  async (req: Request, res: Response): Promise<void> => {
    const { viewerJsonPath } = req.body as { viewerJsonPath: string };

    if (!viewerJsonPath) {
      res.status(400).json({ error: "Viewer JSON path is required" });
      return;
    }

    try {
      // Check if file exists
      await fs.access(viewerJsonPath);

      // Read and send JSON
      const jsonData = await fs.readFile(viewerJsonPath, "utf-8");
      res.setHeader("Content-Type", "application/json");
      res.send(jsonData);
    } catch (error: unknown) {
      console.error("Viewer JSON fetch failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        error: "Failed to fetch viewer JSON",
        details: errorMessage,
      });
    }
  },
);

export default router;
