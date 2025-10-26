import { ToolPlugin, ToolContext, ToolResult } from "../types";

const toolName = "scrollToAnchor";

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Scroll the current document view to a specific anchor tag. Use this when reading recipe steps aloud or navigating to specific sections.",
  parameters: {
    type: "object" as const,
    properties: {
      anchorId: {
        type: "string",
        description:
          'The ID of the anchor tag to scroll to (e.g., "step-1", "step-2"). Should match the anchor IDs in the document.',
      },
    },
    required: ["anchorId"],
  },
};

const scrollToAnchor = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ToolResult> => {
  const anchorId = args.anchorId as string;

  // We need to update the current result's viewState to trigger scrolling
  if (!context.currentResult) {
    return {
      message: "No document is currently displayed to scroll.",
      updating: false,
    };
  }

  return {
    ...context.currentResult,
    message: `Scrolled to ${anchorId}`,
    updating: true, // This will update the existing result instead of creating a new one
    viewState: {
      ...context.currentResult.viewState,
      scrollToAnchor: anchorId,
      scrollTimestamp: Date.now(), // Add timestamp to ensure reactivity even with same anchor
    },
    instructions: "Read the step aloud.",
    instructionsRequired: true,
  };
};

export const plugin: ToolPlugin = {
  toolDefinition,
  execute: scrollToAnchor,
  generatingMessage: "Scrolling to section...",
  isEnabled: () => true,
  systemPrompt: `Use the ${toolName} API to scroll the document view to a specific anchor when the user asks to read a specific step or navigate to a section. For example, when the user says "read step 3" or "what's next?", call this function with the appropriate anchor ID (e.g., "step-3") BEFORE or AFTER reading the step aloud.`,
};
