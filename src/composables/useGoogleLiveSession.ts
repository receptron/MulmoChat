/* eslint-env browser */

import { ref, shallowRef } from "vue";
import type { StartApiResponse } from "../../server/types";
import type { BuildContext, ToolCallMessage } from "./types";
import { isValidToolCallMessage } from "./types";
import {
  type RealtimeSessionEventHandlers,
  type RealtimeSessionOptions,
  type UseRealtimeSessionReturn,
} from "./useRealtimeSession";
import { AudioStreamManager } from "../utils/audioStreamManager";
import { convertToGoogleToolFormat } from "../utils/toolConverter";
import { DEFAULT_GOOGLE_LIVE_MODEL_ID } from "../config/models";

type BrowserMediaStream = globalThis.MediaStream;
/* eslint-disable-next-line no-undef */
type BrowserHTMLAudioElement = HTMLAudioElement;

export type UseGoogleLiveSessionOptions = RealtimeSessionOptions;
export type UseGoogleLiveSessionReturn = UseRealtimeSessionReturn;

interface GoogleLiveState {
  ws: WebSocket | null;
  localStream: BrowserMediaStream | null;
  audioManager: AudioStreamManager | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

export function useGoogleLiveSession(
  options: UseGoogleLiveSessionOptions,
): UseGoogleLiveSessionReturn {
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
  const pendingToolCalls = new Map<string, any>();
  const processedToolCalls = new Set<string>();
  const remoteAudioElement = shallowRef<BrowserHTMLAudioElement | null>(null);

  const googleLive: GoogleLiveState = {
    ws: null,
    localStream: null,
    audioManager: null,
  };

  const sendWebSocketMessage = (message: any): boolean => {
    if (!googleLive.ws || googleLive.ws.readyState !== WebSocket.OPEN) {
      console.warn("Cannot send message because WebSocket is not open.");
      return false;
    }
    googleLive.ws.send(JSON.stringify(message));
    return true;
  };

  const handleWebSocketMessage = (event: MessageEvent) => {
    let data: any;

    try {
      data = JSON.parse(event.data);
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
      handlers.onError?.(error);
      return;
    }

    // Handle server content
    if (data.serverContent) {
      const serverContent = data.serverContent;

      // Check for model turn
      if (serverContent.modelTurn) {
        conversationActive.value = true;
        handlers.onConversationStarted?.();

        const parts = serverContent.modelTurn.parts || [];

        for (const part of parts) {
          // Handle text response
          if (part.text) {
            handlers.onTextDelta?.(part.text);
          }

          // Handle audio response
          if (part.inlineData && part.inlineData.mimeType === "audio/pcm") {
            const audioData = part.inlineData.data;
            if (googleLive.audioManager) {
              googleLive.audioManager.queueAudio(audioData);
            }
          }

          // Handle function call
          if (part.functionCall) {
            const functionCall = part.functionCall;
            const callId = functionCall.id || `call-${Date.now()}`;

            // Store for potential multi-part calls
            pendingToolCalls.set(callId, functionCall);
          }
        }

        // Check if turn is complete
        if (serverContent.turnComplete) {
          handlers.onTextCompleted?.();

          // Process all pending tool calls
          for (const [callId, functionCall] of pendingToolCalls.entries()) {
            if (!processedToolCalls.has(callId)) {
              const toolCallMsg: ToolCallMessage = {
                type: "response.function_call_arguments.done",
                call_id: callId,
                name: functionCall.name,
              };

              const argStr = JSON.stringify(functionCall.args || {});
              console.log(`MSG: toolcall\n${argStr}`);
              processedToolCalls.add(callId);
              handlers.onToolCall?.(toolCallMsg, callId, argStr);
            }
          }

          pendingToolCalls.clear();
          conversationActive.value = false;
          handlers.onConversationFinished?.();
        }
      }
    }

    // Handle tool call invoke (alternative format)
    if (data.toolCall) {
      const toolCall = data.toolCall;
      const callId = toolCall.id || `call-${Date.now()}`;

      if (!processedToolCalls.has(callId)) {
        const toolCallMsg: ToolCallMessage = {
          type: "response.function_call_arguments.done",
          call_id: callId,
          name: toolCall.functionCalls?.[0]?.name || "",
        };

        const argStr = JSON.stringify(toolCall.functionCalls?.[0]?.args || {});
        console.log(`MSG: toolcall\n${argStr}`);
        processedToolCalls.add(callId);
        handlers.onToolCall?.(toolCallMsg, callId, argStr);
      }
    }

    // Handle setup complete
    if (data.setupComplete) {
      console.log("Google Live API setup complete");
    }
  };

  const handleWebSocketError = (error: Event) => {
    console.error("WebSocket error:", error);
    handlers.onError?.(error);
  };

  const handleWebSocketClose = () => {
    console.log("WebSocket closed");
    googleLive.ws = null;
    chatActive.value = false;
    conversationActive.value = false;
  };

  const handleWebSocketOpen = (
    instructions: string,
    tools: any[],
    modelId: string,
  ) => {
    console.log("WebSocket opened, sending setup message");

    // Convert tools to Google format
    const googleTools = convertToGoogleToolFormat(tools);

    // Send setup message
    const setupMessage = {
      setup: {
        model: `models/${modelId}`,
        generationConfig: {
          responseModalities: ["TEXT", "AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: "Aoede",
              },
            },
          },
        },
        systemInstruction: {
          parts: [
            {
              text: instructions,
            },
          ],
        },
        tools:
          googleTools.length > 0
            ? [{ functionDeclarations: googleTools }]
            : undefined,
      },
    };

