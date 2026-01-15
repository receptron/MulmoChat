import { ToolPlugin, ToolContext, ToolResult } from "../types";
import HtmlView from "../views/html.vue";
import HtmlPreview from "../previews/html.vue";
import HtmlGenerationConfig from "../configs/HtmlGenerationConfig.vue";
import type { HtmlToolData } from "../utils";

const toolName = "editHtml";

export interface EditHtmlArgs {
  prompt: string;
}

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Edit the currently selected HTML page by sending a detailed modification prompt to another LLM (Claude). This tool modifies the existing HTML based on your description while preserving the existing structure and functionality where possible.",
  parameters: {
    type: "object" as const,
    properties: {
      prompt: {
        type: "string",
        description:
          "Detailed description of the modifications to make to the HTML page. Be specific about what changes are needed - layout adjustments, style updates, new functionality, content changes, etc. The more detailed your prompt, the better the modifications will match your requirements.",
      },
    },
    required: ["prompt"],
  },
};

const editHtml = async (
  context: ToolContext,
  args: EditHtmlArgs,
): Promise<ToolResult<HtmlToolData>> => {
  const { prompt } = args;

  // Get the currently selected HTML from context
  const currentData = context.currentResult?.data as HtmlToolData | undefined;
  const currentHtml = currentData?.html;

  if (!currentHtml) {
    return {
      message: "No HTML page is currently selected to edit",
      instructions:
        "Tell the user that they need to select an HTML page first before editing it.",
    };
  }

  if (!context.app?.fetchGenerateHtml) {
    return {
      message: "fetchGenerateHtml function not available",
      instructions: "Acknowledge that the HTML editing failed.",
    };
  }

  // Get backend model preference (default to claude)
  const backend = (context?.getPluginConfig?.("htmlGenerationBackend") ||
    context?.userPreferences?.pluginConfigs?.["htmlGenerationBackend"] ||
    context?.userPreferences?.htmlGenerationBackend ||
    "claude") as "claude" | "gemini";

  try {
    const data = await context.app.fetchGenerateHtml({ prompt, html: currentHtml, backend });

    if (data.success && data.html) {
      return {
        data: {
          html: data.html,
          type: currentData?.type || "tailwind",
        },
        title: prompt.slice(0, 50),
        message: "HTML editing succeeded",
        instructions:
          "Acknowledge that the HTML was modified and has been already presented to the user.",
        updating: true, // Update the existing result instead of creating a new one
      };
    } else {
      console.error("ERR:1\n no HTML data", data);
      return {
        message: data.error || "HTML editing failed",
        instructions: "Acknowledge that the HTML editing failed.",
      };
    }
  } catch (error) {
    console.error("ERR: exception\n HTML editing failed", error);
    return {
      message: "HTML editing failed",
      jsonData: error,
      instructions: "Acknowledge that the HTML editing failed.",
    };
  }
};

export const plugin: ToolPlugin<HtmlToolData, unknown, EditHtmlArgs> = {
  toolDefinition,
  execute: editHtml,
  generatingMessage: "Editing HTML...",
  isEnabled: (startResponse) =>
    !!startResponse?.hasAnthropicApiKey || !!startResponse?.hasGoogleApiKey,
  viewComponent: HtmlView,
  previewComponent: HtmlPreview,
  config: {
    key: "htmlGenerationBackend",
    defaultValue: "claude" as "claude" | "gemini",
    component: HtmlGenerationConfig,
  },
};
