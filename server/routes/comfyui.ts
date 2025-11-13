import express, { Request, Response, Router } from "express";
import { randomUUID } from "crypto";

const router: Router = express.Router();

const DEFAULT_COMFY_MODEL =
  process.env.COMFYUI_DEFAULT_MODEL ?? "flux1-schnell-fp8.safetensors";
const COMFY_BASE_URL = process.env.COMFYUI_BASE_URL ?? "http://127.0.0.1:8000";

const parsedComfyTimeout = Number.parseInt(
  process.env.COMFYUI_TIMEOUT_MS ?? "300000",
  10,
);
const COMFY_REQUEST_TIMEOUT_MS = Number.isFinite(parsedComfyTimeout)
  ? parsedComfyTimeout
  : 60000;

const parsedComfyPoll = Number.parseInt(
  process.env.COMFYUI_POLL_INTERVAL_MS ?? "1000",
  10,
);
const COMFY_POLL_INTERVAL_MS = Number.isFinite(parsedComfyPoll)
  ? parsedComfyPoll
  : 1000;

interface ComfyImageDescriptor {
  filename: string;
  subfolder?: string;
  type?: string;
}

interface ComfyHistoryEntry {
  status?: {
    status?: string;
    completed?: string;
  };
  outputs?: Record<
    string,
    {
      images?: ComfyImageDescriptor[];
    }
  >;
}

type ComfyHistoryResponse = Record<string, ComfyHistoryEntry>;

interface BuildWorkflowParams {
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  steps: number;
  cfgScale: number;
  seed: number;
  sampler: string;
  scheduler: string;
  denoise: number;
  model: string;
  filenamePrefix: string;
}

const buildSDXLTurboWorkflow = ({
  prompt,
  negativePrompt,
  width,
  height,
  steps,
  cfgScale,
  seed,
  sampler,
  scheduler,
  denoise,
  model,
  filenamePrefix,
}: BuildWorkflowParams) => {
  return {
    "1": {
      class_type: "CheckpointLoaderSimple",
      inputs: {
        ckpt_name: model,
      },
    },
    "2": {
      class_type: "EmptyLatentImage",
      inputs: {
        width,
        height,
        batch_size: 1,
      },
    },
    "3": {
      class_type: "CLIPTextEncode",
      inputs: {
        text: prompt,
        clip: ["1", 1],
      },
    },
    "4": {
      class_type: "CLIPTextEncode",
      inputs: {
        text: negativePrompt,
        clip: ["1", 1],
      },
    },
    "5": {
      class_type: "KSampler",
      inputs: {
        seed,
        steps,
        cfg: cfgScale,
        sampler_name: sampler,
        scheduler,
        denoise,
        model: ["1", 0],
        positive: ["3", 0],
        negative: ["4", 0],
        latent_image: ["2", 0],
      },
    },
    "6": {
      class_type: "VAEDecode",
      inputs: {
        samples: ["5", 0],
        vae: ["1", 2],
      },
    },
    "7": {
      class_type: "SaveImage",
      inputs: {
        images: ["6", 0],
        filename_prefix: filenamePrefix,
      },
    },
  } as const;
};

