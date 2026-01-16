import { ref, type Ref } from "vue";
import type { ToolContext, ToolResult } from "../tools";
import type { UserPreferencesState } from "./useUserPreferences";
import { SESSION_CONFIG } from "../config/session";
import { v4 as uuidv4 } from "uuid";

import {
  editImage,
  generateImage,
  generateImageWithBackend,
  browseUrl,
  getTwitterEmbed,
  searchExa,
  generateHtml,
  summarizePdf,
  saveImages,
} from "../tools/backend";

type ToolExecuteFn = typeof import("../tools").toolExecute;
type GetToolPluginFn = typeof import("../tools").getToolPlugin;

interface UseToolResultsOptions {
  toolExecute: ToolExecuteFn;
  getToolPlugin: GetToolPluginFn;
  suppressInstructions: Ref<boolean>;
  userPreferences: Ref<UserPreferencesState>;
  getPluginConfig: <T = unknown>(key: string) => T | undefined;
  sleep: (milliseconds: number) => Promise<void>;
  sendInstructions: (instructions: string) => boolean | Promise<boolean>;
  sendFunctionCallOutput: (callId: string, output: string) => boolean;
  conversationActive: Ref<boolean>;
  isDataChannelOpen: () => boolean;
  scrollToBottomOfSideBar: () => void;
  scrollCurrentResultToTop: () => void;
  onToolCallError?: (toolName: string, error: string) => void;
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
      const context: ToolContext = {
        currentResult: selectedResult.value ?? undefined,
        userPreferences: options.userPreferences.value,
        getPluginConfig: options.getPluginConfig,
        app: {
          editImage,
          generateImage,
          generateImageWithBackend,
          browseUrl,
          getTwitterEmbed,
          searchExa,
          generateHtml,
          summarizePdf,
          saveImages,
        },
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

      const plugin = options.getToolPlugin(result.toolName!);
      if (plugin?.uploadMessage && options.isDataChannelOpen()) {
        for (
          let i = 0;
          i < SESSION_CONFIG.UPLOAD_RETRY_ATTEMPTS &&
          options.conversationActive.value;
          i++
        ) {
          console.log(`WAIT:${i} \n`, plugin.uploadMessage);
          await options.sleep(SESSION_CONFIG.UPLOAD_RETRY_DELAY_MS);
        }
        console.log(`UPL:${result.toolName}\n${plugin.uploadMessage}`);
        options.sendInstructions(plugin.uploadMessage);
      }
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
