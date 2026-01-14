import Anthropic from "@anthropic-ai/sdk";
import type { MessageCreateParamsNonStreaming } from "@anthropic-ai/sdk/resources/messages";
import {
  TextGenerationError,
  type ProviderGenerateParams,
  type TextGenerationResult,
  type TextMessage,
  type ToolCall,
} from "../types";

type AnthropicRole = "user" | "assistant";

function toAnthropicMessages(messages: TextMessage[]) {
  return messages.map((message) => {
    const role: AnthropicRole =
      message.role === "assistant" ? "assistant" : "user";

    // For tool messages, use Anthropic's tool_result content type
    if (message.role === "tool" && message.tool_call_id) {
      return {
        role: "user" as const,
        content: [
          {
            type: "tool_result" as const,
            tool_use_id: message.tool_call_id,
            content: message.content,
          },
        ],
      };
    }

    // For assistant messages with tool calls
    if (message.role === "assistant" && message.tool_calls) {
      const content: Array<{ type: string; [key: string]: unknown }> = [];

      // Add text content if present
      if (message.content) {
        content.push({
          type: "text",
          text: message.content,
        });
      }

      // Add tool use blocks
      for (const toolCall of message.tool_calls) {
        content.push({
          type: "tool_use",
          id: toolCall.id,
          name: toolCall.name,
          input: JSON.parse(toolCall.arguments),
        });
      }

      return {
        role: "assistant" as const,
        content,
      };
    }

    return {
      role,
      content: [
        {
          type: "text" as const,
          text: message.content,
        },
      ],
    };
  });
}

export async function generateWithAnthropic(
  params: ProviderGenerateParams,
): Promise<TextGenerationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new TextGenerationError(
      "ANTHROPIC_API_KEY environment variable not set",
      500,
    );
  }

  const client = new Anthropic({ apiKey });

  const messageParams: MessageCreateParamsNonStreaming = {
    model: params.model,
    max_tokens: params.maxTokens ?? 8192,
    messages: toAnthropicMessages(
      params.conversationMessages,
    ) as MessageCreateParamsNonStreaming["messages"],
  };

  if (params.temperature !== undefined) {
    messageParams.temperature = params.temperature;
  }
  if (params.topP !== undefined) {
    messageParams.top_p = params.topP;
  }
  if (params.systemPrompt) {
    messageParams.system = params.systemPrompt;
  }
  if (params.tools !== undefined && params.tools.length > 0) {
    messageParams.tools = params.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters as {
        type: "object";
        properties?: Record<string, unknown>;
        required?: string[];
      },
    }));
  }

  const response = await client.messages.create(messageParams);

  const text = response.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");

  // Extract tool calls from response
  const toolCalls: ToolCall[] = [];
  for (const block of response.content) {
    if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        name: block.name,
        arguments: JSON.stringify(block.input),
      });
    }
  }

  const usage = response.usage
    ? {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens:
          (response.usage.input_tokens ?? 0) +
          (response.usage.output_tokens ?? 0),
      }
    : undefined;

  return {
    provider: "anthropic",
    model: params.model,
    text,
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
    ...(usage ? { usage } : {}),
    rawResponse: response,
  };
}
