import { ToolPlugin, ToolContext, ToolResult } from "../types";
import SpreadsheetView from "../views/spreadsheet.vue";
import SpreadsheetPreview from "../previews/spreadsheet.vue";

const toolName = "presentSpreadsheet";

export interface SpreadsheetSheet {
  name: string;
  data: Array<Array<string | number | { f: string }>>;
}

export interface SpreadsheetToolData {
  sheets: SpreadsheetSheet[];
}

const toolDefinition = {
  type: "function" as const,
  name: toolName,
  description:
    "Display an Excel-like spreadsheet with formulas and calculations.",
  parameters: {
    type: "object" as const,
    properties: {
      title: {
        type: "string",
        description: "Title for the spreadsheet",
      },
      sheets: {
        type: "array",
        description:
          "Array of sheets to display. Each sheet contains a name and 2D array of cell data.",
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Sheet name (e.g., 'Sales Q1', 'Summary')",
            },
            data: {
              type: "array",
              description:
                "2D array of cell data. Each cell can be a string, number, or formula object. For formulas, use format: {f: 'SUM(A1:A10)'} or {f: 'B2+C2'}. Examples of valid formulas: SUM(A1:A10), AVERAGE(B2:B5), A1+B1, (A1+B1)/2, MAX(C1:C10), MIN(D1:D5), COUNT(E1:E10).",
              items: {
                type: "array",
                description:
                  "Row of cells. Each cell is either a primitive value or a formula object.",
              },
            },
          },
          required: ["name", "data"],
        },
      },
    },
    required: ["title", "sheets"],
  },
};

const presentSpreadsheet = async (
  context: ToolContext,
  args: Record<string, any>,
): Promise<ToolResult<SpreadsheetToolData>> => {
  const title = args.title as string;
  const sheets = args.sheets as SpreadsheetSheet[];

  // Validate that sheets are provided
  if (!sheets || sheets.length === 0) {
    throw new Error("At least one sheet is required");
  }

  // Validate each sheet has data
  for (const sheet of sheets) {
    if (!sheet.name || !sheet.data || sheet.data.length === 0) {
      throw new Error(
        `Invalid sheet: ${sheet.name || "unnamed"}. Each sheet must have a name and data.`,
      );
    }
  }

  return {
    message: `Created spreadsheet: ${title}`,
    title,
    data: { sheets },
    instructions:
      "Acknowledge that the spreadsheet has been created and is displayed to the user.",
  };
};

export const plugin: ToolPlugin = {
  toolDefinition,
  execute: presentSpreadsheet,
  generatingMessage: "Creating spreadsheet...",
  waitingMessage:
    "Tell the user that the spreadsheet was created and will be presented shortly.",
  isEnabled: () => true,
  viewComponent: SpreadsheetView,
  previewComponent: SpreadsheetPreview,
  systemPrompt: `Call the ${toolName} API to display spreadsheets with tabular data and formulas. Use Excel-style formulas like SUM, AVERAGE, cell references (A1, B2), and arithmetic operations.`,
};
