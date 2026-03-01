import {
  FunctionCallingConfigMode,
  GoogleGenAI,
  type Content,
  type GenerateContentConfig,
  type Part,
  type Schema,
} from "@google/genai";
import {
  TextGenerationError,
  type ProviderGenerateParams,
  type TextGenerationResult,
  type TextMessage,
  type ToolCall,
} from "../types";

type GeminiRole = "user" | "model";

function toGeminiRole(role: TextMessage["role"]): GeminiRole {
  return role === "assistant" ? "model" : "user";
}

function toGeminiMessages(messages: TextMessage[]): Content[] {
  return messages.map((message, index) => {
    const role = toGeminiRole(message.role);
    const parts: Part[] = [];

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
        thoughtSignature,
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
          thoughtSignature: toolCall.thoughtSignature,
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

function extractToolCallsFromCandidates(candidates: unknown): ToolCall[] {
  const toolCalls: ToolCall[] = [];
  if (!Array.isArray(candidates)) return toolCalls;

  for (const candidate of candidates) {
    const content = (
      candidate as {
        content?: {
          parts?: Part[];
        };
      }
    ).content;
    const parts = content?.parts;
    if (!Array.isArray(parts)) continue;

    for (const part of parts) {
      if (part?.functionCall) {
        const toolCall: ToolCall = {
          id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          name: part.functionCall.name || "",
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

async function getFunctionCallingConfig(
  ai: GoogleGenAI,
  config: GenerateContentConfig,
  params: ProviderGenerateParams,
) {
  const { tools, conversationMessages, model } = params;
  if (tools === undefined) {
    return { functionDeclarations: [], allowedFunctionNames: [] };
  }

  // According to official documentation (https://ai.google.dev/gemini-api/docs/function-calling?example=meeting#native-tools), we should specify no more than 20 function calls.
  const MAX_FUNCTION_CALLINGS = 20;
  let indices: number[];
  if (tools.length > MAX_FUNCTION_CALLINGS) {
    const toolList = tools
      .map(
        (t, i) =>
          `{"index":${i},"description":${JSON.stringify(t.description)}}}`,
      )
      .join("\n");
    const message: TextMessage[] = [
      ...conversationMessages,
      {
        role: "user",
        content: `Gemini recommends using ${MAX_FUNCTION_CALLINGS} or fewer function callings, but more than that have been passed. Based on the current context, please return the indices of the necessary function callings, ensuring there are ${MAX_FUNCTION_CALLINGS} or fewer.\nList of function callings: [\n${toolList}\n]`,
      },
    ];
    const response = await ai.models.generateContent({
      model: normalizeModelId(model),
      contents: toGeminiMessages(message),
      config: {
        ...config,
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "array",
          items: { type: "integer" },
        },
      },
    });
    indices = response.text === undefined ? [] : JSON.parse(response.text);
    console.log(
      `Gemini recommends using ${MAX_FUNCTION_CALLINGS} or fewer function callings. We use only ${indices.map((i) => tools[i].name)}.`,
    );
  } else {
    indices = tools.map((_, i) => i);
  }

  return {
    functionDeclarations: indices.map((i) => ({
      name: tools[i].name,
      description: tools[i].description,
      parameters: tools[i].parameters as Schema,
    })),
    allowedFunctionNames: indices.map((i) => tools[i].name),
  };
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

  // Build config object for generation settings, tools, and toolConfig
  const config: GenerateContentConfig = {};

  if (params.maxTokens !== undefined) {
    config.maxOutputTokens = params.maxTokens;
  }
  if (params.temperature !== undefined) {
    config.temperature = params.temperature;
  }
  if (params.topP !== undefined) {
    config.topP = params.topP;
  }

  // Use systemInstruction parameter for system prompts (Gemini-specific)
  if (params.systemPrompt) {
    config.systemInstruction = params.systemPrompt;
  }

  // Add tools if provided - tools and toolConfig go inside config object
  const ai = new GoogleGenAI({ apiKey });
  if (params.tools !== undefined && params.tools.length > 0) {
    const ret = await getFunctionCallingConfig(ai, config, params);
    if (ret) {
      config.tools = [{ functionDeclarations: ret.functionDeclarations }];
      config.toolConfig = {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY, // AUTO, ANY, or NONE
          allowedFunctionNames: ret.allowedFunctionNames, // Explicitly list which functions can be called
        },
      };
    }
  }

  // generateContent automatically handles thought signatures when full conversation
  // history is provided (SDK v1.33.0+). Thought signatures are preserved in the
  // response and automatically validated on subsequent requests.
  const response = await ai.models.generateContent({
    model: normalizeModelId(params.model),
    contents: toGeminiMessages(params.conversationMessages),
    config,
  });

  const text = response.text || "";
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
