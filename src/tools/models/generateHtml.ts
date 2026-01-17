import { ToolPlugin, ToolContext, ToolResult } from "../types";
import HtmlView from "../views/html.vue";
import HtmlPreview from "../previews/html.vue";
import type { HtmlToolData } from "../utils";

const toolName = "generateHtml";

export interface GenerateHtmlArgs {
  prompt: string;
}

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Generate a complete, standalone HTML page by sending a detailed prompt to another LLM (Claude). This tool uses AI to write HTML, CSS, and JavaScript based on your description. The generated HTML will be self-contained with all styles and scripts inline, requiring no external dependencies.",
  parameters: {
    type: "object" as const,
    properties: {
      prompt: {
        type: "string",
        description:
          "Detailed description of the desired HTML page. Be specific about layout, styling, interactivity, colors, animations, and functionality. The more detailed your prompt, the better the generated HTML will match your requirements. This prompt will be sent to another AI model (Claude) that specializes in HTML generation.",
      },
    },
    required: ["prompt"],
  },
};

const generateHtml = async (
  context: ToolContext,
  args: GenerateHtmlArgs,
): Promise<ToolResult<HtmlToolData>> => {
  const { prompt } = args;

  if (!context.app?.generateHtml) {
    return {
      message: "generateHtml function not available",
      instructions: "Acknowledge that the HTML generation failed.",
    };
  }

  try {
    const data = await context.app.generateHtml({ prompt });

    if (data.success && data.html) {
      return {
        data: {
          html: data.html,
          type: "tailwind",
        },
        title: prompt.slice(0, 50),
        message: "HTML generation succeeded",
        instructions:
          "Acknowledge that the HTML was generated and has been already presented to the user.",
      };
    } else {
      console.error("ERR:1\n no HTML data", data);
      return {
        message: data.error || "HTML generation failed",
        instructions: "Acknowledge that the HTML generation failed.",
      };
    }
  } catch (error) {
    console.error("ERR: exception\n HTML generation failed", error);
    return {
      message: "HTML generation failed",
      jsonData: error,
      instructions: "Acknowledge that the HTML generation failed.",
    };
  }
};

export const plugin: ToolPlugin<HtmlToolData, unknown, GenerateHtmlArgs> = {
  toolDefinition,
  execute: generateHtml,
  generatingMessage: "Generating HTML...",
  isEnabled: (startResponse) =>
    !!startResponse?.hasAnthropicApiKey || !!startResponse?.hasGoogleApiKey,
  viewComponent: HtmlView,
  previewComponent: HtmlPreview,
  backends: ["textLLM"],
};
