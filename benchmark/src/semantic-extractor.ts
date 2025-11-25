/**
 * Semantic Extractor
 *
 * Structure-agnostic extraction of values from spreadsheets.
 * Finds data by semantic meaning (labels) rather than fixed positions.
 */

import type {
  SpreadsheetSheet,
  SpreadsheetCell,
} from "../../src/tools/models/spreadsheet";
import type {
  CellLocation,
  ExtractedValue,
  FormulaInfo,
  SemanticExtractionResult,
} from "./types";

/**
 * Check if two strings match (case-insensitive by default)
 */
function matchesLabel(
  cellValue: any,
  targetLabel: string,
  caseSensitive = false,
): boolean {
  if (typeof cellValue !== "string") return false;

  const cellStr = caseSensitive ? cellValue : cellValue.toLowerCase();
  const targetStr = caseSensitive ? targetLabel : targetLabel.toLowerCase();

  // Exact match
  if (cellStr === targetStr) return true;

  // Contains match (for partial labels)
  if (cellStr.includes(targetStr)) return true;

  // Fuzzy match (ignoring punctuation and extra spaces)
  const normalize = (s: string) =>
    s.replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
  return normalize(cellStr) === normalize(targetStr);
}

/**
 * Extract numeric value from cell
 */
function extractNumericValue(cell: any): number | null {
  if (cell === null || cell === undefined) return null;

  // Handle cell object format {v: value, f: format}
  const value = typeof cell === "object" && "v" in cell ? cell.v : cell;

  if (typeof value === "number") return value;
  if (typeof value === "string") {
    // Remove currency symbols, commas, percentage signs
    const cleaned = value.replace(/[$,€£¥%]/g, "").trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  return null;
}

/**
 * Extract string value from cell
 */
function extractStringValue(cell: any): string {
  if (cell === null || cell === undefined) return "";

  // Handle cell object format {v: value, f: format}
  const value = typeof cell === "object" && "v" in cell ? cell.v : cell;

  return String(value);
}

/**
 * Check if cell contains a formula
 */
function hasFormula(cell: any): boolean {
  if (cell === null || cell === undefined) return false;

  // Handle cell object format {v: value, f: format}
  const value = typeof cell === "object" && "v" in cell ? cell.v : cell;

  return typeof value === "string" && value.startsWith("=");
}

/**
 * Extract formula from cell
 */
function extractFormula(cell: any): string | null {
  if (!hasFormula(cell)) return null;

  const value = typeof cell === "object" && "v" in cell ? cell.v : cell;
  return String(value);
}

/**
 * Find adjacent cells (right, down, left, up)
 */
function findAdjacentCells(
  data: any[][],
  row: number,
  col: number,
): CellLocation[] {
  const adjacent: CellLocation[] = [];
  const directions = [
    [0, 1], // right
    [1, 0], // down
    [0, -1], // left
    [-1, 0], // up
  ];

  for (const [dr, dc] of directions) {
    const newRow = row + dr;
    const newCol = col + dc;

    if (
      newRow >= 0 &&
      newRow < data.length &&
      newCol >= 0 &&
      newCol < data[newRow].length
    ) {
      adjacent.push({
        row: newRow,
        col: newCol,
        value: data[newRow][newCol],
        formula: extractFormula(data[newRow][newCol]) || undefined,
      });
    }
  }

  return adjacent;
}

/**
 * Find value associated with a label
 * Looks in adjacent cells (right first, then down, then left, then up)
 */
export function findByLabel(
  sheet: SpreadsheetSheet,
  label: string,
  caseSensitive = false,
): ExtractedValue | null {
  const data = sheet.data;

  // Search all cells for the label
  for (let row = 0; row < data.length; row++) {
    for (let col = 0; col < data[row].length; col++) {
      const cell = data[row][col];
      const cellStr = extractStringValue(cell);

      if (matchesLabel(cellStr, label, caseSensitive)) {
        // Found the label, now look for adjacent value
        const adjacent = findAdjacentCells(data, row, col);

        for (const adjCell of adjacent) {
          const numValue = extractNumericValue(adjCell.value);
          if (numValue !== null) {
            return {
              label,
              value: numValue,
              location: adjCell,
              confidence: 1.0,
            };
          }
        }

        // If no numeric adjacent cell, return string value if available
        for (const adjCell of adjacent) {
          const strValue = extractStringValue(adjCell.value);
          if (strValue && strValue !== label) {
            return {
              label,
              value: strValue,
              location: adjCell,
              confidence: 0.8,
            };
          }
        }
      }
    }
  }

  return null;
}

/**
 * Find all values in the sheet with their labels
 */
export function extractAllLabeledValues(
  sheet: SpreadsheetSheet,
): ExtractedValue[] {
  const results: ExtractedValue[] = [];
  const data = sheet.data;
  const processed = new Set<string>();

  for (let row = 0; row < data.length; row++) {
    for (let col = 0; col < data[row].length; col++) {
      const cell = data[row][col];
      const cellStr = extractStringValue(cell);

      // Skip if empty or already processed
      if (!cellStr || processed.has(`${row},${col}`)) continue;

      // Check if this looks like a label (non-numeric string)
      const numValue = extractNumericValue(cell);
      if (numValue !== null) continue; // This is a value, not a label

      // Look for adjacent numeric value
      const adjacent = findAdjacentCells(data, row, col);
      for (const adjCell of adjacent) {
        const adjNumValue = extractNumericValue(adjCell.value);
        if (adjNumValue !== null) {
          results.push({
            label: cellStr,
            value: adjNumValue,
            location: adjCell,
            confidence: 1.0,
          });
          processed.add(`${adjCell.row},${adjCell.col}`);
          break; // Take first adjacent value
        }
      }
    }
  }

  return results;
}

/**
 * Extract all formulas from the sheet
 */
export function extractFormulas(sheet: SpreadsheetSheet): FormulaInfo[] {
  const formulas: FormulaInfo[] = [];
  const data = sheet.data;

  for (let row = 0; row < data.length; row++) {
    for (let col = 0; col < data[row].length; col++) {
      const cell = data[row][col];
      const formula = extractFormula(cell);

      if (formula) {
        // Extract function names from formula
        const functions = extractFunctionNames(formula);

        formulas.push({
          cell: columnToLetter(col) + (row + 1),
          formula,
          functions,
        });
      }
    }
  }

  return formulas;
}

/**
 * Extract function names from a formula
 */
function extractFunctionNames(formula: string): string[] {
  const functions: string[] = [];

  // Remove leading = sign
  const cleanFormula = formula.startsWith("=") ? formula.substring(1) : formula;

  // Match function names (word followed by opening parenthesis)
  const functionRegex = /([A-Z_][A-Z0-9_]*)\s*\(/gi;
  let match;

  while ((match = functionRegex.exec(cleanFormula)) !== null) {
    functions.push(match[1].toUpperCase());
  }

  return functions;
}

/**
 * Convert column index to letter (0 -> A, 1 -> B, etc.)
 */
function columnToLetter(col: number): string {
  let result = "";
  let num = col;

  while (num >= 0) {
    result = String.fromCharCode((num % 26) + 65) + result;
    num = Math.floor(num / 26) - 1;
  }

  return result;
}

/**
 * Find all labels (text cells) in the sheet
 */
export function extractLabels(sheet: SpreadsheetSheet): string[] {
  const labels = new Set<string>();
  const data = sheet.data;

  for (let row = 0; row < data.length; row++) {
    for (let col = 0; col < data[row].length; col++) {
      const cell = data[row][col];
      const cellStr = extractStringValue(cell);

      // Skip empty cells and cells that look like numbers/formulas
      if (!cellStr || cellStr.startsWith("=")) continue;

      const numValue = extractNumericValue(cell);
      if (numValue === null) {
        labels.add(cellStr);
      }
    }
  }

  return Array.from(labels);
}

/**
 * Find a specific numeric value in the sheet (useful for finding calculated results)
 */
export function findValue(
  sheet: SpreadsheetSheet,
  targetValue: number,
  tolerance = 0.01,
): CellLocation | null {
  const data = sheet.data;

  for (let row = 0; row < data.length; row++) {
    for (let col = 0; col < data[row].length; col++) {
      const cell = data[row][col];
      const numValue = extractNumericValue(cell);

      if (numValue !== null && Math.abs(numValue - targetValue) <= tolerance) {
        return {
          row,
          col,
          value: cell,
          formula: extractFormula(cell) || undefined,
        };
      }
    }
  }

  return null;
}

/**
 * Main semantic extraction function
 */
export function extractSemanticData(
  sheet: SpreadsheetSheet,
): SemanticExtractionResult {
  return {
    values: extractAllLabeledValues(sheet),
    formulas: extractFormulas(sheet),
    labels: extractLabels(sheet),
  };
}

/**
 * Check if a cell at a location contains a formula
 */
export function cellHasFormula(
  sheet: SpreadsheetSheet,
  row: number,
  col: number,
): boolean {
  if (
    row < 0 ||
    row >= sheet.data.length ||
    col < 0 ||
    col >= sheet.data[row].length
  ) {
    return false;
  }

  return hasFormula(sheet.data[row][col]);
}

/**
 * Get functions used in a cell's formula
 */
export function getCellFunctions(
  sheet: SpreadsheetSheet,
  row: number,
  col: number,
): string[] {
  if (
    row < 0 ||
    row >= sheet.data.length ||
    col < 0 ||
    col >= sheet.data[row].length
  ) {
    return [];
  }

  const formula = extractFormula(sheet.data[row][col]);
  return formula ? extractFunctionNames(formula) : [];
}
