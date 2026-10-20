// ElevenLabs Realtime: the Realtime events over a WebSocket
// (useRealtimeWebSocketSession) with ElevenLabs' URL and secret. The server
// mints the secret (`POST /api/start/elevenlabs`) with the model, voice and audio
// fixed in it, so ELEVENLABS_API_KEY never reaches the browser and the
// session.update here carries only what the role decides.

import {
  type RealtimeSessionOptions,
  type UseRealtimeSessionReturn,
} from "./useRealtimeSession";
import {
  useRealtimeWebSocketSession,
  type RealtimeDialect,
} from "./useRealtimeWebSocketSession";
import { DEFAULT_ELEVENLABS_VOICE_MODEL_ID } from "../config/models";
import { ELEVENLABS_SAMPLE_RATE } from "../../server/utils/elevenLabsRealtime";

const elevenLabsDialect: RealtimeDialect = {
  name: "ElevenLabs voice",
  voiceProvider: "elevenlabs",
  defaultModelId: DEFAULT_ELEVENLABS_VOICE_MODEL_ID,
  // A JSON POST, so another site can't make the server mint one (a GET can be
  // sent cross-site by an <img>; see requireTrustedOrigin).
  startRequest: ({ modelId, voice }) => ({
    url: "/api/start/elevenlabs",
    body: { model: modelId, voice },
  }),
  secret: (start) => start.elevenLabsClientSecret,
  // The model is the one in the secret; the URL names none.
  url: () => "wss://api.elevenlabs.io/v1/convai/realtime",
  // OpenAI's subprotocols, which ElevenLabs accepts as they are.
  protocols: (secret) => ["realtime", `openai-insecure-api-key.${secret}`],
  inputSampleRate: ELEVENLABS_SAMPLE_RATE,
  // No turn_detection: ElevenLabs refuses server_vad, and the secret's
  // semantic_vad stays when session.update leaves it out.
  session: ({ instructions, tools }) => ({
    type: "realtime",
    instructions,
    tools,
  }),
};

export function useElevenLabsVoiceSession(
  options: RealtimeSessionOptions,
): UseRealtimeSessionReturn {
  return useRealtimeWebSocketSession(options, elevenLabsDialect);
}
