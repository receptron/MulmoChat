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

  const handleWebSocketMessage = async (event: MessageEvent) => {
    let data: any;

    try {
      // Google Live API sends messages as Blobs, not strings
      let jsonString: string;
      if (event.data instanceof Blob) {
        jsonString = await event.data.text();
      } else {
        jsonString = event.data;
      }

      data = JSON.parse(jsonString);

      // Only log non-audio messages to reduce spam
      if (
        !data.serverContent?.modelTurn?.parts?.some((p: any) => p.inlineData)
      ) {
        console.log("GOOGLE LIVE MESSAGE:", JSON.stringify(data, null, 2));
      }
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
      handlers.onError?.(error);
      return;
    }

    // Handle errors from Google
    if (data.error) {
      console.error("Google Live API error:", data.error);
      handlers.onError?.(data.error);
      return;
    }

    // Handle audio data (Google's actual format)
    if (data.data) {
      const audioData = data.data;
      if (googleLive.audioManager && audioData) {
        googleLive.audioManager.queueAudio(audioData);
      }
    }

    // Handle tool calls (Google's actual format)
    if (data.toolCall) {
      const functionCalls = data.toolCall.functionCalls || [];

      for (const fc of functionCalls) {
        const callId = fc.id || `call-${Date.now()}`;

        // Check for duplicates
        if (processedToolCalls.has(callId)) {
          console.warn(`⚠️ Skipping duplicate tool call: ${callId} (${fc.name})`);
          continue;
        }

        console.log(`✅ Processing new tool call: ${callId} (${fc.name})`);

        // Mark as processed BEFORE calling handler to prevent double execution
        processedToolCalls.add(callId);

        const toolCallMsg: ToolCallMessage = {
          type: "response.function_call_arguments.done",
          call_id: callId,
          name: fc.name,
        };

        const argStr = JSON.stringify(fc.args || {});
        console.log(`Tool call: ${fc.name}(${argStr})`);

        // Call handler immediately - don't store in pendingToolCalls since we're handling it now
        handlers.onToolCall?.(toolCallMsg, callId, argStr);

        // Store ONLY for sendFunctionCallOutput to retrieve the name later
        pendingToolCalls.set(callId, {
          id: callId,
          name: fc.name,
          args: fc.args || {},
        });
      }
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
          if (part.inlineData) {
            const audioData = part.inlineData.data;
            if (googleLive.audioManager && audioData) {
              googleLive.audioManager.queueAudio(audioData);
            }
          }

          // Handle function call (old format - shouldn't happen with new model)
          if (part.functionCall) {
            const functionCall = part.functionCall;
            const callId = functionCall.id || `call-${Date.now()}`;

            // Skip if already processed
            if (!processedToolCalls.has(callId)) {
              pendingToolCalls.set(callId, functionCall);
            }
          }

          // Handle executable code - parse it and convert to function call
          if (part.executableCode && part.executableCode.language === "PYTHON") {
            const code = part.executableCode.code;
            console.log("Parsing Python code to extract function call:", code);

            // Parse Python code like: default_api.functionName(arg1='value1', arg2='value2')
            const match = code.match(/default_api\.(\w+)\((.*?)\)/);
            if (match) {
              const functionName = match[1];
              const argsString = match[2];

              // Parse arguments (simple parser for key='value' pairs)
              const args: any = {};
              const argMatches = argsString.matchAll(/(\w+)=([^,]+)/g);
              for (const argMatch of argMatches) {
                const key = argMatch[1];
                let value = argMatch[2].trim();
                // Remove quotes
                if (
                  (value.startsWith("'") && value.endsWith("'")) ||
                  (value.startsWith('"') && value.endsWith('"'))
                ) {
                  value = value.slice(1, -1);
                }
                args[key] = value;
              }

              console.log(
                `Converted code execution to function call: ${functionName}`,
                args,
              );

              // Create a synthetic function call
              const callId = `code-exec-${Date.now()}`;
              const syntheticFunctionCall = {
                id: callId,
                name: functionName,
                args: args,
              };

              pendingToolCalls.set(callId, syntheticFunctionCall);
            } else {
              console.warn(
                "Could not parse executable code into function call:",
                code,
              );
            }
          }
        }

        // Check if turn is complete
        if (serverContent.turnComplete) {
          handlers.onTextCompleted?.();

          // Process all pending tool calls (from old serverContent.modelTurn.parts format)
          for (const [callId, functionCall] of pendingToolCalls.entries()) {
            if (!processedToolCalls.has(callId)) {
              console.log(`⚠️ Processing pending tool call from turnComplete: ${callId}`);
              const toolCallMsg: ToolCallMessage = {
                type: "response.function_call_arguments.done",
                call_id: callId,
                name: functionCall.name,
              };

              const argStr = JSON.stringify(functionCall.args || {});
              console.log(`MSG: toolcall\n${argStr}`);
              processedToolCalls.add(callId);
              handlers.onToolCall?.(toolCallMsg, callId, argStr);
            } else {
              console.log(`✓ Skipping already processed tool call: ${callId}`);
            }
          }

          pendingToolCalls.clear();
          conversationActive.value = false;
          handlers.onConversationFinished?.();
        }
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

  const handleWebSocketClose = (event: CloseEvent) => {
    console.log(
      `WebSocket closed - Code: ${event.code}, Reason: ${event.reason}, Clean: ${event.wasClean}`,
    );

    // Stop audio capture when WebSocket closes
    if (googleLive.audioManager) {
      googleLive.audioManager.stopCapture();
    }

    googleLive.ws = null;
    chatActive.value = false;
    conversationActive.value = false;
  };

  const handleWebSocketOpen = (
    instructions: string,
    tools: any[],
    modelId: string,
  ) => {
    // Convert tools to Google format
    const googleTools = convertToGoogleToolFormat(tools);

    // Send setup message
    const setupMessage: any = {
      setup: {
        model: modelId.startsWith("models/") ? modelId : `models/${modelId}`,
      },
    };

    // Add generation config
    setupMessage.setup.generationConfig = {
      responseModalities: ["AUDIO"],
    };

    // Add system instruction if provided
    if (instructions && instructions.trim()) {
      // Add explicit instruction to use function calling, not code execution
      const enhancedInstructions =
        instructions +
        "\n\nIMPORTANT: When you need to use tools, you MUST call the functions directly using function calling. DO NOT use code execution or write Python code to call functions. Always use the native function calling mechanism.";

      setupMessage.setup.systemInstruction = {
        parts: [{ text: enhancedInstructions }],
      };
    }

    // Add tools if any
    if (googleTools.length > 0) {
      setupMessage.setup.tools = [{ functionDeclarations: googleTools }];
    }

    sendWebSocketMessage(setupMessage);

    // Now that WebSocket is open, start audio capture
    if (googleLive.localStream && googleLive.audioManager) {
      googleLive.audioManager.startCapture(
        googleLive.localStream,
        (pcmChunk) => {
          // Only send if WebSocket is still open
          if (googleLive.ws?.readyState === WebSocket.OPEN) {
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
          }
        },
        16000, // Target sample rate for Google
      );
    }
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

      // Request microphone access (but don't start capture yet)
      googleLive.localStream =
        await globalThis.navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
          },
        });

      // Initialize audio stream manager (capture will start when WebSocket opens)
      googleLive.audioManager = new AudioStreamManager();

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

    // Google Live API accepts simple string for turns
    const success = sendWebSocketMessage({
      clientContent: {
        turns: text,
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
