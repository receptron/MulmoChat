import { ref, shallowRef, type Ref } from "vue";
import type { StartApiResponse } from "../../server/types";
import type { BuildContext, ToolCallMessage } from "./types";
import { isValidToolCallMessage } from "./types";
import { DEFAULT_REALTIME_MODEL_ID } from "../config/models";

export interface RealtimeSessionEventHandlers {
  onToolCall?: (
    msg: ToolCallMessage,
    id: string,
    argStr: string,
  ) => void | Promise<void>;
  onTextDelta?: (delta: string) => void;
  onTextCompleted?: () => void;
  onConversationStarted?: () => void;
  onConversationFinished?: () => void;

  // User speech events (microphone input detection)
  // Fired when the user starts/stops speaking into the microphone
  onSpeechStarted?: () => void;
  onSpeechStopped?: () => void;

  // LLM audio playback events (text-to-speech output)
  // Fired when the LLM's voice response starts/stops playing
  // Use these for avatar lip-sync, visual feedback, etc.
  onAudioPlaybackStarted?: () => void;
  onAudioPlaybackStopped?: () => void;

  onError?: (error: unknown) => void;
}

export interface RealtimeSessionOptions {
  buildInstructions: (context: BuildContext) => string;
  buildTools: (context: BuildContext) => unknown[];
  handlers?: RealtimeSessionEventHandlers;
  getModelId?: (context: BuildContext) => string;
}

export interface UseRealtimeSessionReturn {
  chatActive: Ref<boolean>;
  conversationActive: Ref<boolean>;
  connecting: Ref<boolean>;
  isMuted: Ref<boolean>;
  startResponse: Ref<StartApiResponse | null>;
  isDataChannelOpen: () => boolean;
  startChat: () => Promise<void>;
  stopChat: () => void;
  sendUserMessage: (text: string) => Promise<boolean>;
  sendFunctionCallOutput: (callId: string, output: string) => boolean;
  sendInstructions: (instructions: string) => boolean | Promise<boolean>;
  setMute: (muted: boolean) => void;
  setLocalAudioEnabled: (enabled: boolean) => void;
  attachRemoteAudioElement: (audio: HTMLAudioElement | null) => void;
  registerEventHandlers: (
    handlers: Partial<RealtimeSessionEventHandlers>,
  ) => void;
}

