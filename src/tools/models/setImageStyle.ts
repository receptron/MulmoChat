import { ToolPlugin, ToolContext, ToolResult } from "../types";
import type { ImageGenerationConfigValue } from "../configs/ImageGenerationConfig.vue";
import SetImageStylePreview from "../previews/setImageStyle.vue";

const toolName = "setImageStyle";

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Set the image style modifier that will be automatically applied to all future image generation requests. This allows you to establish a consistent visual style for all generated images.",
  parameters: {
    type: "object" as const,
    properties: {
      styleModifier: {
        type: "string",
        description:
          "The style description to append to all image generation prompts (e.g., 'ghibli-style anime', 'oil painting', 'cyberpunk', 'watercolor', 'minimalist line art'). Use an empty string to clear the current style.",
      },
    },
    required: ["styleModifier"],
  },
};

type SetImageStyleArgs = {
  styleModifier: string;
};

interface SetImageStyleData {
  styleModifier: string;
  previousStyleModifier: string;
}

const setImageStyleExecute = async (
  context: ToolContext,
  args: SetImageStyleArgs,
): Promise<ToolResult<SetImageStyleData>> => {
  const { styleModifier } = args;

  try {
    // Get current config
    const currentConfig = context.getPluginConfig?.("imageGenerationBackend") ||
      context.userPreferences?.pluginConfigs?.["imageGenerationBackend"] || {
        backend: "gemini" as const,
        styleModifier: "",
      };

    // Handle legacy string format
    let config: ImageGenerationConfigValue;
    if (typeof currentConfig === "string") {
      config = {
        backend: currentConfig as "gemini" | "openai" | "comfyui",
        styleModifier: "",
      };
    } else {
      config = currentConfig as ImageGenerationConfigValue;
    }

    const previousStyleModifier = config.styleModifier || "";

    // Update the config with new style modifier
    const newConfig: ImageGenerationConfigValue = {
      ...config,
      styleModifier: styleModifier.trim(),
    };

    // Update via userPreferences if available
    if (context.userPreferences?.pluginConfigs) {
      context.userPreferences.pluginConfigs.imageGenerationBackend = newConfig;
    }

    const isClearing = styleModifier.trim() === "";
    const message = isClearing
      ? "Image style cleared"
      : `Image style set to: ${styleModifier.trim()}`;

    const instructions = isClearing
      ? "Acknowledge that the image style has been cleared. All future images will be generated without a consistent style modifier."
      : `Acknowledge that all future images will now be generated with the style: "${styleModifier.trim()}". This style will be automatically applied to every image generation request until changed.`;

    return {
      message,
      data: {
        styleModifier: styleModifier.trim(),
        previousStyleModifier,
      },
      jsonData: {
        success: true,
        styleModifier: styleModifier.trim(),
        previousStyleModifier,
        backend: config.backend,
      },
      instructions,
      instructionsRequired: true,
    };
  } catch (error) {
    console.error("ERR: exception in setImageStyle", error);
    return {
      message: `Failed to set image style: ${error instanceof Error ? error.message : "Unknown error"}`,
      jsonData: {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      instructions:
        "Acknowledge that there was an error setting the image style and ask the user to try again.",
    };
  }
};

export const plugin: ToolPlugin<SetImageStyleData> = {
  toolDefinition,
  execute: setImageStyleExecute as any,
  generatingMessage: "Setting image style...",
  isEnabled: () => true,
  previewComponent: SetImageStylePreview,
};
