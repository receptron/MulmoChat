/* global WebSocket, CloseEvent */

// Grok voice (xAI's Voice Agent API). The events are OpenAI Realtime's
// (session.update, conversation.item.create, response.create,
// response.function_call_arguments.done, …), but the transport is a WebSocket
// opened from the browser with PCM16 audio as base64 JSON, like Gemini Live.
// The server mints a short-lived client secret (`/api/start?voice=grok`), so
// XAI_API_KEY never reaches the browser.

import { ref } from "vue";
import type { StartApiResponse } from "../../server/types";
import type { ToolCallMessage } from "./types";
import {
  type RealtimeSessionEventHandlers,
  type RealtimeSessionOptions,
  type UseRealtimeSessionReturn,
} from "./useRealtimeSession";
import { AudioStreamManager } from "../utils/audioStreamManager";
import { DEFAULT_GROK_VOICE_MODEL_ID } from "../config/models";

const GROK_REALTIME_URL = "wss://api.x.ai/v1/realtime";
const GROK_VOICE = "eve";
// Microphone audio sent to Grok; its replies come back at the rate
// AudioStreamManager plays by default.
const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;

interface GrokState {
  ws: WebSocket | null;
  localStream: MediaStream | null;
  audioManager: AudioStreamManager | null;
}

interface GrokServerEvent {
  type: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  delta?: string;
  error?: unknown;
}

