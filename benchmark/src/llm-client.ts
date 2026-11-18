/**
 * LLM Client Abstraction
 *
 * Provides unified interface for calling different LLM providers
 * (OpenAI, Anthropic, Google Gemini) for spreadsheet generation.
 */

import type { LLMClient, LLMConfig, LLMResponse } from "./types";

/**
 * Time a request; a thrown error becomes an empty response carrying the message
 */
async function timedRequest(
  request: () => Promise<Omit<LLMResponse, "latency">>,
): Promise<LLMResponse> {
  const startTime = Date.now();

  try {
    const response = await request();
    return { ...response, latency: Date.now() - startTime };
  } catch (error) {
    return {
      content: "",
      latency: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function postJSON(
  providerLabel: string,
  url: string,
  headers: Record<string, string>,
  body: unknown,
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${providerLabel} API error: ${response.status} ${errorText}`);
  }

  return await response.json();
}

interface ChatMessage {
  role: "system" | "user";
  content: string;
}

function chatMessages(prompt: string, systemPrompt?: string): ChatMessage[] {
  return [
    ...(systemPrompt
      ? [{ role: "system" as const, content: systemPrompt }]
      : []),
    { role: "user" as const, content: prompt },
  ];
}

interface ChatCompletionBody {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * Parse an OpenAI-compatible chat completion (OpenAI, Grok)
 */
function chatCompletionResponse(
  data: ChatCompletionBody,
): Omit<LLMResponse, "latency"> {
  // Use optional chaining to handle potential API variations
  const message = data.choices?.[0]?.message;
  const content = message?.content ?? "";

  return {
    content,
    usage: {
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
      totalTokens: data.usage?.total_tokens || 0,
    },
  };
}

/**
 * OpenAI API Client
 */
class OpenAIClient implements LLMClient {
  public readonly name: string;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    if (config.provider !== "openai") {
      throw new Error("OpenAIClient requires provider to be 'openai'");
    }
    this.config = config;
    this.name = `OpenAI ${config.model}`;
  }

  async generateSpreadsheet(
    prompt: string,
    systemPrompt?: string,
  ): Promise<LLMResponse> {
    return timedRequest(async () => {
      // Determine which token parameter to use based on model
      // GPT-5+ models use max_completion_tokens, older models use max_tokens
      const useNewTokenParam = this.config.model.startsWith("gpt-5");
      const tokenParam = useNewTokenParam ? "max_completion_tokens" : "max_tokens";

      const requestBody: any = {
        model: this.config.model,
        messages: [
          {
            role: "system",
            content: systemPrompt || this.config.systemPrompt,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: this.config.temperature || 0,
      };

      // Add the appropriate token limit parameter
      requestBody[tokenParam] = this.config.maxTokens || 4000;

      const data = await postJSON(
        "OpenAI",
        "https://api.openai.com/v1/chat/completions",
        { Authorization: `Bearer ${this.config.apiKey}` },
        requestBody,
      );
      return chatCompletionResponse(data);
    });
  }
}

/**
 * Anthropic API Client
 */
class AnthropicClient implements LLMClient {
  public readonly name: string;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    if (config.provider !== "anthropic") {
      throw new Error("AnthropicClient requires provider to be 'anthropic'");
    }
    this.config = config;
    this.name = `Anthropic ${config.model}`;
  }

  async generateSpreadsheet(
    prompt: string,
    systemPrompt?: string,
  ): Promise<LLMResponse> {
    return timedRequest(async () => {
      const data = await postJSON(
        "Anthropic",
        "https://api.anthropic.com/v1/messages",
        {
          "x-api-key": this.config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        {
          model: this.config.model,
          max_tokens: this.config.maxTokens || 4000,
          temperature: this.config.temperature || 0,
          system: systemPrompt || this.config.systemPrompt,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        },
      );

      // Use optional chaining to handle potential API variations
      const content = data.content?.[0]?.text ?? "";

      return {
        content,
        usage: {
          promptTokens: data.usage?.input_tokens || 0,
          completionTokens: data.usage?.output_tokens || 0,
          totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
      };
    });
  }
}

/**
 * Google Gemini API Client
 */
class GeminiClient implements LLMClient {
  public readonly name: string;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    if (config.provider !== "google") {
      throw new Error("GeminiClient requires provider to be 'google'");
    }
    this.config = config;
    this.name = `Google ${config.model}`;
  }

  async generateSpreadsheet(
    prompt: string,
    systemPrompt?: string,
  ): Promise<LLMResponse> {
    return timedRequest(async () => {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

      const fullPrompt = systemPrompt
        ? `${systemPrompt}\n\n${prompt}`
        : `${this.config.systemPrompt}\n\n${prompt}`;

      const data = await postJSON("Gemini", url, {}, {
        contents: [
          {
            parts: [
              {
                text: fullPrompt,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: this.config.temperature || 0,
          maxOutputTokens: this.config.maxTokens || 4000,
        },
      });

      // Extract text from Gemini response
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

      return {
        content,
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount || 0,
          completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: data.usageMetadata?.totalTokenCount || 0,
        },
      };
    });
  }
}

/**
 * Ollama API Client (Local)
 */
class OllamaClient implements LLMClient {
  public readonly name: string;
  private config: LLMConfig;
  private baseUrl: string;

  constructor(config: LLMConfig) {
    if (config.provider !== "ollama") {
      throw new Error("OllamaClient requires provider to be 'ollama'");
    }
    this.config = config;
    this.name = `Ollama ${config.model}`;
    this.baseUrl = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
  }

  async generateSpreadsheet(
    prompt: string,
    systemPrompt?: string,
  ): Promise<LLMResponse> {
    return timedRequest(async () => {
      const data = await postJSON("Ollama", `${this.baseUrl}/api/chat`, {}, {
        model: this.config.model,
        messages: chatMessages(prompt, systemPrompt || this.config.systemPrompt),
        stream: false,
        options: {
          temperature: this.config.temperature || 0,
          num_predict: this.config.maxTokens || 4000,
        },
      });

      return {
        content: data.message?.content || data.response || "",
      };
    });
  }
}

/**
 * Grok/xAI API Client
 */
class GrokClient implements LLMClient {
  public readonly name: string;
  private config: LLMConfig;

  constructor(config: LLMConfig) {
    if (config.provider !== "grok") {
      throw new Error("GrokClient requires provider to be 'grok'");
    }
    this.config = config;
    this.name = `Grok ${config.model}`;
  }

  async generateSpreadsheet(
    prompt: string,
    systemPrompt?: string,
  ): Promise<LLMResponse> {
    return timedRequest(async () => {
      const data = await postJSON(
        "Grok",
        "https://api.x.ai/v1/chat/completions",
        { Authorization: `Bearer ${this.config.apiKey}` },
        {
          model: this.config.model,
          messages: chatMessages(prompt, systemPrompt || this.config.systemPrompt),
          temperature: this.config.temperature || 0,
          max_tokens: this.config.maxTokens || 4000,
        },
      );
      return chatCompletionResponse(data);
    });
  }
}

/**
 * Create LLM client based on configuration
 */
export function createLLMClient(config: LLMConfig): LLMClient {
  switch (config.provider) {
    case "openai":
      return new OpenAIClient(config);
    case "anthropic":
      return new AnthropicClient(config);
    case "google":
      return new GeminiClient(config);
    case "ollama":
      return new OllamaClient(config);
    case "grok":
      return new GrokClient(config);
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}

/**
 * Extract JSON from LLM response
 * Handles cases where LLM wraps JSON in markdown code blocks
 */
export function extractJSON(content: string): string {
  // Try to parse as-is first
  try {
    JSON.parse(content);
    return content;
  } catch {
    // Not valid JSON, try to extract from markdown
  }

  // Look for JSON in markdown code blocks
  const jsonBlockMatch = content.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim();
  }

  // Look for JSON object anywhere in the content
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return jsonMatch[0].trim();
  }

  // Return original content if no JSON found
  return content;
}
