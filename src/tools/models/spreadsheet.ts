import { ToolPlugin, ToolContext, ToolResult } from "../types";
import SpreadsheetView from "../views/spreadsheet.vue";
import SpreadsheetPreview from "../previews/spreadsheet.vue";

const toolName = "presentSpreadsheet";

export type SpreadsheetCell =
  | string
  | number
  | { f: string; z: string } // Formulas must specify format
  | { v: any; z: string }; // Formatted value

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
          "Sheets to render as spreadsheet tabs. Each sheet includes a name and 2D array of cells (rows x columns).",
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
                "Rows of cells. Inputs should be plain numbers/strings; ALL calculations must be formulas with formats. Use Excel-style A1 notation in formulas: columns are letters (A, B, C...), rows are 1-based numbers (1, 2, 3...). Example row: ['Year', 'Revenue', 'Growth %'], [2024, 1500000, {\"f\": \"B2/B1-1\", \"z\": \"0.00%\"}]. Format codes (z): '$#,##0.00' (currency), '#,##0' (integer), '0.00%' (percent), '0.00' (decimal).",
              items: {
                type: "array",
                description:
                  "Row of cells. Each cell can be a primitive value, formula object, or formatted cell object.",
                items: {
                  oneOf: [
                    {
                      type: "string",
                      description:
                        "Text labels only (headers, categories). NOT for formulas or formatted numbers.",
                    },
                    {
                      type: "number",
                      description: "Raw numeric values (inputs only)",
                    },
                    {
                      type: "object",
                      description:
                        "Formula with required formatting - use for ALL calculations",
                      properties: {
                        f: {
                          type: "string",
                          description:
                            "Formula expression using Excel A1 notation (columns: A,B,C...; rows: 1,2,3...). Examples: 'B2*1.05', 'SUM(A1:A10)', 'C3/C2-1'",
                        },
                        z: {
                          type: "string",
                          description:
                            "Required number format code",
                        },
                      },
                      required: ["f", "z"],
                    },
                    {
                      type: "object",
                      description: "Formatted value with required format code",
                      properties: {
                        v: {
                          description: "Value (number, string, boolean)",
                        },
                        z: {
                          type: "string",
                          description: "Required number format code",
                        },
                      },
                      required: ["v", "z"],
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
  systemPrompt: `Use ${toolName} whenever the user needs a spreadsheet-style table, multi-step math, or dynamic what-if analysis—do not summarize in text. Build LIVE sheets: inputs stay raw numbers/labels, every calculation is a formula object {"f": "...", "z": "..."}. Never pre-calculate or format values yourself; let the spreadsheet compute using cell refs, functions (SUM, AVERAGE, IF, etc.), and arithmetic (A1*1.05). Standard formats: "$#,##0.00" currency, "#,##0" integer, "0.00%" percent, "0.00" decimal. If a number needs formatting but no formula, wrap it as {"v": value, "z": format}.`,
};
