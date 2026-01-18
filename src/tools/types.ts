import type { StartApiResponse } from "../../server/types";
import type { BackendType } from "./backendTypes";

/**
 * App interface provided to plugins via context.app
 * Contains backend functions and config accessors
 */
export interface ToolContextApp extends Record<
  string,
  (...args: any[]) => any
> {
  // Config accessors
  getConfig: <T = unknown>(key: string) => T | undefined;
  setConfig: (key: string, value: unknown) => void;
}

export interface ToolContext {
  currentResult?: ToolResult<unknown> | null;
  app?: ToolContextApp;
}

export interface ToolResult<T = unknown, J = unknown> {
  toolName?: string; // name of the tool that generated this result
  uuid?: string; // unique identifier for this result
  message: string; // status message sent back to the LLM about the tool execution result
  title?: string;
  jsonData?: J; // data to be passed to the LLM
  instructions?: string; // follow-up instructions for the LLM
  instructionsRequired?: boolean; // if true, instructions will be sent even if suppressInstructions is enabled
  updating?: boolean; // if true, updates existing result instead of creating new one
  cancelled?: boolean; // if true, operation was cancelled by user and should not be added to UI

  data?: T; // tool specific data
  viewState?: Record<string, unknown>; // tool specific view state
}

export interface ToolResultComplete<
  T = unknown,
  J = unknown,
> extends ToolResult<T, J> {
  toolName: string;
  uuid: string;
}

export interface FileUploadConfig {
  acceptedTypes: string[]; // MIME types like "image/png", "application/pdf"
  handleUpload: (
    fileData: string,
    fileName: string,
    ...args: unknown[]
  ) => ToolResult<unknown, unknown>;
}

// Vue component types are complex generics - use any for simplicity
type VueComponent = any;

export interface ToolPluginConfig {
  key: string; // Storage key for this config (will be prefixed with "plugin_config_")
  defaultValue: unknown; // Default value for this configuration
  component: VueComponent; // Vue component for configuration UI (Props: { value: unknown }, Emits: { 'update:value': [newValue: unknown] })
}

export interface ToolSample {
  name: string; // Display name for the sample
  args: Record<string, unknown>; // Sample arguments to pass to execute
}

// JSON Schema property definition - using recursive type with index signature for flexibility
export interface JsonSchemaProperty {
  type?: string;
  description?: string;
  enum?: string[];
  items?: JsonSchemaProperty;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
  oneOf?: JsonSchemaProperty[];
  [key: string]: unknown; // Allow additional JSON Schema properties
}

export interface ToolPlugin<
  T = unknown,
  J = unknown,
  A extends object = object,
> {
  toolDefinition: {
    type: "function";
    name: string;
    description: string;
    parameters?: {
      type: "object";
      properties: Record<string, JsonSchemaProperty>;
      required: string[];
      additionalProperties?: boolean;
    };
  };
  execute: (context: ToolContext, args: A) => Promise<ToolResult<T, J>>;
  generatingMessage: string;
  waitingMessage?: string;
  uploadMessage?: string;
  isEnabled: (startResponse?: StartApiResponse | null) => boolean;
  delayAfterExecution?: number;
  viewComponent?: VueComponent; // Vue component for rendering results
  previewComponent?: VueComponent; // Vue component for sidebar preview
  fileUpload?: FileUploadConfig; // Optional file upload configuration
  systemPrompt?: string; // Optional tool-specific system prompt statement
  config?: ToolPluginConfig; // Optional plugin-specific configuration
  samples?: ToolSample[]; // Optional sample arguments for testing
  backends?: BackendType[]; // Backend types this plugin uses (e.g., ["textLLM", "imageGen"])
}