    console.log("GOOGLE LIVE SETUP:", JSON.stringify(setupMessage, null, 2));
    sendWebSocketMessage(setupMessage);
  };

  const attachRemoteAudioElement = (audio: BrowserHTMLAudioElement | null) => {
    remoteAudioElement.value = audio;
    // Google Live uses AudioStreamManager for playback, not HTML audio element
  };

  const setMute = (muted: boolean) => {
    isMuted.value = muted;
    if (googleLive.localStream) {
      const audioTracks = googleLive.localStream.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = !muted;
      });
    }
  };

  const setLocalAudioEnabled = (enabled: boolean) => {
    if (googleLive.localStream) {
      const audioTracks = googleLive.localStream.getAudioTracks();
      audioTracks.forEach((track) => {
        track.enabled = enabled;
      });
    }
  };

  const stopChat = () => {
    if (googleLive.ws) {
      googleLive.ws.close();
      googleLive.ws = null;
    }

    if (googleLive.audioManager) {
      googleLive.audioManager.destroy();
      googleLive.audioManager = null;
    }

    if (googleLive.localStream) {
      googleLive.localStream.getTracks().forEach((track) => track.stop());
      googleLive.localStream = null;
    }

    chatActive.value = false;
    conversationActive.value = false;
    setMute(false);
  };

  const startChat = async () => {
    if (chatActive.value || connecting.value) return;

    connecting.value = true;

    try {
      // Fetch Google API key
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

      if (!startResponse.value?.googleApiKey) {
        throw new Error("No Google API key received from server");
      }

      // Build instructions and tools
      const instructions = options.buildInstructions({
        startResponse: startResponse.value,
      });
      const tools = options.buildTools({
        startResponse: startResponse.value,
      });
      const modelId =
        options.getModelId?.({
          startResponse: startResponse.value,
        }) ?? DEFAULT_GOOGLE_LIVE_MODEL_ID;

      console.log(`INSTRUCTIONS:\n${instructions}`);

      // Establish WebSocket connection
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${startResponse.value.googleApiKey}`;

      googleLive.ws = new WebSocket(wsUrl);

      googleLive.ws.onopen = () =>
        handleWebSocketOpen(instructions, tools, modelId);
      googleLive.ws.onmessage = handleWebSocketMessage;
      googleLive.ws.onerror = handleWebSocketError;
      googleLive.ws.onclose = handleWebSocketClose;

      // Request microphone access
      googleLive.localStream =
        await globalThis.navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });

      // Initialize audio stream manager
      googleLive.audioManager = new AudioStreamManager();
      googleLive.audioManager.startCapture(
        googleLive.localStream,
        (pcmChunk) => {
          // Send audio chunk to Google
          sendWebSocketMessage({
            realtimeInput: {
              mediaChunks: [
                {
                  data: pcmChunk,
                  mimeType: "audio/pcm",
                },
              ],
            },
          });
        },
        16000, // Target sample rate for Google
      );

      chatActive.value = true;
    } catch (err) {
      console.error("Failed to start Google Live session:", err);
      stopChat();
      globalThis.alert(
        "Failed to start Google Live session. Check console for details.",
      );
    } finally {
      connecting.value = false;
    }
  };

  const sendUserMessage = async (text: string) => {
    if (
      !chatActive.value ||
      !googleLive.ws ||
      googleLive.ws.readyState !== WebSocket.OPEN
    ) {
      console.warn("Cannot send text message because WebSocket is not ready.");
      return false;
    }

    console.log(`MSG:\n`, text);

    const success = sendWebSocketMessage({
      clientContent: {
        turns: [
          {
            role: "user",
            parts: [
              {
                text,
              },
            ],
          },
        ],
        turnComplete: true,
      },
    });

    return success;
  };

  const sendFunctionCallOutput = (callId: string, output: string) => {
    // Get the function name from processed tool calls
    let functionName = "unknown";
    for (const [id, call] of pendingToolCalls.entries()) {
      if (id === callId) {
        functionName = call.name;
        break;
      }
    }

    return sendWebSocketMessage({
      toolResponse: {
        functionResponses: [
          {
            id: callId,
            name: functionName,
            response: {
              result: output,
            },
          },
        ],
      },
    });
  };

  const sendInstructions = (instructions: string) => {
    // Google Live API doesn't support mid-conversation instruction updates
    // We'll send it as a user message instead
    console.log("Sending instructions as user message:", instructions);
    return sendUserMessage(instructions);
  };

  const isDataChannelOpen = () => googleLive.ws?.readyState === WebSocket.OPEN;

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
