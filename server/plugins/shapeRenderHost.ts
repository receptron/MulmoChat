// renderShapeScript: renders a ShapeScript model to a PNG sheet (four camera
// angles by default) so the model can look at what it wrote before presenting
// it. The tool itself (schema, defaults, the sheet, puppeteer) comes from
// @mulmoclaude/shapescript-plugin/render; this module supplies where a `.shape`
// is read from and where the PNG goes.
//
// Adapted from MulmoTerminal's server/infra/shapescript-render-tool.ts
// (https://github.com/receptron/mulmoterminal, MIT License, Copyright (c) 2026
// Receptron). Differences: MulmoTerminal's agent reads the saved PNG from disk.
// MulmoChat's models can't read files, so the result carries the image, shown
// in the canvas and sent to the model with the tool output (`imagesForModel`,
// see src/tools/index.ts). Sources stay inside artifacts/shapes/.
import { randomBytes } from "node:crypto";
import {
  executeRenderShapeScript,
  RENDER_SHAPE_SCRIPT_DESCRIPTION,
  RENDER_SHAPE_SCRIPT_SCHEMA,
  RENDER_SHAPE_SCRIPT_TOOL_NAME,
} from "@mulmoclaude/shapescript-plugin/render";
import {
  isShapeArtifactPath,
  toArtifactsRelative,
} from "@mulmoclaude/shapescript-plugin";
import type { ToolDefinition } from "gui-chat-protocol";
import { artifactsFileOps } from "./workspace";
import { logger } from "../utils/logger";

// Renders get their own folder: a `.shape` is a source the user edits, a PNG
// is a by-product.
const RENDERS_DIR = "renders";

// The package's prompt tells the agent to read the PNG from disk.
const RENDER_SHAPE_SCRIPT_PROMPT =
  "Use renderShapeScript to CHECK a 3D model you wrote before presenting it: it renders the model to an image of four camera angles and shows you that image. Fix what you see and re-render. Pass `path` for a model presentShapeScript already saved (artifacts/shapes/...), or `script` for one you haven't saved. If it reports that no browser is available, say so and continue with presentShapeScript rather than retrying.";

/** The tool definition the browser registers (GET /api/plugin-host-tools). */
export const RENDER_SHAPE_SCRIPT: ToolDefinition = {
  type: "function",
  name: RENDER_SHAPE_SCRIPT_TOOL_NAME,
  description: RENDER_SHAPE_SCRIPT_DESCRIPTION.replace(
    /Returns the image path — read that file to see the result\. /,
    "The image is shown to you with the result. ",
  ),
  prompt: RENDER_SHAPE_SCRIPT_PROMPT,
  parameters: RENDER_SHAPE_SCRIPT_SCHEMA,
};

async function readShape(filePath: string): Promise<string> {
  if (!isShapeArtifactPath(filePath)) {
    throw new Error(
      "`path` must be a .shape file under artifacts/shapes/, as returned by presentShapeScript",
    );
  }
  return artifactsFileOps.read(toArtifactsRelative(filePath));
}

/** Run one call. Failures come back as a message the model can act on. */
export async function renderShapeScript(
  args: Record<string, unknown>,
): Promise<unknown> {
  // Filled by saveImage when the sheet is rendered.
  const saved: { image?: { path: string; base64: string } } = {};
  let result: { message: string; rendered: boolean };
  try {
    result = await executeRenderShapeScript(
      {
        readShape,
        async saveImage(base64) {
          const rel = `${RENDERS_DIR}/${randomBytes(8).toString("hex")}.png`;
          await artifactsFileOps.write(rel, Buffer.from(base64, "base64"));
          saved.image = { path: `artifacts/${rel}`, base64 };
          return saved.image.path;
        },
        onWarning: (message) => logger.warn(`[renderShapeScript] ${message}`),
      },
      args,
    );
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { message: `renderShapeScript failed: ${reason}` };
  }
  const { image } = saved;
  if (!result.rendered || !image) return { message: result.message };
  const imageData = `data:image/png;base64,${image.base64}`;
  return {
    message: result.message.replace(
      /Read that file to see the model\.$/,
      "The image is attached for you to look at.",
    ),
    title: "ShapeScript render",
    data: { imageData, prompt: `ShapeScript render (${image.path})` },
    imagesForModel: [imageData],
    instructions:
      "Look at the attached render. If the model is wrong, fix the script and render again; otherwise present it with presentShapeScript.",
    instructionsRequired: true,
  };
}
