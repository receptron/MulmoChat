import dotenv from "dotenv";
dotenv.config({ quiet: true });
import { writeFile } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.TEST_SERVER_URL ?? "http://localhost:3001";
const PROMPT =
  process.env.COMFY_TEST_PROMPT ?? "A cinematic portrait of a friendly robot";
const NEGATIVE_PROMPT = process.env.COMFY_TEST_NEGATIVE_PROMPT ?? "";

const toNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const WIDTH = toNumber(process.env.COMFY_TEST_WIDTH, 512);
const HEIGHT = toNumber(process.env.COMFY_TEST_HEIGHT, 512);
const STEPS = toNumber(process.env.COMFY_TEST_STEPS, 6);
const CFG_SCALE = toNumber(process.env.COMFY_TEST_CFG_SCALE, 1.5);
const DENOISE = toNumber(process.env.COMFY_TEST_DENOISE, 1);

const SAMPLER = process.env.COMFY_TEST_SAMPLER ?? "dpmpp_2m_sde";
const SCHEDULER = process.env.COMFY_TEST_SCHEDULER ?? "karras";
const MODEL = process.env.COMFY_TEST_MODEL;
const FILENAME_PREFIX = process.env.COMFY_TEST_FILENAME_PREFIX ?? "ComfyUITest";

const SHOULD_SAVE = (process.env.COMFY_TEST_SAVE ?? "false").toLowerCase();
const SAVE_IMAGE = ["1", "true", "yes"].includes(SHOULD_SAVE);

interface ComfyResponse {
  success: boolean;
  images?: string[];
  promptId?: string;
  model?: string;
  metadata?: Record<string, unknown>;
  error?: string;
  details?: string;
}

async function saveImage(
  base64: string,
  filenamePrefix: string,
): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${filenamePrefix}-${timestamp}.png`;
  const outputPath = path.join(process.cwd(), "output", filename);
  await writeFile(outputPath, buffer);
  return outputPath;
}

async function main(): Promise<void> {
  if (!PROMPT) {
    console.error("Set COMFY_TEST_PROMPT or provide a prompt in the script.");
    process.exit(1);
  }

  console.log("=== ComfyUI HTTP API Smoke Test ===\n");
  console.log(`Server: ${BASE_URL}`);
  console.log(`Prompt: ${PROMPT}`);
  console.log(`Negative prompt: ${NEGATIVE_PROMPT || "<none>"}`);
  console.log(
    `Params: ${WIDTH}x${HEIGHT}, steps=${STEPS}, cfg=${CFG_SCALE}, denoise=${DENOISE}`,
  );
  console.log(`Sampler: ${SAMPLER}, scheduler: ${SCHEDULER}`);
  if (MODEL) {
    console.log(`Model override: ${MODEL}`);
  }
  console.log("");

  const response = await fetch(`${BASE_URL}/api/generate-image/comfy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: PROMPT,
      negativePrompt: NEGATIVE_PROMPT,
      width: WIDTH,
      height: HEIGHT,
      steps: STEPS,
      cfgScale: CFG_SCALE,
      sampler: SAMPLER,
      scheduler: SCHEDULER,
      denoise: DENOISE,
      model: MODEL,
      filenamePrefix: FILENAME_PREFIX,
    }),
  });

  if (!response.ok) {
    console.error(`Request failed: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.error(text);
    process.exit(1);
  }

  const data = (await response.json()) as ComfyResponse;

  if (!data.success) {
    console.error("API reported failure:", data.error ?? "Unknown error");
    if (data.details) {
      console.error("Details:", data.details);
    }
    process.exit(1);
  }

  const imageCount = data.images?.length ?? 0;
  console.log(`Success! Prompt ID: ${data.promptId ?? "<unknown>"}`);
  console.log(`Model: ${data.model ?? "<unspecified>"}`);
  console.log(`Images returned: ${imageCount}`);

  if (imageCount === 0) {
    console.warn("No images in response. Nothing to save.");
    return;
  }

  if (SAVE_IMAGE) {
    try {
      const savedPath = await saveImage(data.images![0], FILENAME_PREFIX);
      console.log(`Saved first image to ${savedPath}`);
    } catch (error) {
      console.error("Failed to save image:", error);
    }
  }
}

main().catch((error) => {
  console.error("ComfyUI test encountered an error:", error);
  process.exit(1);
});
