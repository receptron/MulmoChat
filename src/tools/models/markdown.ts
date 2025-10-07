import { ToolPlugin, ToolContext, ToolResult } from "../types";
import MarkdownView from "../views/markdown.vue";
import MarkdownPreview from "../previews/markdown.vue";
import { loadBlankImageBase64 } from "./mulmocast";

const toolName = "pushMarkdown";

export interface MarkdownToolData {
  markdown: string;
}

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description: "Generate and display a document in markdown format.",
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
          "The markdown content to display. Describe embedded images in the following format: ![Detailed image prompt](__too_be_replaced_image_path__)",
      },
    },
    required: ["title", "markdown"],
  },
};

const pushMarkdown = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ToolResult<MarkdownToolData>> => {
  let markdown = args.markdown as string;
  const title = args.title as string;
  let docUuid: string | undefined;

  // Detect all image placeholders in the format: ![prompt](__too_be_replaced_image_path__)
  const imageRegex = /!\[([^\]]+)\]\(__too_be_replaced_image_path__\)/g;
  const matches = [...markdown.matchAll(imageRegex)];

  if (matches.length > 0) {
    // Generate a UUID for this markdown document
    docUuid = crypto.randomUUID();
    const images: Record<string, string> = {};

    // Load blank image for image generation
    const blankImageBase64 = await loadBlankImageBase64();

    // Generate images for each placeholder in parallel
    const imagePromises = matches.map(async (match, i) => {
      const prompt = `${match[1]}. Use the last image as the output dimension.`;
      const imageId = `image_${i}`;

      try {
        // Generate the image using the API
        const response = await fetch("/api/generate-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prompt, images: [blankImageBase64] }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.imageData) {
            images[imageId] = `data:image/png;base64,${data.imageData}`;
          }
        }
      } catch (error) {
        console.error(`Failed to generate image for prompt: ${prompt}`, error);
      }
    });

    await Promise.all(imagePromises);

    // Save images to server and get URLs
    if (Object.keys(images).length > 0) {
      try {
        const response = await fetch("/api/save-images", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uuid: docUuid,
            images,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const imageUrls = data.imageUrls as Record<string, string>;

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

export const plugin: ToolPlugin = {
  toolDefinition,
  execute: pushMarkdown,
  generatingMessage: "Creating document...",
  waitingMessage:
    "Tell the user that the document was created, will be presented to the user shortly.",
  isEnabled: () => true,
  viewComponent: MarkdownView,
  previewComponent: MarkdownPreview,
};
