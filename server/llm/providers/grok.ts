import {
  TextGenerationError,
  type ProviderGenerateParams,
  type TextGenerationResult,
} from "../types.js";
import {
  hasTools,
  postProviderJson,
  toChatCompletionRequest,
  toChatCompletionResult,
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

  const requestBody = toChatCompletionRequest(params);
  if (hasTools(params)) {
    requestBody.parallel_tool_calls = true;
  }

  const data = await postProviderJson<ChatCompletionResponse>(
    GROK_CHAT_COMPLETIONS_URL,
    requestBody,
    { apiLabel: "xAI", apiKey },
  );
  return toChatCompletionResult(data, "grok", params.model);
}
