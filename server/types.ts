export interface StartApiResponse {
  success: boolean;
  message: string;
  ephemeralKey: string;
  googleMapKey: string | undefined;
  hasExaApiKey: boolean;
  hasAnthropicApiKey: boolean;
  googleApiKey: string | undefined;
  hasGoogleApiKey: boolean;
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
