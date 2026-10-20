// Grok voice (xAI's Voice Agent API): the Realtime events over a WebSocket
// (useRealtimeWebSocketSession) with xAI's URL, secret and audio format. The
// server mints a short-lived client secret (`/api/start?voice=grok`), so
// XAI_API_KEY never reaches the browser.

import {
  type RealtimeSessionOptions,
  type UseRealtimeSessionReturn,
} from "./useRealtimeSession";
import {
  OUTPUT_SAMPLE_RATE,
  useRealtimeWebSocketSession,
  type RealtimeDialect,
} from "./useRealtimeWebSocketSession";
import { DEFAULT_GROK_VOICE_MODEL_ID } from "../config/models";

const GROK_REALTIME_URL = "wss://api.x.ai/v1/realtime";
const INPUT_SAMPLE_RATE = 16000;

const grokDialect: RealtimeDialect = {
  name: "Grok voice",
  voiceProvider: "xai",
  defaultModelId: DEFAULT_GROK_VOICE_MODEL_ID,
  startRequest: () => ({ url: "/api/start?voice=grok" }),
  secret: (start) => start.grokClientSecret,
  url: (modelId) => `${GROK_REALTIME_URL}?model=${encodeURIComponent(modelId)}`,
  // xAI takes the client secret as a subprotocol.
  protocols: (secret) => [`xai-client-secret.${secret}`],
  inputSampleRate: INPUT_SAMPLE_RATE,
  session: ({ instructions, tools, voice }) => ({
    voice,
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
  }),
};

export function useGrokVoiceSession(
  options: RealtimeSessionOptions,
): UseRealtimeSessionReturn {
  return useRealtimeWebSocketSession(options, grokDialect);
}
