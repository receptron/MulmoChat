import { ToolPlugin, ToolContext, ToolResult } from "../types";
import { ROLES } from "../../config/roles";
import SwitchRolePreview from "../previews/switchRole.vue";

const toolName = "switchRole";

const roleEntries = ROLES.map((role) => ({
  id: role.id,
  name: role.name,
}));

const roleOptionsDescription = roleEntries
  .map((entry) => `'${entry.id}' (${entry.name})`)
  .join(", ");

const availableRolesSummary = roleEntries
  .map((entry) => `${entry.id} (${entry.name})`)
  .join(", ");

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Switch the system prompt role and reconnect to the LLM. This changes the AI's personality and behavior. Available roles: 'general' (teacher explaining things simply), 'tutor' (adaptive tutor that evaluates knowledge first), 'listener' (silent role that only generates images).",
  parameters: {
    type: "object" as const,
    properties: {
      role: {
        type: "string",
        enum: roleEntries.map((entry) => entry.id),
        description: `The role to switch to. Options: ${roleOptionsDescription}`,
      },
    },
    required: ["role"],
  },
};

type SwitchRoleArgs = {
  role: string;
};

const switchRoleExecute = async (
  _context: ToolContext,
  args: SwitchRoleArgs,
): Promise<ToolResult> => {
  const { role } = args;

  try {
    // Validate role
    const validRole = roleEntries.find((entry) => entry.id === role);
    if (!validRole) {
      return {
        message: `Invalid role: ${role}`,
        jsonData: {
          success: false,
          error: "Invalid role",
          availableRoles: roleEntries,
        },
        instructions: `Tell the user that '${role}' is not a valid role. Available roles are: ${availableRolesSummary}.`,
      };
    }

    // Call switchRole asynchronously (don't await)
    const globalObject = globalThis as typeof globalThis & {
      switchRole?: (selectedRole: string) => void;
    };

    if (
      typeof window !== "undefined" &&
      typeof globalObject.switchRole === "function"
    ) {
      // Fire and forget - this will disconnect and reconnect
      setTimeout(() => {
        globalObject.switchRole?.(role);
      }, 0);
    } else {
      console.error("switchRole function not found on window object");
      return {
        message: "Failed to switch role: switchRole API not available",
        jsonData: {
          success: false,
          error: "switchRole API not available",
        },
        instructions:
          "Tell the user that the role switching feature is not available.",
      };
    }

    // Immediately return to LLM
    return {
      message: `Role switch to '${validRole.name}' initiated`,
      jsonData: {
        success: true,
        role,
        roleName: validRole.name,
      },
      /*
      instructions: `Tell the user that you are switching to ${validRole.name} role and will reconnect shortly. The conversation will be interrupted momentarily during the reconnection.`,
      instructionsRequired: true, // Always send this instruction
      */
    };
  } catch (error) {
    console.error("ERR: exception in switchRole", error);
    return {
      message: `Role switch error: ${error instanceof Error ? error.message : "Unknown error"}`,
      jsonData: {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      instructions:
        "Acknowledge that there was an error switching roles and ask the user to try again.",
    };
  }
};

export const plugin: ToolPlugin = {
  toolDefinition,
  execute: switchRoleExecute,
  generatingMessage: "Switching role...",
  isEnabled: () => true,
  previewComponent: SwitchRolePreview,
  systemPrompt: `When users ask to change the role, personality, or behavior of the AI (e.g., 'switch to tutor role', 'change to listener role', 'be a teacher'), use the ${toolName} function. Note that switching roles will disconnect and reconnect the conversation.`,
};
