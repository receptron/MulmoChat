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
                "2D array of cell data. CRITICAL: Formulas MUST be objects with 'f' property, NOT plain strings.\n" +
                "Cell format examples:\n" +
                "- Label/header: \"Year\" or \"Total\"\n" +
                "- Number input: 10000 or 0\n" +
                "- Formula (REQUIRED format): {\"f\": \"B2*1.03\"} or {\"f\": \"SUM(A1:A10)\"}\n" +
                "- Formatted number: {\"v\": 10000, \"z\": \"$#,##0.00\"}\n" +
                "- Formatted formula: {\"f\": \"B2*1.05\", \"z\": \"$#,##0.00\"}\n" +
                "WRONG: \"B2*1.03\" or \"$10,000\" (plain strings won't calculate)\n" +
                "RIGHT: {\"f\": \"B2*1.03\"} or {\"f\": \"B2*1.03\", \"z\": \"$#,##0.00\"}\n" +
                "Format codes (z): '$#,##0.00' (currency), '#,##0' (thousands), '0.00%' (percent)\n" +
                "Compound interest example: [{\"f\": \"B2*1.03\", \"z\": \"$#,##0.00\"}, {\"f\": \"C2*1.05\", \"z\": \"$#,##0.00\"}]",
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
  systemPrompt: `Call the ${toolName} API to display dynamic spreadsheets. CRITICAL FORMAT RULES: (1) Formulas MUST be JSON objects like {"f": "B2*1.03"}, NOT plain strings like "B2*1.03". (2) Use formulas for ALL calculations - NEVER hardcode results. (3) Use raw numbers for inputs: 10000 not "$10,000". Examples: Year 0 = [0, 10000, 10000, 10000], Year 1 = [1, {"f": "B2*1.03"}, {"f": "C2*1.05"}, {"f": "D2*1.07"}]. Add formatting: {"f": "B2*1.03", "z": "$#,##0.00"}. Supported formulas: cell refs (A1, B2), functions (SUM, AVERAGE, IF, MIN, MAX), arithmetic (A1*1.05, B2+C2), absolute refs ($A$1).`,
};
