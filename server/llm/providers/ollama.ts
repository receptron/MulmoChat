import {
  TextGenerationError,
  type ProviderGenerateParams,
  type TextGenerationResult,
  type ToolCall,
} from "../types";

interface OllamaToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

interface OllamaChatResponse {
  message?: {
    role?: string;
    content?: string;
    tool_calls?: OllamaToolCall[];
  };
  response?: string;
  model?: string;
  total_duration?: number;
  load_duration?: number;
}

function getOllamaBaseUrl(): string {
  return (
    process.env.OLLAMA_BASE_URL?.replace(/\/?$/, "") ?? "http://127.0.0.1:11434"
  );
}

function stripCodeFence(content: string): string {
  const trimmed = content.trim();
  if (!trimmed.startsWith("```") || trimmed.lastIndexOf("```") === 0) {
    return trimmed;
  }

  const firstFence = trimmed.indexOf("\n");
  if (firstFence === -1) {
    return trimmed;
  }

  const withoutFence = trimmed.slice(firstFence + 1);
  const closingIndex = withoutFence.lastIndexOf("```");
  if (closingIndex === -1) {
    return trimmed;
  }

  return withoutFence.slice(0, closingIndex).trim();
}

function normalizeToolCallsFromText(text: string): ToolCall[] {
  if (!text?.trim()) {
    return [];
  }

  const candidate = stripCodeFence(text);

  try {
    const parsed = JSON.parse(candidate);
    const asArray = Array.isArray(parsed) ? parsed : [parsed];

    const calls: ToolCall[] = [];
    asArray.forEach((item, index) => {
      if (!item || typeof item !== "object") {
        return;
      }
      const name = (item as { name?: unknown }).name;
      const args = (item as { arguments?: unknown }).arguments;

      if (typeof name !== "string" || !name) {
        return;
      }

      const serializedArgs =
        typeof args === "string" ? args : JSON.stringify(args ?? {});

      calls.push({
        id: `fallback_call_${Date.now()}_${index}`,
        name,
        arguments: serializedArgs,
      });
    });

    return calls;
  } catch {
    return [];
  }
}

export async function generateWithOllama(
  params: ProviderGenerateParams,
): Promise<TextGenerationResult> {
  const baseUrl = getOllamaBaseUrl();

  const requestBody: Record<string, unknown> = {
    model: params.model,
    stream: false,
    messages: params.messages.map((message) => {
      const baseMessage: Record<string, unknown> = {
        role: message.role,
        content: message.content,
      };

      // Include tool_call_id for tool messages
      if (message.role === "tool" && message.tool_call_id) {
        // Ollama doesn't have native tool_call_id support, format in content
        baseMessage.content = `Tool result for ${message.tool_call_id}: ${message.content}`;
      }

      // Include tool_calls for assistant messages
      if (message.role === "assistant" && message.tool_calls) {
        baseMessage.tool_calls = message.tool_calls.map((tc) => ({
          function: {
            name: tc.name,
            arguments: JSON.parse(tc.arguments),
          },
        }));
      }

      return baseMessage;
    }),
    options: {
      temperature: params.temperature,
      num_predict: params.maxTokens,
      top_p: params.topP,
    },
  };

  // Add tools if provided (Ollama supports OpenAI-compatible tool format)
  if (params.tools !== undefined && params.tools.length > 0) {
    requestBody.tools = params.tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new TextGenerationError(
      `Ollama API error: ${response.status} ${response.statusText} - ${errorText}`,
      response.status,
    );
  }

  const data = (await response.json()) as OllamaChatResponse;
  const text = data.message?.content ?? data.response ?? "";

  // Extract tool calls if present
  let toolCalls: ToolCall[] = [];

  // First, try to extract native tool calls from Ollama response
  if (data.message?.tool_calls && data.message.tool_calls.length > 0) {
    for (const tc of data.message.tool_calls) {
      toolCalls.push({
        id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
        name: tc.function.name,
        arguments: JSON.stringify(tc.function.arguments),
      });
    }
  }

  // Fallback: If no native tool calls but text looks like JSON tool calls,
  // try to parse tool calls from text (for models like phi-4-mini that
  // return tool calls as JSON in the response text)
  if (toolCalls.length === 0 && text.trim()) {
    const fallbackCalls = normalizeToolCallsFromText(text);
    if (fallbackCalls.length > 0) {
      toolCalls = fallbackCalls;
    }
  }

  return {
    provider: "ollama",
    model: params.model,
    text,
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
    rawResponse: data,
  };
}
