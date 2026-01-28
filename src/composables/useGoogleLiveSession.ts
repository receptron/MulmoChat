/* global WebSocket, CloseEvent */

import { ref, shallowRef } from "vue";
import type { StartApiResponse } from "../../server/types";
import type { ToolCallMessage } from "./types";
import {
  type RealtimeSessionEventHandlers,
  type RealtimeSessionOptions,
  type UseRealtimeSessionReturn,
} from "./useRealtimeSession";
import { AudioStreamManager } from "../utils/audioStreamManager";
import {
  convertToGoogleToolFormat,
  type OpenAITool,
} from "../utils/toolConverter";
import { DEFAULT_GOOGLE_LIVE_MODEL_ID } from "../config/models";

// Types for Google Live API
interface GoogleLiveState {
  ws: WebSocket | null;
  localStream: MediaStream | null;
  audioManager: AudioStreamManager | null;
}

interface PendingToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

interface GoogleFunctionCall {
  id?: string;
  name: string;
  args?: Record<string, unknown>;
}

interface GoogleToolCall {
  functionCalls?: GoogleFunctionCall[];
}

interface GoogleInlineData {
  data: string;
  mimeType?: string;
}

interface GooglePart {
  text?: string;
  inlineData?: GoogleInlineData;
  functionCall?: GoogleFunctionCall;
}

interface GoogleModelTurn {
  parts?: GooglePart[];
}

interface GoogleServerContent {
  modelTurn?: GoogleModelTurn;
  turnComplete?: boolean;
  interrupted?: boolean;
}

interface GoogleWebSocketMessage {
  error?: unknown;
  data?: string;
  toolCall?: GoogleToolCall;
  serverContent?: GoogleServerContent;
  setupComplete?: boolean;
}

interface GoogleGenerationConfig {
  responseModalities: string[];
}

interface GoogleSystemInstruction {
  parts: { text: string }[];
}

interface GoogleToolDeclarations {
  functionDeclarations: unknown[];
}

interface GoogleSetupConfig {
  model: string;
  generationConfig?: GoogleGenerationConfig;
  systemInstruction?: GoogleSystemInstruction;
  tools?: GoogleToolDeclarations[];
}

interface GoogleSetupMessage {
  setup: GoogleSetupConfig;
}

