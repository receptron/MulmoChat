export const TEXT_MODEL_PROVIDERS = [
  "openai",
  "anthropic",
  "google",
  "ollama",
] as const;

export type TextModelProvider = (typeof TEXT_MODEL_PROVIDERS)[number];

export interface ResolvedTextModel {
  provider: TextModelProvider;
  model: string;
  rawId: string;
}

const DEFAULT_MODEL_ID = "openai:gpt-6.1-sol";

export const DEFAULT_TEXT_MODEL: ResolvedTextModel = {
  provider: "openai",
  model: "gpt-6.1-sol",
  rawId: DEFAULT_MODEL_ID,
};

function isTextProvider(value: string): value is TextModelProvider {
  return (TEXT_MODEL_PROVIDERS as readonly string[]).includes(value);
}

export function resolveTextModelId(modelId?: string | null): ResolvedTextModel {
  if (!modelId) {
    return DEFAULT_TEXT_MODEL;
  }

  const trimmed = modelId.trim();
  if (!trimmed) {
    return DEFAULT_TEXT_MODEL;
  }

  const separatorIndex = trimmed.indexOf(":");
  if (separatorIndex <= 0) {
    return DEFAULT_TEXT_MODEL;
  }

  const provider = trimmed.slice(0, separatorIndex);
  const model = trimmed.slice(separatorIndex + 1).trim();

  if (!isTextProvider(provider) || !model) {
    return DEFAULT_TEXT_MODEL;
  }

  return {
    provider,
    model,
    rawId: trimmed,
  };
}
