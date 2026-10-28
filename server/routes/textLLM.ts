import { Router, Request, Response } from "express";
import { generateText, getProviderAvailability } from "../llm/textService.js";
import {
  TextGenerationError,
  type TextGenerationRequest,
  type TextLLMProviderId,
  type TextMessage,
} from "../llm/types.js";
import { sendApiError } from "../utils/logger.js";
import { MAX_MESSAGE_IMAGES, parseImageDataUrl } from "../llm/images.js";

const router = Router();

function isProviderId(value: unknown): value is TextLLMProviderId {
  return (
    value === "openai" ||
    value === "anthropic" ||
    value === "google" ||
    value === "ollama" ||
    value === "grok"
  );
}

// Only user messages carry images, and only as image data URLs.
function parseMessageImages(role: string, images: unknown): string[] {
  if (
    role !== "user" ||
    !Array.isArray(images) ||
    images.length > MAX_MESSAGE_IMAGES ||
    !images.every(
      (image) => typeof image === "string" && parseImageDataUrl(image),
    )
  ) {
    throw new TextGenerationError(
      `images must be up to ${MAX_MESSAGE_IMAGES} image data URLs on a user message`,
      400,
    );
  }
  return images;
}

function parseMessages(value: unknown): TextMessage[] {
  if (!Array.isArray(value)) {
    throw new TextGenerationError("messages must be an array", 400);
  }

  return value.map((message) => {
    if (!message || typeof message !== "object") {
      throw new TextGenerationError("Each message must be an object", 400);
    }

    const role = (message as { role?: unknown }).role;
    const content = (message as { content?: unknown }).content;
    const tool_call_id = (message as { tool_call_id?: unknown }).tool_call_id;
    const tool_calls = (message as { tool_calls?: unknown }).tool_calls;
    const images = (message as { images?: unknown }).images;

    if (typeof role !== "string" || typeof content !== "string") {
      throw new TextGenerationError(
        "Each message must include string role and content",
        400,
      );
    }

    if (
      role !== "system" &&
      role !== "user" &&
      role !== "assistant" &&
      role !== "tool"
    ) {
      throw new TextGenerationError(`Unsupported message role: ${role}`, 400);
    }

    const baseMessage: TextMessage = {
      role: role as TextMessage["role"],
      content,
    };

    // Add tool_call_id for tool messages
    if (role === "tool" && typeof tool_call_id === "string") {
      baseMessage.tool_call_id = tool_call_id;
    }

    // Add tool_calls for assistant messages
    if (role === "assistant" && Array.isArray(tool_calls)) {
      baseMessage.tool_calls = tool_calls;
    }

    if (images !== undefined) {
      baseMessage.images = parseMessageImages(role, images);
    }

    return baseMessage;
  });
}

router.get("/text/providers", (_req: Request, res: Response) => {
  res.json({
    success: true,
    providers: getProviderAvailability(),
  });
});

router.post("/text/generate", async (req: Request, res: Response) => {
  try {
    const { provider, model, messages, maxTokens, temperature, topP, tools } =
      req.body as Partial<TextGenerationRequest> & { messages: unknown };

    if (!isProviderId(provider)) {
      throw new TextGenerationError("Unsupported provider", 400);
    }

    if (typeof model !== "string" || model.trim().length === 0) {
      throw new TextGenerationError("Model is required", 400);
    }

    const parsedMessages = parseMessages(messages);

    const requestPayload: TextGenerationRequest = {
      provider,
      model,
      messages: parsedMessages,
    };

    if (typeof maxTokens === "number") {
      requestPayload.maxTokens = maxTokens;
    }
    if (typeof temperature === "number") {
      requestPayload.temperature = temperature;
    }
    if (typeof topP === "number") {
      requestPayload.topP = topP;
    }
    if (Array.isArray(tools) && tools.length > 0) {
      requestPayload.tools = tools;
    }

    const result = await generateText(requestPayload);

    res.json({
      success: true,
      result,
    });
  } catch (error: unknown) {
    if (error instanceof TextGenerationError) {
      sendApiError(res, req, error.statusCode ?? 400, error.message);
      return;
    }

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    sendApiError(res, req, 500, "Failed to generate text", errorMessage);
  }
});

export default router;
