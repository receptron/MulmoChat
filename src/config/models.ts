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
