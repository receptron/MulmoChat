/**
 * Standalone test for spreadsheet formula evaluation
 * Run with: npx tsx src/tests/spreadsheet-formula-test.ts
 */

import "../tools/models/functions/statistical";
import "../tools/models/functions/mathematical";
import "../tools/models/functions/logical";
import "../tools/models/functions/text";
import "../tools/models/functions/financial";
import "../tools/models/functions/lookup";
import "../tools/models/functions/date";
import { functionRegistry } from "../tools/models/spreadsheet-functions";

// Test data matching user's spreadsheet
const testData = [
  [
    { v: "Loan Amount" },
    { v: 250000, f: "$#,##0.00" },
  ],
  [
    { v: "Annual Interest Rate" },
    { v: 0.06, f: "0.00%" },
  ],
  [
    { v: "Term (years)" },
    { v: 30, f: "#,##0" },
  ],
  [
    { v: "Payments per Year" },
    { v: 12, f: "#,##0" },
  ],
  [
    { v: "Total Periods" },
    { v: "=B3*B4", f: "#,##0" },
  ],
  [
    { v: "Monthly Rate" },
    { v: "=B2/B4", f: "0.00%" },
  ],
  [
    { v: "Monthly Payment" },
    { v: "=-PMT(B6,B5,B1)", f: "$#,##0.00" },
  ],
];

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

// Helper to convert Excel column letters to 0-based index
const colToIndex = (col: string): number => {
  let result = 0;
  for (let i = 0; i < col.length; i++) {
    result = result * 26 + (col.charCodeAt(i) - 64);
  }
  return result - 1;
};

