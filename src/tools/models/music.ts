import type { ToolContext, ToolResult } from "gui-chat-protocol/vue";
import type { ToolPlugin } from "../types";
import MusicView from "../views/music.vue";
import MusicPreview from "../previews/music.vue";

const toolName = "showMusic";

export interface MusicToolData {
  musicXML: string;
}

export interface MusicArgs {
  musicXML: string;
  title?: string;
}

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description: "Display sheet music from MusicXML format.",
  parameters: {
    type: "object" as const,
    properties: {
      musicXML: {
        type: "string",
        description: "The music in MusicXML format",
      },
      title: {
        type: "string",
        description: "Optional title for the music piece",
      },
    },
    required: ["musicXML"],
  },
};

const pushMusic = async (
  context: ToolContext,
  args: MusicArgs,
): Promise<ToolResult<MusicToolData>> => {
  try {
    const { musicXML, title } = args;

    if (!musicXML || typeof musicXML !== "string") {
      throw new Error("musicXML parameter is required and must be a string");
    }

    return {
      message: "Sheet music displayed",
      title: title || "Sheet Music",
      data: { musicXML },
      instructions:
        "Acknowledge that the sheet music has been displayed to the user.",
    };
  } catch (error) {
    console.error("ERR: exception\n Music rendering failed", error);
    return {
      message: `Music rendering failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      instructions: "Acknowledge that the music rendering failed.",
    };
  }
};

export const plugin: ToolPlugin<MusicToolData, unknown, MusicArgs> = {
  toolDefinition,
  execute: pushMusic,
  generatingMessage: "Rendering sheet music...",
  isEnabled: () => true,
  viewComponent: MusicView,
  previewComponent: MusicPreview,
};
