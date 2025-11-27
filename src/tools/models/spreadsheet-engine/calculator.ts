/**
 * Spreadsheet Calculator
 *
 * Core calculation engine with circular reference detection and cross-sheet support
 */

import { formatNumber } from "./formatter";
import { columnToIndex } from "./parser";
import { evaluateFormula as evaluateFormulaFn } from "./evaluator";
import type {
  SheetData,
  CellValue,
  CalculatedSheet,
  CalculationError,
  FormulaInfo,
} from "./types";

/**
 * Calculate formulas in a single sheet
 *
 * @param sheet - Sheet data to calculate
 * @param allSheets - All sheets for cross-sheet references
 * @returns Calculated sheet with formulas evaluated
 */
export function calculateSheet(
  sheet: SheetData,
  allSheets?: SheetData[],
): CalculatedSheet {
  const data = sheet.data;
  const sheetName = sheet.name;
  const sheetsCache = new Map<string, CellValue[][]>();
  const errors: CalculationError[] = [];
  const formulas: FormulaInfo[] = [];

  // Create a copy of the data with calculated values
  const calculated: any[][] = data.map((row) => [...row]);

  // Add current sheet to cache to prevent infinite loops
  sheetsCache.set(sheetName, calculated);

  // Track cells being calculated to detect circular references
  const calculating = new Set<string>();

  // Helper to extract raw value from cell with recursive formula evaluation
  const getRawValue = (cell: any, row?: number, col?: number): number => {
    if (typeof cell === "number") return cell;

    // Handle string values (for legacy or calculated cells)
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
      // Handle regular numeric strings, but preserve non-numeric strings
      const num = parseFloat(cell);
      return isNaN(num) ? cell : num;
    }

    // Handle new cell format {v, f}
    if (typeof cell === "object" && cell !== null && "v" in cell) {
      const value = cell.v;
      // If value is a string starting with "=", it's a formula
      if (typeof value === "string" && value.startsWith("=")) {
        // Check if we have row/col info to evaluate recursively
        if (row !== undefined && col !== undefined) {
          const cellKey = `${row},${col}`;

          // Check for circular reference
          if (calculating.has(cellKey)) {
            console.warn(
              `Circular reference detected at row ${row}, col ${col}`,
            );
            errors.push({
              cell: { row, col },
              formula: value,
              error: "Circular reference detected",
              type: "circular",
            });
            return 0;
          }

          // Check if already calculated (result is cached as a number)
          const calculatedCell = calculated[row][col];
          if (typeof calculatedCell === "number") {
            return calculatedCell;
          }

          // Recursively evaluate the formula
          calculating.add(cellKey);
          try {
            const formula = value.substring(1); // Remove "=" prefix
            const result = evaluateFormula(formula);
            calculating.delete(cellKey);

            // Cache the calculated result (preserve strings and numbers)
            calculated[row][col] = result;

            return result;
          } catch (error) {
            calculating.delete(cellKey);
            console.error(
              `Error evaluating formula at row ${row}, col ${col}:`,
              error,
            );
            errors.push({
              cell: { row, col },
              formula: value,
              error: error instanceof Error ? error.message : String(error),
              type: "unknown",
            });
            return 0;
          }
        }
        return 0; // No position info, can't evaluate
      }
      // Try to parse as number, but preserve strings
      const num = parseFloat(value);
      return isNaN(num) ? value : num;
    }

    // Try to parse cell as number, but preserve strings
    const num = parseFloat(cell);
    return isNaN(num) ? cell : num;
  };

  // Helper to get cell value by reference (e.g., "B2", "$B$2", or "'Sheet1'!B2")
  const getCellValue = (ref: string): CellValue => {
    let sheetData: any[][] = calculated;
    let cellRef = ref;
    let isCurrentSheet = true;

    // Check for cross-sheet reference (e.g., 'Sheet Name'!B2 or Sheet1!B2)
    const sheetMatch = ref.match(/^(?:'([^']+)'|([^!]+))!(.+)$/);
    if (sheetMatch) {
      const targetSheetName = sheetMatch[1] || sheetMatch[2]; // Quoted or unquoted sheet name
      cellRef = sheetMatch[3]; // Cell reference part
      isCurrentSheet = false;

      // Check cache first to prevent infinite loops
      if (sheetsCache.has(targetSheetName)) {
        sheetData = sheetsCache.get(targetSheetName)!;
      } else {
        // Find the sheet in all sheets
        const targetSheet = allSheets?.find((s) => s.name === targetSheetName);
        if (targetSheet && targetSheet.data) {
          // Calculate formulas for the target sheet with cache
          const targetCalculated = targetSheet.data.map((row) => [...row]);
          sheetsCache.set(targetSheetName, targetCalculated);

          // Recursively calculate the target sheet
          const targetResult = calculateSheet(targetSheet, allSheets);
          sheetsCache.set(targetSheetName, targetResult.data);
          sheetData = targetResult.data as any[][];
        } else {
          return 0; // Sheet not found
        }
      }
    }

    // Remove $ symbols for absolute references
    const cleanRef = cellRef.replace(/\$/g, "");
    const match = cleanRef.match(/^([A-Z]+)(\d+)$/);
    if (!match) return 0;

    const col = columnToIndex(match[1]); // A=0, B=1, ..., Z=25, AA=26, etc.
    const row = parseInt(match[2]) - 1; // 1-indexed to 0-indexed

    if (
      row < 0 ||
      row >= sheetData.length ||
      col < 0 ||
      col >= sheetData[row].length
    ) {
      return 0;
    }

    const cell = sheetData[row][col];
    // Pass row/col only if this is the current sheet (for recursive evaluation)
    return getRawValue(
      cell,
      isCurrentSheet ? row : undefined,
      isCurrentSheet ? col : undefined,
    );
  };

  // Helper to get range values (e.g., "B2:B11" or "Sheet1!B2:B11")
  const getRangeValues = (range: string): CellValue[] => {
    let sheetData: any[][] = calculated;
    let rangeRef = range;
    let isCurrentSheet = true;

    // Check for cross-sheet reference
    const sheetMatch = range.match(/^(?:'([^']+)'|([^!]+))!(.+)$/);
    if (sheetMatch) {
      const targetSheetName = sheetMatch[1] || sheetMatch[2];
      rangeRef = sheetMatch[3];
      isCurrentSheet = false;

      // Check cache first
      if (sheetsCache.has(targetSheetName)) {
        sheetData = sheetsCache.get(targetSheetName)!;
      } else {
        // Find and calculate the target sheet
        const targetSheet = allSheets?.find((s) => s.name === targetSheetName);
        if (targetSheet && targetSheet.data) {
          const targetCalculated = targetSheet.data.map((row) => [...row]);
          sheetsCache.set(targetSheetName, targetCalculated);

          // Recursively calculate the target sheet
          const targetResult = calculateSheet(targetSheet, allSheets);
          sheetsCache.set(targetSheetName, targetResult.data);
          sheetData = targetResult.data as any[][];
        } else {
          return [];
        }
      }
    }

    const match = rangeRef.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/);
    if (!match) return [];

    const startCol = columnToIndex(match[1]);
    const startRow = parseInt(match[2]) - 1;
    const endCol = columnToIndex(match[3]);
    const endRow = parseInt(match[4]) - 1;

    const values: CellValue[] = [];
    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        if (
          row >= 0 &&
          row < sheetData.length &&
          col >= 0 &&
          col < sheetData[row].length
        ) {
          const cell = sheetData[row][col];
          // Pass row/col only if current sheet (for recursive evaluation)
          const num = getRawValue(
            cell,
            isCurrentSheet ? row : undefined,
            isCurrentSheet ? col : undefined,
          );
          if (!isNaN(num)) values.push(num);
        }
      }
    }
    return values;
  };

  // Evaluate a formula with context
  const evaluateFormula = (formula: string): CellValue => {
    return evaluateFormulaFn(formula, {
      getCellValue,
      getRangeValues,
      evaluateFormula,
    });
  };

  // Process all cells and calculate formulas
  for (let rowIdx = 0; rowIdx < data.length; rowIdx++) {
    for (let colIdx = 0; colIdx < data[rowIdx].length; colIdx++) {
      const originalCell = data[rowIdx][colIdx];
      const calculatedCell = calculated[rowIdx][colIdx];

      // Check if cell was already calculated recursively (it's now a number)
      if (
        typeof calculatedCell === "number" &&
        originalCell &&
        typeof originalCell === "object" &&
        "f" in originalCell
      ) {
        // Cell was recursively evaluated - apply formatting now
        const format = originalCell.f;
        if (format) {
          calculated[rowIdx][colIdx] = formatNumber(calculatedCell, format);
        }
        continue;
      }

      // Handle cell format {v, f}
      if (
        originalCell &&
        typeof originalCell === "object" &&
        "v" in originalCell
      ) {
        const value = originalCell.v;
        const format = originalCell.f;

        // Check if value is a formula (string starting with "=")
        if (typeof value === "string" && value.startsWith("=")) {
          // Remove the "=" prefix and evaluate the formula
          const formula = value.substring(1);

          // Track formula info
          formulas.push({
            cell: { row: rowIdx, col: colIdx },
            formula: value,
            dependencies: [], // TODO: Extract dependencies from formula
            result: 0, // Will be updated below
          });

          const result = evaluateFormula(formula);

          // Update formula result
          formulas[formulas.length - 1].result = result;

          // Apply formatting if specified
          if (format && typeof result === "number") {
            calculated[rowIdx][colIdx] = formatNumber(result, format);
          } else {
            calculated[rowIdx][colIdx] = result;
          }
        } else {
          // Regular value cell (not a formula)
          if (format && typeof value === "number") {
            calculated[rowIdx][colIdx] = formatNumber(value, format);
          } else {
            // Convert to plain value (important for range evaluation)
            calculated[rowIdx][colIdx] = value;
          }
        }
      }
      // If cell is not in {v, f} format, leave it as-is (already a plain value)
    }
  }

  return {
    name: sheetName,
    data: calculated,
    formulas,
    errors,
  };
}

/**
 * Calculate all sheets in a workbook
 *
 * @param sheets - Array of sheets to calculate
 * @returns Array of calculated sheets
 */
export function calculateWorkbook(sheets: SheetData[]): CalculatedSheet[] {
  return sheets.map((sheet) => calculateSheet(sheet, sheets));
}
