import { ToolPlugin, ToolContext, ToolResult } from "../types";
import MarkdownView from "../views/markdown.vue";
import MarkdownPreview from "../previews/markdown.vue";
import { loadBlankImageBase64 } from "../utils";
import { generateImageWithBackend, fetchSaveImages } from "../backend";
import { v4 as uuidv4 } from "uuid";

const toolName = "presentDocument";

export interface MarkdownToolData {
  markdown: string;
  pdfPath?: string;
}

export interface MarkdownArgs {
  title: string;
  markdown: string;
}

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description: "Display a document in markdown format.",
  parameters: {
    type: "object" as const,
    properties: {
      title: {
        type: "string",
        description: "Title for the document",
      },
      markdown: {
        type: "string",
        description:
          "The markdown content to display. Describe embedded images in the following format: ![Detailed image prompt](__too_be_replaced_image_path__). IMPORTANT: For embedded images, you MUST use the EXACT placeholder path '__too_be_replaced_image_path__'.",
      },
    },
    required: ["title", "markdown"],
  },
};

const pushMarkdown = async (
  context: ToolContext,
  args: MarkdownArgs,
): Promise<ToolResult<MarkdownToolData>> => {
  let { markdown } = args;
  const { title } = args;
  let docUuid: string | undefined;

  // Validate that markdown is provided
  if (!markdown || markdown.trim() === "") {
    throw new Error("Markdown content is required but was not provided");
  }

  // Detect all image placeholders in the format: ![prompt](__too_be_replaced_image_path__)
  // Also handle variant with leading slash: ![prompt](/__too_be_replaced_image_path__)
  const imageRegex = /!\[([^\]]+)\]\(\/?__too_be_replaced_image_path__\)/g;
  const matches = [...markdown.matchAll(imageRegex)];

  if (matches.length > 0) {
    // Generate a UUID for this markdown document
    docUuid = uuidv4();
    const images: Record<string, string> = {};

    // Load blank image for image generation
    const blankImageBase64 = await loadBlankImageBase64();

    // Generate images for each placeholder in parallel
    const imagePromises = matches.map(async (match, i) => {
      const prompt = `${match[1]}. Use the last image as the output dimension.`;
      const imageId = `image_${i}`;

      try {
        // Generate the image using the shared backend-aware function
        const result = await generateImageWithBackend(
          prompt,
          [blankImageBase64],
          context,
        );

        if (result.success && result.imageData) {
          images[imageId] = `data:image/png;base64,${result.imageData}`;
        }
      } catch (error) {
        console.error(`Failed to generate image for prompt: ${prompt}`, error);
      }
    });

    await Promise.all(imagePromises);

    // Save images to server and get URLs
    if (Object.keys(images).length > 0) {
      try {
        const data = await fetchSaveImages({ uuid: docUuid, images });

        if (data.imageUrls) {
          const imageUrls = data.imageUrls;

          // Replace placeholders with actual image URLs
          let imageIndex = 0;
          markdown = markdown.replace(imageRegex, (match, prompt) => {
            const imageId = `image_${imageIndex}`;
            const imageUrl = imageUrls[imageId];
            imageIndex++;
            return imageUrl ? `![${prompt}](${imageUrl})` : match;
          });
        }
      } catch (error) {
        console.error("Failed to save images:", error);
      }
    }
  }

  return {
    message: `Created markdown document: ${title}`,
    title,
    data: { markdown },
    uuid: docUuid,
    instructions:
      "Acknowledge that the document has been created and is displayed to the user.",
  };
};

export const plugin: ToolPlugin<MarkdownToolData, unknown, MarkdownArgs> = {
  toolDefinition,
  execute: pushMarkdown,
  generatingMessage: "Creating document...",
  waitingMessage:
    "Tell the user that the document was created, will be presented to the user shortly.",
  isEnabled: () => true,
  viewComponent: MarkdownView,
  previewComponent: MarkdownPreview,
  samples: [
    {
      name: "Basic Markdown",
      args: {
        title: "Sample Document",
        markdown: `# Hello World

This is a **bold** text and this is *italic*.

## Features
- Item 1
- Item 2
- Item 3

### Code Example
\`\`\`javascript
const greeting = "Hello!";
console.log(greeting);
\`\`\`
`,
      },
    },
    {
      name: "Table Example",
      args: {
        title: "Data Table",
        markdown: `# Product List

| Name | Price | Stock |
|------|-------|-------|
| Apple | $1.00 | 50 |
| Banana | $0.50 | 100 |
| Orange | $0.75 | 30 |

> Note: Prices are subject to change.
`,
      },
    },
  ],
  systemPrompt: `Use the ${toolName} tool to create structured documents with text and embedded images. This tool is ideal for:
- Guides, tutorials, and how-to content ("create a guide about...", "explain how to...")
- Educational content (lessons, explanations, timelines, concept visualizations)
- Reports and presentations (business reports, data analysis, infographics)
- Articles and blog posts with illustrations
- Documentation with diagrams or screenshots
- Recipes with step-by-step photos
- Travel guides with location images
- Product presentations or lookbooks
- Any content that combines written information with supporting visuals

IMPORTANT: Use this tool instead of just generating standalone images when the user wants informational or educational content with visuals. This creates a cohesive document with formatted text (markdown) AND images embedded at appropriate locations. For example, if asked to "create a guide about photosynthesis with a diagram", use ${toolName} to create a full guide with explanatory text and the diagram embedded, rather than just generating the diagram image alone.

Format embedded images as: ![Detailed image prompt](__too_be_replaced_image_path__)`,
};
