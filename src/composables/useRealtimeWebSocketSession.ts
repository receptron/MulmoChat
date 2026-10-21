/* global WebSocket, CloseEvent */

// The OpenAI Realtime events (session.update, conversation.item.create,
// response.create, response.function_call_arguments.done, …) over a WebSocket
// opened from the browser, with PCM16 audio as base64 JSON played through
// AudioStreamManager, like Gemini Live. Grok voice speaks it
// (useGrokVoiceSession); a RealtimeDialect says what one provider does
// differently. The server mints a short-lived secret, so the provider's API
// key never reaches the browser.

import { ref } from "vue";
import type { StartApiResponse } from "../../server/types";
import type { ToolCallMessage } from "./types";
import {
  type RealtimeSessionEventHandlers,
  type RealtimeSessionOptions,
  type UseRealtimeSessionReturn,
} from "./useRealtimeSession";
import { AudioStreamManager } from "../utils/audioStreamManager";
import { resolveVoice, type VoiceProvider } from "../../server/utils/voices";

// Replies come back at the rate AudioStreamManager plays by default.
export const OUTPUT_SAMPLE_RATE = 24000;

/** What one provider's Realtime API needs that another's does not. */
export interface RealtimeDialect {
  /** In logs and in the alert when a start fails ("Grok voice"). */
  name: string;
  voiceProvider: VoiceProvider;
  defaultModelId: string;
  /** The server route that mints this provider's secret: a GET, or a JSON
   *  POST when it has a body. */
  startRequest: (choice: { modelId: string; voice: string }) => {
    url: string;
    body?: unknown;
  };
  secret: (start: StartApiResponse) => string | undefined;
  url: (modelId: string) => string;
  /** WebSocket subprotocols: how the secret is passed, since a browser
   *  cannot set an Authorization header on a WebSocket. */
  protocols: (secret: string) => string[];
  /** Microphone audio sent to the provider. */
  inputSampleRate: number;
  /** The session.update `session`, given the parts every provider has. */
  session: (shared: {
    instructions: string;
    tools: unknown[];
    voice: string;
  }) => Record<string, unknown>;
}

interface WebSocketState {
  ws: WebSocket | null;
  localStream: MediaStream | null;
  audioManager: AudioStreamManager | null;
}

interface RealtimeServerEvent {
  type: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  delta?: string;
  response?: { id?: string };
  error?: { code?: string; event_id?: string | null } & Record<string, unknown>;
}

