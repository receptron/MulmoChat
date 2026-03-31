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

  // Override instructions for plugins that provide too-brief follow-up prompts
  const INSTRUCTION_OVERRIDES: Record<string, string> = {
    browse:
      "The webpage has been successfully browsed and the content is now available. You MUST now provide a THOROUGH and DETAILED explanation of the content. Do NOT give a brief or one-sentence summary. Cover ALL key points, arguments, specific details, examples, and important information comprehensively. Do NOT skip or simplify any part. IMPORTANT: Always clearly state the source — mention the website name, article title, and URL so the user knows exactly where the information comes from.",
    searchWeb:
      "The web search was successful. Now provide a DETAILED explanation of the search results. For each relevant result, clearly cite the source (website name, article title, and URL), then summarize the key information from the article text. Do NOT just list links or titles — explain what the articles say and highlight the most important findings. Always make it clear which information comes from which source.",
  };

  const maybeSendInstructions = async (
    pluginName: string,
    plugin: ReturnType<GetToolPluginFn> | undefined,
    result: ToolResult,
  ) => {
    if (!shouldSendInstructions(result)) {
      return;
    }

    const instructions =
      INSTRUCTION_OVERRIDES[result.toolName ?? ""] || result.instructions;
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
      // Skip waitingMessage for YouTube URLs (browse should be silent)
      const isYouTubeBrowse =
        msg.name === "browse" &&
        typeof args?.url === "string" &&
        /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)/.test(args.url);
      if (
        plugin?.waitingMessage &&
        options.isDataChannelOpen() &&
        !isYouTubeBrowse
      ) {
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

        // Auto-display article HTML when browse returns htmlContent
        if (result.toolName === "browse") {
          const browseData = (
            result.jsonData as {
              data?: { htmlContent?: string; title?: string; url?: string };
            }
          )?.data;
          if (browseData?.htmlContent) {
            const styledHtml = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${browseData.title || "Article"}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.8; color: #333; max-width: 800px; margin: 0 auto; padding: 1rem 2rem; }
img { max-width: 100%; height: auto; border-radius: 8px; margin: 1em 0; }
a { color: #2563eb; }
h1, h2, h3 { margin-top: 1.5em; }
figure { margin: 1em 0; }
figcaption { font-size: 0.85em; color: #666; text-align: center; }
blockquote { border-left: 4px solid #ddd; padding-left: 1em; color: #555; }
.source-link { background: #f0f7ff; border: 1px solid #bdd5f5; border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1.5rem; font-size: 0.9em; }
.source-link a { word-break: break-all; }
</style></head><body>
<div class="source-link">Source: <a href="${browseData.url || ""}" target="_blank">${browseData.url || ""}</a></div>
<h1>${browseData.title || ""}</h1>
${browseData.htmlContent}
</body></html>`;

            const htmlResult: ToolResult = {
              message: `Article: ${browseData.title || "Web Page"}`,
              title: browseData.title || "Web Page",
              data: { html: styledHtml, type: "tailwind" },
              toolName: "renderHtml",
              uuid: uuidv4(),
            };
            addNewResult(htmlResult);
          }
        }
      }

      // Strip htmlContent from LLM payload to save tokens (it's already displayed)
      let jsonDataForLLM = result.jsonData;
      if (result.toolName === "browse" && jsonDataForLLM) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { htmlContent, ...rest } =
          (jsonDataForLLM as { data?: Record<string, unknown> }).data || {};
        jsonDataForLLM = { data: rest };
      }
      const outputPayload = {
        status: result.message,
        data: jsonDataForLLM,
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
