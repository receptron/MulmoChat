import {
  TextGenerationError,
  type ProviderGenerateParams,
  type TextGenerationResult,
} from "../types";

// gpt-5.6-* and gpt-6-* on /v1/chat/completions (gpt-6-astra and gpt-6.1-*
// go to /v1/responses: see USES_RESPONSES_API)
const NO_REASONING_WITH_TOOLS = /^gpt-(5\.6|6)-/;

// Models that take function tools only on /v1/responses: on
// /v1/chat/completions they refuse tools with reasoning on, and refuse
// reasoning_effort "none" (checked 2026-10-01).
const USES_RESPONSES_API = /^gpt-(6-astra|6\.1-)/;

const OPENAI_CHAT_COMPLETIONS_URL =
  "https://api.openai.com/v1/chat/completions";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAIChatCompletionResponse {
  choices: Array<{
    message: {
      role: string;
      content?: string;
      tool_calls?: OpenAIToolCall[];
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export async function generateWithOpenAI(
  params: ProviderGenerateParams,
): Promise<TextGenerationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new TextGenerationError(
      "OPENAI_API_KEY environment variable not set",
      500,
    );
  }
  if (USES_RESPONSES_API.test(params.model)) {
    return generateWithResponses(params, apiKey);
  }

  const requestBody: Record<string, unknown> = {
    model: params.model,
    messages: params.messages.map((message) => {
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
    }),
  };

  if (params.maxTokens !== undefined) {
    requestBody.max_tokens = params.maxTokens;
  }
  if (params.temperature !== undefined) {
    requestBody.temperature = params.temperature;
  }
  if (params.topP !== undefined) {
    requestBody.top_p = params.topP;
  }
  if (params.tools !== undefined && params.tools.length > 0) {
    // Convert from Realtime API format to Chat Completions format
    requestBody.tools = params.tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
    // Enable parallel tool calling (o-series models reject the parameter)
    if (!/^o\d/.test(params.model)) {
      requestBody.parallel_tool_calls = true;
    }
    // These models only take function tools on /v1/chat/completions with
    // reasoning off (reasoning plus tools needs /v1/responses). Older models
    // reject the field, so it is sent only to them.
    if (NO_REASONING_WITH_TOOLS.test(params.model)) {
      requestBody.reasoning_effort = "none";
    }
  }

  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new TextGenerationError(
      `OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`,
      response.status,
    );
  }

  const data = (await response.json()) as OpenAIChatCompletionResponse;
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
    provider: "openai",
    model: params.model,
    text,
    ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
    ...(usage ? { usage } : {}),
    rawResponse: data,
  };
}

// /v1/responses, stateless as the chat completions call above: the whole
// conversation goes in each time, as input items.
type ResponsesInputItem = Record<string, unknown>;

interface ResponsesOutputItem {
  type: string;
  content?: Array<{ type: string; text?: string }>;
  call_id?: string;
  name?: string;
  arguments?: string;
}

interface ResponsesResponse {
  output?: ResponsesOutputItem[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
}

const responsesInput = (
  messages: ProviderGenerateParams["messages"],
): { instructions: string; input: ResponsesInputItem[] } => {
  const instructions: string[] = [];
  const input: ResponsesInputItem[] = [];
  for (const message of messages) {
    if (message.role === "system") {
      instructions.push(message.content);
    } else if (message.role === "tool") {
      input.push({
        type: "function_call_output",
        call_id: message.tool_call_id,
        output: message.content,
      });
    } else if (message.role === "assistant") {
      if (message.content) {
        input.push({ role: "assistant", content: message.content });
      }
      for (const call of message.tool_calls ?? []) {
        input.push({
          type: "function_call",
          call_id: call.id,
          name: call.name,
          arguments: call.arguments,
        });
      }
    } else {
      input.push({
        role: "user",
        content: [
          { type: "input_text", text: message.content },
          ...(message.images ?? []).map((url) => ({
            type: "input_image",
            image_url: url,
          })),
        ],
      });
    }
  }
  return { instructions: instructions.join("\n\n"), input };
};

async function generateWithResponses(
  params: ProviderGenerateParams,
  apiKey: string,
): Promise<TextGenerationResult> {
  const { instructions, input } = responsesInput(params.messages);
  const requestBody: Record<string, unknown> = {
    model: params.model,
    input,
    store: false,
  };
  if (instructions) requestBody.instructions = instructions;
  if (params.maxTokens !== undefined) {
    requestBody.max_output_tokens = params.maxTokens;
  }
  if (params.tools !== undefined && params.tools.length > 0) {
    // strict: false, as on chat completions. The Responses API makes a tool
    // strict unless told otherwise, which makes every optional argument
    // required and closes open objects: searchWeb's optional date filters
    // were filled on every search, in forms Exa refused, and presentChart's
    // free-form chart option couldn't hold its properties.
    requestBody.tools = params.tools.map((tool) => ({
      type: "function",
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      strict: false,
    }));
    requestBody.parallel_tool_calls = true;
  }
  // These reasoning models take no temperature or top_p: a caller that sets
  // one is told so, rather than having it dropped. (MulmoChat's text chat
  // sets neither.)
  if (params.temperature !== undefined || params.topP !== undefined) {
    throw new TextGenerationError(
      `temperature and top_p are not supported for model ${params.model}`,
      400,
    );
  }

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new TextGenerationError(
      `OpenAI API error: ${response.status} ${response.statusText} - ${errorText}`,
      response.status,
    );
  }

  const data = (await response.json()) as ResponsesResponse;
  const output = data.output ?? [];
  const text = output
    .filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((part) => part.type === "output_text")
    .map((part) => part.text ?? "")
    .join("");
  const toolCalls = output
    .filter((item) => item.type === "function_call" && item.call_id)
    .map((item) => ({
      id: item.call_id as string,
      name: item.name ?? "",
      arguments: item.arguments ?? "{}",
    }));
  const usage = data.usage
    ? {
        promptTokens: data.usage.input_tokens ?? 0,
        completionTokens: data.usage.output_tokens ?? 0,
        totalTokens: data.usage.total_tokens ?? 0,
      }
    : undefined;

  return {
    provider: "openai",
    model: params.model,
    text,
    ...(toolCalls.length > 0 ? { toolCalls } : {}),
    ...(usage ? { usage } : {}),
    rawResponse: data,
  };
}
