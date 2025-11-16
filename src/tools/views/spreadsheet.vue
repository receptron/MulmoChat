<template>
  <div class="spreadsheet-container">
    <div
      v-if="
        !selectedResult.data?.sheets || selectedResult.data.sheets.length === 0
      "
      class="min-h-full p-8 flex items-center justify-center"
    >
      <div class="text-gray-500">No spreadsheet data available</div>
    </div>
    <template v-else>
      <div class="spreadsheet-content-wrapper">
        <div class="p-4">
          <div class="header">
            <h1 class="title">
              {{ selectedResult.title || "Spreadsheet" }}
            </h1>
            <div class="button-group">
              <button @click="downloadExcel" class="download-btn excel-btn">
                <span class="material-icons">download</span>
                Excel
              </button>
            </div>
          </div>

          <!-- Sheet tabs (if multiple sheets) -->
          <div v-if="selectedResult.data.sheets.length > 1" class="sheet-tabs">
            <button
              v-for="(sheet, index) in selectedResult.data.sheets"
              :key="index"
              @click="activeSheetIndex = index"
              :class="['sheet-tab', { active: activeSheetIndex === index }]"
            >
              {{ sheet.name }}
            </button>
          </div>

          <!-- Spreadsheet table -->
          <div
            ref="tableContainer"
            class="table-container"
            v-html="renderedHtml"
            @click="handleTableClick"
          ></div>
        </div>
      </div>

      <!-- Collapsible Editor -->
      <details
        v-if="!miniEditorOpen"
        ref="editorDetails"
        class="spreadsheet-source"
      >
        <summary>Edit Spreadsheet Data</summary>
        <textarea
          ref="editorTextarea"
          v-model="editableData"
          @input="handleDataEdit"
          class="spreadsheet-editor"
          spellcheck="false"
        ></textarea>
        <button @click="applyChanges" class="apply-btn" :disabled="!hasChanges">
          Apply Changes
        </button>
      </details>

      <!-- Mini Editor at Bottom -->
      <div v-if="miniEditorOpen" class="mini-editor-panel">
        <div class="mini-editor-content">
          <span v-if="miniEditorCell" class="cell-ref">
            {{ indexToCol(miniEditorCell.col) }}{{ miniEditorCell.row + 1 }}
          </span>

          <!-- Type Selector -->
          <div class="radio-group">
            <label class="radio-option">
              <input type="radio" value="string" v-model="miniEditorType" />
              String
            </label>
            <label class="radio-option">
              <input type="radio" value="object" v-model="miniEditorType" />
              Formula
            </label>
          </div>

          <!-- String input -->
          <input
            v-if="miniEditorType === 'string'"
            type="text"
            v-model="miniEditorValue"
            class="form-input"
            placeholder="Value"
            @keyup.enter="saveMiniEditor"
          />

          <!-- Formula inputs -->
          <template v-if="miniEditorType === 'object'">
            <input
              type="text"
              v-model="miniEditorFormula"
              class="form-input"
              placeholder="Value or Formula (e.g., 100 or SUM(B2:B11))"
              @keyup.enter="saveMiniEditor"
            />
            <input
              type="text"
              v-model="miniEditorFormat"
              class="form-input"
              placeholder="Format (e.g., $#,##0.00)"
              @keyup.enter="saveMiniEditor"
            />
          </template>

          <button @click="saveMiniEditor" class="save-btn">Save</button>
          <button @click="closeMiniEditor" class="cancel-btn">✕</button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import * as XLSX from "xlsx";
import type { ToolResult } from "../types";
import type { SpreadsheetToolData } from "../models/spreadsheet";

const props = defineProps<{
  selectedResult: ToolResult<SpreadsheetToolData>;
}>();

const emit = defineEmits<{
  updateResult: [result: ToolResult];
}>();

const activeSheetIndex = ref(0);
const editableData = ref(
  JSON.stringify(props.selectedResult.data?.sheets || [], null, 2),
);
const editorTextarea = ref<HTMLTextAreaElement | null>(null);
const editorDetails = ref<HTMLDetailsElement | null>(null);
const tableContainer = ref<HTMLDivElement | null>(null);

