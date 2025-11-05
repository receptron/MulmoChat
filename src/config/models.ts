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
    id: "gemini-2.0-flash-exp",
    label: "Gemini 2.0 Flash Experimental",
    description: "Google's latest experimental multimodal model",
  },
  {
    id: "models/gemini-2.0-flash-exp",
    label: "Gemini 2.0 Flash Exp (with models/ prefix)",
    description: "Alternative format with models/ prefix",
  },
];

export const DEFAULT_GOOGLE_LIVE_MODEL_ID = GOOGLE_LIVE_MODELS[0].id;
