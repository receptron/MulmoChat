/* global FileReader */
import { ToolPlugin, ToolContext, ToolResult } from "../types";
import MulmocastView from "../views/mulmocast.vue";
import MulmocastPreview from "../previews/mulmocast.vue";
import MulmocastConfig from "../configs/MulmocastConfig.vue";
import type { MulmoScript } from "mulmocast";
import { v4 as uuidv4 } from "uuid";
import { generateImageWithBackend } from "./generateImage";

const toolName = "showPresentation";
const dryRun = false;

export interface MulmocastToolData {
  mulmoScript: MulmoScript;
  images?: Record<string, string>;
  moviePath?: string;
  viewerJsonPath?: string;
}

export interface MulmocastBeat {
  text: string;
  imagePrompt?: string;
}

export interface MulmocastArgs {
  title: string;
  lang: string;
  beats: MulmocastBeat[];
}

// Convert URL to base64 (without data URL prefix)
async function urlToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove "data:image/png;base64," prefix
      const base64Data = base64.split(",")[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Load blank.png and convert to base64 (without data URL prefix)
export async function loadBlankImageBase64(): Promise<string> {
  return urlToBase64("/blank.png");
}

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Let MulmoCast to process a given MulmoScript to generate a presentation of a given topic or story.",
  parameters: {
    type: "object" as const,
    properties: {
      title: { type: "string", description: "The title of the presentation" },
      lang: {
        type: "string",
        description: "The language of the presentation, such as en, ja, etc.",
      },
      beats: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: {
              type: "string",
              description:
                "The text to be spoken by the presenter, which is also used to generate an image if there is no imagePrompt. Typically 50 to 70 words.",
            },
            imagePrompt: {
              type: "string",
              description:
                "Optional prompt to be used to generate an image. Typically 50 to 70 words. Do not specify the image style.",
            },
          },
          required: ["text"],
          additionalProperties: false,
        },
        minItems: 1,
      },
    },
    required: ["title", "lang", "beats"],
    additionalProperties: false,
  },
};

const mulmocast = async (
  context: ToolContext,
  args: MulmocastArgs,
): Promise<ToolResult<MulmocastToolData>> => {
  console.log("MULMOSCRIPT:\n", JSON.stringify(args, null, 2));

  const { title, beats } = args;

  // Reference images for aspect ratio
  const blankImageBase64 = await loadBlankImageBase64();
  const imageRefs: string[] = [blankImageBase64];

  // Generate beat objects with UUIDs first
  const beatsWithIds = beats.map((beat) => ({
    id: uuidv4(),
    speaker: "Presenter",
    text: beat.text,
    imagePrompt: beat.imagePrompt,
  }));

  // Generate images for each beat concurrently
  const imagePromises = beatsWithIds.map(async (beat) => {
    const prompt =
      beat.imagePrompt ||
      `generate image appropriate for the text. <text>${beat.text}</text>. Let the art convey the story and emotions without text. Use the last image for the aspect ratio.`;
      if (dryRun) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return {
          id: beat.id,
          imageData: `data:image/png;base64,${blankImageBase64}`,
        };
      }
      try {
        // Generate the image using the shared backend-aware function
        // The global style modifier will be automatically applied
        const result = await generateImageWithBackend(
          prompt,
          imageRefs,
          context,
        );

        if (result.success && result.imageData) {
          return { id: beat.id, imageData: result.imageData };
        }
      } catch (error) {
        // Notice that we just display the error and return null for the image data
        console.error(
          "EXC: exception\nFailed to generate image for beat:",
          error,
        );
      }
      return { id: beat.id, imageData: null };
    },
  );

  const imageResults = await Promise.all(imagePromises);

  // Create images mapping from beat ID to imageData
  const imagesMap: Record<string, string> = {};
  imageResults.forEach((result) => {
    if (result.imageData) {
      imagesMap[result.id] = result.imageData;
    }
  });

  // Construct MulmoScript object
  const mulmoScript = {
    $mulmocast: { version: "1.1" },
    canvasSize: {
      width: 1536,
      height: 1080,
    },
    imageParams: {
      provider: "google",
      model: "gemini-2.5-flash-image-preview",
    },
    audioParams: {
      padding: 0.2,
      introPadding: 0.5,
      closingPadding: 0.5,
      outroPadding: 0.5,
      bgmVolume: 0.1,
      audioVolume: 1.5,
      suppressSpeech: false,
    },
    soundEffectParams: {},
    speechParams: {
      speakers: {
        Presenter: {
          voiceId: "shimmer",
        },
      },
    },
    title,
    lang: args.lang,
    beats: beatsWithIds,
  } as unknown as MulmoScript;

  const message = `Mulmocast has processed the MulmoScript for "${title}" with ${beats.length} beats. Movie generation will begin automatically.`;

  return {
    message,
    title,
    instructions:
      "Acknowledge that all the images were successfully generated and that the movie is being generated.",
    data: {
      mulmoScript,
      images: imagesMap,
      moviePath: dryRun ? "__dryrun__.mp4" : undefined, // __dryrun__.mp4 is a placeholder for the dry run
    },
  };
};

export const plugin: ToolPlugin<MulmocastToolData, unknown, MulmocastArgs> = {
  toolDefinition,
  execute: mulmocast,
  generatingMessage: "Processing with Mulmocast...",
  waitingMessage:
    "Tell the user that the script was written and we are genenerating images and video with Mulmocast.",
  isEnabled: () => true,
  viewComponent: MulmocastView,
  previewComponent: MulmocastPreview,
  systemPrompt: `Call the ${toolName} API to display presentations when the user is asking for a presentation.`,
  config: {
    key: "mulmocast",
    defaultValue: true,
    component: MulmocastConfig,
  },
};
