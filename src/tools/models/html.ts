import { ToolPlugin, ToolContext, ToolResult } from "../types";
import HtmlView from "../views/html.vue";
import HtmlPreview from "../previews/html.vue";

const toolName = "renderHtml";

export const HTML_LIBRARIES = [
  "tailwind",
  "d3.js",
  "three.js",
  "p5.js",
  "mermaid",
] as const;
export type HtmlLibraryType = (typeof HTML_LIBRARIES)[number];

const LIBRARY_DESCRIPTIONS: Record<HtmlLibraryType, string> = {
  tailwind: "Tailwind CSS for utility-first styling",
  "d3.js": "D3.js for data-driven visualizations and interactive charts",
  "three.js": "Three.js for 3D graphics and WebGL rendering",
  "p5.js": "p5.js for creative coding, animations, and generative art",
  mermaid: "Mermaid for diagrams and flowcharts from text definitions",
};

export interface HtmlToolData {
  html: string;
  type: HtmlLibraryType;
}

export interface HtmlArgs {
  title: string;
  html: string;
  type: HtmlLibraryType;
}

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Render a full HTML page with specified library support (Tailwind CSS, D3.js, Three.js, Chart.js, p5.js, or Mermaid). The HTML will be rendered in an isolated iframe.",
  parameters: {
    type: "object" as const,
    properties: {
      title: {
        type: "string",
        description: "Title for the HTML page",
      },
      html: {
        type: "string",
        description:
          "The complete HTML content to render. Should be a full HTML document including DOCTYPE, html, head, and body tags.",
      },
      type: {
        type: "string",
        enum: [...HTML_LIBRARIES],
        description: (() => {
          const validValues = HTML_LIBRARIES.map(
            (lib) => `'${lib}' for ${LIBRARY_DESCRIPTIONS[lib]}`,
          ).join(", ");
          return `The primary library used in this HTML page. Valid values: ${validValues}.`;
        })(),
      },
    },
    required: ["title", "html", "type"],
  },
};

const renderHtml = async (
  context: ToolContext,
  args: HtmlArgs,
): Promise<ToolResult<HtmlToolData>> => {
  const { html, type, title } = args;

  // Validate type
  if (!HTML_LIBRARIES.includes(type)) {
    throw new Error(
      `Invalid library type: ${type}. Must be one of: ${HTML_LIBRARIES.join(", ")}`,
    );
  }

  return {
    message: `Rendered HTML page: ${title} (using ${type})`,
    title,
    data: { html, type },
    instructions:
      "Acknowledge that the HTML page has been created and is displayed to the user.",
  };
};

export const plugin: ToolPlugin<HtmlToolData, unknown, HtmlArgs> = {
  toolDefinition,
  execute: renderHtml,
  generatingMessage: "Rendering HTML page...",
  waitingMessage:
    "Tell the user that the HTML page was created and will be presented shortly.",
  isEnabled: () => true,
  viewComponent: HtmlView,
  previewComponent: HtmlPreview,
};
