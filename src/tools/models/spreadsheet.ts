import { ToolPlugin, ToolContext, ToolResult } from "../types";
import SpreadsheetView from "../views/spreadsheet.vue";
import SpreadsheetPreview from "../previews/spreadsheet.vue";

const toolName = "presentSpreadsheet";

export interface SpreadsheetCell {
  v: string | number; // Value - if string starts with "=", it's a formula
  f?: string; // Format code (e.g., "$#,##0.00", "0.00%", "#,##0")
}

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
                'Rows of cells. Each cell is an object with \'v\' (value) and \'f\' (format). Use Excel-style A1 notation in formulas: columns are letters (A, B, C...), rows are 1-based numbers (1, 2, 3...). Example: [{"v": "Year", "f": ""}, {"v": 2024, "f": "#,##0"}, {"v": "=B2*1.05", "f": "$#,##0.00"}]. Format codes: \'$#,##0.00\' (currency), \'#,##0\' (integer), \'0.00%\' (percent), \'0.00\' (decimal).',
              items: {
                type: "array",
                description:
                  "Row of cells. Each cell is an object with value and format.",
                items: {
                  type: "object",
                  description:
                    "Cell object with value and optional format. If value is a string starting with '=', it's treated as a formula.",
                  properties: {
                    v: {
                      oneOf: [{ type: "string" }, { type: "number" }],
                      description:
                        "Cell value. Can be text, number, or formula (string starting with '='). Examples: 'Revenue', 1500000, '=SUM(A1:A10)', '=B2/B1-1'",
                    },
                    f: {
                      type: "string",
                      description:
                        "Optional format code for displaying the value. Common formats: '$#,##0.00' (currency), '#,##0' (integer), '0.00%' (percent), '0.00' (decimal)",
                    },
                  },
                  required: ["v"],
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
        `Invalid sheets format: sheets must be an array, not a string. Parse error: ${error instanceof Error ? error.message : String(error)}`,
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
  systemPrompt: `Use ${toolName} whenever the user needs a spreadsheet-style table, multi-step math, or dynamic what-if analysis—do not summarize in text. Build LIVE sheets where every cell is an object {"v": value, "f": format}. For formulas, set "v" to a string starting with "=" (e.g., {"v": "=B2*1.05", "f": "$#,##0.00"}). Never pre-calculate; let the spreadsheet compute using cell refs, functions (SUM, AVERAGE, IF, etc.), and arithmetic. Standard formats: "$#,##0.00" currency, "#,##0" integer, "0.00%" percent, "0.00" decimal. Format is optional for plain text/numbers.`,
};