// Mini editor state
const miniEditorOpen = ref(false);
const miniEditorCell = ref<{ row: number; col: number } | null>(null);
const miniEditorValue = ref<any>(null);
const miniEditorType = ref<"number" | "string" | "object">("string");
const miniEditorFormula = ref("");
const miniEditorFormat = ref("");

// Check if spreadsheet data has been modified
const hasChanges = computed(() => {
  try {
    const currentData = JSON.stringify(
      props.selectedResult.data?.sheets || [],
      null,
      2,
    );
    return editableData.value !== currentData;
  } catch {
    return false;
  }
});

// Helper to format a number according to Excel format code
const formatNumber = (value: number, format: string): string => {
  if (!format) return value.toString();

  try {
    // Handle currency formats
    if (format.includes("$")) {
      const decimals = (format.match(/\.0+/) || [""])[0].length - 1;
      const hasComma = format.includes(",");

      let formatted = Math.abs(value).toFixed(decimals >= 0 ? decimals : 0);
      if (hasComma) {
        formatted = formatted.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      }
      formatted = "$" + formatted;
      if (value < 0) formatted = "-" + formatted;
      return formatted;
    }

    // Handle percentage
    if (format.includes("%")) {
      const decimals = (format.match(/\.0+/) || [""])[0].length - 1;
      return (value * 100).toFixed(decimals >= 0 ? decimals : 2) + "%";
    }

    // Handle comma separator
    if (format.includes(",")) {
      const decimals = (format.match(/\.0+/) || [""])[0].length - 1;
      let formatted = Math.abs(value).toFixed(decimals >= 0 ? decimals : 0);
      formatted = formatted.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      if (value < 0) formatted = "-" + formatted;
      return formatted;
    }

    // Handle decimal places
    const decimals = (format.match(/\.0+/) || [""])[0].length - 1;
    if (decimals >= 0) {
      return value.toFixed(decimals);
    }

    return value.toString();
  } catch (error) {
    console.error("Format error:", error);
    return value.toString();
  }
};

// Helper to convert Excel column letters to 0-based index (A=0, Z=25, AA=26, etc.)
const colToIndex = (col: string): number => {
  let result = 0;
  for (let i = 0; i < col.length; i++) {
    result = result * 26 + (col.charCodeAt(i) - 64); // A=1, B=2, etc.
  }
  return result - 1; // Convert to 0-based
};

// Helper to convert 0-based index to Excel column letters (0=A, 25=Z, 26=AA, etc.)
const indexToCol = (index: number): string => {
  let col = "";
  let num = index + 1; // Convert to 1-based
  while (num > 0) {
    const remainder = (num - 1) % 26;
    col = String.fromCharCode(65 + remainder) + col;
    num = Math.floor((num - 1) / 26);
  }
  return col;
};

