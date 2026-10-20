import type { SessionTransportKind } from "../composables/useSessionTransport";
import type { VoiceProvider } from "../../server/utils/voices";

import {
  DEFAULT_ELEVENLABS_VOICE_MODEL_ID,
  ELEVENLABS_VOICE_MODELS,
} from "../../server/utils/elevenLabsRealtime";

// Defined with the server's mint, which accepts only these.
export { DEFAULT_ELEVENLABS_VOICE_MODEL_ID, ELEVENLABS_VOICE_MODELS };

export interface RealtimeModelOption {
  id: string;
  label: string;
  description?: string;
}

export const REALTIME_MODELS: RealtimeModelOption[] = [
  {
    id: "gpt-realtime-2.1",
    label: "GPT Realtime 2.1",
    description: "Realtime voice model with reasoning",
  },
  {
    id: "gpt-realtime-2.1-mini",
    label: "GPT Realtime 2.1 Mini",
    description: "Faster, lower-cost distilled version of GPT Realtime 2.1",
  },
];

export const DEFAULT_REALTIME_MODEL_ID = REALTIME_MODELS[0].id;

export interface GoogleLiveModelOption {
  id: string;
  label: string;
  description?: string;
  // Sent as generationConfig.thinkingConfig.thinkingLevel; required by thinking models
  thinkingLevel?: "low" | "high";
}

export const GOOGLE_LIVE_MODELS: GoogleLiveModelOption[] = [
  {
    id: "gemini-3.8-live",
    label: "Gemini 3.8 Live",
    description: "Low-latency native audio model with function calling",
  },
  {
    id: "gemini-3.8-live-extended-thinking",
    label: "Gemini 3.8 Live Extended Thinking",
    description: "Deeper reasoning for complex requests, with higher latency",
    thinkingLevel: "high",
  },
];

export const DEFAULT_GOOGLE_LIVE_MODEL_ID = GOOGLE_LIVE_MODELS[0].id;

export interface GrokVoiceModelOption {
  id: string;
  label: string;
  description?: string;
}

export const GROK_VOICE_MODELS: GrokVoiceModelOption[] = [
  {
    id: "grok-voice-3.0",
    label: "Grok Voice 3.0",
    description: "xAI's speech-to-speech model with reasoning and tool use",
  },
  {
    id: "grok-voice-think-fast-2.0",
    label: "Grok Voice Think Fast 2.0",
    description: "xAI's speech-to-speech model with reasoning and tool use",
  },
];

export const DEFAULT_GROK_VOICE_MODEL_ID = GROK_VOICE_MODELS[0].id;

export interface VoiceModelChoice {
  models: readonly RealtimeModelOption[];
  defaultId: string;
  /** In the status line when the saved model is not in the list. */
  fallbackLabel: string;
}

// The models a voice transport offers; null for text, whose models are in
// textModels.ts.
export const VOICE_MODELS_FOR_KIND: Record<
  SessionTransportKind,
  VoiceModelChoice | null
> = {
  "voice-realtime": {
    models: REALTIME_MODELS,
    defaultId: DEFAULT_REALTIME_MODEL_ID,
    fallbackLabel: "GPT Realtime",
  },
  "voice-google-live": {
    models: GOOGLE_LIVE_MODELS,
    defaultId: DEFAULT_GOOGLE_LIVE_MODEL_ID,
    fallbackLabel: "Gemini Live",
  },
  "voice-grok": {
    models: GROK_VOICE_MODELS,
    defaultId: DEFAULT_GROK_VOICE_MODEL_ID,
    fallbackLabel: "Grok Voice",
  },
  "voice-elevenlabs": {
    models: ELEVENLABS_VOICE_MODELS,
    defaultId: DEFAULT_ELEVENLABS_VOICE_MODEL_ID,
    fallbackLabel: "Eleven Realtime",
  },
  "text-rest": null,
};

/** `modelId` when the transport offers it, else its default; null for text. */
export const resolveVoiceModelId = (
  kind: SessionTransportKind,
  modelId: string | null,
): string | null => {
  const choice = VOICE_MODELS_FOR_KIND[kind];
  if (!choice) return null;
  return choice.models.some((m) => m.id === modelId)
    ? (modelId as string)
    : choice.defaultId;
};

// Which provider's voices a transport speaks with; null for one that doesn't speak.
export const VOICE_PROVIDER_FOR_KIND: Record<
  SessionTransportKind,
  VoiceProvider | null
> = {
  "voice-realtime": "openai",
  "voice-google-live": "google",
  "voice-grok": "xai",
  "voice-elevenlabs": "elevenlabs",
  "text-rest": null,
};