export function useRealtimeWebSocketSession(
  options: RealtimeSessionOptions,
  dialect: RealtimeDialect,
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
  const processedToolCalls = new Set<string>();

  const state: WebSocketState = {
    ws: null,
    localStream: null,
    audioManager: null,
  };

  // A response runs from response.created until its response.done. The
  // server starts some itself (its VAD turn; ElevenLabs also follows a spoken
  // "let me check" with the tool call's response unasked), so they are kept
  // by id. A response.create asked for while any runs is held and sent after
  // the last, once: several tool outputs get one follow-up response.
  const runningResponses = new Set<string>();
  let responseHeld = false;
  // response.create sent, response.created not seen yet. If the provider
  // answers it with an error instead, no response.done follows.
  let responseRequested = false;
  const responding = () => responseRequested || runningResponses.size > 0;
  // A response's done settles every response that started before it too:
  // the provider runs them in turn, and Grok sends no done for a response it
  // drops when a new turn of the user's starts (room noise taken for speech
  // right after our response.create left ours running forever, the spinner
  // on and every later response.create held). A done whose created was not
  // seen settles them all. False for the late done of a response settled
  // that way, which must not settle the responses running since.
  const settledEarly = new Set<string>();
  const settleResponse = (id: string): boolean => {
    if (settledEarly.delete(id)) return false;
    if (!runningResponses.has(id)) {
      runningResponses.clear();
      return true;
    }
    for (const running of [...runningResponses]) {
      runningResponses.delete(running);
      if (running === id) break;
      settledEarly.add(running);
    }
    return true;
  };
  // The event_id of the last response.create, to tell a refusal of it from a
  // late refusal of an earlier one. Grok and ElevenLabs drop a
  // response.create sent while a response runs without a word; an
  // OpenAI-style refusal names the event_id it refuses.
  let lastCreateId: string | null = null;
  let createCount = 0;
  // The user's turn: "waiting" once they stopped, until the server's response
  // to it starts ("answered"): that response.created is the server's, not the
  // answer to our response.create. speech_stopped comes before that created
  // on both Grok and ElevenLabs; committed comes before it on ElevenLabs and
  // after it on Grok, so a committed after the response started is not a new
  // turn.
  let userTurn: "none" | "waiting" | "answered" = "none";
  // Our response.create went out while the server was starting a response of
  // its own. Grok and ElevenLabs drop it without a word, so when that response
  // is done ours is asked again. A provider that kept it would answer twice;
  // the two that drop it were checked live.
  let responseOverlapped = false;

  const sendWebSocketMessage = (message: unknown): boolean => {
    if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
      console.warn("Cannot send message because WebSocket is not open.");
      return false;
    }
    state.ws.send(JSON.stringify(message));
    return true;
  };

  const requestResponse = (): boolean => {
    if (responding()) {
      responseHeld = true;
      return true;
    }
    responseRequested = true;
    lastCreateId = `mulmochat_response_${++createCount}`;
    return sendWebSocketMessage({
      type: "response.create",
      event_id: lastCreateId,
    });
  };

  const addUserText = (text: string) =>
    sendWebSocketMessage({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      },
    });

  const handleToolCall = async (event: RealtimeServerEvent) => {
    const callId = event.call_id;
    if (!callId || !event.name || processedToolCalls.has(callId)) return;
    processedToolCalls.add(callId);
    const msg: ToolCallMessage = {
      type: "response.function_call_arguments.done",
      call_id: callId,
      name: event.name,
    };
    await handlers.onToolCall?.(msg, callId, event.arguments ?? "{}");
  };

  const handleError = (error: RealtimeServerEvent["error"]) => {
    const refusedId = error?.event_id;
    if (error?.code === "conversation_already_has_active_response") {
      // A late refusal of an earlier response.create: the one sent since
      // stands.
      if (refusedId && refusedId !== lastCreateId) return;
      // Our response.create was refused because one the server started is
      // running. Its response.created may already have cleared
      // responseRequested, so this doesn't depend on it: ask again after that
      // response, or now if it is already done.
      responseRequested = false;
      responseOverlapped = false;
      responseHeld = true;
      if (!responding()) {
        responseHeld = false;
        requestResponse();
      }
      return;
    }
    // An error about our response.create would fail again, so drop it. One
    // about another event leaves it waiting.
    if (responseRequested && (!refusedId || refusedId === lastCreateId)) {
      responseRequested = false;
      responseOverlapped = false;
      responseHeld = false;
    }
  };

  const handleWebSocketMessage = async (message: MessageEvent) => {
    let event: RealtimeServerEvent;
    try {
      event = JSON.parse(message.data as string) as RealtimeServerEvent;
    } catch (error) {
      console.error(`Failed to parse ${dialect.name} message:`, error);
      handlers.onError?.(error);
      return;
    }

    switch (event.type) {
      case "error":
        console.error(`${dialect.name} error:`, event.error);
        handleError(event.error);
        handlers.onError?.(event.error);
        break;
      case "response.output_audio.delta":
        if (event.delta) state.audioManager?.queueAudio(event.delta);
        break;
      case "response.created":
        if (userTurn === "waiting") {
          userTurn = "answered";
          if (responseRequested) responseOverlapped = true;
        } else {
          responseRequested = false;
        }
        runningResponses.add(event.response?.id ?? "");
        conversationActive.value = true;
        handlers.onConversationStarted?.();
        break;
      case "response.done": {
        const id = event.response?.id ?? "";
        if (!settleResponse(id) || runningResponses.size > 0) break;
        // Whatever turn was taken has had its response by now.
        userTurn = "none";
        if (responseOverlapped && responseRequested) {
          // No response came for ours: it was dropped. Its instruction is in
          // the conversation already.
          responseRequested = false;
          responseHeld = true;
        }
        responseOverlapped = false;
        state.audioManager?.endOfReply();
        conversationActive.value = false;
        handlers.onTextCompleted?.();
        handlers.onConversationFinished?.();
        if (responseHeld && !responseRequested) {
          responseHeld = false;
          requestResponse();
        }
        break;
      }
      case "response.function_call_arguments.done":
        await handleToolCall(event);
        break;
      case "input_audio_buffer.speech_started":
        userTurn = "none";
        // The user talks over the reply: stop playing what is queued.
        state.audioManager?.stopPlayback();
        handlers.onSpeechStarted?.();
        break;
      case "input_audio_buffer.speech_stopped":
        if (userTurn === "none") userTurn = "waiting";
        handlers.onSpeechStopped?.();
        break;
      case "input_audio_buffer.committed":
        if (userTurn === "none") userTurn = "waiting";
        break;
    }
  };

  const handleWebSocketOpen = (
    instructions: string,
    tools: unknown[],
  ): void => {
    // Connected only now: text sent before the socket opens would be lost.
    chatActive.value = true;
    connecting.value = false;
    sendWebSocketMessage({
      type: "session.update",
      session: dialect.session({
        instructions,
        tools,
        voice: resolveVoice(
          dialect.voiceProvider,
          options.getVoiceId?.(dialect.voiceProvider),
        ),
      }),
    });

    if (state.localStream && state.audioManager) {
      state.audioManager.startCapture(
        state.localStream,
        (pcmChunk) => {
          if (state.ws?.readyState === WebSocket.OPEN) {
            sendWebSocketMessage({
              type: "input_audio_buffer.append",
              audio: pcmChunk,
            });
          }
        },
        dialect.inputSampleRate,
      );
    }
  };

  const handleWebSocketError = (error: Event) => {
    console.error(`${dialect.name} WebSocket error:`, error);
    handlers.onError?.(error);
  };

  // Bound to its socket: a close from a socket stopChat already replaced
  // (startChat awaits before opening the next one) must not end the new chat.
  const handleWebSocketClose = (ws: WebSocket) => (event: CloseEvent) => {
    console.log(
      `${dialect.name} WebSocket closed - Code: ${event.code}, Reason: ${event.reason}`,
    );
    if (state.ws !== ws) return;
    // An unexpected close: release the microphone and audio as a stop would.
    stopChat();
  };

  const attachRemoteAudioElement = (__audio: HTMLAudioElement | null) => {
    /* the audio plays through AudioStreamManager, not an audio element */
  };

  const setTracksEnabled = (enabled: boolean) => {
    state.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  };

  const setMute = (muted: boolean) => {
    isMuted.value = muted;
    setTracksEnabled(!muted);
  };

  const setLocalAudioEnabled = (enabled: boolean) => {
    setTracksEnabled(enabled);
  };

  // Bumped by stopChat, so a startChat still awaiting the server or the
  // microphone gives up instead of connecting after it was stopped.
  let startGeneration = 0;

  const stopChat = () => {
    startGeneration++;
    const ws = state.ws;
    if (ws) {
      state.ws = null;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      ws.close();
    }
    if (state.audioManager) {
      state.audioManager.destroy();
      state.audioManager = null;
    }
    if (state.localStream) {
      state.localStream.getTracks().forEach((track) => track.stop());
      state.localStream = null;
    }
    processedToolCalls.clear();
    runningResponses.clear();
    settledEarly.clear();
    responseHeld = false;
    responseRequested = false;
    responseOverlapped = false;
    userTurn = "none";
    chatActive.value = false;
    conversationActive.value = false;
    connecting.value = false;
    setMute(false);
  };

  const startChat = async () => {
    if (chatActive.value || connecting.value) return;

    connecting.value = true;
    const generation = ++startGeneration;
    const stopped = () => generation !== startGeneration;

    try {
      const { url, body } = dialect.startRequest({
        modelId:
          options.getModelId?.({ startResponse: null }) ??
          dialect.defaultModelId,
        voice: resolveVoice(
          dialect.voiceProvider,
          options.getVoiceId?.(dialect.voiceProvider),
        ),
      });
      const response = await fetch(url, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      const start = (await response.json()) as StartApiResponse;
      if (stopped()) return;
      startResponse.value = start;

      const clientSecret = dialect.secret(start);
      if (!clientSecret) {
        throw new Error(
          `No ${dialect.name} client secret received from server`,
        );
      }

      const instructions = options.buildInstructions({
        startResponse: startResponse.value,
      });
      const tools = options.buildTools({
        startResponse: startResponse.value,
      });
      const modelId =
        options.getModelId?.({ startResponse: startResponse.value }) ??
        dialect.defaultModelId;

      // Microphone first, so the WebSocket opens with audio ready to send.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: dialect.inputSampleRate,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      if (stopped()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      state.localStream = stream;

      state.audioManager = new AudioStreamManager();
      state.audioManager.setPlaybackEventHandlers({
        onPlaybackStarted: () => handlers.onAudioPlaybackStarted?.(),
        onPlaybackStopped: () => handlers.onAudioPlaybackStopped?.(),
      });

      const ws = new WebSocket(
        dialect.url(modelId),
        dialect.protocols(clientSecret),
      );
      state.ws = ws;
      ws.onopen = () => handleWebSocketOpen(instructions, tools);
      ws.onmessage = handleWebSocketMessage;
      ws.onerror = handleWebSocketError;
      ws.onclose = handleWebSocketClose(ws);
      // chatActive and connecting change in handleWebSocketOpen.
    } catch (err) {
      console.error(`Failed to start ${dialect.name} session:`, err);
      if (stopped()) return;
      stopChat();
      alert(
        `Failed to start ${dialect.name} session. Check console for details.`,
      );
    }
  };

  const sendUserMessage = async (text: string) => {
    if (!chatActive.value || !addUserText(text)) {
      console.warn("Cannot send text message because WebSocket is not ready.");
      return false;
    }
    return requestResponse();
  };

  const sendFunctionCallOutput = (callId: string, output: string) => {
    return sendWebSocketMessage({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output,
      },
    });
  };

  // response.create's `instructions` replace the session's system prompt for
  // that response, so a plugin's follow-up goes in as a user message instead.
  const sendInstructions = (instructions: string) => {
    if (!addUserText(`[System instruction] ${instructions}`)) return false;
    return requestResponse();
  };

  // Neither Grok nor ElevenLabs takes image input: Grok drops an input_image
  // part, ElevenLabs accepts it and its model says it sees no image. So tools
  // that return images only report their text.
  const sendImagesToModel = () => false;

  const isDataChannelOpen = () => state.ws?.readyState === WebSocket.OPEN;

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
    continueConversation: () => false,
    setMute,
    setLocalAudioEnabled,
    attachRemoteAudioElement,
    registerEventHandlers,
  };
}
