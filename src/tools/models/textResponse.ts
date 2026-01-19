import type { ToolContext } from "gui-chat-protocol/vue";
import type { ToolPlugin } from "../types";
import TextResponseView from "../views/TextResponseView.vue";
import TextResponsePreview from "../previews/TextResponsePreview.vue";

export interface TextResponseData {
  text: string;
  role?: "assistant" | "system" | "user";
  transportKind?: string;
}

type TextResponseArgs = TextResponseData;

export const plugin: ToolPlugin<TextResponseData, unknown, TextResponseArgs> = {
  toolDefinition: {
    type: "function",
    name: "text-response",
    description: "Render plain text content from the assistant.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Plain text content to display to the user.",
        },
        role: {
          type: "string",
          enum: ["assistant", "system", "user"],
          description: "Speaker role of the message.",
        },
        transportKind: {
          type: "string",
          description:
            "Identifier for the transport or provider that produced the message.",
        },
      },
      required: ["text"],
    },
  },
  generatingMessage: "Processing...",
  // Never advertise this pseudo tool to the LLM; only the client uses it.
  isEnabled: () => false,
  viewComponent: TextResponseView,
  previewComponent: TextResponsePreview,
  execute: async (_context: ToolContext, args: TextResponseArgs) => ({
    data: {
      text: args.text,
      role: args.role,
      transportKind: args.transportKind,
    },
    message: args.text,
  }),
};
