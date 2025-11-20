import { functionRegistry } from "./index";
import { FunctionContext } from "../spreadsheet-functions";

// Mock context
const mockContext: FunctionContext = {
  getCellValue: (ref: string) => {
    // Mock data for VLOOKUP/HLOOKUP/INDEX/MATCH
    // Table A1:C3
    // A1: 1, B1: "Apple", C1: 10
    // A2: 2, B2: "Banana", C2: 20
    // A3: 3, B3: "Cherry", C3: 30

    const data: Record<string, any> = {
      A1: 1,
      B1: "Apple",
      C1: 10,
      A2: 2,
      B2: "Banana",
      C2: 20,
      A3: 3,
      B3: "Cherry",
      C3: 30,
      D1: 100, // For HLOOKUP
      E1: 200,
      F1: 300,
    };

    // Handle sheet refs
    if (ref.includes("!")) {
      return data[ref.split("!")[1]] ?? 0;
    }
    return data[ref] ?? 0;
  },
  getRangeValues: (range: string) => {
    // Mock range values
    if (range === "A1:A3") return [1, 2, 3];
    if (range === "B1:B3") return ["Apple", "Banana", "Cherry"];
    if (range === "C1:C3") return [10, 20, 30];
    return [];
  },
  evaluateFormula: (formula: string) => {
    // Simple mock evaluator that returns the value if it's not a formula
    if (!isNaN(Number(formula))) return Number(formula);
    if (formula.startsWith('"') && formula.endsWith('"'))
      return formula.slice(1, -1);
    return formula;
  },
};

const runTest = (
  name: string,
  funcName: string,
  args: string[],
  expected: any,
) => {
  try {
    const func = functionRegistry.get(funcName);
    if (!func) {
      console.error(`❌ ${name}: Function ${funcName} not found`);
      return;
    }

    const result = func.handler(args, mockContext);

    // Handle approximate equality for dates/floats
    const isMatch =
      result == expected ||
      (typeof result === "number" &&
        typeof expected === "number" &&
        Math.abs(result - expected) < 0.001);

    if (isMatch) {
      console.log(`✅ ${name}: Passed (${result})`);
    } else {
      console.error(`❌ ${name}: Failed. Expected ${expected}, got ${result}`);
    }
  } catch (e) {
    console.error(`❌ ${name}: Error - ${e}`);
  }
};

console.log("--- Verifying Lookup Functions ---");

// VLOOKUP
// Look for 2 in A1:A3, return col 2 (Banana)
runTest("VLOOKUP Exact", "VLOOKUP", ["2", "A1:C3", "2", "FALSE"], "Banana");

// MATCH
// Look for "Cherry" in B1:B3
runTest("MATCH Exact", "MATCH", ['"Cherry"', "B1:B3", "0"], 3);

// INDEX
// Row 2, Col 2 of A1:C3 (Banana)
runTest("INDEX", "INDEX", ["A1:C3", "2", "2"], "Banana");

console.log("\n--- Verifying Date Functions ---");

// TODAY
// Should be close to current serial date
const now = new Date();
const expectedSerial =
  (now.getTime() - new Date(Date.UTC(1899, 11, 30)).getTime()) /
  (24 * 60 * 60 * 1000);
// Just check if it runs and returns a number close to expected
const todayFunc = functionRegistry.get("TODAY");
if (todayFunc) {
  const result = todayFunc.handler([], mockContext);
  if (
    typeof result === "number" &&
    Math.abs(result - Math.floor(expectedSerial)) < 2
  ) {
    console.log(`✅ TODAY: Passed (approx ${result})`);
  } else {
    console.error(`❌ TODAY: Failed. Got ${result}`);
  }
}

// DATE
// DATE(2023, 1, 1) -> 44927
runTest("DATE", "DATE", ["2023", "1", "1"], 44927);

// YEAR
// YEAR(44927) -> 2023
runTest("YEAR", "YEAR", ["44927"], 2023);

// DATEDIF
// DATEDIF(DATE(2023,1,1), DATE(2024,1,1), "Y") -> 1
runTest("DATEDIF Years", "DATEDIF", ["44927", "45292", '"Y"'], 1);

console.log("\n--- Verification Complete ---");
