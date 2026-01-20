import { ref } from "vue";
import type { StartApiResponse } from "../../server/types";
import {
  type RealtimeSessionEventHandlers,
  type RealtimeSessionOptions,
  type UseRealtimeSessionReturn,
} from "./useRealtimeSession";
import { resolveTextModelId, DEFAULT_TEXT_MODEL } from "../config/textModels";

interface TextMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{ id: string; name: string; arguments: string }>;
}

export type UseTextSessionOptions = RealtimeSessionOptions;
export type UseTextSessionReturn = UseRealtimeSessionReturn;

const createCallId = () => crypto.randomUUID();

async function fetchStartResponse(): Promise<StartApiResponse | null> {
  try {
    const response = await fetch("/api/start", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return (await response.json()) as StartApiResponse;
  } catch (error) {
    console.warn("Failed to fetch start response for text session", error);
    return null;
  }
}

export function useTextSession(
  options: UseTextSessionOptions,
): UseTextSessionReturn {
  let handlers: RealtimeSessionEventHandlers = {
    ...(options.handlers ?? {}),
  };

  const registerEventHandlers = (
    newHandlers: Partial<RealtimeSessionEventHandlers>,
  ) => {
    handlers = {
      ...handlers,
      ...newHandlers,
    };
  };

  const chatActive = ref(false);
  const conversationActive = ref(false);
  const connecting = ref(false);
  const isMuted = ref(false);
  const startResponse = ref<StartApiResponse | null>(null);

  // Client-side conversation history (source of truth)
  const conversationMessages = ref<TextMessage[]>([]);

  const ensureStartResponse = async () => {
    if (startResponse.value) return;
    const result = await fetchStartResponse();
    if (result) {
      startResponse.value = result;
    }
  };

  const initializeConversation = () => {
    // Build initial system prompt
    const instructions = options.buildInstructions({
      startResponse: startResponse.value,
    });

    if (instructions && instructions.trim()) {
      conversationMessages.value = [
        {
          role: "system",
          content: instructions.trim(),
        },
      ];
    } else {
      conversationMessages.value = [];
    }
  };

  const startChat = async () => {
    if (chatActive.value || connecting.value) return;

    connecting.value = true;
    try {
      await ensureStartResponse();
      initializeConversation();
      chatActive.value = true;
    } catch (error) {
      handlers.onError?.(error);
    } finally {
      connecting.value = false;
    }
  };

  const stopChat = () => {
    chatActive.value = false;
    conversationActive.value = false;
    conversationMessages.value = [];
  };

  const sendUserMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return false;
    }

    if (!chatActive.value) {
      await startChat();
      if (!chatActive.value) {
        return false;
      }
    }

    await ensureStartResponse();

    const resolvedModel = resolveTextModelId(
      options.getModelId?.({ startResponse: startResponse.value }) ??
        DEFAULT_TEXT_MODEL.rawId,
    );

    console.log("SENDING USER MESSAGE", `"${trimmed}"`);

    // Append user message to conversation history
    conversationMessages.value.push({
      role: "user",
      content: trimmed,
    });

    conversationActive.value = true;
    handlers.onConversationStarted?.();

    try {
      const tools = options.buildTools({
        startResponse: startResponse.value,
      });
      // Call stateless generate API with full conversation history
      const response = await fetch("/api/text/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: resolvedModel.provider,
          model: resolvedModel.model,
          messages: conversationMessages.value,
          tools: tools.length > 0 ? tools : undefined,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("Generate API error:", response.status, errorBody);
        throw new Error(`API error: ${response.statusText} - ${errorBody}`);
      }

      const payload = (await response.json()) as {
        success?: boolean;
        result?: {
          text?: string;
          toolCalls?: Array<{ id: string; name: string; arguments: string }>;
        };
        error?: unknown;
      };

      if (!payload.success) {
        throw new Error(
          typeof payload.error === "string"
            ? payload.error
            : "Text generation failed",
        );
      }

      const assistantText = payload.result?.text ?? "";
      const toolCalls = payload.result?.toolCalls;

      // Append assistant response to conversation history
      if (assistantText || toolCalls) {
        conversationMessages.value.push({
          role: "assistant",
          content: assistantText || "",
          ...(toolCalls?.length ? { tool_calls: toolCalls } : {}),
        });
      }

      // Always show text response if there's any text
      if (assistantText) {
        handlers.onTextDelta?.(assistantText);
        handlers.onTextCompleted?.();

        const callId = createCallId();
        handlers.onToolCall?.(
          {
            type: "response.function_call_arguments.done",
            name: "text-response",
            // Intentionally omit call_id so the pseudo tool doesn't trigger
            // sendFunctionCallOutput back to the LLM transport.
          },
          callId,
          JSON.stringify({
            text: assistantText,
            role: "assistant",
            transportKind: "text-rest",
          }),
        );
      }

      // Handle tool calls if present
      if (toolCalls && toolCalls.length > 0) {
        for (const toolCall of toolCalls) {
          handlers.onToolCall?.(
            {
              type: "response.function_call_arguments.done",
              name: toolCall.name,
              call_id: toolCall.id,
            },
            toolCall.id,
            toolCall.arguments,
          );
        }
      }

      return true;
    } catch (error) {
      console.error("Text session request failed", error);
      handlers.onError?.(error);
      return false;
    } finally {
      conversationActive.value = false;
      handlers.onConversationFinished?.();
    }
  };

  const sendFunctionCallOutput = (callId: string, output: string) => {
    // Append tool output to conversation history
    conversationMessages.value.push({
      role: "tool",
      tool_call_id: callId,
      content: output,
    });
    return true;
  };

  const sendInstructions = (instructions: string) => {
    const trimmed = instructions.trim();
    if (!trimmed) {
      return false;
    }

    void (async () => {
      if (!chatActive.value) {
        await startChat();
        if (!chatActive.value) {
          return;
        }
      }

      await ensureStartResponse();

      const resolvedModel = resolveTextModelId(
        options.getModelId?.({ startResponse: startResponse.value }) ??
          DEFAULT_TEXT_MODEL.rawId,
      );

      // Append instructions as system message
      conversationMessages.value.push({
        role: "system",
        content: trimmed,
      });

      conversationActive.value = true;
      handlers.onConversationStarted?.();

      try {
        console.log("SENDING INSTRUCTIONS", `"${trimmed}"`);

        const tools = options.buildTools({
          startResponse: startResponse.value,
        });

        // Call stateless generate API with full conversation history
        const response = await fetch("/api/text/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider: resolvedModel.provider,
            model: resolvedModel.model,
            messages: conversationMessages.value,
            tools: tools.length > 0 ? tools : undefined,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.text();
          console.error("Instructions API error:", response.status, errorBody);
          throw new Error(`API error: ${response.statusText} - ${errorBody}`);
        }

        const payload = (await response.json()) as {
          success?: boolean;
          result?: {
            text?: string;
            toolCalls?: Array<{ id: string; name: string; arguments: string }>;
          };
          error?: unknown;
        };

        if (!payload.success) {
          throw new Error(
            typeof payload.error === "string"
              ? payload.error
              : "Instruction processing failed",
          );
        }

        const assistantText = payload.result?.text ?? "";
        const toolCalls = payload.result?.toolCalls;

        // Append assistant response to conversation history
        if (assistantText || toolCalls) {
          conversationMessages.value.push({
            role: "assistant",
            content: assistantText || "",
            ...(toolCalls?.length ? { tool_calls: toolCalls } : {}),
          });
        }

        // Handle tool calls if present
        if (toolCalls && toolCalls.length > 0) {
          for (const toolCall of toolCalls) {
            handlers.onToolCall?.(
              {
                type: "response.function_call_arguments.done",
                name: toolCall.name,
                call_id: toolCall.id,
              },
              toolCall.id,
              toolCall.arguments,
            );
          }
        }

        // Always show text response if there's any text
        if (assistantText) {
          handlers.onTextDelta?.(assistantText);
          handlers.onTextCompleted?.();

          const callId = createCallId();
          handlers.onToolCall?.(
            {
              type: "response.function_call_arguments.done",
              name: "text-response",
              // Intentionally omit call_id so the pseudo tool doesn't trigger
              // sendFunctionCallOutput back to the LLM transport.
            },
            callId,
            JSON.stringify({
              text: assistantText,
              role: "assistant",
              transportKind: "text-rest",
            }),
          );
        }
      } catch (error) {
        console.error("Instructions request failed", error);
        handlers.onError?.(error);
      } finally {
        conversationActive.value = false;
        handlers.onConversationFinished?.();
      }
    })();
    return true;
  };

  const isDataChannelOpen = () => !conversationActive.value;

  const setMute = (muted: boolean) => {
    isMuted.value = muted;
  };

  const setLocalAudioEnabled: UseRealtimeSessionReturn["setLocalAudioEnabled"] =
    (__enabled) => {
      /* Text session does not manage local audio */
    };

  const attachRemoteAudioElement: UseRealtimeSessionReturn["attachRemoteAudioElement"] =
    (__audio) => {
      /* No remote audio for text session */
    };

  return {
    chatActive,
    conversationActive,
    connecting,
    isMuted,
    startResponse,
    isDataChannelOpen,
    startChat,
    stopChat,
    sendUserMessage,
    sendFunctionCallOutput,
    sendInstructions,
    setMute,
    setLocalAudioEnabled,
    attachRemoteAudioElement,
    registerEventHandlers,
  };
}
