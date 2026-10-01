import { generateWithAnthropic } from "./providers/anthropic";
import { generateWithGoogle } from "./providers/google";
import { generateWithGrok } from "./providers/grok";
import { generateWithOllama } from "./providers/ollama";
import { generateWithOpenAI } from "./providers/openai";
import {
  ProviderAvailability,
  ProviderGenerateParams,
  TextGenerationError,
  TextGenerationRequest,
  TextGenerationResult,
  TextMessage,
  TextLLMProviderId,
} from "./types";

const DEFAULT_MODELS: Record<TextLLMProviderId, string> = {
  openai: "gpt-6.1-sol",
  anthropic: "claude-sonnet-5-5",
  google: "gemini-3.8-flash",
  ollama: "gemma4:26b",
  grok: "grok-4.7",
};

// At most three per company, its newest, default first (checked against
// each API's model list, 2026-10-01).
const PROVIDER_MODEL_SUGGESTIONS: Partial<Record<TextLLMProviderId, string[]>> =
  {
    openai: ["gpt-6.1-sol", "gpt-6-astra", "gpt-6-luna"],
    anthropic: ["claude-sonnet-5-5", "claude-opus-5-5", "claude-fable-5-1"],
    google: [
      "gemini-3.8-flash",
      "gemini-3.1-pro-preview",
      "gemini-3.5-flash-lite",
    ],
    grok: ["grok-4.7", "grok-4.6"],
    // Installed and checked with tools here; qwen3.5's tag is the MLX
    // build (Apple silicon only), nemotron-3-ultra runs on Ollama's cloud.
    ollama: ["gemma4:26b", "qwen3.5:27b-mlx", "nemotron-3-ultra:cloud"],
  };

function isSupportedRole(role: string): role is TextMessage["role"] {
  return (
    role === "system" ||
    role === "user" ||
    role === "assistant" ||
    role === "tool"
  );
}

function validateMessages(messages: TextMessage[]): void {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new TextGenerationError("At least one message is required", 400);
  }

  for (const message of messages) {
    if (!isSupportedRole(message.role)) {
      throw new TextGenerationError(
        `Unsupported message role: ${message.role}`,
        400,
      );
    }
    if (
      message.tool_calls === undefined &&
      (typeof message.content !== "string" ||
        message.content.trim().length === 0)
    ) {
      console.error("Message content must be a non-empty string", message);
      throw new TextGenerationError(
        "Message content must be a non-empty string",
        400,
      );
    }
  }
}

function extractSystemPrompt(messages: TextMessage[]): string | undefined {
  const systemMessages = messages.filter((msg) => msg.role === "system");
  if (systemMessages.length === 0) return undefined;

  return systemMessages
    .map((msg) => msg.content.trim())
    .filter((content) => content.length > 0)
    .join("\n\n");
}

function getConversationMessages(messages: TextMessage[]): TextMessage[] {
  return messages.filter((msg) => msg.role !== "system");
}

function buildProviderParams(
  request: TextGenerationRequest,
): ProviderGenerateParams {
  validateMessages(request.messages);

  const conversationMessages = getConversationMessages(request.messages);
  if (conversationMessages.length === 0) {
    throw new TextGenerationError(
      "At least one non-system message is required",
      400,
    );
  }

  const params: ProviderGenerateParams = {
    model: request.model,
    messages: request.messages,
    conversationMessages,
  };

  const systemPrompt = extractSystemPrompt(request.messages);
  if (systemPrompt) {
    params.systemPrompt = systemPrompt;
  }
  if (request.maxTokens !== undefined) {
    params.maxTokens = request.maxTokens;
  }
  if (request.temperature !== undefined) {
    params.temperature = request.temperature;
  }
  if (request.topP !== undefined) {
    params.topP = request.topP;
  }
  if (request.tools !== undefined) {
    params.tools = request.tools;
  }

  return params;
}

export async function generateText(
  request: TextGenerationRequest,
): Promise<TextGenerationResult> {
  if (!request.provider) {
    throw new TextGenerationError("Provider is required", 400);
  }

  if (!request.model) {
    throw new TextGenerationError("Model is required", 400);
  }

  const params = buildProviderParams(request);

  switch (request.provider) {
    case "openai":
      return generateWithOpenAI(params);
    case "anthropic":
      return generateWithAnthropic(params);
    case "google":
      return generateWithGoogle(params);
    case "ollama":
      return generateWithOllama(params);
    case "grok":
      return generateWithGrok(params);
    default: {
      const exhaustiveCheck: never = request.provider;
      throw new TextGenerationError(
        `Unsupported provider: ${exhaustiveCheck}`,
        400,
      );
    }
  }
}

function hasProviderCredentials(provider: TextLLMProviderId): boolean {
  switch (provider) {
    case "openai":
      return Boolean(process.env.OPENAI_API_KEY);
    case "anthropic":
      return Boolean(process.env.ANTHROPIC_API_KEY);
    case "google":
      return Boolean(process.env.GEMINI_API_KEY);
    case "grok":
      return Boolean(process.env.XAI_API_KEY);
    case "ollama":
      return true;
    default:
      return true;
  }
}

export function getProviderAvailability(): ProviderAvailability[] {
  // The order of the Configuration's Mode menu: the hosted companies, then
  // Ollama's local models.
  const providers: TextLLMProviderId[] = [
    "openai",
    "anthropic",
    "google",
    "grok",
    "ollama",
  ];

  return providers.map((provider) => {
    const base: ProviderAvailability = {
      provider,
      hasCredentials: hasProviderCredentials(provider),
    };

    const defaultModel = DEFAULT_MODELS[provider];
    if (defaultModel) {
      base.defaultModel = defaultModel;
    }

    const suggestions = PROVIDER_MODEL_SUGGESTIONS[provider];
    if (suggestions) {
      base.models = suggestions;
    }

    return base;
  });
}
