export interface StartApiResponse {
  success: boolean;
  message: string;
  ephemeralKey: string;
  googleMapKey: string | undefined;
  hasExaApiKey: boolean;
  hasAnthropicApiKey: boolean;
  googleApiKey: string | undefined;
  hasGoogleApiKey: boolean;
  hasXaiApiKey: boolean;
  /** TYPESAFE_API_KEY is set: manageKenteiScript can grade answers (JEV). */
  hasTypesafeApiKey: boolean;
  /** xAI client secret for the Grok voice WebSocket (`/api/start?voice=grok`). */
  grokClientSecret?: string;
  /** ElevenLabs Realtime client secret (`/api/start/elevenlabs`). */
  elevenLabsClientSecret?: string;
  [key: string]: unknown;
}

/** `POST /api/start/live/session`: what the browser sends to start a
 *  gpt-live-1 session, and what it gets back. */
export interface LiveSessionRequest {
  /** The browser's WebRTC offer. */
  sdp: string;
  /** A `LIVE_VOICE_MODELS` id. */
  model?: string;
  voice?: string;
  /** For the voice model: how to talk and when to hand work to the backend. */
  instructions: string;
  /** For the backend model, which has the tools. */
  backendInstructions: string;
  tools: unknown[];
}

export interface LiveSessionResponse {
  success: true;
  sessionId: string;
  /** OpenAI's WebRTC answer. */
  sdp: string;
}

export interface TextProvidersResponse {
  success: boolean;
  providers: Array<{
    provider: string;
    hasCredentials: boolean;
    defaultModel?: string;
    models?: string[];
  }>;
}

export interface TextGenerationResponse {
  success: boolean;
  result?: {
    provider: string;
    model: string;
    text: string;
    usage?: Record<string, number>;
  };
  error?: string;
  details?: string;
}
