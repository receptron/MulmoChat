// Image generation models offered in the settings UI. `label` is shown in the
// model dropdown, `shortLabel` in the header status line.

export const GEMINI_IMAGE_MODELS = [
  {
    id: "gemini-2.5-flash-image",
    label: "Nano Banana (Gemini 2.5 Flash Image)",
    shortLabel: "Nano Banana",
  },
  {
    id: "gemini-3.1-flash-image",
    label: "Nano Banana 2 (Gemini 3.1 Flash Image)",
    shortLabel: "Nano Banana 2",
  },
  {
    id: "gemini-3.1-flash-lite-image",
    label: "Nano Banana 2 Lite (Gemini 3.1 Flash Lite Image)",
    shortLabel: "Nano Banana 2 Lite",
  },
  {
    id: "gemini-3-pro-image",
    label: "Nano Banana Pro (Gemini 3 Pro Image)",
    shortLabel: "Nano Banana Pro",
  },
] as const;

export const OPENAI_IMAGE_MODELS = [
  { id: "gpt-image-1", label: "GPT Image 1", shortLabel: "GPT Image 1" },
  {
    id: "gpt-image-1-mini",
    label: "GPT Image 1 Mini",
    shortLabel: "GPT Image 1 Mini",
  },
  { id: "gpt-image-1.5", label: "GPT Image 1.5", shortLabel: "GPT Image 1.5" },
  { id: "gpt-image-2", label: "GPT Image 2", shortLabel: "GPT Image 2" },
  {
    id: "gpt-image-2.5-flare",
    label: "GPT Image 2.5 Flare (fast)",
    shortLabel: "GPT Image 2.5 Flare",
  },
  {
    id: "gpt-image-2.5-sunburst",
    label: "GPT Image 2.5 Sunburst (most capable)",
    shortLabel: "GPT Image 2.5 Sunburst",
  },
] as const;

export type GeminiImageModelId = (typeof GEMINI_IMAGE_MODELS)[number]["id"];
export type OpenAIImageModelId = (typeof OPENAI_IMAGE_MODELS)[number]["id"];

// Used when the user has not picked a model. Keep in sync with
// server/utils/imageModelDefaults.ts.
export const DEFAULT_GEMINI_IMAGE_MODEL: GeminiImageModelId =
  "gemini-3.1-flash-image";
export const DEFAULT_OPENAI_IMAGE_MODEL: OpenAIImageModelId =
  "gpt-image-2.5-flare";

// Preview IDs saved by earlier versions, mapped to their stable releases
const RENAMED_GEMINI_IMAGE_MODELS: Readonly<
  Record<string, GeminiImageModelId>
> = {
  "gemini-3.1-flash-image-preview": "gemini-3.1-flash-image",
  "gemini-3-pro-image-preview": "gemini-3-pro-image",
};

/** A saved Gemini image model ID, or the default when it is not offered. */
export function resolveGeminiImageModel(id: unknown): GeminiImageModelId {
  const renamed =
    typeof id === "string" ? (RENAMED_GEMINI_IMAGE_MODELS[id] ?? id) : id;
  return (
    GEMINI_IMAGE_MODELS.find((m) => m.id === renamed)?.id ??
    DEFAULT_GEMINI_IMAGE_MODEL
  );
}

/** A saved OpenAI image model ID, or the default when it is not offered. */
export function resolveOpenAIImageModel(id: unknown): OpenAIImageModelId {
  return (
    OPENAI_IMAGE_MODELS.find((m) => m.id === id)?.id ??
    DEFAULT_OPENAI_IMAGE_MODEL
  );
}

/** Short name of the image model in use, for the header status line. */
export function imageModelShortLabel(config: {
  backend: string;
  geminiModel: GeminiImageModelId;
  openaiModel: OpenAIImageModelId;
}): string {
  if (config.backend === "comfyui") return "ComfyUI";
  if (config.backend === "openai") {
    return (
      OPENAI_IMAGE_MODELS.find((m) => m.id === config.openaiModel)
        ?.shortLabel ?? config.openaiModel
    );
  }
  return (
    GEMINI_IMAGE_MODELS.find((m) => m.id === config.geminiModel)?.shortLabel ??
    config.geminiModel
  );
}
