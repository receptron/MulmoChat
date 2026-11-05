import {
  TextGenerationError,
  type ProviderGenerateParams,
  type TextGenerationResult,
  type TextLLMProviderId,
  type TextMessage,
  type ToolDefinition,
} from "../types.js";

// The OpenAI chat completions format, which xAI (Grok) also speaks.

interface ChatCompletionToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatCompletionResponse {
  choices: Array<{
    message: {
      role: string;
      content?: string;
      tool_calls?: ChatCompletionToolCall[];
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export const toChatCompletionMessages = (messages: TextMessage[]) =>
  messages.map((message) => {
    const baseMessage: Record<string, unknown> = {
      role: message.role,
      content: message.content,
    };

    // Include tool_call_id for tool messages
    if (message.role === "tool" && message.tool_call_id) {
      baseMessage.tool_call_id = message.tool_call_id;
    }

    // Images for the model go in the content as image_url parts
    if (message.images?.length) {
      baseMessage.content = [
        { type: "text", text: message.content },
        ...message.images.map((url) => ({
          type: "image_url",
          image_url: { url },
        })),
      ];
    }

    // Include tool_calls for assistant messages
    if (message.role === "assistant" && message.tool_calls) {
      baseMessage.tool_calls = message.tool_calls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: {
          name: tc.name,
          arguments: tc.arguments,
        },
      }));
    }

    return baseMessage;
  });

export const toChatCompletionSampling = (params: ProviderGenerateParams) => ({
  ...(params.maxTokens !== undefined ? { max_tokens: params.maxTokens } : {}),
  ...(params.temperature !== undefined
    ? { temperature: params.temperature }
    : {}),
  ...(params.topP !== undefined ? { top_p: params.topP } : {}),
});

export const toFunctionTools = (tools: ToolDefinition[]) =>
  tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));

export const hasTools = (
  params: ProviderGenerateParams,
): params is ProviderGenerateParams & { tools: ToolDefinition[] } =>
  params.tools !== undefined && params.tools.length > 0;

export const toChatCompletionRequest = (
  params: ProviderGenerateParams,
): Record<string, unknown> => ({
  model: params.model,
  messages: toChatCompletionMessages(params.messages),
  ...toChatCompletionSampling(params),
  ...(hasTools(params) ? { tools: toFunctionTools(params.tools) } : {}),
});

export async function postProviderJson<TResponse>(
  url: string,
  body: Record<string, unknown>,
  provider: { apiLabel: string; apiKey?: string },
): Promise<TResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: provider.apiKey
      ? {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        }
      : { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new TextGenerationError(
      `${provider.apiLabel} API error: ${response.status} ${response.statusText} - ${errorText}`,
      response.status,
    );
  }

  return response.json();
}

export const toChatCompletionResult = (
  data: ChatCompletionResponse,
  provider: TextLLMProviderId,
  model: string,
): TextGenerationResult => {
  const message = data.choices?.[0]?.message;
  const text = message?.content ?? "";
  const toolCalls = message?.tool_calls?.map((tc) => ({
    id: tc.id,
    name: tc.function.name,
    arguments: tc.function.arguments,
  }));

  const usage = data.usage
    ? {
        promptTokens: data.usage.prompt_tokens ?? 0,
        completionTokens: data.usage.completion_tokens ?? 0,
        totalTokens: data.usage.total_tokens ?? 0,
      }
    : undefined;

  return {
    provider,
    model,
    text,
    ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
    ...(usage ? { usage } : {}),
    rawResponse: data,
  };
};
