import { Router, Request, Response } from "express";
import { generateText, getProviderAvailability } from "../llm/textService";
import {
  TextGenerationError,
  type TextGenerationRequest,
  type TextLLMProviderId,
  type TextMessage,
  type TextSessionDefaults,
} from "../llm/types";
import {
  appendSessionMessages,
  createTextSession,
  deleteTextSession,
  getTextSession,
  serializeSession,
  updateSessionDefaults,
} from "../llm/textSessionStore";
import { sendApiError } from "../utils/logger";

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

    return baseMessage;
  });
}

function optionalNumber(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new TextGenerationError(`${field} must be a valid number`, 400);
  }

  return value;
}

function validateGenerationDefaults(defaults: TextSessionDefaults): void {
  if (
    defaults.maxTokens !== undefined &&
    (!Number.isFinite(defaults.maxTokens) || defaults.maxTokens <= 0)
  ) {
    throw new TextGenerationError("maxTokens must be greater than zero", 400);
  }

  if (
    defaults.temperature !== undefined &&
    (defaults.temperature < 0 || defaults.temperature > 2)
  ) {
    throw new TextGenerationError("temperature must be between 0 and 2", 400);
  }

  if (
    defaults.topP !== undefined &&
    (defaults.topP <= 0 || defaults.topP > 1)
  ) {
    throw new TextGenerationError("topP must be between 0 and 1", 400);
  }
}

function normalizeInstructions(
  value: unknown,
  field = "instructions",
): string[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  if (Array.isArray(value)) {
    const instructions = value
      .map((item, index) => {
        if (typeof item !== "string") {
          throw new TextGenerationError(
            `${field}[${index}] must be a string`,
            400,
          );
        }
        const trimmed = item.trim();
        if (!trimmed) {
          return null;
        }
        return trimmed;
      })
      .filter((instruction): instruction is string => Boolean(instruction));

    return instructions;
  }

  throw new TextGenerationError(`${field} must be a string or array`, 400);
}

interface NormalizedToolOutput {
  callId: string;
  output: string;
}

