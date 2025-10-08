import { ToolPlugin, ToolContext, ToolResult } from "../types";
import HtmlView from "../views/html.vue";
import HtmlPreview from "../previews/html.vue";
import type { HtmlToolData } from "./html";

const toolName = "generateHtml";

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
  args: Record<string, any>,
): Promise<ToolResult<HtmlToolData>> => {
  const prompt = args.prompt as string;

  try {
    const response = await fetch("/api/generate-html", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }

    const data = await response.json();

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
      instructions: "Acknowledge that the HTML generation failed.",
    };
  }
};

export const plugin: ToolPlugin<HtmlToolData> = {
  toolDefinition,
  execute: generateHtml,
  generatingMessage: "Generating HTML...",
  isEnabled: () => true,
  viewComponent: HtmlView,
  previewComponent: HtmlPreview,
};