export function useGrokVoiceSession(
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
  const processedToolCalls = new Set<string>();

  const grok: GrokState = {
    ws: null,
    localStream: null,
    audioManager: null,
  };

  // A response is running from response.create (or the server's own VAD turn)
  // until response.done. Another response.create in that window is held and
  // sent after it, once: several tool outputs get one follow-up response.
  let responseActive = false;
  let responseHeld = false;
  // response.create sent, response.created not seen yet. If Grok answers it
  // with an error instead, no response.done follows.
  let responseRequested = false;

  const sendWebSocketMessage = (message: unknown): boolean => {
    if (!grok.ws || grok.ws.readyState !== WebSocket.OPEN) {
      console.warn("Cannot send message because WebSocket is not open.");
      return false;
    }
    grok.ws.send(JSON.stringify(message));
    return true;
  };

  const requestResponse = (): boolean => {
    if (responseActive) {
      responseHeld = true;
      return true;
    }
    responseActive = true;
    responseRequested = true;
    return sendWebSocketMessage({ type: "response.create" });
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

  const handleToolCall = async (event: GrokServerEvent) => {
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

  const handleWebSocketMessage = async (message: MessageEvent) => {
    let event: GrokServerEvent;
    try {
      event = JSON.parse(message.data as string) as GrokServerEvent;
    } catch (error) {
      console.error("Failed to parse Grok message:", error);
      handlers.onError?.(error);
      return;
    }

    switch (event.type) {
      case "error":
        console.error("Grok voice error:", event.error);
        if (responseRequested) {
          responseRequested = false;
          responseActive = false;
          responseHeld = false;
        }
        handlers.onError?.(event.error);
        break;
      case "response.output_audio.delta":
        if (event.delta) grok.audioManager?.queueAudio(event.delta);
        break;
      case "response.created":
        responseActive = true;
        responseRequested = false;
        conversationActive.value = true;
        handlers.onConversationStarted?.();
        break;
      case "response.done":
        responseActive = false;
        conversationActive.value = false;
        handlers.onTextCompleted?.();
        handlers.onConversationFinished?.();
        if (responseHeld) {
          responseHeld = false;
          requestResponse();
        }
        break;
      case "response.function_call_arguments.done":
        await handleToolCall(event);
        break;
      case "input_audio_buffer.speech_started":
        // The user talks over the reply: stop playing what is queued.
        grok.audioManager?.stopPlayback();
        handlers.onSpeechStarted?.();
        break;
      case "input_audio_buffer.speech_stopped":
        handlers.onSpeechStopped?.();
        break;
    }
  };

  const handleWebSocketOpen = (
    instructions: string,
    tools: unknown[],
  ): void => {
    sendWebSocketMessage({
      type: "session.update",
      session: {
        voice: GROK_VOICE,
        instructions,
        turn_detection: { type: "server_vad" },
        audio: {
          input: {
            format: { type: "audio/pcm", rate: INPUT_SAMPLE_RATE },
          },
          output: {
            format: { type: "audio/pcm", rate: OUTPUT_SAMPLE_RATE },
          },
        },
        tools,
      },
    });

    if (grok.localStream && grok.audioManager) {
      grok.audioManager.startCapture(
        grok.localStream,
        (pcmChunk) => {
          if (grok.ws?.readyState === WebSocket.OPEN) {
            sendWebSocketMessage({
              type: "input_audio_buffer.append",
              audio: pcmChunk,
            });
          }
        },
        INPUT_SAMPLE_RATE,
      );
    }
  };

  const handleWebSocketError = (error: Event) => {
    console.error("Grok WebSocket error:", error);
    handlers.onError?.(error);
  };

  // Bound to its socket: a close from a socket stopChat already replaced
  // (startChat awaits before opening the next one) must not end the new chat.
  const handleWebSocketClose = (ws: WebSocket) => (event: CloseEvent) => {
    console.log(
      `Grok WebSocket closed - Code: ${event.code}, Reason: ${event.reason}`,
    );
    if (grok.ws !== ws) return;
    // An unexpected close: release the microphone and audio as a stop would.
    stopChat();
  };

  const attachRemoteAudioElement = (__audio: HTMLAudioElement | null) => {
    /* Grok audio plays through AudioStreamManager, not an audio element */
  };

  const setTracksEnabled = (enabled: boolean) => {
    grok.localStream?.getAudioTracks().forEach((track) => {
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

  const stopChat = () => {
    const ws = grok.ws;
    if (ws) {
      grok.ws = null;
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      ws.close();
    }
    if (grok.audioManager) {
      grok.audioManager.destroy();
      grok.audioManager = null;
    }
    if (grok.localStream) {
      grok.localStream.getTracks().forEach((track) => track.stop());
      grok.localStream = null;
    }
    processedToolCalls.clear();
    responseActive = false;
    responseHeld = false;
    responseRequested = false;
    chatActive.value = false;
    conversationActive.value = false;
    setMute(false);
  };

  const startChat = async () => {
    if (chatActive.value || connecting.value) return;

    connecting.value = true;

    try {
      const response = await fetch("/api/start?voice=grok", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      startResponse.value = await response.json();

      const clientSecret = startResponse.value?.grokClientSecret;
      if (!clientSecret) {
        throw new Error("No Grok client secret received from server");
      }

      const instructions = options.buildInstructions({
        startResponse: startResponse.value,
      });
      const tools = options.buildTools({
        startResponse: startResponse.value,
      });
      const modelId =
        options.getModelId?.({ startResponse: startResponse.value }) ??
        DEFAULT_GROK_VOICE_MODEL_ID;

      // Microphone first, so the WebSocket opens with audio ready to send.
      grok.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: INPUT_SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      grok.audioManager = new AudioStreamManager();
      grok.audioManager.setPlaybackEventHandlers({
        onPlaybackStarted: () => handlers.onAudioPlaybackStarted?.(),
        onPlaybackStopped: () => handlers.onAudioPlaybackStopped?.(),
      });

      // Browsers can't set an Authorization header on a WebSocket; xAI takes
      // the client secret as a subprotocol instead.
      const ws = new WebSocket(
        `${GROK_REALTIME_URL}?model=${encodeURIComponent(modelId)}`,
        [`xai-client-secret.${clientSecret}`],
      );
      grok.ws = ws;
      ws.onopen = () => handleWebSocketOpen(instructions, tools);
      ws.onmessage = handleWebSocketMessage;
      ws.onerror = handleWebSocketError;
      ws.onclose = handleWebSocketClose(ws);

      chatActive.value = true;
    } catch (err) {
      console.error("Failed to start Grok voice session:", err);
      stopChat();
      alert("Failed to start Grok voice session. Check console for details.");
    } finally {
      connecting.value = false;
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

  // Grok's voice API takes no image input (an input_image part is dropped),
  // so tools that return images only report their text to it.
  const sendImagesToModel = () => false;

  const isDataChannelOpen = () => grok.ws?.readyState === WebSocket.OPEN;

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
    setMute,
    setLocalAudioEnabled,
    attachRemoteAudioElement,
    registerEventHandlers,
  };
}
