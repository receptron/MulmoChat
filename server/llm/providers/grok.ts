import {
  TextGenerationError,
  type ProviderGenerateParams,
  type TextGenerationResult,
} from "../types.js";
import {
  postProviderJson,
  toChatCompletionMessages,
  toChatCompletionResult,
  toChatCompletionSampling,
  toFunctionTools,
  type ChatCompletionResponse,
} from "./chatCompletions.js";

const GROK_CHAT_COMPLETIONS_URL = "https://api.x.ai/v1/chat/completions";

export async function generateWithGrok(
  params: ProviderGenerateParams,
): Promise<TextGenerationResult> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new TextGenerationError(
      "XAI_API_KEY environment variable not set",
      500,
    );
  }

  const requestBody: Record<string, unknown> = {
    model: params.model,
    messages: toChatCompletionMessages(params.messages),
    ...toChatCompletionSampling(params),
  };
  if (params.tools !== undefined && params.tools.length > 0) {
    // Convert to OpenAI-compatible format (which xAI supports)
    requestBody.tools = toFunctionTools(params.tools);
    // Enable parallel tool calling
    requestBody.parallel_tool_calls = true;
  }

  const data = await postProviderJson<ChatCompletionResponse>(
    GROK_CHAT_COMPLETIONS_URL,
    requestBody,
    { apiLabel: "xAI", apiKey },
  );
  return toChatCompletionResult(data, "grok", params.model);
}
