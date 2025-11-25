/**
 * Evaluator Tests
 * Run with: npx tsx src/tools/models/spreadsheet-engine/__tests__/run-evaluator-tests.ts
 */

import {
  parseFunctionArgs,
  evaluateFormula,
  type EvaluatorContext,
} from "../evaluator";
import "../functions"; // Load all functions

let passedTests = 0;
let failedTests = 0;
const failures: string[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    passedTests++;
    console.log(`✓ ${name}`);
  } catch (error) {
    failedTests++;
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`✗ ${name}: ${message}`);
    console.log(`✗ ${name}`);
  }
}

function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected) {
        throw new Error(`Expected "${expected}", got "${actual}"`);
      }
    },
    toEqual(expected: any) {
      const actualStr = JSON.stringify(actual);
      const expectedStr = JSON.stringify(expected);
      if (actualStr !== expectedStr) {
        throw new Error(`Expected ${expectedStr}, got ${actualStr}`);
      }
    },
  };
}

// Helper to create mock context
function createContext(
  cells: Record<string, number | string> = {},
  ranges: Record<string, (number | string)[]> = {},
): EvaluatorContext {
  const context: EvaluatorContext = {
    getCellValue: (ref: string) => cells[ref] ?? 0,
    getRangeValues: (range: string) => ranges[range] ?? [],
    evaluateFormula: (formula: string) => evaluateFormula(formula, context),
  };
  return context;
}

console.log("\n=== Evaluator Tests ===\n");

// Parse function arguments
console.log("Parse Function Arguments:");
test("parses simple args", () => {
  expect(parseFunctionArgs("A1, B2")).toEqual(["A1", "B2"]);
});
test("parses range args", () => {
  expect(parseFunctionArgs("A1:A10")).toEqual(["A1:A10"]);
});
test("parses numeric args", () => {
  expect(parseFunctionArgs("100, 200")).toEqual(["100", "200"]);
});
test("parses nested functions", () => {
  expect(parseFunctionArgs("SUM(A1:A10), 2")).toEqual(["SUM(A1:A10)", "2"]);
});
test("parses quoted strings", () => {
  expect(parseFunctionArgs('"Hello", "World"')).toEqual(['"Hello"', '"World"']);
});
test("parses complex nested", () => {
  expect(parseFunctionArgs("ROUND(SUM(A1:A10), 2), B1")).toEqual([
    "ROUND(SUM(A1:A10), 2)",
    "B1",
  ]);
});

// Simple arithmetic
console.log("\nSimple Arithmetic:");
test("evaluates addition", () => {
  const ctx = createContext();
  expect(evaluateFormula("2+3", ctx)).toBe(5);
});
test("evaluates subtraction", () => {
  const ctx = createContext();
  expect(evaluateFormula("10-3", ctx)).toBe(7);
});
test("evaluates multiplication", () => {
  const ctx = createContext();
  expect(evaluateFormula("4*5", ctx)).toBe(20);
});
test("evaluates division", () => {
  const ctx = createContext();
  expect(evaluateFormula("20/4", ctx)).toBe(5);
});
test("evaluates order of operations", () => {
  const ctx = createContext();
  expect(evaluateFormula("2+3*4", ctx)).toBe(14);
});
test("evaluates with parentheses", () => {
  const ctx = createContext();
  expect(evaluateFormula("(2+3)*4", ctx)).toBe(20);
});

// Cell references
console.log("\nCell References:");
test("evaluates cell reference", () => {
  const ctx = createContext({ A1: 10 });
  expect(evaluateFormula("A1", ctx)).toBe(10);
});
test("evaluates cell addition", () => {
  const ctx = createContext({ A1: 10, B1: 20 });
  expect(evaluateFormula("A1+B1", ctx)).toBe(30);
});
test("evaluates cell multiplication", () => {
  const ctx = createContext({ A1: 5, B1: 4 });
  expect(evaluateFormula("A1*B1", ctx)).toBe(20);
});
test("evaluates mixed cell and number", () => {
  const ctx = createContext({ A1: 10 });
  expect(evaluateFormula("A1*2", ctx)).toBe(20);
});

// Function calls
console.log("\nFunction Calls:");
test("evaluates SUM function", () => {
  const ctx = createContext({}, { "A1:A3": [10, 20, 30] });
  expect(evaluateFormula("SUM(A1:A3)", ctx)).toBe(60);
});
test("evaluates AVERAGE function", () => {
  const ctx = createContext({}, { "A1:A3": [10, 20, 30] });
  expect(evaluateFormula("AVERAGE(A1:A3)", ctx)).toBe(20);
});
test("evaluates MAX function", () => {
  const ctx = createContext({}, { "A1:A5": [10, 50, 30, 20, 40] });
  expect(evaluateFormula("MAX(A1:A5)", ctx)).toBe(50);
});
test("evaluates MIN function", () => {
  const ctx = createContext({}, { "A1:A5": [10, 50, 30, 20, 40] });
  expect(evaluateFormula("MIN(A1:A5)", ctx)).toBe(10);
});
test("evaluates COUNT function", () => {
  const ctx = createContext({}, { "A1:A10": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
  expect(evaluateFormula("COUNT(A1:A10)", ctx)).toBe(10);
});

// Nested functions
console.log("\nNested Functions:");
test("evaluates nested ROUND(SUM)", () => {
  const ctx = createContext({}, { "A1:A3": [10.5, 20.7, 30.3] });
  const result = evaluateFormula("ROUND(SUM(A1:A3), 0)", ctx);
  expect(result).toBe(62);
});
test("evaluates nested ROUND(AVERAGE)", () => {
  const ctx = createContext({}, { "A1:A3": [10, 20, 30] });
  const result = evaluateFormula("ROUND(AVERAGE(A1:A3), 2)", ctx);
  expect(result).toBe(20);
});

// Complex expressions
console.log("\nComplex Expressions:");
test("evaluates formula with cell and function", () => {
  const ctx = createContext({ B1: 100 }, { "A1:A3": [10, 20, 30] });
  expect(evaluateFormula("SUM(A1:A3)+B1", ctx)).toBe(160);
});
test("evaluates division with function", () => {
  const ctx = createContext({ B1: 3 }, { "A1:A3": [10, 20, 30] });
  expect(evaluateFormula("SUM(A1:A3)/B1", ctx)).toBe(20);
});

// Math functions
console.log("\nMath Functions:");
test("evaluates ABS function", () => {
  const ctx = createContext();
  expect(evaluateFormula("ABS(-5)", ctx)).toBe(5);
});
test("evaluates ROUND function", () => {
  const ctx = createContext();
  expect(evaluateFormula("ROUND(3.14159, 2)", ctx)).toBe(3.14);
});
test("evaluates POWER function", () => {
  const ctx = createContext();
  expect(evaluateFormula("POWER(2, 3)", ctx)).toBe(8);
});
test("evaluates SQRT function", () => {
  const ctx = createContext();
  expect(evaluateFormula("SQRT(16)", ctx)).toBe(4);
});

// Summary
console.log("\n=== Test Summary ===");
console.log(`Passed: ${passedTests}`);
console.log(`Failed: ${failedTests}`);

if (failures.length > 0) {
  console.log("\n=== Failures ===");
  failures.forEach((f) => console.log(f));
  process.exit(1);
} else {
  console.log("\n✓ All tests passed!");
  process.exit(0);
}
