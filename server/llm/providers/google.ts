import { GoogleGenAI, type GenerateContentParameters } from "@google/genai";
import {
  TextGenerationError,
  type ProviderGenerateParams,
  type TextGenerationResult,
  type TextMessage,
  type ToolCall,
} from "../types";

type GeminiRole = "user" | "model";

type GeminiPart =
  | { text: string }
  | {
      functionCall: { name: string; args: Record<string, unknown> };
      thoughtSignature?: string; // Gemini 3 thought signature
    }
  | {
      functionResponse: { name: string; response: Record<string, unknown> };
      thoughtSignature?: string; // Gemini 3 thought signature
    };

type GeminiContent = {
  role: GeminiRole;
  parts: GeminiPart[];
};

function toGeminiRole(role: TextMessage["role"]): GeminiRole {
  return role === "assistant" ? "model" : "user";
}

function toGeminiMessages(messages: TextMessage[]): GeminiContent[] {
  return messages.map((message, index) => {
    const role = toGeminiRole(message.role);
    const parts: GeminiPart[] = [];

    // Handle tool result messages
    if (message.role === "tool" && message.tool_call_id) {
      // Find the corresponding tool call in previous assistant messages to get thought signature
      let thoughtSignature: string | undefined;
      let functionName = message.tool_call_id; // Default to tool_call_id

      // Search backwards for the assistant message with matching tool call
      for (let i = index - 1; i >= 0; i--) {
        const prevMsg = messages[i];
        if (prevMsg.role === "assistant" && prevMsg.tool_calls) {
          const matchingToolCall = prevMsg.tool_calls.find(
            (tc) => tc.id === message.tool_call_id,
          );
          if (matchingToolCall) {
            functionName = matchingToolCall.name;
            thoughtSignature = matchingToolCall.thoughtSignature;
            break;
          }
        }
      }

      // Build function response with thought signature if present (required for Gemini 3)
      parts.push({
        functionResponse: {
          name: functionName,
          response: { result: message.content },
        },
        // Include thought signature if found (critical for Gemini 3 function calling)
        ...(thoughtSignature ? { thoughtSignature } : {}),
      });
    }
    // Handle assistant messages with tool calls
    else if (message.role === "assistant" && message.tool_calls) {
      if (message.content) {
        parts.push({ text: message.content });
      }
      for (const toolCall of message.tool_calls) {
        // Include thought signature if present (for preserving in conversation history)
        parts.push({
          functionCall: {
            name: toolCall.name,
            args: JSON.parse(toolCall.arguments),
          },
          ...(toolCall.thoughtSignature
            ? { thoughtSignature: toolCall.thoughtSignature }
            : {}),
        });
      }
    }
    // Regular text messages
    else {
      parts.push({ text: message.content });
    }

    return { role, parts };
  });
}

function extractTextFromCandidates(candidates: unknown): string {
  if (!Array.isArray(candidates)) return "";
  for (const candidate of candidates) {
    const content = (
      candidate as { content?: { parts?: Array<{ text?: string }> } }
    ).content;
    const parts = content?.parts;
    if (!Array.isArray(parts)) continue;
    for (const part of parts) {
      if (part?.text) {
        return part.text;
      }
    }
  }
  return "";
}

function extractToolCallsFromCandidates(candidates: unknown): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  if (!Array.isArray(candidates)) return toolCalls;

  for (const candidate of candidates) {
    const content = (
      candidate as {
        content?: {
          parts?: Array<{
            functionCall?: { name: string; args: Record<string, unknown> };
            thoughtSignature?: string;
          }>;
        };
      }
    ).content;
    const parts = content?.parts;
    if (!Array.isArray(parts)) continue;

    for (const part of parts) {
      if (part?.functionCall) {
        const toolCall: ToolCall = {
          id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args),
        };

        // Include thought signature if present (required for Gemini 3)
        if (part.thoughtSignature) {
          toolCall.thoughtSignature = part.thoughtSignature;
        }

        toolCalls.push(toolCall);
      }
    }
  }

  return toolCalls;
}

function normalizeModelId(model: string): string {
  if (model.startsWith("models/")) {
    return model;
  }
  return `models/${model}`;
}

export async function generateWithGoogle(
  params: ProviderGenerateParams,
): Promise<TextGenerationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new TextGenerationError(
      "GEMINI_API_KEY environment variable not set",
      500,
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  const contents = toGeminiMessages(params.conversationMessages);

  const generationConfigEntries: Array<[string, number]> = [];
  if (params.maxTokens !== undefined) {
    generationConfigEntries.push(["maxOutputTokens", params.maxTokens]);
  }
  if (params.temperature !== undefined) {
    generationConfigEntries.push(["temperature", params.temperature]);
  }
  if (params.topP !== undefined) {
    generationConfigEntries.push(["topP", params.topP]);
  }

  const requestBody: GenerateContentParameters = {
    model: normalizeModelId(params.model),
    contents,
  };

  // Build config object for generation settings, tools, and toolConfig
  const config: Record<string, unknown> = {};

  // Use systemInstruction parameter for system prompts (Gemini-specific)
  if (params.systemPrompt) {
    config.systemInstruction = params.systemPrompt;
  }

  if (generationConfigEntries.length > 0) {
    config.generationConfig = Object.fromEntries(generationConfigEntries);
  }

  // Add tools if provided - tools and toolConfig go inside config object
  if (params.tools !== undefined && params.tools.length > 0) {
    config.tools = [
      {
        functionDeclarations: params.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        })),
      },
    ];

    // Configure tool calling mode
    const allowedFunctionNames = params.tools.map((tool) => tool.name);
    config.toolConfig = {
      functionCallingConfig: {
        mode: "ANY", // AUTO, ANY, or NONE
        allowedFunctionNames, // Explicitly list which functions can be called
      },
    };
  }

  // Add config to request body if it has any settings
  if (Object.keys(config).length > 0) {
    requestBody.config = config as GenerateContentParameters["config"];
  }

  // generateContent automatically handles thought signatures when full conversation
  // history is provided (SDK v1.33.0+). Thought signatures are preserved in the
  // response and automatically validated on subsequent requests.
  const response = await ai.models.generateContent(requestBody);

  const text = extractTextFromCandidates(response.candidates) ?? "";
  const toolCalls = extractToolCallsFromCandidates(response.candidates);

  const usageMetadata = response.usageMetadata;
  const usage = usageMetadata
    ? {
        inputTokens: usageMetadata.promptTokenCount ?? 0,
        outputTokens: usageMetadata.candidatesTokenCount ?? 0,
        totalTokens: usageMetadata.totalTokenCount ?? 0,
      }
    : undefined;

  return {
    provider: "google",
    model: params.model,
    text,
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
    ...(usage ? { usage } : {}),
    rawResponse: response,
  };
}
