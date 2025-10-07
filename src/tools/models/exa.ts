import { ToolPlugin, ToolContext, ToolResult } from "../types";
import ExaView from "../views/exa.vue";
import ExaPreview from "../previews/exa.vue";

const toolName = "exaSearch";

export interface ExaSearchResult {
  id: string;
  url: string;
  title: string;
  score: number;
  publishedDate?: string;
  author?: string;
  highlights?: string[];
  text?: string;
}

export interface ExaJsonData {
  query: string;
  results: ExaSearchResult[];
}

export type ExaResult = ToolResult<never, ExaJsonData>;

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Search the web using Exa API for high-quality, relevant results",
  parameters: {
    type: "object" as const,
    properties: {
      query: {
        type: "string",
        description: "The search query to find relevant web content",
      },
      numResults: {
        type: "number",
        description: "Number of results to return (default: 5, max: 10)",
        minimum: 1,
        maximum: 10,
      },
      includeText: {
        type: "boolean",
        description:
          "Whether to include page text content in results (default: true)",
      },
      fetchHighlights: {
        type: "boolean",
        description:
          "Whether to include query-relevant highlights from the content",
      },
      includeDomains: {
        type: "array",
        description: "Only search within these domains",
        items: { type: "string" },
      },
      excludeDomains: {
        type: "array",
        description: "Exclude results from these domains",
        items: { type: "string" },
      },
      startPublishedDate: {
        type: "string",
        description:
          "Only include results published after this date (ISO format: 2025-01-01)",
      },
      endPublishedDate: {
        type: "string",
        description:
          "Only include results published before this date (ISO format: 2025-01-01)",
      },
    },
    required: ["query"],
  },
};

const exaSearch = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ExaResult> => {
  const query = args.query as string;
  const numResults = (args.numResults as number) || 5;
  const includeText = args.includeText !== false;
  const fetchHighlights = args.fetchHighlights || false;
  const includeDomains = args.includeDomains;
  const excludeDomains = args.excludeDomains;
  const startPublishedDate = args.startPublishedDate;
  const endPublishedDate = args.endPublishedDate;

  try {
    const response = await fetch("/api/exa-search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        numResults: Math.min(numResults, 10),
        includeText,
        fetchHighlights,
        includeDomains,
        excludeDomains,
        startPublishedDate,
        endPublishedDate,
      }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.success && data.results) {
      return {
        message: `Found ${data.results.length} relevant results for "${query}"`,
        jsonData: { query, results: data.results },
        instructions:
          "Acknowledge that the search was successful and provide a very short summary, focusing only on the most relevant information.",
      };
    } else {
      console.error("ERR:1\n Exa search failed");
      return {
        message: data.error || "Exa search failed",
        instructions:
          "Acknowledge that the search failed and suggest trying a different query.",
      };
    }
  } catch (error) {
    console.error("EXC: exception\n Exa search failed", error);
    return {
      message: `Exa search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      instructions:
        "Acknowledge that the search failed due to a technical error.",
    };
  }
};

export const plugin: ToolPlugin = {
  toolDefinition,
  execute: exaSearch,
  generatingMessage: "Searching the web...",
  waitingMessage:
    "Tell the user that you are searching for relevant information.",
  isEnabled: (startResponse) => !!startResponse?.hasExaApiKey,
  delayAfterExecution: 3000,
  viewComponent: ExaView,
  previewComponent: ExaPreview,
};
