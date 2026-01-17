/**
 * Backend type definitions for plugin architecture
 * These types define what backend services are available and their settings
 */

// Backend types that plugins can declare they use
export type BackendType =
  | "textLLM"
  | "imageGen"
  | "audio"
  | "search"
  | "browse"
  | "map";

// Backend settings for each type (managed by app layer)
// Provider names match current codebase conventions

export interface TextLLMBackendSettings {
  provider: "claude" | "gemini";
}

export interface ImageGenBackendSettings {
  provider: "gemini" | "openai" | "comfyui";
  model?: string;
  styleModifier?: string;
}

/** Configuration value for image generation backend (stored in pluginConfigs) */
export interface ImageGenerationConfigValue {
  backend: "gemini" | "openai" | "comfyui";
  styleModifier?: string;
  geminiModel?: "gemini-2.5-flash-image" | "gemini-3-pro-image-preview";
  openaiModel?: "gpt-image-1" | "gpt-image-1.5" | "gpt-image-1-mini";
}

// Union type for all backend settings
export interface BackendSettings {
  textLLM?: TextLLMBackendSettings;
  imageGen?: ImageGenBackendSettings;
  // Other backend types can be added as needed
}
