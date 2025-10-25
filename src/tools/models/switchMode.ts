import { ToolPlugin, ToolContext, ToolResult } from "../types";
import { MODES } from "../../config/modes";
import SwitchModePreview from "../previews/switchMode.vue";

const toolName = "switchMode";

const modeEntries = MODES.map((mode) => ({
  id: mode.id,
  name: mode.name,
}));

const modeOptionsDescription = modeEntries
  .map((entry) => `'${entry.id}' (${entry.name})`)
  .join(", ");

const availableModesSummary = modeEntries
  .map((entry) => `${entry.id} (${entry.name})`)
  .join(", ");

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Switch the system prompt mode and reconnect to the LLM. This changes the AI's personality and behavior. Available modes: 'general' (teacher explaining things simply), 'tutor' (adaptive tutor that evaluates knowledge first), 'listener' (silent mode that only generates images).",
  parameters: {
    type: "object" as const,
    properties: {
      mode: {
        type: "string",
        enum: modeEntries.map((entry) => entry.id),
        description: `The mode to switch to. Options: ${modeOptionsDescription}`,
      },
    },
    required: ["mode"],
  },
};

type SwitchModeArgs = {
  mode: string;
};

const switchModeExecute = async (
  _context: ToolContext,
  args: SwitchModeArgs,
): Promise<ToolResult> => {
  const { mode } = args;

  try {
    // Validate mode
    const validMode = modeEntries.find((entry) => entry.id === mode);
    if (!validMode) {
      return {
        message: `Invalid mode: ${mode}`,
        jsonData: {
          success: false,
          error: "Invalid mode",
          availableModes: modeEntries,
        },
        instructions: `Tell the user that '${mode}' is not a valid mode. Available modes are: ${availableModesSummary}.`,
      };
    }

    // Call switchMode asynchronously (don't await)
    const globalObject = globalThis as typeof globalThis & {
      switchMode?: (selectedMode: string) => void;
    };

    if (
      typeof window !== "undefined" &&
      typeof globalObject.switchMode === "function"
    ) {
      // Fire and forget - this will disconnect and reconnect
      setTimeout(() => {
        globalObject.switchMode?.(mode);
      }, 0);
    } else {
      console.error("switchMode function not found on window object");
      return {
        message: "Failed to switch mode: switchMode API not available",
        jsonData: {
          success: false,
          error: "switchMode API not available",
        },
        instructions:
          "Tell the user that the mode switching feature is not available.",
      };
    }

    // Immediately return to LLM
    return {
      message: `Mode switch to '${validMode.name}' initiated`,
      jsonData: {
        success: true,
        mode,
        modeName: validMode.name,
      },
      instructions: `Tell the user that you are switching to ${validMode.name} mode and will reconnect shortly. The conversation will be interrupted momentarily during the reconnection.`,
      instructionsRequired: true, // Always send this instruction
    };
  } catch (error) {
    console.error("ERR: exception in switchMode", error);
    return {
      message: `Mode switch error: ${error instanceof Error ? error.message : "Unknown error"}`,
      jsonData: {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      instructions:
        "Acknowledge that there was an error switching modes and ask the user to try again.",
    };
  }
};

export const plugin: ToolPlugin = {
  toolDefinition,
  execute: switchModeExecute,
  generatingMessage: "Switching mode...",
  isEnabled: () => true,
  previewComponent: SwitchModePreview,
  systemPrompt: `When users ask to change the mode, personality, or behavior of the AI (e.g., 'switch to tutor mode', 'change to listener mode', 'be a teacher'), use the ${toolName} function. Note that switching modes will disconnect and reconnect the conversation.`,
};