const waitForComfyResult = async (
  baseUrl: string,
  promptId: string,
  timeoutMs: number,
  pollIntervalMs: number,
) => {
  const expiration = Date.now() + timeoutMs;
  while (Date.now() < expiration) {
    const response = await fetch(`${baseUrl}/history/${promptId}`);
    if (!response.ok) {
      throw new Error(
        `ComfyUI history request failed: ${response.status} ${response.statusText}`,
      );
    }
    const history: ComfyHistoryResponse = await response.json();
    const entry = history[promptId];
    if (entry?.status?.status === "completed" || entry?.outputs) {
      return entry;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error("Timed out waiting for ComfyUI result");
};

const loadComfyImageAsBase64 = async (
  baseUrl: string,
  { filename, subfolder, type }: ComfyImageDescriptor,
) => {
  const query = new URLSearchParams({
    filename,
    subfolder: subfolder ?? "",
    type: type ?? "output",
  });
  const response = await fetch(`${baseUrl}/view?${query.toString()}`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch image ${filename}: ${response.status} ${response.statusText}`,
    );
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.toString("base64");
};

const toNumber = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

router.post(
  "/generate-image/comfy",
  async (req: Request, res: Response): Promise<void> => {
    const body = req.body ?? {};
    const { prompt } = body;

    const negativePrompt =
      typeof body.negativePrompt === "string" ? body.negativePrompt : "";
    const widthValue = toNumber(body.width, 512);
    const heightValue = toNumber(body.height, 512);
    const stepsValue = toNumber(body.steps, 20);
    const cfgScaleValue = toNumber(body.cfgScale, 8); // was 1.5
    const defaultSeed = Math.floor(Math.random() * 2 ** 32);
    const seedValue = toNumber(body.seed, defaultSeed);
    const samplerValue =
      typeof body.sampler === "string" && body.sampler.trim().length > 0
        ? body.sampler
        : "dpmpp_2m_sde";
    const schedulerValue =
      typeof body.scheduler === "string" && body.scheduler.trim().length > 0
        ? body.scheduler
        : "karras";
    const denoiseValue = toNumber(body.denoise, 1);
    let modelValue =
      typeof body.model === "string" && body.model.trim().length > 0
        ? body.model
        : DEFAULT_COMFY_MODEL;
    if (!modelValue || modelValue.trim().length === 0) {
      res.status(400).json({
        error: "Model is required",
        details: "Set COMFYUI_DEFAULT_MODEL or pass model in the request body.",
      });
      return;
    }
    modelValue = modelValue.trim();
    const filenamePrefix =
      typeof body.filenamePrefix === "string" &&
      body.filenamePrefix.trim().length > 0
        ? body.filenamePrefix
        : "ComfyUI";

    if (!prompt) {
      res.status(400).json({ error: "Prompt is required" });
      return;
    }

    try {
      const workflow = buildSDXLTurboWorkflow({
        prompt,
        negativePrompt,
        width: widthValue,
        height: heightValue,
        steps: stepsValue,
        cfgScale: cfgScaleValue,
        seed: seedValue,
        sampler: samplerValue,
        scheduler: schedulerValue,
        denoise: denoiseValue,
        model: modelValue,
        filenamePrefix,
      });

      const clientId = randomUUID();
      const queueResponse = await fetch(`${COMFY_BASE_URL}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: workflow,
          client_id: clientId,
        }),
      });

      if (!queueResponse.ok) {
        const errorText = await queueResponse.text();
        throw new Error(
          `ComfyUI prompt submission failed: ${queueResponse.status} ${queueResponse.statusText} - ${errorText}`,
        );
      }

      const { prompt_id: promptId } = (await queueResponse.json()) as {
        prompt_id: string;
      };

      if (!promptId) {
        throw new Error("ComfyUI did not return a prompt_id");
      }

      const result = await waitForComfyResult(
        COMFY_BASE_URL,
        promptId,
        COMFY_REQUEST_TIMEOUT_MS,
        COMFY_POLL_INTERVAL_MS,
      );

      const images: string[] = [];
      const outputs = result?.outputs ?? {};
      for (const nodeId of Object.keys(outputs)) {
        const node = outputs[nodeId];
        for (const image of node.images ?? []) {
          const imageData = await loadComfyImageAsBase64(COMFY_BASE_URL, image);
          images.push(imageData);
        }
      }

      if (images.length === 0) {
        res.status(502).json({
          error: "No images returned by ComfyUI",
          details: "Workflow completed without producing images",
        });
        return;
      }

      res.json({
        success: true,
        images,
        promptId,
        model: modelValue,
        metadata: {
          width: widthValue,
          height: heightValue,
          steps: stepsValue,
          cfgScale: cfgScaleValue,
          sampler: samplerValue,
          scheduler: schedulerValue,
          denoise: denoiseValue,
          filenamePrefix,
          clientId,
        },
      });
    } catch (error: unknown) {
      console.error("ComfyUI image generation failed:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({
        error: "Failed to generate image with ComfyUI",
        details: errorMessage,
      });
    }
  },
);

export default router;
