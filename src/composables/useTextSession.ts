import { ref, shallowRef } from "vue";
import type { StartApiResponse } from "../../server/types";
import {
  type RealtimeSessionEventHandlers,
  type RealtimeSessionOptions,
  type UseRealtimeSessionReturn,
} from "./useRealtimeSession";
import { resolveTextModelId, DEFAULT_TEXT_MODEL } from "../config/textModels";

interface TextMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export type UseTextSessionOptions = RealtimeSessionOptions;
export type UseTextSessionReturn = UseRealtimeSessionReturn;

let fallbackCallIdCounter = 0;

const createCallId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `text-${Date.now()}-${++fallbackCallIdCounter}`;

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
  const conversationMessages = ref<TextMessage[]>([]);
  const sessionId = ref<string | null>(null);
  const activeModelId = ref<string | null>(null);
  const creatingSession = shallowRef<Promise<string | null> | null>(null);

  const ensureStartResponse = async () => {
    if (startResponse.value) return;
    const result = await fetchStartResponse();
    if (result) {
      startResponse.value = result;
    }
  };

  const destroySession = async (id: string | null) => {
    if (!id) return;
    try {
      await fetch(`/api/text/session/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
    } catch (error) {
      console.warn("Failed to delete text session", error);
    }
  };

  const ensureSession = async (): Promise<string | null> => {
    if (creatingSession.value) {
      return creatingSession.value;
    }

    const creation = (async () => {
      await ensureStartResponse();

      const resolvedModel = resolveTextModelId(
        options.getModelId?.({ startResponse: startResponse.value }) ??
          DEFAULT_TEXT_MODEL.rawId,
      );

      if (sessionId.value && activeModelId.value === resolvedModel.rawId) {
        return sessionId.value;
      }

      if (sessionId.value && activeModelId.value !== resolvedModel.rawId) {
        await destroySession(sessionId.value);
        sessionId.value = null;
      }

      const instructions = options.buildInstructions({
        startResponse: startResponse.value,
      });
      const tools = options.buildTools({
        startResponse: startResponse.value,
      });

      try {
        const response = await fetch("/api/text/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider: resolvedModel.provider,
            model: resolvedModel.model,
            systemPrompt: instructions,
            tools,
          }),
        });

        if (!response.ok) {
          throw new Error(`Session creation failed: ${response.statusText}`);
        }

        const payload = (await response.json()) as {
          success?: boolean;
          session?: { id: string; messages?: TextMessage[] };
          error?: unknown;
        };

        if (!payload.success || !payload.session?.id) {
          throw new Error(
            typeof payload.error === "string"
              ? payload.error
              : "Invalid session response",
          );
        }

        sessionId.value = payload.session.id;
        activeModelId.value = resolvedModel.rawId;
        conversationMessages.value = payload.session.messages ?? [];
        return sessionId.value;
      } catch (error) {
        sessionId.value = null;
        activeModelId.value = null;
        handlers.onError?.(error);
        return null;
      }
    })();

    creatingSession.value = creation;
    try {
      return await creation;
    } finally {
      creatingSession.value = null;
    }
  };

  const startChat = async () => {
    if (chatActive.value || connecting.value) return;

    connecting.value = true;
    try {
      const id = await ensureSession();
      if (!id) {
        throw new Error("Unable to establish text session");
      }
      chatActive.value = true;
    } catch (error) {
      handlers.onError?.(error);
    } finally {
      connecting.value = false;
    }
  };

  const stopChat = () => {
    const id = sessionId.value;
    chatActive.value = false;
    conversationActive.value = false;
    conversationMessages.value = [];
    sessionId.value = null;
    activeModelId.value = null;
    void destroySession(id);
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

    const id = await ensureSession();
    if (!id) {
      return false;
    }
    console.log("SENDING USER MESSAGE", `${id}: "${trimmed}"`);

    conversationActive.value = true;
    handlers.onConversationStarted?.();

    try {
      const response = await fetch(
        `/api/text/session/${encodeURIComponent(id)}/message`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            role: "user",
            content: trimmed,
          }),
        },
      );

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("Message API error:", response.status, errorBody);
        throw new Error(`API error: ${response.statusText} - ${errorBody}`);
      }

      const payload = (await response.json()) as {
        success?: boolean;
        result?: {
          text?: string;
          toolCalls?: Array<{ id: string; name: string; arguments: string }>;
        };
        session?: { messages?: TextMessage[] };
        error?: unknown;
        details?: unknown;
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

      // Update conversation messages
      if (payload.session?.messages) {
        conversationMessages.value = payload.session.messages;
      } else {
        conversationMessages.value = [
          ...conversationMessages.value,
          { role: "user", content: trimmed },
          { role: "assistant", content: assistantText },
        ];
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
    void (async () => {
      const id = await ensureSession();
      if (!id) return;
      try {
        await fetch(`/api/text/session/${encodeURIComponent(id)}/tool-output`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            toolOutputs: [
              {
                callId,
                output,
              },
            ],
          }),
        });
      } catch (error) {
        handlers.onError?.(error);
      }
    })();
    return true;
  };

  const sendInstructions = (instructions: string) => {
    const trimmed = instructions.trim();
    if (!trimmed) {
      return false;
    }

    void (async () => {
      const id = await ensureSession();
      if (!id) return;

      conversationActive.value = true;
      handlers.onConversationStarted?.();

      try {
        console.log("SENDING INSTRUCTIONS", `${id}: "${trimmed}"`);

        const response = await fetch(
          `/api/text/session/${encodeURIComponent(id)}/instructions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ instructions: trimmed }),
          },
        );

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
          session?: { messages?: TextMessage[] };
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

        // Update conversation messages
        if (payload.session?.messages) {
          conversationMessages.value = payload.session.messages;
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
