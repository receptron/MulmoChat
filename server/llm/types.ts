export type TextLLMProviderId =
  | "openai"
  | "anthropic"
  | "google"
  | "ollama"
  | "grok";

export interface TextMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string; // Required when role is "tool"
  tool_calls?: ToolCall[]; // Present when assistant makes tool calls
}

export interface ToolDefinition {
  type: "function";
  name: string;
  description?: string;
  parameters?: unknown;
}

export interface TextGenerationRequest {
  provider: TextLLMProviderId;
  model: string;
  messages: TextMessage[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  tools?: ToolDefinition[];
}

export interface ProviderGenerateParams {
  model: string;
  messages: TextMessage[];
  conversationMessages: TextMessage[];
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  tools?: ToolDefinition[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
  thoughtSignature?: string; // Gemini 3 thought signature (required for Google provider)
}

export interface TextGenerationResult {
  provider: TextLLMProviderId;
  model: string;
  text: string;
  toolCalls?: ToolCall[];
  usage?: Record<string, number>;
  rawResponse?: unknown;
}

export interface ProviderAvailability {
  provider: TextLLMProviderId;
  hasCredentials: boolean;
  defaultModel?: string;
  models?: string[];
}

export interface TextSessionDefaults {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

export interface TextSessionSnapshot {
  id: string;
  provider: TextLLMProviderId;
  model: string;
  messages: TextMessage[];
  defaults: TextSessionDefaults;
  tools?: ToolDefinition[];
  createdAt: number;
  updatedAt: number;
}

export class TextGenerationError extends Error {
  statusCode: number | undefined;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "TextGenerationError";
    this.statusCode = statusCode;
  }
}
