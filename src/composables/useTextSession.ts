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
  images?: string[]; // image data URLs a tool showed the model (user messages)
}

// Follow-up turns in a row for tools that show the model an image.
const MAX_FOLLOW_UP_TURNS = 3;
// The server's limit per message (server/llm/images.ts).
const MAX_MESSAGE_IMAGES = 4;

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
  options: RealtimeSessionOptions,
): UseRealtimeSessionReturn {
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

  // Images tool results showed the model (sendImagesToModel). They are added
  // after the turn's tool calls are all answered, because the provider APIs
  // expect the tool outputs right after the assistant message that called them.
  const pendingImages: Array<{ images: string[]; caption: string }> = [];
  // A tool's required instructions were queued: the model answers them in a
  // follow-up turn instead of with the user's next message.
  let followUpRequested = false;
  // Required instructions are queued and no turn has answered them: the
  // follow-up limit stopped the conversation first (continueConversation).
  let requiredUnanswered = false;

  const flushPendingImages = () => {
    for (const { images, caption } of pendingImages.splice(0)) {
      conversationMessages.value.push({
        role: "user",
        content: caption,
        images,
      });
    }
  };

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
    console.log("[useTextSession] instructions:", instructions);

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

  // Bumped when a chat starts or stops. A turn still waiting on the model or a
  // tool when that happens stops, so it can't write into the next chat.
  let chatGeneration = 0;
  const isCurrentChat = (generation: number) => generation === chatGeneration;

  const startChat = async () => {
    if (chatActive.value || connecting.value) return;

    connecting.value = true;
    try {
      await ensureStartResponse();
      initializeConversation();
      chatGeneration++;
      chatActive.value = true;
    } catch (error) {
      handlers.onError?.(error);
    } finally {
      connecting.value = false;
    }
  };

  const stopChat = () => {
    chatGeneration++;
    requiredUnanswered = false;
    chatActive.value = false;
    conversationActive.value = false;
    conversationMessages.value = [];
    pendingImages.length = 0;
    followUpRequested = false;
  };

  // One request to the model, then its text and tool calls. Throws on failure.
  const runTurn = async (
    resolvedModel: ReturnType<typeof resolveTextModelId>,
    generation: number,
  ) => {
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

    if (!isCurrentChat(generation)) return;

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
        if (!isCurrentChat(generation)) return;
        await handlers.onToolCall?.(
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

    console.log("SENDING USER MESSAGE", `"${trimmed}"`);

    // Append user message to conversation history
    conversationMessages.value.push({
      role: "user",
      content: trimmed,
    });

    return runConversation();
  };

  /** Run the model on the conversation so far, with its follow-up turns. */
  const runConversation = async (): Promise<boolean> => {
    const resolvedModel = resolveTextModelId(
      options.getModelId?.({ startResponse: startResponse.value }) ??
        DEFAULT_TEXT_MODEL.rawId,
    );

    conversationActive.value = true;
    handlers.onConversationStarted?.();
    const generation = chatGeneration;
    // The first turn sends whatever is queued.
    requiredUnanswered = false;

    try {
      followUpRequested = false;
      await runTurn(resolvedModel, generation);
      // A tool that showed the model an image, or asked it to act on its
      // result (required instructions: readXPost's post, a step to read
      // aloud), gets the model another turn: to look at the image
      // (renderShapeScript: check the model, fix it, render again) or to
      // answer.
      for (
        let turn = 0;
        turn < MAX_FOLLOW_UP_TURNS &&
        (pendingImages.length > 0 || followUpRequested) &&
        isCurrentChat(generation);
        turn++
      ) {
        followUpRequested = false;
        flushPendingImages();
        await runTurn(resolvedModel, generation);
      }
      // Past the limit, the images and instructions go with the user's next
      // message, unless the host asks for a turn (continueConversation).
      requiredUnanswered = followUpRequested && isCurrentChat(generation);
      followUpRequested = false;
      if (isCurrentChat(generation)) flushPendingImages();
      return true;
    } catch (error) {
      // Images from a failed turn would reach the model out of context.
      pendingImages.length = 0;
      followUpRequested = false;
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

  const sendImagesToModel = (images: string[], caption: string) => {
    if (images.length === 0) return false;
    pendingImages.push({
      images: images.slice(0, MAX_MESSAGE_IMAGES),
      caption,
    });
    return true;
  };

  const sendInstructions = (instructions: string, required?: boolean) => {
    const trimmed = instructions.trim();
    if (!trimmed) {
      return false;
    }
    // Instructions are appended to conversation history as a user message
    // and sent with the next API call, not at once: during a turn that
    // would put them between an assistant tool call and its outputs, which
    // the APIs reject.
    console.log("QUEUING INSTRUCTIONS (text session)", `"${trimmed}"`);
    conversationMessages.value.push({
      role: "user",
      content: `[System instruction] ${trimmed}`,
    });
    if (required) {
      // Required ones get a turn: a follow-up of the running conversation,
      // or, when none is running (the host asking the model to go on with a
      // slideshow, useSequence), one of their own.
      if (conversationActive.value) followUpRequested = true;
      else if (chatActive.value) void runConversation();
    }

    return true;
  };

  // For text sessions, always return false to prevent intermediate messages
  // OpenAI's Chat API requires all tool responses before any other messages
  const isDataChannelOpen = () => false;

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
    sendImagesToModel,
    continueConversation: () => {
      if (!requiredUnanswered || conversationActive.value || !chatActive.value)
        return false;
      void runConversation();
      return true;
    },
    setMute,
    setLocalAudioEnabled,
    attachRemoteAudioElement,
    registerEventHandlers,
  };
}
