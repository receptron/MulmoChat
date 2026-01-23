import { ref, type Ref } from "vue";
import type {
  ToolContext,
  ToolResult,
  ToolContextApp,
} from "gui-chat-protocol/vue";
import type { UserPreferencesState } from "./useUserPreferences";
import { v4 as uuidv4 } from "uuid";

import {
  editImage as backendEditImage,
  generateImage as backendGenerateImage,
  generateImageWithBackend,
  normalizeImageConfig,
  browseUrl,
  getTwitterEmbed,
  searchExa,
  generateHtml as backendGenerateHtml,
  normalizeHtmlConfig,
  summarizePdf,
  saveImages,
} from "../tools/backend";
import type { HtmlGenerationParams } from "../tools/backend";
import type { ImageToolData } from "../tools/utils/imageTypes";
import type { ToolExecuteFn, GetToolPluginFn } from "../tools/types";
import { ROLES } from "../config/roles";

// Plugins that are allowed to use setConfig
const PLUGINS_WITH_SET_CONFIG = ["setImageStyle"];

interface UseToolResultsOptions {
  toolExecute: ToolExecuteFn;
  getToolPlugin: GetToolPluginFn;
  suppressInstructions: Ref<boolean>;
  userPreferences: Ref<UserPreferencesState>;
  sleep: (milliseconds: number) => Promise<void>;
  sendInstructions: (instructions: string) => boolean | Promise<boolean>;
  sendFunctionCallOutput: (callId: string, output: string) => boolean;
  conversationActive: Ref<boolean>;
  isDataChannelOpen: () => boolean;
  scrollToBottomOfSideBar: () => void;
  scrollCurrentResultToTop: () => void;
  onToolCallError?: (toolName: string, error: string) => void;
  switchRole?: (roleId: string) => void;
}

interface ToolCallMessage {
  name: string;
  call_id?: string;
  [key: string]: unknown;
}

interface HandleToolCallArgs {
  msg: ToolCallMessage;
  rawArgs: unknown;
}

export interface UseToolResultsReturn {
  toolResults: Ref<ToolResult[]>;
  selectedResult: Ref<ToolResult | null>;
  isGeneratingImage: Ref<boolean>;
  generatingMessage: Ref<string>;
  handleToolCall: (args: HandleToolCallArgs) => Promise<void>;
  handleSelectResult: (result: ToolResult) => void;
  handleUpdateResult: (updatedResult: ToolResult) => void;
  handleUploadFiles: (results: ToolResult[]) => Promise<void>;
}