function normalizeToolOutputs(value: unknown): NormalizedToolOutput[] {
  if (value === undefined || value === null) {
    throw new TextGenerationError("Tool output payload is required", 400);
  }

  const toPayload = (input: unknown, index?: number): NormalizedToolOutput => {
    if (!input || typeof input !== "object") {
      const position = index !== undefined ? `[${index}]` : "";
      throw new TextGenerationError(
        `toolOutputs${position} must be an object`,
        400,
      );
    }
    const callId = (input as { callId?: unknown }).callId;
    const output = (input as { output?: unknown }).output;

    if (typeof callId !== "string" || !callId.trim()) {
      throw new TextGenerationError("callId must be a non-empty string", 400);
    }
    if (typeof output !== "string" || !output.trim()) {
      throw new TextGenerationError("output must be a non-empty string", 400);
    }

    return {
      callId: callId.trim(),
      output: output.trim(),
    };
  };

  if (Array.isArray(value)) {
    if (value.length === 0) {
      throw new TextGenerationError("toolOutputs array cannot be empty", 400);
    }
    return value.map((item, index) => toPayload(item, index));
  }

  return [toPayload(value)];
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

router.post("/text/session", (req: Request, res: Response) => {
  try {
    const {
      provider,
      model,
      systemPrompt,
      messages,
      maxTokens,
      temperature,
      topP,
      tools,
    } = req.body as Partial<TextGenerationRequest> & {
      systemPrompt?: unknown;
      messages?: unknown;
    };

    if (!isProviderId(provider)) {
      throw new TextGenerationError("Unsupported provider", 400);
    }

    if (typeof model !== "string" || !model.trim()) {
      throw new TextGenerationError("Model is required", 400);
    }

    const defaults = {
      maxTokens: optionalNumber(maxTokens, "maxTokens"),
      temperature: optionalNumber(temperature, "temperature"),
      topP: optionalNumber(topP, "topP"),
    };

    validateGenerationDefaults(defaults);

    const initialMessages = messages ? parseMessages(messages) : undefined;

    const session = createTextSession({
      provider,
      model: model.trim(),
      systemPrompt:
        typeof systemPrompt === "string" && systemPrompt.trim()
          ? systemPrompt.trim()
          : undefined,
      initialMessages,
      defaults,
      tools: Array.isArray(tools) ? tools : undefined,
    });

    res.status(201).json({
      success: true,
      session,
    });
  } catch (error: unknown) {
    if (error instanceof TextGenerationError) {
      sendApiError(res, req, error.statusCode ?? 400, error.message);
      return;
    }

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    sendApiError(res, req, 500, "Failed to create text session", errorMessage);
  }
});

router.get("/text/session/:sessionId", (req: Request<{ sessionId: string }>, res: Response) => {
  const session = getTextSession(req.params.sessionId);
  if (!session) {
    res.status(404).json({
      success: false,
      error: "Session not found",
    });
    return;
  }

  res.json({
    success: true,
    session: serializeSession(session),
  });
});

router.delete("/text/session/:sessionId", (req: Request<{ sessionId: string }>, res: Response) => {
  const deleted = deleteTextSession(req.params.sessionId);
  if (!deleted) {
    res.status(404).json({
      success: false,
      error: "Session not found",
    });
    return;
  }

  res.json({ success: true });
});

router.post(
  "/text/session/:sessionId/instructions",
  async (req: Request<{ sessionId: string }>, res: Response) => {
    const session = getTextSession(req.params.sessionId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: "Session not found",
      });
      return;
    }

    try {
      const instructions = normalizeInstructions(
        req.body?.instructions ?? req.body,
      );

      console.log(
        "RECEIVED INSTRUCTIONS",
        `${session.id}: "${instructions.join(", ")}"`,
      );

      // Append instructions as system messages immediately
      const instructionMessages: TextMessage[] = instructions.map(
        (instruction) => ({
          role: "system" as const,
          content: instruction,
        }),
      );

      appendSessionMessages(session, instructionMessages);

      console.log("INSTRUCTION CONVERSATION", session.messages);

      const requestPayload: TextGenerationRequest = {
        provider: session.provider,
        model: session.model,
        messages: session.messages,
      };

      if (session.defaults.maxTokens !== undefined) {
        requestPayload.maxTokens = session.defaults.maxTokens;
      }
      if (session.defaults.temperature !== undefined) {
        requestPayload.temperature = session.defaults.temperature;
      }
      if (session.defaults.topP !== undefined) {
        requestPayload.topP = session.defaults.topP;
      }
      if (session.tools !== undefined && session.tools.length > 0) {
        requestPayload.tools = session.tools;
      }

      // Generate response
      const result = await generateText(requestPayload);

      // Append assistant response (including tool_calls if present)
      if (result.text || result.toolCalls) {
        appendSessionMessages(session, [
          {
            role: "assistant",
            content: result.text || "",
            ...(result.toolCalls?.length
              ? { tool_calls: result.toolCalls }
              : {}),
          },
        ]);
      }

      res.json({
        success: true,
        result,
        session: serializeSession(session),
      });
    } catch (error: unknown) {
      if (error instanceof TextGenerationError) {
        sendApiError(res, req, error.statusCode ?? 400, error.message);
        return;
      }

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      sendApiError(
        res,
        req,
        500,
        "Failed to process instructions",
        errorMessage,
      );
    }
  },
);

router.post(
  "/text/session/:sessionId/tool-output",
  (req: Request<{ sessionId: string }>, res: Response) => {
    const session = getTextSession(req.params.sessionId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: "Session not found",
      });
      return;
    }

    try {
      const parsedOutputs = normalizeToolOutputs(
        req.body?.toolOutputs ?? req.body,
      );

      // Append tool outputs as tool messages immediately
      const toolOutputMessages: TextMessage[] = parsedOutputs.map(
        ({ callId, output }) => ({
          role: "tool" as const,
          tool_call_id: callId,
          content: output,
        }),
      );

      appendSessionMessages(session, toolOutputMessages);

      res.json({
        success: true,
        session: serializeSession(session),
      });
    } catch (error: unknown) {
      if (error instanceof TextGenerationError) {
        sendApiError(res, req, error.statusCode ?? 400, error.message);
        return;
      }

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      sendApiError(res, req, 500, "Failed to append tool output", errorMessage);
    }
  },
);

