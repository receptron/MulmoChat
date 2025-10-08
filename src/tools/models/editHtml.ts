import { ToolPlugin, ToolContext, ToolResult } from "../types";
import HtmlView from "../views/html.vue";
import HtmlPreview from "../previews/html.vue";
import type { HtmlToolData } from "./html";

const toolName = "editHtml";

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
  args: Record<string, any>,
): Promise<ToolResult<HtmlToolData>> => {
  const prompt = args.prompt as string;

  // Get the currently selected HTML from context
  const currentHtml = context.currentResult?.data?.html;

  if (!currentHtml) {
    return {
      message: "No HTML page is currently selected to edit",
      instructions:
        "Tell the user that they need to select an HTML page first before editing it.",
    };
  }

  try {
    const response = await fetch("/api/generate-html", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        html: currentHtml,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.success && data.html) {
      return {
        data: {
          html: data.html,
          type: context.currentResult?.data?.type || "tailwind",
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

export const plugin: ToolPlugin<HtmlToolData> = {
  toolDefinition,
  execute: editHtml,
  generatingMessage: "Editing HTML...",
  isEnabled: (startResponse) => !!startResponse?.hasAnthropicApiKey,
  viewComponent: HtmlView,
  previewComponent: HtmlPreview,
};