export function useToolResults(
  options: UseToolResultsOptions,
): UseToolResultsReturn {
  const toolResults = ref<ToolResult[]>([]);
  const selectedResult = ref<ToolResult | null>(null);
  const isGeneratingImage = ref(false);
  const generatingMessage = ref("");

  const updateSelectedResult = (result: ToolResult | null) => {
    selectedResult.value = result;
    if (result) {
      options.scrollCurrentResultToTop();
    }
  };

  const sendFunctionOutput = (callId: string | undefined, payload: unknown) => {
    if (!callId) return;
    options.sendFunctionCallOutput(callId, JSON.stringify(payload));
  };

  const updateExistingResult = (
    result: ToolResult,
    previousResult: ToolResult,
  ) => {
    const index = toolResults.value.findIndex(
      (r) => r.uuid === previousResult.uuid,
    );
    if (index !== -1) {
      toolResults.value[index] = result;
    } else {
      console.error("ERR:Failed to find the result to update");
    }
    updateSelectedResult(result);
  };

  const addNewResult = (result: ToolResult) => {
    toolResults.value.push(result);
    // Don't auto-select text-response results - they're conversational, not actionable
    if (result.toolName !== "text-response") {
      updateSelectedResult(result);
    }
    options.scrollToBottomOfSideBar();
  };

  const shouldSendInstructions = (result: ToolResult) => {
    return (
      Boolean(result.instructions) &&
      (!options.suppressInstructions.value || result.instructionsRequired)
    );
  };

  const maybeSendInstructions = async (
    pluginName: string,
    plugin: ReturnType<GetToolPluginFn> | undefined,
    result: ToolResult,
  ) => {
    if (!shouldSendInstructions(result)) {
      return;
    }

    const instructions = result.instructions;
    if (!instructions) {
      return;
    }

    const delay = plugin?.delayAfterExecution;
    if (delay) {
      await options.sleep(delay);
    }
    console.log(`INS:${pluginName}\n${instructions}`);
    options.sendInstructions(instructions);
  };

  const handleToolCall = async ({ msg, rawArgs }: HandleToolCallArgs) => {
    try {
      const args = typeof rawArgs === "string" ? JSON.parse(rawArgs) : rawArgs;
      isGeneratingImage.value = true;
      generatingMessage.value =
        options.getToolPlugin(msg.name)?.generatingMessage || "Processing...";
      options.scrollToBottomOfSideBar();
      const plugin = options.getToolPlugin(msg.name);

      // Config accessor functions
      const getConfig = <T = unknown>(key: string): T | undefined => {
        return options.userPreferences.value?.pluginConfigs?.[key] as
          | T
          | undefined;
      };

      const setConfig = (key: string, value: unknown): void => {
        if (options.userPreferences.value?.pluginConfigs) {
          options.userPreferences.value.pluginConfigs[key] = value;
        }
      };

      // Resolve image config from user preferences
      const imageConfig = normalizeImageConfig(
        getConfig("imageGenerationBackend"),
      );
      const comfyuiModel =
        options.userPreferences.value?.comfyuiModel ||
        "flux1-schnell-fp8.safetensors";

      // Create wrapped functions with config already bound
      const currentImageData = (
        selectedResult.value?.data as ImageToolData | undefined
      )?.imageData;
      const imageGenerationContext = {
        currentImageData,
        options: { config: imageConfig, comfyuiModel },
      };

      // Resolve HTML config from user preferences
      const htmlBackend = normalizeHtmlConfig(
        getConfig("htmlGenerationBackend"),
      );

      // Build app object with getConfig always available
      // setConfig only works for authorized plugins
      const app: ToolContextApp = {
        // Config accessors
        getConfig,
        setConfig: PLUGINS_WITH_SET_CONFIG.includes(msg.name)
          ? setConfig
          : () => {
              console.warn(
                `Plugin "${msg.name}" is not authorized to use setConfig`,
              );
            },

        // Wrapped image functions with config bound
        editImage: (prompt: string) =>
          backendEditImage(imageGenerationContext, prompt),
        generateImage: (prompt: string) =>
          backendGenerateImage(imageGenerationContext, prompt),
        generateImageWithBackend: (prompt: string, images: string[]) =>
          generateImageWithBackend(prompt, images, {
            config: imageConfig,
            comfyuiModel,
          }),
        // Wrapped HTML function with backend resolved
        generateHtml: (params: Omit<HtmlGenerationParams, "backend">) =>
          backendGenerateHtml({ ...params, backend: htmlBackend }),
        // Other backend functions (no config needed)
        browseUrl,
        getTwitterEmbed,
        searchExa,
        summarizePdf,
        saveImages,
        // Config accessors for plugins that need to read/modify config
        getImageConfig: () => imageConfig,

        // Role management for switchRole plugin
        getRoles: () => ROLES.map((r) => ({ id: r.id, name: r.name })),
        switchRole: options.switchRole ?? (() => {}),
      };

      const context: ToolContext = {
        currentResult: selectedResult.value ?? undefined,
        app,
      };

      // Note: waitingMessage is only sent for realtime sessions
      // For text sessions, it would cause an error because we need to send
      // tool output before any new LLM generation can happen
      if (plugin?.waitingMessage && options.isDataChannelOpen()) {
        options.sendInstructions(plugin.waitingMessage);
      }

      const result = await options.toolExecute(context, msg.name, args);
      console.log("TOOL RESULT", result);

      // Check if the operation was cancelled by the user
      if (!result.cancelled) {
        const previousResult = context.currentResult;
        if (
          previousResult &&
          result.updating &&
          result.toolName === previousResult.toolName
        ) {
          updateExistingResult(result, previousResult);
        } else {
          addNewResult(result);
        }
      }

      const outputPayload = {
        status: result.message,
        data: result.jsonData,
      };
      console.log(`RES:${result.toolName}\n`, outputPayload);
      sendFunctionOutput(msg.call_id, outputPayload);
      await maybeSendInstructions(result.toolName, plugin, result);
    } catch (e) {
      const errorMessage = `Tool execution failed: ${e}`;
      console.error(`MSG: ${errorMessage}`);
      sendFunctionOutput(msg.call_id, errorMessage);

      // Report error to debug panel if callback is provided
      if (options.onToolCallError) {
        options.onToolCallError(msg.name, errorMessage);
      }

      // Instruct the LLM about the error
      const retryInstruction = `The previous tool call for "${msg.name}" failed with error: ${e}. Please analyze the error and try an appropriate solution.`;
      console.log(`INS:tool-error\n${retryInstruction}`);
      options.sendInstructions(retryInstruction);
    } finally {
      isGeneratingImage.value = false;
      generatingMessage.value = "";
    }
  };

  const handleSelectResult = (result: ToolResult) => {
    updateSelectedResult(result);
  };

  const handleUpdateResult = (updatedResult: ToolResult) => {
    const index = toolResults.value.findIndex(
      (r) => r.uuid === updatedResult.uuid,
    );
    if (index !== -1) {
      // Update properties instead of replacing to maintain object reference
      Object.assign(toolResults.value[index], updatedResult);
    }
    if (selectedResult.value?.uuid === updatedResult.uuid) {
      // Update properties of selectedResult instead of replacing it
      Object.assign(selectedResult.value!, updatedResult);
      options.scrollCurrentResultToTop();
    }
  };

  const handleUploadFiles = async (results: ToolResult[]) => {
    for (const result of results) {
      const completeResult: ToolResult = {
        ...result,
        uuid: result.uuid ?? uuidv4(),
      };

      toolResults.value.push(completeResult);
      updateSelectedResult(completeResult);
    }

    options.scrollToBottomOfSideBar();
  };

  return {
    toolResults,
    selectedResult,
    isGeneratingImage,
    generatingMessage,
    handleToolCall,
    handleSelectResult,
    handleUpdateResult,
    handleUploadFiles,
  };
}