export function useGoogleLiveSession(
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
  const pendingToolCalls = new Map<string, PendingToolCall>();
  const processedToolCalls = new Set<string>();
  const remoteAudioElement = shallowRef<HTMLAudioElement | null>(null);

  const googleLive: GoogleLiveState = {
    ws: null,
    localStream: null,
    audioManager: null,
  };

  const sendWebSocketMessage = (message: unknown): boolean => {
    if (!googleLive.ws || googleLive.ws.readyState !== WebSocket.OPEN) {
      console.warn("Cannot send message because WebSocket is not open.");
      return false;
    }
    googleLive.ws.send(JSON.stringify(message));
    return true;
  };

  /**
   * Fix Google's double-stringification issue where array elements
   * are returned as JSON strings instead of objects
   */
  const fixGoogleArgs = (args: unknown): unknown => {
    if (Array.isArray(args)) {
      return args.map((item: unknown) => {
        // If array item is a string that looks like JSON, parse it
        if (typeof item === "string" && item.startsWith("{")) {
          try {
            return JSON.parse(item) as unknown;
          } catch {
            return item;
          }
        }
        return fixGoogleArgs(item);
      });
    }

    if (args && typeof args === "object") {
      const fixed: Record<string, unknown> = {};
      for (const key in args) {
        if (Object.prototype.hasOwnProperty.call(args, key)) {
          fixed[key] = fixGoogleArgs((args as Record<string, unknown>)[key]);
        }
      }
      return fixed;
    }

    return args;
  };

  const handleWebSocketMessage = async (event: MessageEvent) => {
    let data: GoogleWebSocketMessage;

    try {
      // Google Live API sends messages as Blobs, not strings
      let jsonString: string;
      if (event.data instanceof Blob) {
        jsonString = await event.data.text();
      } else {
        jsonString = event.data;
      }

      data = JSON.parse(jsonString);
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

    // Handle audio data (Google's actual format from sample code: turn.data)
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
          continue;
        }

        // Mark as processed BEFORE calling handler to prevent double execution
        processedToolCalls.add(callId);

        const toolCallMsg: ToolCallMessage = {
          type: "response.function_call_arguments.done",
          call_id: callId,
          name: fc.name,
        };

        // Fix Google's double-stringification of array elements
        // Google sometimes returns array items as JSON strings instead of objects
        const fixedArgs = fixGoogleArgs(fc.args || {});
        const argStr = JSON.stringify(fixedArgs);

        // Call handler immediately - don't store in pendingToolCalls since we're handling it now
        await handlers.onToolCall?.(toolCallMsg, callId, argStr);

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

          // Handle audio response (inlineData format)
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
              pendingToolCalls.set(callId, {
                id: callId,
                name: functionCall.name,
                args: functionCall.args || {},
              });
            }
          }
        }
      }

      // Check if turn is complete (at serverContent level, not just modelTurn)
      if (serverContent.turnComplete) {
        handlers.onTextCompleted?.();

        // Process all pending tool calls (from old serverContent.modelTurn.parts format)
        for (const [callId, functionCall] of pendingToolCalls.entries()) {
          if (!processedToolCalls.has(callId)) {
            const toolCallMsg: ToolCallMessage = {
              type: "response.function_call_arguments.done",
              call_id: callId,
              name: functionCall.name,
            };

            const argStr = JSON.stringify(functionCall.args || {});
            processedToolCalls.add(callId);
            await handlers.onToolCall?.(toolCallMsg, callId, argStr);
          }
        }

        pendingToolCalls.clear();
        conversationActive.value = false;
        handlers.onConversationFinished?.();
      }
    }

    // Handle setup complete
    if (data.setupComplete) {
      // Setup is complete, connection is ready
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
    tools: OpenAITool[],
    modelId: string,
  ) => {
    // Convert tools to Google format
    const googleTools = convertToGoogleToolFormat(tools);

    // Build setup config
    const setupConfig: GoogleSetupConfig = {
      model: modelId.startsWith("models/") ? modelId : `models/${modelId}`,
      generationConfig: {
        responseModalities: ["AUDIO"],
      },
    };

    // Add system instruction if provided
    if (instructions && instructions.trim()) {
      // Add explicit instruction to use function calling, not code execution
      const enhancedInstructions =
        instructions +
        "\n\nIMPORTANT: When you need to use tools, you MUST call the functions directly using function calling. DO NOT use code execution or write Python code to call functions. Always use the native function calling mechanism.";

      setupConfig.systemInstruction = {
        parts: [{ text: enhancedInstructions }],
      };
    }

    // Add tools if any
    if (googleTools.length > 0) {
      setupConfig.tools = [{ functionDeclarations: googleTools }];
    }

    const setupMessage: GoogleSetupMessage = { setup: setupConfig };
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

  const attachRemoteAudioElement = (audio: HTMLAudioElement | null) => {
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
      }) as OpenAITool[];
      const modelId =
        options.getModelId?.({
          startResponse: startResponse.value,
        }) ?? DEFAULT_GOOGLE_LIVE_MODEL_ID;

      // Request microphone access FIRST (before WebSocket)
      googleLive.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Initialize audio stream manager
      googleLive.audioManager = new AudioStreamManager();

      // Set up audio playback event handlers for avatar lip-sync, visual feedback, etc.
      console.log(
        "[Avatar Debug] Google: Setting up audioManager handlers, onAudioPlaybackStarted exists:",
        !!handlers.onAudioPlaybackStarted,
      );
      googleLive.audioManager.setPlaybackEventHandlers({
        onPlaybackStarted: () => {
          console.log(
            "[Avatar Debug] Google: audioManager callback onPlaybackStarted called",
          );
          handlers.onAudioPlaybackStarted?.();
        },
        onPlaybackStopped: () => {
          console.log(
            "[Avatar Debug] Google: audioManager callback onPlaybackStopped called",
          );
          handlers.onAudioPlaybackStopped?.();
        },
      });

      // NOW establish WebSocket connection (after mic is ready)
      const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${startResponse.value.googleApiKey}`;

      googleLive.ws = new WebSocket(wsUrl);

      googleLive.ws.onopen = () =>
        handleWebSocketOpen(instructions, tools, modelId);
      googleLive.ws.onmessage = handleWebSocketMessage;
      googleLive.ws.onerror = handleWebSocketError;
      googleLive.ws.onclose = handleWebSocketClose;

      chatActive.value = true;
    } catch (err) {
      console.error("Failed to start Google Live session:", err);
      stopChat();
      alert("Failed to start Google Live session. Check console for details.");
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

    // Google Live API expects turns as an array of Content objects
    const success = sendWebSocketMessage({
      clientContent: {
        turns: [
          {
            role: "user",
            parts: [{ text }],
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

  const sendInstructions = (instructions: string): Promise<boolean> => {
    // Google Live API doesn't support mid-conversation instruction updates
    // We'll send it as a user message instead
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
