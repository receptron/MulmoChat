/**
 * Test for re-calculation scenarios that might cause infinite loops
 */

import { SpreadsheetEngine } from "../engine";
import type { SheetData } from "../types";
import "../../functions/index";

console.log("\n=== Re-calculation Test ===\n");

const pvAnalysisData = [
  [{ v: "Parameter" }, { v: "Value" }, { v: "" }],
  [
    { v: "Monthly Income" },
    { f: "$#,##0.00", v: 1000 },
    { v: "Change this value" },
  ],
  [
    { v: "Annual Discount Rate" },
    { f: "0.00%", v: 0.05 },
    { v: "Change this value" },
  ],
  [
    { v: "Monthly Discount Rate" },
    { f: "0.00%", v: "=B3/12" },
    { v: "Calculated automatically" },
  ],
  [
    { v: "Total Present Value" },
    { v: "=SUM(C9:C20)", f: "$#,##0.00" },
    { v: "Sum of discounted cash flows" },
  ],
  [{ v: "" }, { v: "" }, { v: "" }],
  [{ v: "" }, { v: "" }, { v: "" }],
  [{ v: "Month" }, { v: "Cash Flow" }, { v: "Present Value" }],
  [
    { v: 1 },
    { f: "$#,##0.00", v: "=$B$2" },
    { f: "$#,##0.00", v: "=B9/(1+$B$4)^A9" },
  ],
  [
    { v: 2 },
    { f: "$#,##0.00", v: "=$B$2" },
    { v: "=B10/(1+$B$4)^A10", f: "$#,##0.00" },
  ],
  [
    { v: 3 },
    { v: "=$B$2", f: "$#,##0.00" },
    { v: "=B11/(1+$B$4)^A11", f: "$#,##0.00" },
  ],
  [
    { v: 4 },
    { f: "$#,##0.00", v: "=$B$2" },
    { v: "=B12/(1+$B$4)^A12", f: "$#,##0.00" },
  ],
  [
    { v: 5 },
    { v: "=$B$2", f: "$#,##0.00" },
    { v: "=B13/(1+$B$4)^A13", f: "$#,##0.00" },
  ],
  [
    { v: 6 },
    { f: "$#,##0.00", v: "=$B$2" },
    { v: "=B14/(1+$B$4)^A14", f: "$#,##0.00" },
  ],
  [
    { v: 7 },
    { v: "=$B$2", f: "$#,##0.00" },
    { v: "=B15/(1+$B$4)^A15", f: "$#,##0.00" },
  ],
  [
    { v: 8 },
    { v: "=$B$2", f: "$#,##0.00" },
    { v: "=B16/(1+$B$4)^A16", f: "$#,##0.00" },
  ],
  [
    { v: 9 },
    { f: "$#,##0.00", v: "=$B$2" },
    { f: "$#,##0.00", v: "=B17/(1+$B$4)^A17" },
  ],
  [
    { v: 10 },
    { f: "$#,##0.00", v: "=$B$2" },
    { f: "$#,##0.00", v: "=B18/(1+$B$4)^A18" },
  ],
  [
    { v: 11 },
    { f: "$#,##0.00", v: "=$B$2" },
    { f: "$#,##0.00", v: "=B19/(1+$B$4)^A19" },
  ],
  [
    { v: 12 },
    { v: "=$B$2", f: "$#,##0.00" },
    { v: "=B20/(1+$B$4)^A20", f: "$#,##0.00" },
  ],
];

const engine = new SpreadsheetEngine();

// Simulate what the Vue component does
function calculateFormulas(
  data: Array<Array<any>>,
  sheetName?: string,
  allSheets?: SheetData[],
): Array<Array<any>> {
  const sheet: SheetData = {
    name: sheetName || "Sheet1",
    data: data,
  };

  const result = engine.calculate(sheet, allSheets);
  return result.data as Array<Array<any>>;
}

try {
  console.log("Test 1: Single calculation");
  const result1 = calculateFormulas(pvAnalysisData, "PV Analysis");
  console.log("✓ First calculation succeeded");
  console.log("  Total PV:", result1[4][1]);

  console.log("\nTest 2: Re-calculate same data");
  const result2 = calculateFormulas(pvAnalysisData, "PV Analysis");
  console.log("✓ Second calculation succeeded");
  console.log("  Total PV:", result2[4][1]);

  console.log(
    "\nTest 3: Calculate with formatted results (simulate re-render)",
  );
  // This simulates if the calculated results are passed back in
  const result3 = calculateFormulas(result1, "PV Analysis");
  console.log("✓ Third calculation succeeded");
  console.log("  Total PV:", result3[4][1]);

  console.log(
    "\nTest 4: Multiple rapid calculations (simulate reactive updates)",
  );
  for (let i = 0; i < 10; i++) {
    const result = calculateFormulas(pvAnalysisData, "PV Analysis");
    console.log(`  Iteration ${i + 1}: ${result[4][1]}`);
  }
  console.log("✓ Rapid calculations succeeded");

  console.log(
    "\n✓ All re-calculation tests passed - no infinite loops detected",
  );
  process.exit(0);
} catch (error) {
  console.error("\n❌ Test failed:");
  console.error(error);
  process.exit(1);
}
