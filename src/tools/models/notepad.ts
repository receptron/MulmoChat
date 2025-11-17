import { ToolPlugin, ToolContext, ToolResult } from "../types";
import NotepadView from "../views/notepad.vue";
import NotepadPreview from "../previews/notepad.vue";

const toolName = "manageNotes";
const STORAGE_KEY = "mulmo_notes";

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface NotepadToolData {
  notes: NoteItem[];
  currentNote?: NoteItem;
}

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Manage notes - create, view, update, or delete notes. Useful for storing information, ideas, or reminders.",
  parameters: {
    type: "object" as const,
    properties: {
      action: {
        type: "string",
        enum: ["create", "list", "view", "update", "delete"],
        description:
          "'create' adds a new note, 'list' shows all notes, 'view' shows a specific note, 'update' modifies a note, 'delete' removes a note",
      },
      title: {
        type: "string",
        description:
          "Note title (required for 'create', used to identify note for 'view'/'update'/'delete')",
      },
      content: {
        type: "string",
        description:
          "Note content (required for 'create', optional for 'update')",
      },
      newTitle: {
        type: "string",
        description: "New title for 'update' action (optional)",
      },
    },
    required: ["action"],
  },
};

// Load notes from localStorage
function loadNotes(): NoteItem[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Error loading notes:", error);
  }
  return [];
}

// Save notes to localStorage
function saveNotes(notes: NoteItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (error) {
    console.error("Error saving notes:", error);
  }
}

