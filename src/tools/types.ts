import type { StartApiResponse } from "../../server/types";
import type { BackendType } from "./backendTypes";

// ============================================================================
// Core Types (Framework-agnostic)
// ============================================================================

/**
 * App interface provided to plugins via context.app
 * Contains backend functions and config accessors
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ToolContextApp extends Record<
  string,
  (...args: any[]) => any
> {
  getConfig: <T = unknown>(key: string) => T | undefined;
  setConfig: (key: string, value: unknown) => void;
}

/**
 * Context passed to plugin execute function
 */
export interface ToolContext {
  currentResult?: ToolResult<unknown> | null;
  app?: ToolContextApp;
}

/**
 * Result returned from plugin execution
 */
export interface ToolResult<T = unknown, J = unknown> {
  toolName?: string; // name of the tool that generated this result
  uuid?: string;
  message: string; // status message sent back to the LLM about the tool execution result
  title?: string;
  jsonData?: J; // data to be passed to the LLM
  instructions?: string; // follow-up instructions for the LLM
  instructionsRequired?: boolean; // if true, instructions will be sent even if suppressInstructions is enabled
  updating?: boolean; // if true, updates existing result instead of creating new one
  cancelled?: boolean; // if true, operation was cancelled by the user and should not be added to UI
  data?: T; // tool specific data (for views, not visible to the LLM)
  viewState?: Record<string, unknown>; // tool specific view state
}

/**
 * Complete tool result with required fields
 */
export interface ToolResultComplete<
  T = unknown,
  J = unknown,
> extends ToolResult<T, J> {
  toolName: string;
  uuid: string;
}

/**
 * JSON Schema property definition
 */
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
  [key: string]: unknown;
}

/**
 * Tool definition for OpenAI-compatible function calling
 */
export interface ToolDefinition {
  type: "function";
  name: string;
  description: string;
  parameters?: {
    type: "object";
    properties: Record<string, JsonSchemaProperty>;
    required: string[];
    additionalProperties?: boolean;
  };
}

/**
 * Sample arguments for testing
 */
export interface ToolSample {
  name: string;
  args: Record<string, unknown>;
}

// ============================================================================
// Input Handlers (Framework-agnostic)
// ============================================================================

/**
 * File input handler
 */
export interface FileInputHandler {
  type: "file";
  acceptedTypes: string[];
  handleInput: (
    fileData: string,
    fileName: string,
  ) => ToolResult<unknown, unknown>;
}

/**
 * Clipboard image input handler
 */
export interface ClipboardImageInputHandler {
  type: "clipboard-image";
  handleInput: (imageData: string) => ToolResult<unknown, unknown>;
}

/**
 * URL input handler
 */
export interface UrlInputHandler {
  type: "url";
  patterns?: string[];
  handleInput: (url: string) => ToolResult<unknown, unknown>;
}

/**
 * Text input handler
 */
export interface TextInputHandler {
  type: "text";
  patterns?: string[];
  handleInput: (text: string) => ToolResult<unknown, unknown>;
}

/**
 * Camera capture input handler
 */
export interface CameraInputHandler {
  type: "camera";
  mode: "photo" | "video";
  handleInput: (
    data: string,
    metadata?: { duration?: number },
  ) => ToolResult<unknown, unknown>;
}

/**
 * Audio input handler
 */
export interface AudioInputHandler {
  type: "audio";
  handleInput: (
    audioData: string,
    duration: number,
  ) => ToolResult<unknown, unknown>;
}

/**
 * Union of all input handler types
 */
export type InputHandler =
  | FileInputHandler
  | ClipboardImageInputHandler
  | UrlInputHandler
  | TextInputHandler
  | CameraInputHandler
  | AudioInputHandler;

/**
 * Legacy file upload config (for backward compatibility)
 * @deprecated Use InputHandler instead
 */
export interface FileUploadConfig {
  acceptedTypes: string[];
  handleUpload: (
    fileData: string,
    fileName: string,
    ...args: unknown[]
  ) => ToolResult<unknown, unknown>;
}

// ============================================================================
// Plugin Config Schema (JSON Schema based, Framework-agnostic)
// ============================================================================

export type ConfigValue = string | number | boolean | string[];

interface BaseFieldSchema {
  label: string;
  description?: string;
  required?: boolean;
}

export interface StringFieldSchema extends BaseFieldSchema {
  type: "string";
  placeholder?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface NumberFieldSchema extends BaseFieldSchema {
  type: "number";
  min?: number;
  max?: number;
  step?: number;
}

export interface BooleanFieldSchema extends BaseFieldSchema {
  type: "boolean";
}

export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface SelectFieldSchema extends BaseFieldSchema {
  type: "select";
  options: SelectOption[];
}

export interface MultiSelectFieldSchema extends BaseFieldSchema {
  type: "multiselect";
  options: SelectOption[];
  minItems?: number;
  maxItems?: number;
}

export type ConfigFieldSchema =
  | StringFieldSchema
  | NumberFieldSchema
  | BooleanFieldSchema
  | SelectFieldSchema
  | MultiSelectFieldSchema;

/**
 * Plugin configuration schema (JSON Schema based)
 */
export interface PluginConfigSchema {
  key: string;
  defaultValue: ConfigValue;
  schema: ConfigFieldSchema;
}

// ============================================================================
// View Component Props (Framework-agnostic interface definitions)
// ============================================================================

/**
 * Standard props for View components
 */
export interface ViewComponentProps<T = unknown, J = unknown> {
  selectedResult: ToolResultComplete<T, J>;
  sendTextMessage: (text?: string) => void;
  onUpdateResult?: (result: Partial<ToolResult<T, J>>) => void;
  pluginConfigs?: Record<string, unknown>;
}

/**
 * Standard props for Preview components
 */
export interface PreviewComponentProps<T = unknown, J = unknown> {
  result: ToolResultComplete<T, J>;
  isSelected?: boolean;
  onSelect?: () => void;
}

// ============================================================================
// Core Plugin Interface (Framework-agnostic)
// ============================================================================

/**
 * Core plugin interface - framework agnostic
 * Does not include UI components
 */
export interface ToolPluginCore<
  T = unknown,
  J = unknown,
  A extends object = object,
> {
  toolDefinition: ToolDefinition;
  execute: (context: ToolContext, args: A) => Promise<ToolResult<T, J>>;
  generatingMessage: string;
  waitingMessage?: string;
  uploadMessage?: string;
  isEnabled: (startResponse?: StartApiResponse | null) => boolean;
  delayAfterExecution?: number;
  systemPrompt?: string;
  inputHandlers?: InputHandler[];
  /** @deprecated Use inputHandlers instead */
  fileUpload?: FileUploadConfig;
  /** New JSON Schema based config (framework-agnostic) */
  configSchema?: PluginConfigSchema;
  samples?: ToolSample[];
  backends?: BackendType[];
}

// ============================================================================
// Vue-specific Types
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type VueComponent = any;

/**
 * Legacy Vue component-based config
 * @deprecated Use PluginConfigSchema instead
 */
export interface ToolPluginConfig {
  key: string;
  defaultValue: unknown;
  component: VueComponent;
}

/**
 * Vue plugin interface - extends core with Vue components
 */
export interface ToolPlugin<
  T = unknown,
  J = unknown,
  A extends object = object,
> extends ToolPluginCore<T, J, A> {
  viewComponent?: VueComponent;
  previewComponent?: VueComponent;
  /**
   * Legacy Vue component-based config (for backward compatibility)
   * @deprecated Use configSchema (PluginConfigSchema) instead
   */
  config?: ToolPluginConfig;
}
