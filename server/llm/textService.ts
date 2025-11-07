import { generateWithAnthropic } from "./providers/anthropic";
import { generateWithGoogle } from "./providers/google";
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
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-sonnet-latest",
  google: "gemini-2.5-flash",
  ollama: "gpt-oss:20b",
};

const PROVIDER_MODEL_SUGGESTIONS: Partial<Record<TextLLMProviderId, string[]>> =
  {
    openai: [
      "gpt-5",
      "gpt-5-mini",
      "gpt-5-nano",
      "gpt-4.1",
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4.1-mini",
    ],
    anthropic: [
      "claude-3-5-sonnet-latest",
      "claude-3-5-haiku-latest",
      "claude-sonnet-4-5",
      "claude-haiku-4-5",
      "claude-opus-4-1-20250805",
    ],
    google: ["gemini-2.5-pro", "gemini-2.5-flash"],
    ollama: [
      "gpt-oss:20b",
      "qwen3:30b",
      "phi4-mini:latest",
      // "deepseek-r1:32b", no tools
      // "gemma3:27b", no tools
      // "deepseek-coder:33b", no tools
      // "llama3.3:70b", no tools
      // "nemotron:70b", no tools
    ],
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
    default: {
      const exhaustiveCheck: never = request.provider;
      throw new TextGenerationError(
        `Unsupported provider: ${exhaustiveCheck}`,
        400,
      );
    }
  }
}

export function getProviderAvailability(): ProviderAvailability[] {
  const providers: TextLLMProviderId[] = [
    "openai",
    "anthropic",
    "google",
    "ollama",
  ];

  return providers.map((provider) => {
    const base: ProviderAvailability = {
      provider,
      hasCredentials:
        provider === "openai"
          ? Boolean(process.env.OPENAI_API_KEY)
          : provider === "anthropic"
            ? Boolean(process.env.ANTHROPIC_API_KEY)
            : provider === "google"
              ? Boolean(process.env.GEMINI_API_KEY)
              : true,
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
