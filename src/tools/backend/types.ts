import type {
  GeminiImageModelId,
  OpenAIImageModelId,
} from "../../config/imageModels";
/**
 * Backend type definitions for plugin architecture
 * These types define what backend services are available and their settings
 *
 * For BackendType, import directly from "gui-chat-protocol/vue".
 */

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
  geminiModel?: GeminiImageModelId;
  openaiModel?: OpenAIImageModelId;
}

// Union type for all backend settings
export interface BackendSettings {
  textLLM?: TextLLMBackendSettings;
  imageGen?: ImageGenBackendSettings;
  // Other backend types can be added as needed
}
