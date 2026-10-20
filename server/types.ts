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
