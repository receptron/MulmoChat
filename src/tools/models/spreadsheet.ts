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
                "2D array of cell data. CRITICAL: All formulas MUST include both 'f' and 'z' properties.\n" +
                "Cell format examples:\n" +
                "- Label/header: \"Year\" or \"Total\"\n" +
                "- Number input: 10000 or 0\n" +
                "- Formula (REQUIRED): {\"f\": \"B2*1.03\", \"z\": \"$#,##0.00\"}\n" +
                "- Formatted value: {\"v\": 10000, \"z\": \"$#,##0.00\"}\n" +
                "WRONG: \"B2*1.03\" (plain string) or {\"f\": \"B2*1.03\"} (missing z)\n" +
                "RIGHT: {\"f\": \"B2*1.03\", \"z\": \"$#,##0.00\"}\n" +
                "Format codes (z): '$#,##0.00' (currency), '#,##0' (integer), '0.00%' (percent), '0.00' (decimal)\n" +
                "Example: [{\"f\": \"B2*1.03\", \"z\": \"$#,##0.00\"}, {\"f\": \"C2*1.05\", \"z\": \"$#,##0.00\"}]",
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
                            "Formula expression (e.g., 'B2*1.05', 'SUM(A1:A10)')",
                        },
                        z: {
                          type: "string",
                          description:
                            "REQUIRED number format: '$#,##0.00' (currency), '#,##0' (integer), '0.00%' (percent), '0.00' (decimal)",
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
                          description: "REQUIRED number format code",
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
  systemPrompt: `Call the ${toolName} API to display dynamic spreadsheets. CRITICAL: ALL formulas MUST include BOTH "f" (formula) and "z" (format) properties. Format: {"f": "B2*1.03", "z": "$#,##0.00"}. Rules: (1) Formulas MUST be objects {"f": "...", "z": "..."}, NOT strings. (2) Use formulas for calculations, NEVER hardcode. (3) Raw numbers for inputs: 10000 not "$10,000". Example: [0, 10000, 10000], [1, {"f": "B2*1.03", "z": "$#,##0.00"}, {"f": "C2*1.05", "z": "$#,##0.00"}]. Common formats: "$#,##0.00" (currency), "#,##0" (integer), "0.00%" (percent). Supported: cell refs (A1), functions (SUM, AVERAGE, IF), arithmetic (A1*1.05).`,
};
