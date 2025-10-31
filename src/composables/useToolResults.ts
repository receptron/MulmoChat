/* eslint-disable no-console */

import { ref, type Ref } from "vue";
import type { ToolContext, ToolResult } from "../tools";
import type { UserPreferencesState } from "./useUserPreferences";
import { SESSION_CONFIG } from "../config/session";
import { generateUUID } from "../utils/uuid";

type ToolExecuteFn = typeof import("../tools").toolExecute;
type GetToolPluginFn = typeof import("../tools").getToolPlugin;

interface UseToolResultsOptions {
  toolExecute: ToolExecuteFn;
  getToolPlugin: GetToolPluginFn;
  suppressInstructions: Ref<boolean>;
  userPreferences: Ref<UserPreferencesState>;
  getPluginConfig: <T = any>(key: string) => T | undefined;
  sleep: (milliseconds: number) => Promise<void>;
  sendInstructions: (instructions: string) => boolean;
  sendFunctionCallOutput: (callId: string, output: string) => boolean;
  conversationActive: Ref<boolean>;
  isDataChannelOpen: () => boolean;
  scrollToBottomOfSideBar: () => void;
  scrollCurrentResultToTop: () => void;
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
    updateSelectedResult(result);
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
      };

      // Note: waitingMessage is only sent for realtime sessions
      // For text sessions, it would cause an error because we need to send
      // tool output before any new LLM generation can happen
      if (plugin?.waitingMessage && options.isDataChannelOpen()) {
        options.sendInstructions(plugin.waitingMessage);
      }

      const result = await options.toolExecute(context, msg.name, args);
      console.log("TOOL RESULT", result);

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

      const outputPayload = {
        status: result.message,
        data: result.jsonData,
      };
      console.log(`RES:${result.toolName}\n`, outputPayload);
      sendFunctionOutput(msg.call_id, outputPayload);
      await maybeSendInstructions(result.toolName, plugin, result);
    } catch (e) {
      const errorMessage = `Failed to parse function call arguments: ${e}`;
      console.error(`MSG: ${errorMessage}`);
      sendFunctionOutput(msg.call_id, errorMessage);

      // Instruct the LLM to retry with corrected JSON
      const retryInstruction = `The previous tool call for "${msg.name}" failed due to invalid JSON arguments. Please analyze the error and retry the tool call with properly formatted JSON arguments. Error details: ${e}`;
      console.log(`INS:retry-after-parse-error\n${retryInstruction}`);
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
      toolResults.value[index] = updatedResult;
    }
    if (selectedResult.value?.uuid === updatedResult.uuid) {
      updateSelectedResult(updatedResult);
    }
  };

  const handleUploadFiles = async (results: ToolResult[]) => {
    for (const result of results) {
      const completeResult: ToolResult = {
        ...result,
        uuid: result.uuid ?? generateUUID(),
      };

      toolResults.value.push(completeResult);
      updateSelectedResult(completeResult);

      const plugin = options.getToolPlugin(result.toolName);
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
