/* global document, navigator */
import type { ToolContext, ToolResult } from "gui-chat-protocol/vue";
import type { ToolPlugin } from "../types";
import ImageView from "../views/image.vue";
import ImagePreview from "../previews/image.vue";
import type { ImageToolData } from "../utils";
import { createApp } from "vue";
import CameraCapture from "../../components/CameraCapture.vue";

const toolName = "takePhoto";

// Camera takes no arguments - empty interface
export type CameraArgs = Record<string, never>;

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description: "Take a photo using the device camera.",
  parameters: {
    type: "object" as const,
    properties: {},
    required: [] as string[],
  },
};

/**
 * Captures a photo from the user's camera with preview UI
 */
const takePhoto = async (
  __context: ToolContext,
  __args: CameraArgs,
): Promise<ToolResult<ImageToolData>> => {
  return new Promise((resolve) => {
    // Create container for the camera component
    const container = document.createElement("div");
    document.body.appendChild(container);

    // Create Vue app with the camera capture component
    const app = createApp(CameraCapture, {
      onCapture: (imageData: string) => {
        // Clean up
        app.unmount();
        document.body.removeChild(container);

        // Return success result
        resolve({
          data: {
            imageData,
            prompt: `Photo taken at ${new Date().toLocaleString()}`,
          },
          message: "photo captured successfully",
          instructions:
            "Acknowledge that the photo was taken and has been already presented to the user. You can describe what you see in the photo if appropriate.",
        });
      },
      onCancel: () => {
        // Clean up
        app.unmount();
        document.body.removeChild(container);

        // Return cancellation result - LLM learns about cancellation from the function return value
        resolve({
          message: "photo capture cancelled by user",
          cancelled: true,
        });
      },
    });

    app.mount(container);
  });
};

export const plugin: ToolPlugin<ImageToolData, unknown, CameraArgs> = {
  toolDefinition,
  execute: takePhoto,
  generatingMessage: "Opening camera...",
  waitingMessage: "Taking photo...",
  isEnabled: () => {
    // Camera API is available in most modern browsers
    return (
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices &&
      !!navigator.mediaDevices.getUserMedia
    );
  },
  viewComponent: ImageView,
  previewComponent: ImagePreview,
  systemPrompt: `When the user asks to take a photo, use selfie, or capture an image from the camera, you MUST use the ${toolName} API.`,
};