interface WebRtcState {
  pc: RTCPeerConnection | null;
  dc: RTCDataChannel | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

export function useRealtimeSession(
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
  const pendingToolArgs: Record<string, string> = {};
  const processedToolCalls = new Map<string, string>();
  const remoteAudioElement = shallowRef<HTMLAudioElement | null>(null);

  // Track LLM audio playback state for lip-sync and visual feedback
  let isAudioPlaying = false;

  const webrtc: WebRtcState = {
    pc: null,
    dc: null,
    localStream: null,
    remoteStream: null,
  };

  const sendDataChannelMessage = (message: unknown): boolean => {
    if (!webrtc.dc || webrtc.dc.readyState !== "open") {
      console.warn(
        "Cannot send message because the data channel is not ready.",
      );
      return false;
    }
    const payload =
      typeof message === "string" ? message : JSON.stringify(message);
    webrtc.dc.send(payload);
    return true;
  };

  const handleMessage = async (event: MessageEvent) => {
    let msg: ToolCallMessage;

    try {
      msg = JSON.parse(event.data) as ToolCallMessage;
    } catch (error) {
      console.error("Failed to parse message:", error);
      handlers.onError?.(error);
      return;
    }

    if (!isValidToolCallMessage(msg)) {
      console.warn("Invalid message format:", msg);
      return;
    }

    // Debug: log all message types to see what's coming from OpenAI
    console.log("[Avatar Debug] OpenAI message type:", msg.type);

    const id = msg.id || msg.call_id;

    switch (msg.type) {
      case "error":
        console.error("Error", msg.error);
        handlers.onError?.(msg.error);
        break;
      case "response.text.delta":
        handlers.onTextDelta?.(msg.delta ?? "");
        break;
      case "response.completed":
        handlers.onTextCompleted?.();
        break;
      case "response.function_call_arguments.delta":
        if (id) {
          pendingToolArgs[id] = (pendingToolArgs[id] || "") + (msg.delta ?? "");
        }
        break;
      case "response.function_call_arguments.done": {
        if (!id) break;
        const argStr = pendingToolArgs[id] || msg.arguments || "";
        delete pendingToolArgs[id];
        if (msg.truncated) {
          console.warn(
            `******* Abandoning truncated tool call for ${msg.name || msg.call_id}`,
          );
          processedToolCalls.delete(id);
          break;
        }
        const previousArgs = processedToolCalls.get(id);
        if (previousArgs === argStr) {
          console.warn(
            `******* Skipping duplicate tool call for ${msg.name || msg.call_id}`,
          );
          break;
        }
        console.log(`MSG: toolcall\n${argStr}`);
        processedToolCalls.set(id, argStr);
        await handlers.onToolCall?.(msg, id, argStr);
        break;
      }
      case "response.created":
        conversationActive.value = true;
        handlers.onConversationStarted?.();
        break;
      case "response.done":
        conversationActive.value = false;
        handlers.onConversationFinished?.();
        break;
      case "input_audio_buffer.speech_started":
        handlers.onSpeechStarted?.();
        break;
      case "input_audio_buffer.speech_stopped":
        handlers.onSpeechStopped?.();
        break;

      // LLM audio playback events (for avatar lip-sync, visual feedback)
      // output_audio_buffer.started: Audio playback has started
      // output_audio_buffer.stopped: Audio playback finished (actual end of playback)
      // output_audio_buffer.cleared: Audio was interrupted (user spoke)
      case "output_audio_buffer.started":
        if (!isAudioPlaying) {
          isAudioPlaying = true;
          console.log("[Avatar Debug] OpenAI: Audio playback STARTED");
          handlers.onAudioPlaybackStarted?.();
        }
        break;
      case "output_audio_buffer.stopped":
      case "output_audio_buffer.cleared":
        if (isAudioPlaying) {
          isAudioPlaying = false;
          console.log("[Avatar Debug] OpenAI: Audio playback STOPPED");
          handlers.onAudioPlaybackStopped?.();
        }
        break;
    }
  };

  const attachRemoteAudioElement = (audio: HTMLAudioElement | null) => {
    remoteAudioElement.value = audio;
    if (audio && webrtc.remoteStream) {
      audio.srcObject = webrtc.remoteStream;
    }
  };

  const setMute = (muted: boolean) => {
    isMuted.value = muted;
    if (webrtc.localStream) {
      const audioTracks = webrtc.localStream.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !muted;
      });
    }
  };

  const setLocalAudioEnabled = (enabled: boolean) => {
    if (webrtc.localStream) {
      const audioTracks = webrtc.localStream.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = enabled;
      });
    }
  };

  const stopChat = () => {
    if (webrtc.pc) {
      webrtc.pc.close();
      webrtc.pc = null;
    }
    if (webrtc.dc) {
      webrtc.dc.close();
      webrtc.dc = null;
    }
    if (webrtc.localStream) {
      webrtc.localStream.getTracks().forEach((track) => track.stop());
      webrtc.localStream = null;
    }
    if (webrtc.remoteStream) {
      webrtc.remoteStream.getTracks().forEach((track) => track.stop());
      webrtc.remoteStream = null;
    }
    if (remoteAudioElement.value) {
      remoteAudioElement.value.srcObject = null;
    }
    chatActive.value = false;
    conversationActive.value = false;
    setMute(false);
  };

  const startChat = async () => {
    if (chatActive.value || connecting.value) return;

    connecting.value = true;

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

      startResponse.value = await response.json();

      if (!startResponse.value?.ephemeralKey) {
        throw new Error("No ephemeral key received from server");
      }
    } catch (err) {
      console.error("Failed to get ephemeral key:", err);
      alert("Failed to start session. Check console for details.");
      connecting.value = false;
      return;
    }

    try {
      webrtc.pc = new RTCPeerConnection();

      const dc = webrtc.pc.createDataChannel("oai-events");
      webrtc.dc = dc;
      dc.addEventListener("open", () => {
        const instructions = options.buildInstructions({
          startResponse: startResponse.value,
        });
        const modelId =
          options.getModelId?.({
            startResponse: startResponse.value,
          }) ?? DEFAULT_REALTIME_MODEL_ID;
        console.log(`INSTRUCTIONS:\n${instructions}`);
        const tools = options.buildTools({
          startResponse: startResponse.value,
        });
        sendDataChannelMessage({
          type: "session.update",
          session: {
            type: "realtime",
            model: modelId,
            instructions,
            audio: {
              output: {
                voice: "shimmer",
              },
            },
            tools,
          },
        });
      });
      dc.addEventListener("message", handleMessage);
      dc.addEventListener("close", () => {
        webrtc.dc = null;
      });

      webrtc.remoteStream = new MediaStream();
      webrtc.pc.ontrack = (event) => {
        webrtc.remoteStream?.addTrack(event.track);
        if (remoteAudioElement.value) {
          remoteAudioElement.value.srcObject = webrtc.remoteStream;
        }
      };

      webrtc.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      webrtc.localStream
        .getTracks()
        .forEach((track) =>
          webrtc.pc?.addTrack(track, webrtc.localStream as MediaStream),
        );

      const offer = await webrtc.pc.createOffer();
      await webrtc.pc.setLocalDescription(offer);

      const response = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${startResponse.value?.ephemeralKey}`,
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });
      const responseText = await response.text();

      await webrtc.pc.setRemoteDescription({
        type: "answer",
        sdp: responseText,
      });
      chatActive.value = true;
    } catch (err) {
      console.error(err);
      stopChat();
      alert("Failed to start voice chat. Check console for details.");
    } finally {
      connecting.value = false;
    }
  };

  const sendUserMessage = async (text: string) => {
    if (!chatActive.value || !webrtc.dc || webrtc.dc.readyState !== "open") {
      console.warn(
        "Cannot send text message because the data channel is not ready.",
      );
      return false;
    }

    console.log(`MSG:\n`, text);
    const itemSuccess = sendDataChannelMessage({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text,
          },
        ],
      },
    });

    if (!itemSuccess) {
      return false;
    }

    const responseSuccess = sendDataChannelMessage({
      type: "response.create",
      response: {},
    });

    return responseSuccess;
  };

  const sendFunctionCallOutput = (callId: string, output: string) => {
    return sendDataChannelMessage({
      type: "conversation.item.create",
      item: {
        type: "function_call_output",
        call_id: callId,
        output,
      },
    });
  };

  const sendInstructions = (instructions: string) => {
    return sendDataChannelMessage({
      type: "response.create",
      response: {
        instructions,
      },
    });
  };

  const isDataChannelOpen = () => webrtc.dc?.readyState === "open";

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