// Calculate formulas
const calculateFormulas = (data: Array<Array<any>>): Array<Array<any>> => {
  const calculated = data.map((row) => [...row]);

  // Helper to extract raw value from cell
  const getRawValue = (cell: any): number => {
    if (typeof cell === "number") return cell;

    if (typeof cell === "string") {
      if (cell.includes("%")) {
        const numericPart = cell.replace("%", "").trim();
        const value = parseFloat(numericPart);
        return isNaN(value) ? 0 : value / 100;
      }
      if (cell.includes("$")) {
        const numericPart = cell.replace(/[$,]/g, "").trim();
        const value = parseFloat(numericPart);
        return isNaN(value) ? 0 : value;
      }
      if (cell.includes(",")) {
        const numericPart = cell.replace(/,/g, "").trim();
        const value = parseFloat(numericPart);
        return isNaN(value) ? 0 : value;
      }
      return parseFloat(cell) || 0;
    }

    if (typeof cell === "object" && cell !== null && "v" in cell) {
      const value = cell.v;
      if (typeof value === "string" && value.startsWith("=")) {
        return 0;
      }
      return parseFloat(value) || 0;
    }

    return parseFloat(cell) || 0;
  };

  // Helper to get cell value by reference
  const getCellValue = (ref: string): number => {
    console.log(`  getCellValue(${ref})`);
    const cleanRef = ref.replace(/\$/g, "");
    const match = cleanRef.match(/^([A-Z]+)(\d+)$/);
    if (!match) return 0;

    const col = colToIndex(match[1]);
    const row = parseInt(match[2]) - 1;

    if (
      row < 0 ||
      row >= calculated.length ||
      col < 0 ||
      col >= calculated[row].length
    ) {
      return 0;
    }

    const cell = calculated[row][col];
    const value = getRawValue(cell);
    console.log(`    -> cell:`, cell, `-> value: ${value}`);
    return value;
  };

  // Helper to get range values
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

  // Helper to parse function arguments
  const parseFunctionArgs = (argsStr: string): string[] => {
    const args: string[] = [];
    let currentArg = "";
    let depth = 0;
    let inString = false;
    let stringChar = "";

    for (let i = 0; i < argsStr.length; i++) {
      const char = argsStr[i];
      const prevChar = i > 0 ? argsStr[i - 1] : "";

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

      if (!inString) {
        if (char === "(") depth++;
        if (char === ")") depth--;

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
    console.log(`evaluateFormula(${formula})`);
    try {
      // Check if it's a function call
      const funcMatch = formula.match(/^([A-Z]+)\((.*)\)$/i);
      if (funcMatch) {
        const [, funcName, argsStr] = funcMatch;
        console.log(`  Direct function call: ${funcName}(${argsStr})`);
        const func = functionRegistry.get(funcName);

        if (func) {
          const args = parseFunctionArgs(argsStr);
          console.log(`  Args:`, args);

          const result = func.handler(args, {
            getCellValue,
            getRangeValues,
            evaluateFormula,
          });
          console.log(`  Result:`, result);
          return result;
        } else {
          console.log(`  Function ${funcName} not found in registry`);
        }
      }

      // Handle arithmetic expressions with embedded functions
      let expr = formula;

      // Find and evaluate function calls
      const funcCallRegex = /([A-Z]+)\(([^()]*(?:\([^()]*\))*[^()]*)\)/gi;
      let embeddedFuncMatch;
      while ((embeddedFuncMatch = funcCallRegex.exec(expr)) !== null) {
        const fullMatch = embeddedFuncMatch[0];
        console.log(`  Embedded function found: ${fullMatch}`);
        const result = evaluateFormula(fullMatch);
        // Wrap result in parentheses to handle negative numbers (e.g., -PMT() → -(result))
        expr = expr.replace(fullMatch, `(${result})`);
        funcCallRegex.lastIndex = 0;
      }

      // Replace cell references with their values
      const cellRefs = expr.match(
        /(?:'[^']+'|[^'!\s]+)![A-Z]+\d+|\$?[A-Z]+\$?\d+/g,
      );
      if (cellRefs) {
        for (const ref of cellRefs) {
          const value = getCellValue(ref);
          const escapedRef = ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          expr = expr.replace(new RegExp(escapedRef, "g"), value.toString());
        }
      }

      // Replace ^ with ** for exponentiation
      expr = expr.replace(/\^/g, "**");

      console.log(`  Final expression to eval: ${expr}`);

      // Safely evaluate the expression
      if (/^[\d+\-*/(). ]+$/.test(expr)) {
        const result = eval(expr);
        console.log(`  Eval result: ${result}`);
        return result;
      }

      console.log(`  Cannot evaluate, returning formula`);
      return formula;
    } catch (error) {
      console.error(`Failed to evaluate formula: ${formula}`, error);
      return formula;
    }
  };

  // Process all cells and calculate formulas
  console.log("\n=== Starting formula calculation ===\n");
  for (let rowIdx = 0; rowIdx < calculated.length; rowIdx++) {
    for (let colIdx = 0; colIdx < calculated[rowIdx].length; colIdx++) {
      const cell = calculated[rowIdx][colIdx];

      if (cell && typeof cell === "object" && "v" in cell) {
        const value = cell.v;
        const format = cell.f;

        if (typeof value === "string" && value.startsWith("=")) {
          console.log(
            `\nProcessing cell [${rowIdx}][${colIdx}]: ${JSON.stringify(cell)}`,
          );
          const formula = value.substring(1);
          const result = evaluateFormula(formula);

          if (format && typeof result === "number") {
            calculated[rowIdx][colIdx] = formatNumber(result, format);
          } else {
            calculated[rowIdx][colIdx] = result;
          }
          console.log(`  Final value: ${calculated[rowIdx][colIdx]}`);
        }
      }
    }
  }

  return calculated;
};

// Run test
console.log("PMT registered?", functionRegistry.hasFunction("PMT"));
console.log(
  "All functions:",
  functionRegistry.getAllFunctions().map((f) => f.name),
);

const result = calculateFormulas(testData);

console.log("\n=== RESULTS ===\n");
result.forEach((row, i) => {
  console.log(`Row ${i}:`, row);
});
