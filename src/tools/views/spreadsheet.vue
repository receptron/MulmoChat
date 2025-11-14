<template>
  <div class="spreadsheet-container">
    <div
      v-if="!selectedResult.data?.sheets || selectedResult.data.sheets.length === 0"
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
          <div class="table-container" v-html="renderedHtml"></div>
        </div>
      </div>

      <!-- Collapsible Editor -->
      <details class="spreadsheet-source">
        <summary>Edit Spreadsheet Data</summary>
        <textarea
          v-model="editableData"
          @input="handleDataEdit"
          class="spreadsheet-editor"
          spellcheck="false"
        ></textarea>
        <button
          @click="applyChanges"
          class="apply-btn"
          :disabled="!hasChanges"
        >
          Apply Changes
        </button>
      </details>
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

// Calculate formulas in the data
const calculateFormulas = (data: Array<Array<any>>): Array<Array<any>> => {
  // Create a copy of the data with calculated values
  const calculated = data.map(row => [...row]);

  // Helper to get cell value by reference (e.g., "B2")
  const getCellValue = (ref: string): number => {
    const match = ref.match(/^([A-Z]+)(\d+)$/);
    if (!match) return 0;

    const col = match[1].charCodeAt(0) - 65; // A=0, B=1, etc.
    const row = parseInt(match[2]) - 1; // 1-indexed to 0-indexed

    if (row < 0 || row >= calculated.length || col < 0 || col >= calculated[row].length) {
      return 0;
    }

    const cell = calculated[row][col];
    return typeof cell === 'number' ? cell : parseFloat(cell) || 0;
  };

  // Helper to get range values (e.g., "B2:B11")
  const getRangeValues = (range: string): number[] => {
    const match = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (!match) return [];

    const startCol = match[1].charCodeAt(0) - 65;
    const startRow = parseInt(match[2]) - 1;
    const endCol = match[3].charCodeAt(0) - 65;
    const endRow = parseInt(match[4]) - 1;

    const values: number[] = [];
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        if (row >= 0 && row < calculated.length && col >= 0 && col < calculated[row].length) {
          const cell = calculated[row][col];
          const num = typeof cell === 'number' ? cell : parseFloat(cell);
          if (!isNaN(num)) values.push(num);
        }
      }
    }
    return values;
  };

  // Evaluate a formula
  const evaluateFormula = (formula: string): number | string => {
    try {
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
          return values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
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
      const cellRefs = formula.match(/[A-Z]+\d+/g);
      if (cellRefs) {
        for (const ref of cellRefs) {
          const value = getCellValue(ref);
          expr = expr.replace(new RegExp(ref, 'g'), value.toString());
        }
      }

      // Safely evaluate the expression
      // Only allow numbers, operators, parentheses, and whitespace
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
      if (cell && typeof cell === 'object' && 'f' in cell) {
        calculated[rowIdx][colIdx] = evaluateFormula(cell.f);
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
</style>
