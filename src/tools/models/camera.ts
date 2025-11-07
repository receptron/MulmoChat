import { ToolPlugin, ToolContext, ToolResult } from "../types";
import ImageView from "../views/image.vue";
import ImagePreview from "../previews/image.vue";
import type { ImageToolData } from "./generateImage";

const toolName = "takePhoto";

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description: "Take a photo using the device camera.",
  parameters: {
    type: "object" as const,
    properties: {},
    required: [],
  },
};

/**
 * Captures a photo from the user's camera
 */
const takePhoto = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ToolResult<ImageToolData>> => {
  try {
    // Request camera access
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false,
    });

    // Create video element to capture the stream
    const video = document.createElement("video");
    video.srcObject = stream;
    video.autoplay = true;
    video.playsInline = true;

    // Wait for video to be ready
    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => {
        video.play();
        resolve();
      };
    });

    // Wait a bit for camera to adjust
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Create canvas to capture frame
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Failed to get canvas context");
    }

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to base64
    const imageData = canvas.toDataURL("image/png");

    // Stop camera stream
    stream.getTracks().forEach((track) => track.stop());

    // Clean up
    video.srcObject = null;

    return {
      data: {
        imageData,
        prompt: `Photo taken at ${new Date().toLocaleString()}`,
      },
      message: "photo captured successfully",
      instructions:
        "Acknowledge that the photo was taken and has been already presented to the user. You can describe what you see in the photo if appropriate.",
    };
  } catch (error) {
    console.error("Camera capture failed:", error);
    return {
      message: `camera capture failed: ${error instanceof Error ? error.message : "unknown error"}`,
      instructions:
        "Acknowledge that the camera capture failed. The user may need to grant camera permissions.",
    };
  }
};

export const plugin: ToolPlugin<ImageToolData> = {
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
