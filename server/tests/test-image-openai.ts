import dotenv from "dotenv";
dotenv.config({ quiet: true });
import { writeFile } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.TEST_SERVER_URL ?? "http://localhost:3001";
const DEFAULT_PROMPT =
  process.env.OPENAI_IMAGE_TEST_PROMPT ??
  "A watercolor of a serene mountain lake";
const MODEL = process.env.OPENAI_IMAGE_TEST_MODEL ?? "gpt-image-1";
const SHOULD_SAVE = (
  process.env.OPENAI_IMAGE_TEST_SAVE ?? "false"
).toLowerCase();
const SAVE_IMAGE = ["1", "true", "yes"].includes(SHOULD_SAVE);

async function saveImage(base64: string): Promise<string> {
  const buffer = Buffer.from(base64, "base64");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filePath = path.join(
    process.cwd(),
    "output",
    `openai-image-${timestamp}.png`,
  );
  await writeFile(filePath, buffer);
  return filePath;
}

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is required to run the OpenAI image test.");
    process.exit(1);
  }

  const prompt = process.argv[2] ?? DEFAULT_PROMPT;
  console.log("=== OpenAI Image Generation Test ===\n");
  console.log(`Server: ${BASE_URL}`);
  console.log(`Prompt: ${prompt}`);
  console.log(`Model: ${MODEL}`);

  const response = await fetch(`${BASE_URL}/api/generate-image/openai`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      model: MODEL,
    }),
  });

  if (!response.ok) {
    console.error(`Request failed: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.error(text);
    process.exit(1);
  }

  const data = (await response.json()) as {
    success?: boolean;
    message?: string;
    imageData?: string;
    error?: string;
    details?: string;
  };

  if (!data.success || !data.imageData) {
    console.error(
      "API reported failure:",
      data.error ?? data.details ?? "Unknown error",
    );
    process.exit(1);
  }

  console.log("Image generation succeeded.");
  if (data.message) {
    console.log(`Note: ${data.message}`);
  }

  if (SAVE_IMAGE) {
    try {
      const savedPath = await saveImage(data.imageData);
      console.log(`Saved image to ${savedPath}`);
    } catch (error) {
      console.error("Failed to save image:", error);
    }
  }
}

main().catch((error) => {
  console.error("Unexpected error during OpenAI image test", error);
  process.exit(1);
});
