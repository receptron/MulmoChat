import { ToolPlugin, ToolContext, ToolResult } from "../types";
import SpreadsheetView from "../views/spreadsheet.vue";
import SpreadsheetPreview from "../previews/spreadsheet.vue";

const toolName = "presentSpreadsheet";

export type SpreadsheetCell =
  | string
  | number
  | { f: string; z?: string } // Formula with optional format
  | { v: any; z?: string }; // Value with optional format

export interface SpreadsheetSheet {
  name: string;
  data: Array<Array<SpreadsheetCell>>;
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
                "2D array of cell data. Each cell can be:\n" +
                "- Simple value: 'text' or 123\n" +
                "- Formula: {f: 'SUM(A1:A10)'}\n" +
                "- Formatted value: {v: 1000000, z: '$#,##0.00'}\n" +
                "- Formatted formula: {f: 'SUM(A1:A10)', z: '$#,##0.00'}\n" +
                "Common format codes (z):\n" +
                "- Currency: '$#,##0.00' or '\"$\"#,##0'\n" +
                "- Thousands separator: '#,##0'\n" +
                "- Percentage: '0.00%'\n" +
                "- Decimal places: '0.00' or '0.000'\n" +
                "- Date: 'yyyy-mm-dd' or 'mm/dd/yyyy'\n" +
                "Examples: {v: 1500000, z: '$#,##0'} displays as $1,500,000",
              items: {
                type: "array",
                description:
                  "Row of cells. Each cell can be a primitive value, formula object, or formatted cell object.",
                items: {
                  oneOf: [
                    { type: "string", description: "Plain Text" },
                    { type: "number" },
                    {
                      type: "object",
                      properties: {
                        f: {
                          type: "string",
                          description:
                            "Formula, such as 'B2*1.05' or 'SUM(A1:A10)'",
                        },
                        z: {
                          type: "string",
                          description: "Number format code",
                        },
                      },
                      required: ["f"],
                    },
                    {
                      type: "object",
                      properties: {
                        v: { description: "Value" },
                        z: {
                          type: "string",
                          description: "Number format code",
                        },
                      },
                      required: ["v"],
                    },
                  ],
                },
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
  let sheets = args.sheets;

  // Handle case where LLM accidentally stringifies the sheets array
  if (typeof sheets === "string") {
    try {
      sheets = JSON.parse(sheets);
      console.warn(
        "Sheets was provided as a string and has been parsed to an array",
      );
    } catch (error) {
      throw new Error(
        "Invalid sheets format: sheets must be an array, not a string. If you're seeing this error, the LLM may have accidentally stringified the data.",
      );
    }
  }

  // Validate that sheets are provided
  if (!Array.isArray(sheets) || sheets.length === 0) {
    throw new Error(
      "At least one sheet is required. Sheets must be an array of sheet objects.",
    );
  }

  // Validate each sheet has data
  for (const sheet of sheets) {
    if (!sheet.name || !sheet.data || sheet.data.length === 0) {
      throw new Error(
        `Invalid sheet: ${sheet.name || "unnamed"}. Each sheet must have a name and data array.`,
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
  systemPrompt: `Call the ${toolName} API to display spreadsheets with tabular data and formulas. Use Excel-style formulas like SUM, AVERAGE, cell references (A1, B2), and arithmetic operations. For better presentation, apply number formatting to cells: use {v: 1000000, z: '$#,##0'} for currency ($1,000,000), {v: 0.85, z: '0.00%'} for percentages (85.00%), or {f: 'SUM(A1:A10)', z: '#,##0'} for formatted formulas (1,234).`,
};
