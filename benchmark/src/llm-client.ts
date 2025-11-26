/**
 * LLM Client Abstraction
 *
 * Provides unified interface for calling different LLM providers
 * (OpenAI, Anthropic, Google Gemini) for spreadsheet generation.
 */

import type { LLMClient, LLMConfig, LLMResponse } from "./types";

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
    const startTime = Date.now();

    try {
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

      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

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
        latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        content: "",
        latency,
        error: error instanceof Error ? error.message : String(error),
      };
    }
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
    const startTime = Date.now();

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.config.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
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
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Anthropic API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      // Use optional chaining to handle potential API variations
      const content = data.content?.[0]?.text ?? "";

      return {
        content,
        usage: {
          promptTokens: data.usage?.input_tokens || 0,
          completionTokens: data.usage?.output_tokens || 0,
          totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
        latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        content: "",
        latency,
        error: error instanceof Error ? error.message : String(error),
      };
    }
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
    const startTime = Date.now();

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent?key=${this.config.apiKey}`;

      const fullPrompt = systemPrompt
        ? `${systemPrompt}\n\n${prompt}`
        : `${this.config.systemPrompt}\n\n${prompt}`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      // Extract text from Gemini response
      const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

      return {
        content,
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount || 0,
          completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: data.usageMetadata?.totalTokenCount || 0,
        },
        latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        content: "",
        latency,
        error: error instanceof Error ? error.message : String(error),
      };
    }
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
    const startTime = Date.now();

    try {
      const messages: any[] = [];

      if (systemPrompt || this.config.systemPrompt) {
        messages.push({
          role: "system",
          content: systemPrompt || this.config.systemPrompt,
        });
      }

      messages.push({
        role: "user",
        content: prompt,
      });

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          stream: false,
          options: {
            temperature: this.config.temperature || 0,
            num_predict: this.config.maxTokens || 4000,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      return {
        content: data.message?.content || data.response || "",
        latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        content: "",
        latency,
        error: error instanceof Error ? error.message : String(error),
      };
    }
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
    const startTime = Date.now();

    try {
      const messages: any[] = [];

      if (systemPrompt || this.config.systemPrompt) {
        messages.push({
          role: "system",
          content: systemPrompt || this.config.systemPrompt,
        });
      }

      messages.push({
        role: "user",
        content: prompt,
      });

      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: this.config.temperature || 0,
          max_tokens: this.config.maxTokens || 4000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Grok API error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      // Use optional chaining like server implementation
      const message = data.choices?.[0]?.message;
      const content = message?.content ?? "";

      return {
        content,
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        latency,
      };
    } catch (error) {
      const latency = Date.now() - startTime;
      return {
        content: "",
        latency,
        error: error instanceof Error ? error.message : String(error),
      };
    }
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