router.post(
  "/text/session/:sessionId/message",
  async (req: Request<{ sessionId: string }>, res: Response) => {
    const session = getTextSession(req.params.sessionId);
    if (!session) {
      res.status(404).json({
        success: false,
        error: "Session not found",
      });
      return;
    }

    const role = (req.body?.role ?? "user") as TextMessage["role"];
    const content = req.body?.content;

    console.log(
      "RECEIVED USER MESSAGE",
      `${session.id}: "${content}", "${role}"`,
    );

    const instructionsInput = req.body?.instructions;
    const maxTokens = optionalNumber(req.body?.maxTokens, "maxTokens");
    const temperature = optionalNumber(req.body?.temperature, "temperature");
    const topP = optionalNumber(req.body?.topP, "topP");

    const providedDefaults: TextSessionDefaults = {};
    if (maxTokens !== undefined) {
      providedDefaults.maxTokens = maxTokens;
    }
    if (temperature !== undefined) {
      providedDefaults.temperature = temperature;
    }
    if (topP !== undefined) {
      providedDefaults.topP = topP;
    }

    if (role !== "user") {
      res.status(400).json({
        success: false,
        error: "Only user messages are supported",
      });
      return;
    }

    if (typeof content !== "string" || !content.trim()) {
      res.status(400).json({
        success: false,
        error: `Message content must be a non-empty string (${content})`,
      });
      return;
    }

    const trimmedContent = content.trim();

    try {
      const newInstructions = normalizeInstructions(instructionsInput);

      validateGenerationDefaults(providedDefaults);

      // If instructions provided, append them first as system messages
      if (newInstructions.length > 0) {
        const instructionMessages: TextMessage[] = newInstructions.map(
          (instruction) => ({
            role: "system" as const,
            content: instruction,
          }),
        );
        appendSessionMessages(session, instructionMessages);
      }

      // Append user message
      const userMessage: TextMessage = {
        role: "user",
        content: trimmedContent,
      };
      appendSessionMessages(session, [userMessage]);

      console.log("CONVERSATION", session.messages);

      const requestPayload: TextGenerationRequest = {
        provider: session.provider,
        model: session.model,
        messages: session.messages,
      };

      const effectiveMaxTokens = maxTokens ?? session.defaults.maxTokens;
      const effectiveTemperature = temperature ?? session.defaults.temperature;
      const effectiveTopP = topP ?? session.defaults.topP;

      if (effectiveMaxTokens !== undefined) {
        requestPayload.maxTokens = effectiveMaxTokens;
      }
      if (effectiveTemperature !== undefined) {
        requestPayload.temperature = effectiveTemperature;
      }
      if (effectiveTopP !== undefined) {
        requestPayload.topP = effectiveTopP;
      }
      if (session.tools !== undefined && session.tools.length > 0) {
        requestPayload.tools = session.tools;
      }

      const result = await generateText(requestPayload);

      // Append assistant response (including tool_calls if present)
      if (result.text || result.toolCalls) {
        appendSessionMessages(session, [
          {
            role: "assistant",
            content: result.text || "", // non-empty string
            ...(result.toolCalls?.length
              ? { tool_calls: result.toolCalls }
              : {}),
          },
        ]);
      }

      if (Object.keys(providedDefaults).length > 0) {
        updateSessionDefaults(session, providedDefaults);
      }

      res.json({
        success: true,
        result,
        session: serializeSession(session),
      });
    } catch (error: unknown) {
      if (error instanceof TextGenerationError) {
        sendApiError(res, req, error.statusCode ?? 400, error.message);
        return;
      }

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      sendApiError(res, req, 500, "Failed to process message", errorMessage);
    }
  },
);

export default router;
