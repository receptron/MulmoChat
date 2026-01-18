import { ToolPlugin, ToolContext, ToolResult } from "../types";
import BrowseView from "../views/browse.vue";
import BrowsePreview from "../previews/browse.vue";

const toolName = "browse";

export interface BrowseToolData {
  url: string;
  twitterEmbedHtml?: string | null;
}

export interface BrowseJsonData {
  data: {
    title?: string;
    description?: string;
    content?: string;
    textContent?: string;
    text?: string;
    byline?: string;
    excerpt?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface BrowseArgs {
  url: string;
}

export type BrowseResult = ToolResult<BrowseToolData, BrowseJsonData>;

const twitterEmbedData: { [key: string]: string } = {};

function isTwitterUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return (
      urlObj.hostname === "twitter.com" ||
      urlObj.hostname === "www.twitter.com" ||
      urlObj.hostname === "x.com" ||
      urlObj.hostname === "www.x.com"
    );
  } catch {
    return false;
  }
}

async function handleTwitterEmbed(
  url: string,
  context: ToolContext,
): Promise<void> {
  if (!isTwitterUrl(url) || url in twitterEmbedData) {
    return;
  }

  const embedHtml = await context.app?.getTwitterEmbed?.(url);
  console.log("*** Twitter embed", url, embedHtml);
  if (embedHtml) {
    twitterEmbedData[url] = embedHtml;
  }
}

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Browse and extract content from a web page using the provided URL.",
  parameters: {
    type: "object" as const,
    properties: {
      url: {
        type: "string",
        description:
          "The URL of the webpage to browse and extract content from",
      },
    },
    required: ["url"],
  },
};

const browse = async (
  context: ToolContext,
  args: BrowseArgs,
): Promise<BrowseResult> => {
  const { url } = args;

  // Handle Twitter embeds
  if (isTwitterUrl(url)) {
    await handleTwitterEmbed(url, context);
  }

  if (!context.app?.browseUrl) {
    return {
      message: "browseUrl function not available",
      instructions: "Acknowledge that the webpage browsing failed.",
    };
  }

  try {
    const data = await context.app.browseUrl(url);

    if (data.success && data.data) {
      const browseData: BrowseToolData = {
        url,
        twitterEmbedHtml: isTwitterUrl(url)
          ? twitterEmbedData[url] || null
          : undefined,
      };

      return {
        message: "Successfully browsed the webpage",
        title: data.data.title || "Untitled",
        jsonData: { data: data.data },
        instructions:
          "Acknowledge that the webpage was successfully browsed and give a ONE-SENTENCE summary of the content if it is available.",
        data: browseData,
      };
    } else {
      console.log("*** Browse failed");
      return {
        message: data.error || "Failed to browse webpage",
        instructions: "Acknowledge that the webpage browsing failed.",
      };
    }
  } catch (error) {
    console.error("*** Browse failed", error);
    return {
      message: `Failed to browse webpage: ${error instanceof Error ? error.message : "Unknown error"}`,
      instructions: "Acknowledge that the webpage browsing failed.",
    };
  }
};

export const plugin: ToolPlugin<BrowseToolData, BrowseJsonData, BrowseArgs> = {
  toolDefinition,
  execute: browse,
  generatingMessage: "Browsing webpage...",
  waitingMessage:
    "Tell the user to that you are accessing the specified web page.",
  isEnabled: () => true,
  delayAfterExecution: 3000,
  viewComponent: BrowseView,
  previewComponent: BrowsePreview,
  backends: ["browse"],
};