// Calculate formulas in the data
const calculateFormulas = (data: Array<Array<any>>): Array<Array<any>> => {
  // Create a copy of the data with calculated values
  const calculated = data.map((row) => [...row]);

  // Helper to extract raw value from cell
  const getRawValue = (cell: any): number => {
    if (typeof cell === "number") return cell;

    // Handle string values
    if (typeof cell === "string") {
      // Handle percentage strings like "5%" or "0.4167%"
      if (cell.includes("%")) {
        const numericPart = cell.replace("%", "").trim();
        const value = parseFloat(numericPart);
        return isNaN(value) ? 0 : value / 100;
      }
      // Handle currency strings like "$1,000" or "$1,000.00"
      if (cell.includes("$")) {
        const numericPart = cell.replace(/[$,]/g, "").trim();
        const value = parseFloat(numericPart);
        return isNaN(value) ? 0 : value;
      }
      // Handle comma-separated numbers like "1,000"
      if (cell.includes(",")) {
        const numericPart = cell.replace(/,/g, "").trim();
        const value = parseFloat(numericPart);
        return isNaN(value) ? 0 : value;
      }
      // Handle regular numeric strings
      return parseFloat(cell) || 0;
    }

    if (typeof cell === "object" && cell !== null) {
      if ("v" in cell) return parseFloat(cell.v) || 0;
      if ("f" in cell) return 0; // Will be calculated later
    }
    return parseFloat(cell) || 0;
  };

  // Helper to get cell value by reference (e.g., "B2" or "$B$2")
  const getCellValue = (ref: string): number => {
    // Remove $ symbols for absolute references
    const cleanRef = ref.replace(/\$/g, "");
    const match = cleanRef.match(/^([A-Z]+)(\d+)$/);
    if (!match) return 0;

    const col = colToIndex(match[1]); // A=0, B=1, ..., Z=25, AA=26, etc.
    const row = parseInt(match[2]) - 1; // 1-indexed to 0-indexed

    if (
      row < 0 ||
      row >= calculated.length ||
      col < 0 ||
      col >= calculated[row].length
    ) {
      return 0;
    }

    const cell = calculated[row][col];
    return getRawValue(cell);
  };

  // Helper to get range values (e.g., "B2:B11")
  const getRangeValues = (range: string): number[] => {
    const match = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (!match) return [];

    const startCol = colToIndex(match[1]);
    const startRow = parseInt(match[2]) - 1;
    const endCol = colToIndex(match[3]);
    const endRow = parseInt(match[4]) - 1;

    const values: number[] = [];
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        if (
          row >= 0 &&
          row < calculated.length &&
          col >= 0 &&
          col < calculated[row].length
        ) {
          const cell = calculated[row][col];
          const num = getRawValue(cell);
          if (!isNaN(num)) values.push(num);
        }
      }
    }
    return values;
  };

  // Helper to parse function arguments, handling nested functions and quoted strings
  const parseFunctionArgs = (argsStr: string): string[] => {
    const args: string[] = [];
    let currentArg = "";
    let depth = 0;
    let inString = false;
    let stringChar = "";

    for (let i = 0; i < argsStr.length; i++) {
      const char = argsStr[i];
      const prevChar = i > 0 ? argsStr[i - 1] : "";

      // Handle string boundaries
      if ((char === '"' || char === "'") && prevChar !== "\\") {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = "";
        }
        currentArg += char;
        continue;
      }

      // Track parentheses depth (for nested functions)
      if (!inString) {
        if (char === "(") depth++;
        if (char === ")") depth--;

        // Split on comma only at depth 0 and not in string
        if (char === "," && depth === 0) {
          args.push(currentArg.trim());
          currentArg = "";
          continue;
        }
      }

      currentArg += char;
    }

    if (currentArg.trim()) {
      args.push(currentArg.trim());
    }

    return args;
  };

  // Evaluate a formula
  const evaluateFormula = (formula: string): number | string => {
    try {
      // Handle IF function
      if (formula.match(/^IF\(/i)) {
        const argsMatch = formula.match(/^IF\((.+)\)$/i);
        if (argsMatch) {
          const args = parseFunctionArgs(argsMatch[1]);
          if (args.length === 3) {
            const condition = args[0];
            const trueValue = args[1];
            const falseValue = args[2];

            // Evaluate condition
            let conditionResult = false;

            // Replace cell references in condition
            let condExpr = condition;
            const cellRefs = condition.match(/\$?[A-Z]+\$?\d+/g);
            if (cellRefs) {
              for (const ref of cellRefs) {
                const value = getCellValue(ref);
                const escapedRef = ref.replace(/\$/g, "\\$");
                condExpr = condExpr.replace(
                  new RegExp(escapedRef, "g"),
                  value.toString(),
                );
              }
            }

            // Evaluate comparison operators
            if (/>=|<=|>|<|==|!=/.test(condExpr)) {
              conditionResult = eval(condExpr);
            } else {
              // Just evaluate as expression
              conditionResult = !!eval(condExpr);
            }

            // Return the appropriate value based on condition
            const resultValue = conditionResult ? trueValue : falseValue;

            // If result is a quoted string, return the string without quotes
            if (/^["'](.*)["']$/.test(resultValue)) {
              return resultValue.slice(1, -1);
            }

            // If result is a nested formula, evaluate it recursively
            if (/^(SUM|AVERAGE|MAX|MIN|COUNT|IF)\(/i.test(resultValue)) {
              return evaluateFormula(resultValue);
            }

            // Otherwise evaluate as expression
            let expr = resultValue;
            const refs = resultValue.match(/\$?[A-Z]+\$?\d+/g);
            if (refs) {
              for (const ref of refs) {
                const value = getCellValue(ref);
                const escapedRef = ref.replace(/\$/g, "\\$");
                expr = expr.replace(
                  new RegExp(escapedRef, "g"),
                  value.toString(),
                );
              }
            }

            const numResult = parseFloat(expr);
            return isNaN(numResult) ? expr : numResult;
          }
        }
      }

      // Handle SUM function
      if (formula.match(/^SUM\(/i)) {
        const rangeMatch = formula.match(/SUM\(([^)]+)\)/i);
        if (rangeMatch) {
          const values = getRangeValues(rangeMatch[1]);
          return values.reduce((sum, val) => sum + val, 0);
        }
      }

      // Handle AVERAGE function
      if (formula.match(/^AVERAGE\(/i)) {
        const rangeMatch = formula.match(/AVERAGE\(([^)]+)\)/i);
        if (rangeMatch) {
          const values = getRangeValues(rangeMatch[1]);
          return values.length > 0
            ? values.reduce((sum, val) => sum + val, 0) / values.length
            : 0;
        }
      }

      // Handle MAX function
      if (formula.match(/^MAX\(/i)) {
        const rangeMatch = formula.match(/MAX\(([^)]+)\)/i);
        if (rangeMatch) {
          const values = getRangeValues(rangeMatch[1]);
          return values.length > 0 ? Math.max(...values) : 0;
        }
      }

      // Handle MIN function
      if (formula.match(/^MIN\(/i)) {
        const rangeMatch = formula.match(/MIN\(([^)]+)\)/i);
        if (rangeMatch) {
          const values = getRangeValues(rangeMatch[1]);
          return values.length > 0 ? Math.min(...values) : 0;
        }
      }

      // Handle COUNT function
      if (formula.match(/^COUNT\(/i)) {
        const rangeMatch = formula.match(/COUNT\(([^)]+)\)/i);
        if (rangeMatch) {
          const values = getRangeValues(rangeMatch[1]);
          return values.length;
        }
      }

      // Handle simple arithmetic expressions with cell references
      // Replace cell references with their values
      let expr = formula;
      // Match cell references including absolute references like $B$4
      const cellRefs = formula.match(/\$?[A-Z]+\$?\d+/g);
      if (cellRefs) {
        for (const ref of cellRefs) {
          const value = getCellValue(ref);
          // Escape $ symbols in regex
          const escapedRef = ref.replace(/\$/g, "\\$");
          expr = expr.replace(new RegExp(escapedRef, "g"), value.toString());
        }
      }

      // Replace ^ with ** for exponentiation
      expr = expr.replace(/\^/g, "**");

      // Safely evaluate the expression
      // Allow numbers, operators, parentheses, whitespace, and decimal points
      if (/^[\d+\-*/(). ]+$/.test(expr)) {
        return eval(expr);
      }

      return formula; // Return original if can't evaluate
    } catch (error) {
      console.error(`Failed to evaluate formula: ${formula}`, error);
      return formula;
    }
  };

  // Process all cells and calculate formulas
  for (let rowIdx = 0; rowIdx < calculated.length; rowIdx++) {
    for (let colIdx = 0; colIdx < calculated[rowIdx].length; colIdx++) {
      const cell = calculated[rowIdx][colIdx];

      if (cell && typeof cell === "object") {
        // Handle formula cells
        if ("f" in cell) {
          const result = evaluateFormula(cell.f);
          // Apply formatting if specified
          if ("z" in cell && cell.z && typeof result === "number") {
            calculated[rowIdx][colIdx] = formatNumber(result, cell.z);
          } else {
            calculated[rowIdx][colIdx] = result;
          }
        }
        // Handle value cells with formatting
        else if ("v" in cell) {
          const value = cell.v;
          if ("z" in cell && cell.z && typeof value === "number") {
            calculated[rowIdx][colIdx] = formatNumber(value, cell.z);
          } else {
            calculated[rowIdx][colIdx] = value;
          }
        }
      }
    }
  }

  return calculated;
};

// Render the active sheet as HTML table
const renderedHtml = computed(() => {
  if (
    !props.selectedResult.data?.sheets ||
    props.selectedResult.data.sheets.length === 0
  ) {
    return "";
  }

  const sheet = props.selectedResult.data.sheets[activeSheetIndex.value];
  if (!sheet || !sheet.data) {
    return "";
  }

  try {
    // Calculate formulas first
    const calculatedData = calculateFormulas(sheet.data);

    // Convert data array to worksheet
    const worksheet = XLSX.utils.aoa_to_sheet(calculatedData);

    // Generate HTML table
    const html = XLSX.utils.sheet_to_html(worksheet, {
      id: "spreadsheet-table",
      editable: false,
    });

    return html;
  } catch (error) {
    console.error("Failed to render spreadsheet:", error);
    return `<div class="error">Failed to render spreadsheet: ${error instanceof Error ? error.message : "Unknown error"}</div>`;
  }
});

// Download as Excel file
const downloadExcel = () => {
  if (!props.selectedResult?.data?.sheets) return;

  try {
    const workbook = XLSX.utils.book_new();

    // Add all sheets to workbook
    props.selectedResult.data.sheets.forEach((sheet) => {
      const worksheet = XLSX.utils.aoa_to_sheet(sheet.data);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheet.name);
    });

    // Generate filename
    const filename = props.selectedResult.title
      ? `${props.selectedResult.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.xlsx`
      : "spreadsheet.xlsx";

    // Write file
    XLSX.writeFile(workbook, filename);
  } catch (error) {
    console.error("Failed to download Excel:", error);
    alert(
      `Failed to download Excel file: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

function handleDataEdit() {
  // Just update the local state, don't apply yet
  // User needs to click "Apply Changes" button
}

function openMiniEditor(rowIndex: number, colIndex: number) {
  try {
    const sheets = JSON.parse(editableData.value);
    const currentSheet = sheets[activeSheetIndex.value];

    if (
      !currentSheet ||
      !currentSheet.data ||
      !currentSheet.data[rowIndex] ||
      currentSheet.data[rowIndex][colIndex] === undefined
    ) {
      return;
    }

    const cellValue = currentSheet.data[rowIndex][colIndex];

    // Determine cell type and extract values
    if (typeof cellValue === "object" && cellValue !== null) {
      miniEditorType.value = "object";
      miniEditorValue.value = "";
      // Prefer formula over value for the combined input
      miniEditorFormula.value = cellValue.f ?? cellValue.v ?? "";
      miniEditorFormat.value = cellValue.z ?? "";
    } else if (typeof cellValue === "number") {
      miniEditorType.value = "object";
      miniEditorValue.value = "";
      miniEditorFormula.value = String(cellValue);
      miniEditorFormat.value = "";
    } else {
      miniEditorType.value = "string";
      miniEditorValue.value = cellValue ?? "";
      miniEditorFormula.value = "";
      miniEditorFormat.value = "";
    }

    miniEditorCell.value = { row: rowIndex, col: colIndex };
    miniEditorOpen.value = true;
  } catch (error) {
    console.error("Failed to open mini editor:", error);
  }
}

function closeMiniEditor() {
  miniEditorOpen.value = false;
  miniEditorCell.value = null;
  miniEditorValue.value = null;
  miniEditorFormula.value = "";
  miniEditorFormat.value = "";
}

function saveMiniEditor() {
  if (!miniEditorCell.value) return;

  try {
    const sheets = JSON.parse(editableData.value);
    const currentSheet = sheets[activeSheetIndex.value];

    if (!currentSheet || !currentSheet.data) return;

    const { row, col } = miniEditorCell.value;

    // Ensure the row exists
    while (currentSheet.data.length <= row) {
      currentSheet.data.push([]);
    }

    // Build the new cell value based on type
    let newCellValue: any;
    if (miniEditorType.value === "string") {
      newCellValue = String(miniEditorValue.value);
    } else {
      // object type (Formula)
      const input = miniEditorFormula.value?.trim() || "";

      // Detect if it's a formula by checking for:
      // 1. Function names (SUM, AVERAGE, MAX, MIN, COUNT, IF)
      // 2. Cell references with operators (A1+B1, etc.)
      // 3. Arithmetic expressions with operators (6/100, 5*2, etc.)
      const isFormula =
        /^(SUM|AVERAGE|MAX|MIN|COUNT|IF)\s*\(/i.test(input) ||
        /[A-Z]+\d+\s*[\+\-\*\/\^]/.test(input) ||
        /\d+\s*[\+\-\*\/\^]\s*\d+/.test(input);

      newCellValue = {};
      if (isFormula) {
        newCellValue.f = input;
      } else if (input !== "") {
        const numValue = parseFloat(input);
        newCellValue.v = isNaN(numValue) ? input : numValue;
      }
      if (miniEditorFormat.value) {
        newCellValue.z = miniEditorFormat.value;
      }
    }

    // Update the cell
    currentSheet.data[row][col] = newCellValue;

    // Update editableData
    editableData.value = JSON.stringify(sheets, null, 2);

    // Apply changes immediately
    const updatedResult: ToolResult<SpreadsheetToolData> = {
      ...props.selectedResult,
      data: {
        ...props.selectedResult.data,
        sheets: sheets,
      },
    };

    emit("updateResult", updatedResult);

    closeMiniEditor();
  } catch (error) {
    alert(
      `Failed to save cell: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

function handleTableClick(event: MouseEvent) {
  const target = event.target as HTMLElement;

  // Check if clicked element is a table cell
  if (target.tagName !== "TD") return;

  // Get the row and column indices
  const cell = target as HTMLTableCellElement;
  const row = cell.parentElement as HTMLTableRowElement;

  const colIndex = cell.cellIndex;
  const rowIndex = row.rowIndex;

  // Check if the main editor details is open
  const isEditorOpen = editorDetails.value?.open ?? false;

  // If editor is closed, open mini editor
  if (!isEditorOpen) {
    openMiniEditor(rowIndex, colIndex);
    return;
  }

  // If editor is open, try to find and select this cell in the editor
  if (editorTextarea.value) {
    try {
      const sheets = JSON.parse(editableData.value);
      const currentSheet = sheets[activeSheetIndex.value];

      if (
        currentSheet &&
        currentSheet.data &&
        currentSheet.data[rowIndex] &&
        currentSheet.data[rowIndex][colIndex] !== undefined
      ) {
        const cellValue = currentSheet.data[rowIndex][colIndex];
        const cellStr = JSON.stringify(cellValue);

        // Find the sheet's data section in the editor
        const sheetStartMarker = `"name": "${currentSheet.name}"`;
        const dataStartMarker = `"data": [`;

        let searchPos = editableData.value.indexOf(sheetStartMarker);
        if (searchPos >= 0) {
          searchPos = editableData.value.indexOf(dataStartMarker, searchPos);
          if (searchPos >= 0) {
            // Now navigate through the formatted JSON to find the target row and cell
            let currentRow = -1;
            let pos = searchPos + dataStartMarker.length;

            // Find the target row by counting opening brackets
            while (pos < editableData.value.length && currentRow < rowIndex) {
              const char = editableData.value[pos];
              if (char === "[") {
                currentRow++;
                if (currentRow === rowIndex) {
                  // Found our target row - now find the colIndex-th cell
                  let currentCol = 0;
                  let cellStart = -1;
                  let inString = false;
                  let inObject = 0;
                  let bracketDepth = 0;

                  for (let i = pos; i < editableData.value.length; i++) {
                    const c = editableData.value[i];
                    const prevChar = i > 0 ? editableData.value[i - 1] : "";

                    // Track string boundaries
                    if (c === '"' && prevChar !== "\\") {
                      inString = !inString;
                    }

                    if (!inString) {
                      // Track bracket depth to know when we exit this row
                      if (c === "[") bracketDepth++;
                      if (c === "]") {
                        bracketDepth--;
                        if (bracketDepth === 0) break; // End of row
                      }

                      // Track object depth
                      if (c === "{") inObject++;
                      if (c === "}") inObject--;

                      // Count cells by top-level commas
                      if (c === "," && inObject === 0 && bracketDepth === 1) {
                        currentCol++;
                      }
                    }

                    // Find the start of our target cell
                    if (currentCol === colIndex && cellStart === -1) {
                      // Skip whitespace and opening bracket/comma
                      if (
                        c !== " " &&
                        c !== "\n" &&
                        c !== "\t" &&
                        c !== "[" &&
                        c !== ","
                      ) {
                        cellStart = i;
                        break;
                      }
                    }
                  }

                  if (cellStart >= 0) {
                    editorTextarea.value.focus();
                    editorTextarea.value.setSelectionRange(
                      cellStart,
                      cellStart + cellStr.length,
                    );

                    // Scroll the textarea to make the selection visible
                    const textBeforeSelection = editableData.value.substring(
                      0,
                      cellStart,
                    );
                    const lineNumber = textBeforeSelection.split("\n").length;
                    const lineHeight = 22;
                    const textarea = editorTextarea.value;
                    textarea.scrollTop = Math.max(
                      0,
                      lineNumber * lineHeight - textarea.clientHeight / 2,
                    );
                  }
                  break;
                }
              }
              pos++;
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to select cell in editor:", error);
    }
  }
}

function applyChanges() {
  try {
    // Parse the edited JSON
    const parsedSheets = JSON.parse(editableData.value);

    // Validate it's an array
    if (!Array.isArray(parsedSheets)) {
      throw new Error("Data must be an array of sheets");
    }

    // Update the result with new spreadsheet data
    const updatedResult: ToolResult<SpreadsheetToolData> = {
      ...props.selectedResult,
      data: {
        ...props.selectedResult.data,
        sheets: parsedSheets,
      },
    };

    emit("updateResult", updatedResult);

    // Reset to first sheet after update
    activeSheetIndex.value = 0;
  } catch (error) {
    alert(
      `Invalid JSON format: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

// Watch for external changes to selectedResult
watch(
  () => props.selectedResult.data?.sheets,
  (newSheets) => {
    editableData.value = JSON.stringify(newSheets || [], null, 2);
    // Reset to first sheet when result changes
    activeSheetIndex.value = 0;
  },
);

// Reset active sheet if it's out of bounds
watch(
  () => props.selectedResult.data?.sheets?.length,
  (length) => {
    if (length && activeSheetIndex.value >= length) {
      activeSheetIndex.value = 0;
    }
  },
);

// Highlight selected cell when mini editor is open
watch(
  [miniEditorOpen, miniEditorCell, renderedHtml],
  () => {
    // Remove previous highlight
    const prevHighlighted =
      tableContainer.value?.querySelector(".cell-editing");
    if (prevHighlighted) {
      prevHighlighted.classList.remove("cell-editing");
    }

    // Add highlight to selected cell
    if (miniEditorOpen.value && miniEditorCell.value && tableContainer.value) {
      const table = tableContainer.value.querySelector("#spreadsheet-table");
      if (table) {
        const row = table.querySelectorAll("tr")[miniEditorCell.value.row];
        if (row) {
          const cell = row.querySelectorAll("td")[miniEditorCell.value.col];
          if (cell) {
            cell.classList.add("cell-editing");
          }
        }
      }
    }
  },
  { flush: "post" },
);
</script>

<style scoped>
.spreadsheet-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
}

.spreadsheet-content-wrapper {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1em;
}

.title {
  font-size: 2em;
  margin: 0;
  font-weight: bold;
}

.button-group {
  display: flex;
  gap: 0.5em;
}

.download-btn {
  padding: 0.5em 1em;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
  display: flex;
  align-items: center;
  gap: 0.5em;
  transition: background-color 0.2s;
}

.excel-btn {
  background-color: #217346;
}

.excel-btn:hover {
  background-color: #1e6a3f;
}

.excel-btn:active {
  background-color: #1a5c36;
}

.download-btn .material-icons {
  font-size: 1.2em;
}

/* Sheet tabs */
.sheet-tabs {
  display: flex;
  gap: 0.25em;
  margin-bottom: 1em;
  border-bottom: 2px solid #e0e0e0;
}

.sheet-tab {
  padding: 0.5em 1em;
  background: #f5f5f5;
  border: none;
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  cursor: pointer;
  font-size: 0.9em;
  color: #666;
  transition: background-color 0.2s;
}

.sheet-tab:hover {
  background: #e8e8e8;
}

.sheet-tab.active {
  background: white;
  color: #333;
  font-weight: 500;
  border-bottom: 2px solid white;
  margin-bottom: -2px;
}

/* Table container */
.table-container {
  overflow-x: auto;
  background: white;
}

/* Style the generated table */
.table-container :deep(table) {
  border-collapse: collapse;
  width: 100%;
  font-family: "Segoe UI", Arial, sans-serif;
  font-size: 0.9em;
}

.table-container :deep(td),
.table-container :deep(th) {
  border: 1px solid #d0d0d0;
  padding: 0.5em 0.75em;
  text-align: left;
}

.table-container :deep(th) {
  background-color: #f5f5f5;
  font-weight: 600;
  color: #333;
}

.table-container :deep(tr:nth-child(even)) {
  background-color: #fafafa;
}

.table-container :deep(tr:hover) {
  background-color: #f0f0f0;
}

.table-container :deep(.cell-editing) {
  background-color: #e8f5e9 !important;
  outline: 2px solid #217346 !important;
  outline-offset: -2px;
}

/* Error message */
.error {
  padding: 1em;
  background: #ffebee;
  color: #c62828;
  border-radius: 4px;
  margin: 1em 0;
}

/* Editor section */
.spreadsheet-source {
  padding: 0.5rem;
  background: #f5f5f5;
  border-top: 1px solid #e0e0e0;
  font-family: monospace;
  font-size: 0.85rem;
  flex-shrink: 0;
}

.spreadsheet-source summary {
  cursor: pointer;
  user-select: none;
  padding: 0.5rem;
  background: #e8e8e8;
  border-radius: 4px;
  font-weight: 500;
  color: #333;
}

.spreadsheet-source[open] summary {
  margin-bottom: 0.5rem;
}

.spreadsheet-source summary:hover {
  background: #d8d8d8;
}

.spreadsheet-editor {
  width: 100%;
  height: 40vh;
  padding: 1rem;
  background: #ffffff;
  border: 1px solid #ccc;
  border-radius: 4px;
  color: #333;
  font-family: "Courier New", monospace;
  font-size: 0.9rem;
  resize: vertical;
  margin-bottom: 0.5rem;
  line-height: 1.5;
}

.spreadsheet-editor:focus {
  outline: none;
  border-color: #217346;
  box-shadow: 0 0 0 2px rgba(33, 115, 70, 0.1);
}

.apply-btn {
  padding: 0.5rem 1rem;
  background: #217346;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.2s;
  font-weight: 500;
}

.apply-btn:hover {
  background: #1e6a3f;
}

.apply-btn:active {
  background: #1a5c36;
}

.apply-btn:disabled {
  background: #cccccc;
  color: #666666;
  cursor: not-allowed;
  opacity: 0.6;
}

.apply-btn:disabled:hover {
  background: #cccccc;
}

/* Mini Editor Panel */
.mini-editor-panel {
  background: #f8f8f8;
  border-top: 1px solid #d0d0d0;
  flex-shrink: 0;
}

.mini-editor-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
}

.cell-ref {
  font-family: monospace;
  font-weight: 600;
  color: #217346;
  font-size: 0.85rem;
  min-width: 2rem;
}

.radio-group {
  display: flex;
  gap: 0.75rem;
  border-right: 1px solid #d0d0d0;
  padding-right: 0.75rem;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  cursor: pointer;
  font-size: 0.85rem;
  color: #555;
}

.radio-option input[type="radio"] {
  cursor: pointer;
  width: 0.9rem;
  height: 0.9rem;
}

.form-input {
  flex: 1;
  padding: 0.4rem 0.6rem;
  border: 1px solid #ccc;
  border-radius: 3px;
  font-size: 0.85rem;
  font-family: inherit;
  transition: border-color 0.2s;
  min-width: 120px;
}

.form-input:focus {
  outline: none;
  border-color: #217346;
  box-shadow: 0 0 0 2px rgba(33, 115, 70, 0.1);
}

.form-input::placeholder {
  color: #999;
  font-size: 0.8rem;
}

.save-btn,
.cancel-btn {
  padding: 0.4rem 0.8rem;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 500;
  transition: background 0.2s;
}

.save-btn {
  background: #217346;
  color: white;
}

.save-btn:hover {
  background: #1e6a3f;
}

.cancel-btn {
  background: transparent;
  color: #666;
  padding: 0.4rem;
  font-size: 1.2rem;
  line-height: 1;
}

.cancel-btn:hover {
  color: #333;
  background: #e0e0e0;
}
</style>