const manageNotes = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ToolResult<NotepadToolData>> => {
  const { action, title, content, newTitle } = args;

  try {
    const notes = loadNotes();

    switch (action) {
      case "create": {
        if (!title || typeof title !== "string" || title.trim() === "") {
          return {
            message: "Cannot create note: title is required",
            data: { notes },
            instructions: "Tell the user that a note title is required.",
            updating: true,
          };
        }

        if (!content || typeof content !== "string" || content.trim() === "") {
          return {
            message: "Cannot create note: content is required",
            data: { notes },
            instructions: "Tell the user that note content is required.",
            updating: true,
          };
        }

        const now = Date.now();
        const newNote: NoteItem = {
          id: `note_${now}_${Math.random().toString(36).substr(2, 9)}`,
          title: title.trim(),
          content: content.trim(),
          createdAt: now,
          updatedAt: now,
        };

        notes.push(newNote);
        saveNotes(notes);

        return {
          message: `Created note: "${newNote.title}"`,
          data: { notes, currentNote: newNote },
          jsonData: {
            created: {
              title: newNote.title,
              contentLength: newNote.content.length,
            },
            totalNotes: notes.length,
          },
          instructions: `Confirm to the user that note "${newNote.title}" has been created.`,
          updating: true,
        };
      }

      case "list": {
        return {
          message: `${notes.length} note${notes.length !== 1 ? "s" : ""} stored`,
          data: { notes },
          jsonData: {
            totalNotes: notes.length,
            notes: notes.map((note) => ({
              title: note.title,
              preview: note.content.substring(0, 100),
              createdAt: new Date(note.createdAt).toISOString(),
            })),
          },
          instructions: "Tell the user about their stored notes.",
          updating: true,
        };
      }

      case "view": {
        if (!title || typeof title !== "string") {
          return {
            message: "Cannot view note: title is required",
            data: { notes },
            instructions:
              "Tell the user which note they want to view by title.",
            updating: true,
          };
        }

        const note = notes.find(
          (n) => n.title.toLowerCase() === title.toLowerCase(),
        );

        if (!note) {
          return {
            message: `Note not found: "${title}"`,
            data: { notes },
            jsonData: {
              availableNotes: notes.map((n) => n.title),
            },
            instructions: `Tell the user that note "${title}" was not found. Show them the available notes if helpful.`,
            updating: true,
          };
        }

        return {
          message: `Viewing note: "${note.title}"`,
          data: { notes, currentNote: note },
          jsonData: {
            title: note.title,
            content: note.content,
            createdAt: new Date(note.createdAt).toISOString(),
            updatedAt: new Date(note.updatedAt).toISOString(),
          },
          instructions: `Show the user the content of note "${note.title}".`,
          updating: true,
        };
      }

      case "update": {
        if (!title || typeof title !== "string") {
          return {
            message:
              "Cannot update note: title is required to identify the note",
            data: { notes },
            instructions: "Tell the user which note they want to update.",
            updating: true,
          };
        }

        const note = notes.find(
          (n) => n.title.toLowerCase() === title.toLowerCase(),
        );

        if (!note) {
          return {
            message: `Note not found: "${title}"`,
            data: { notes },
            jsonData: {
              availableNotes: notes.map((n) => n.title),
            },
            instructions: `Tell the user that note "${title}" was not found. Show them the available notes if helpful.`,
            updating: true,
          };
        }

        let updated = false;
        const oldTitle = note.title;

        if (newTitle && typeof newTitle === "string" && newTitle.trim()) {
          note.title = newTitle.trim();
          updated = true;
        }

        if (content && typeof content === "string" && content.trim()) {
          note.content = content.trim();
          updated = true;
        }

        if (!updated) {
          return {
            message: "No updates provided",
            data: { notes, currentNote: note },
            instructions:
              "Tell the user that they need to provide either new content or a new title to update the note.",
            updating: true,
          };
        }

        note.updatedAt = Date.now();
        saveNotes(notes);

        const titleChange =
          oldTitle !== note.title ? ` (renamed from "${oldTitle}")` : "";

        return {
          message: `Updated note: "${note.title}"${titleChange}`,
          data: { notes, currentNote: note },
          jsonData: {
            title: note.title,
            oldTitle,
            updated: true,
          },
          instructions: `Confirm to the user that note "${note.title}" has been updated${titleChange}.`,
          updating: true,
        };
      }

      case "delete": {
        if (!title || typeof title !== "string") {
          return {
            message: "Cannot delete note: title is required",
            data: { notes },
            instructions:
              "Tell the user which note they want to delete by title.",
            updating: true,
          };
        }

        const indexToDelete = notes.findIndex(
          (n) => n.title.toLowerCase() === title.toLowerCase(),
        );

        if (indexToDelete === -1) {
          return {
            message: `Note not found: "${title}"`,
            data: { notes },
            jsonData: {
              availableNotes: notes.map((n) => n.title),
            },
            instructions: `Tell the user that note "${title}" was not found. Show them the available notes if helpful.`,
            updating: true,
          };
        }

        const deletedNote = notes[indexToDelete];
        notes.splice(indexToDelete, 1);
        saveNotes(notes);

        return {
          message: `Deleted note: "${deletedNote.title}"`,
          data: { notes },
          jsonData: {
            deleted: deletedNote.title,
            totalNotes: notes.length,
          },
          instructions: `Confirm to the user that note "${deletedNote.title}" has been deleted.`,
          updating: true,
        };
      }

      default:
        return {
          message: `Unknown action: ${action}`,
          data: { notes },
          instructions:
            "Tell the user that the action was not recognized. Valid actions are: create, list, view, update, delete.",
          updating: true,
        };
    }
  } catch (error) {
    console.error("ERR: exception in manageNotes", error);
    return {
      message: `Notes error: ${error instanceof Error ? error.message : "Unknown error"}`,
      data: { notes: [] },
      instructions: "Acknowledge that there was an error managing notes.",
    };
  }
};

export const plugin: ToolPlugin<NotepadToolData> = {
  toolDefinition,
  execute: manageNotes,
  generatingMessage: "Managing notes...",
  isEnabled: () => true,
  viewComponent: NotepadView,
  previewComponent: NotepadPreview,
  systemPrompt: `When users want to save information, create reminders, or store ideas for later, use the ${toolName} function to help them manage notes.`,
};
