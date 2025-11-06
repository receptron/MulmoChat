export interface RealtimeModelOption {
  id: string;
  label: string;
  description?: string;
}

export const REALTIME_MODELS: RealtimeModelOption[] = [
  {
    id: "gpt-realtime",
    label: "GPT Realtime",
  },
  {
    id: "gpt-realtime-mini",
    label: "GPT Realtime Mini",
    description: "Lower-latency, lower-cost realtime model",
  },
];

export const DEFAULT_REALTIME_MODEL_ID = REALTIME_MODELS[0].id;

export interface GoogleLiveModelOption {
  id: string;
  label: string;
  description?: string;
}

export const GOOGLE_LIVE_MODELS: GoogleLiveModelOption[] = [
  {
    id: "gemini-2.5-flash-native-audio-preview-09-2025",
    label: "Gemini 2.5 Flash Native Audio (Sept 2025)",
    description: "Official Live API model with native audio and function calling",
  },
  {
    id: "gemini-2.0-flash-exp",
    label: "Gemini 2.0 Flash Experimental",
    description: "Experimental model (may not support Live API properly)",
  },
];

export const DEFAULT_GOOGLE_LIVE_MODEL_ID = GOOGLE_LIVE_MODELS[0].id;
