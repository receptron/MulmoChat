import { ToolPlugin, ToolContext, ToolResult } from "../types";
import TimerView from "../views/timer.vue";
import TimerPreview from "../previews/timer.vue";

const toolName = "manageTimer";
const STORAGE_KEY = "mulmo_timers";

export interface TimerItem {
  id: string;
  name: string;
  duration: number; // in seconds
  startTime: number; // timestamp when timer started
  endTime: number; // timestamp when timer ends
  status: "running" | "paused" | "completed";
}

export interface TimerToolData {
  timers: TimerItem[];
  action: string;
}

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Manage timers - create, start, pause, resume, or check timers. Useful for tracking time-based tasks.",
  parameters: {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: ["create", "list", "cancel", "clear_completed"],
        description:
          "'create' starts a new timer, 'list' shows all timers, 'cancel' removes a timer, 'clear_completed' removes finished timers",
      },
      name: {
        type: "string",
        description:
          "Timer name/description (required for 'create', used to identify timer for 'cancel')",
      },
      duration: {
        type: "number",
        description:
          "Duration in seconds (required for 'create'). Examples: 60 for 1 minute, 300 for 5 minutes, 3600 for 1 hour",
      },
    },
    required: ["action"],
  },
};

// Load timers from localStorage
function loadTimers(): TimerItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const timers = JSON.parse(stored);
      // Update timer statuses based on current time
      const now = Date.now();
      return timers.map((timer: TimerItem) => {
        if (timer.status === "running" && now >= timer.endTime) {
          return { ...timer, status: "completed" as const };
        }
        return timer;
      });
    }
  } catch (error) {
    console.error("Error loading timers:", error);
  }
  return [];
}

// Save timers to localStorage
function saveTimers(timers: TimerItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
  } catch (error) {
    console.error("Error saving timers:", error);
  }
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

const manageTimer = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ToolResult<TimerToolData>> => {
  const { action, name, duration } = args;

  try {
    const timers = loadTimers();

    switch (action) {
      case "create": {
        if (!name || typeof name !== "string" || name.trim() === "") {
          return {
            message: "Cannot create timer: name is required",
            data: { timers, action },
            instructions: "Tell the user that a timer name is required.",
            updating: true,
          };
        }

        if (typeof duration !== "number" || duration <= 0) {
          return {
            message: "Cannot create timer: valid duration is required",
            data: { timers, action },
            instructions:
              "Tell the user that a valid duration in seconds is required (must be > 0).",
            updating: true,
          };
        }

        const now = Date.now();
        const newTimer: TimerItem = {
          id: `timer_${now}_${Math.random().toString(36).substr(2, 9)}`,
          name: name.trim(),
          duration,
          startTime: now,
          endTime: now + duration * 1000,
          status: "running",
        };

        timers.push(newTimer);
        saveTimers(timers);

        return {
          message: `Timer "${newTimer.name}" started for ${formatDuration(duration)}`,
          data: { timers, action },
          jsonData: {
            created: {
              name: newTimer.name,
              duration,
              endsAt: new Date(newTimer.endTime).toISOString(),
            },
            totalTimers: timers.length,
          },
          instructions: `Confirm to the user that timer "${newTimer.name}" has been started for ${formatDuration(duration)}.`,
          updating: true,
        };
      }

      case "list": {
        const runningTimers = timers.filter(
          (timer) => timer.status === "running",
        );
        const completedTimers = timers.filter(
          (timer) => timer.status === "completed",
        );

        return {
          message: `${timers.length} timer${timers.length !== 1 ? "s" : ""} (${runningTimers.length} running, ${completedTimers.length} completed)`,
          data: { timers, action },
          jsonData: {
            totalTimers: timers.length,
            running: runningTimers.map((t) => ({
              name: t.name,
              timeRemaining: Math.max(0, t.endTime - Date.now()) / 1000,
            })),
            completed: completedTimers.map((t) => ({ name: t.name })),
          },
          instructions:
            "Tell the user about their active and completed timers.",
          updating: true,
        };
      }

      case "cancel": {
        if (!name || typeof name !== "string") {
          return {
            message: "Cannot cancel timer: name is required",
            data: { timers, action },
            instructions:
              "Tell the user which timer they want to cancel by name.",
            updating: true,
          };
        }

        const indexToCancel = timers.findIndex(
          (timer) => timer.name.toLowerCase() === name.toLowerCase(),
        );

        if (indexToCancel === -1) {
          return {
            message: `Timer not found: "${name}"`,
            data: { timers, action },
            jsonData: {
              availableTimers: timers.map((t) => t.name),
            },
            instructions: `Tell the user that timer "${name}" was not found. Show them the current timers if helpful.`,
            updating: true,
          };
        }

        const cancelledTimer = timers[indexToCancel];
        timers.splice(indexToCancel, 1);
        saveTimers(timers);

        return {
          message: `Cancelled timer: "${cancelledTimer.name}"`,
          data: { timers, action },
          jsonData: {
            cancelled: cancelledTimer.name,
            totalTimers: timers.length,
          },
          instructions: `Confirm to the user that timer "${cancelledTimer.name}" has been cancelled.`,
          updating: true,
        };
      }

      case "clear_completed": {
        const completedTimers = timers.filter(
          (timer) => timer.status === "completed",
        );
        const remainingTimers = timers.filter(
          (timer) => timer.status !== "completed",
        );

        if (completedTimers.length === 0) {
          return {
            message: "No completed timers to clear",
            data: { timers, action },
            instructions:
              "Tell the user that there are no completed timers to clear.",
            updating: true,
          };
        }

        saveTimers(remainingTimers);

        return {
          message: `Cleared ${completedTimers.length} completed timer${completedTimers.length !== 1 ? "s" : ""}`,
          data: { timers: remainingTimers, action },
          jsonData: {
            clearedCount: completedTimers.length,
            totalTimers: remainingTimers.length,
          },
          instructions: `Confirm to the user that ${completedTimers.length} completed timer${completedTimers.length !== 1 ? "s have" : " has"} been cleared.`,
          updating: true,
        };
      }

      default:
        return {
          message: `Unknown action: ${action}`,
          data: { timers, action },
          instructions:
            "Tell the user that the action was not recognized. Valid actions are: create, list, cancel, clear_completed.",
          updating: true,
        };
    }
  } catch (error) {
    console.error("ERR: exception in manageTimer", error);
    return {
      message: `Timer error: ${error instanceof Error ? error.message : "Unknown error"}`,
      data: { timers: [], action },
      instructions: "Acknowledge that there was an error managing the timer.",
    };
  }
};

export const plugin: ToolPlugin<TimerToolData> = {
  toolDefinition,
  execute: manageTimer,
  generatingMessage: "Managing timer...",
  isEnabled: () => true,
  viewComponent: TimerView,
  previewComponent: TimerPreview,
  systemPrompt: `When users want to set a timer or track time for a task, use the ${toolName} function. Convert time descriptions to seconds (e.g., "5 minutes" = 300 seconds, "1 hour" = 3600 seconds).`,
};
