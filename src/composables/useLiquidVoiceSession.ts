import { LIQUID_VOICE_MODEL } from "../config/models";
import type {
  RealtimeSessionOptions,
  UseRealtimeSessionReturn,
} from "./useRealtimeSession";
import {
  useRealtimeWebSocketSession,
  type RealtimeDialect,
} from "./useRealtimeWebSocketSession";

const liquidDialect: RealtimeDialect = {
  name: "LFM3 Omni (llama.cpp)",
  voiceProvider: null,
  defaultModelId: LIQUID_VOICE_MODEL.id,
  startRequest: () => ({ url: "/api/start/liquid", body: {} }),
  requiresSecret: false,
  secret: () => undefined,
  url: () => {
    const url = new URL(
      import.meta.env.VITE_LFM_REALTIME_URL ||
        "ws://127.0.0.1:8080/v1/realtime",
    );
    if (!["ws:", "wss:"].includes(url.protocol)) {
      throw new Error("VITE_LFM_REALTIME_URL must use ws:// or wss://");
    }
    return url.toString();
  },
  protocols: () => [],
  inputSampleRate: 16000,
  clientTurnDetection: true,
  streamsText: true,
  waitForSessionUpdated: true,
  // llama.cpp has no server VAD. response.create closes the streamed audio
  // turn. Its realtime endpoint currently accepts input_text and audio only.
  session: ({ instructions, tools }) => ({
    type: "realtime",
    instructions: `${instructions}\n\nRespond with function calls, and interleaved text and audio.`,
    tools,
    max_output_tokens: 1024,
    output_modalities: ["text", "audio"],
    audio: { input: { format: { type: "audio/pcm", rate: 16000 } } },
  }),
};

export function useLiquidVoiceSession(
  options: RealtimeSessionOptions,
): UseRealtimeSessionReturn {
  return useRealtimeWebSocketSession(options, liquidDialect);
}
