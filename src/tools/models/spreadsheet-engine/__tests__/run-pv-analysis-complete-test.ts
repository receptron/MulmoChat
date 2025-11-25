/**
 * Complete PV Analysis Test with Array Output Comparison
 * Run with: npx tsx src/tools/models/spreadsheet-engine/__tests__/run-pv-analysis-complete-test.ts
 */

import { calculateSheet } from "../calculator";
import { toStringArray, expectSheetOutput } from "./test-utils";
import "../functions"; // Load all functions

console.log("\n=== PV Analysis - Complete Array Output Test ===\n");

const pvAnalysisSheet = {
  name: "PV Analysis",
  data: [
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
  ],
};

try {
  console.log("Calculating PV Analysis spreadsheet...\n");
  const result = calculateSheet(pvAnalysisSheet);

  // Expected output as array of strings (with formatting applied)
  const expected = [
    // Row 1: Headers
    ["Parameter", "Value", ""],

    // Row 2: Monthly Income
    ["Monthly Income", "$1,000.00", "Change this value"],

    // Row 3: Annual Discount Rate
    ["Annual Discount Rate", "5.00%", "Change this value"],

    // Row 4: Monthly Discount Rate (calculated)
    ["Monthly Discount Rate", "0.42%", "Calculated automatically"],

    // Row 5: Total Present Value (SUM of all PVs)
    ["Total Present Value", "$11,678.72", "Sum of discounted cash flows"],

    // Rows 6-7: Empty
    ["", "", ""],
    ["", "", ""],

    // Row 8: Table headers
    ["Month", "Cash Flow", "Present Value"],

    // Rows 9-20: Monthly calculations
    // All values are formatted according to their format codes ($#,##0.00)
    ["1", "$1,000.00", "$995.82"],
    ["2", "$1,000.00", "$991.65"],
    ["3", "$1,000.00", "$987.51"],
    ["4", "$1,000.00", "$983.37"],
    ["5", "$1,000.00", "$979.26"],
    ["6", "$1,000.00", "$975.17"],
    ["7", "$1,000.00", "$971.09"],
    ["8", "$1,000.00", "$967.03"],
    ["9", "$1,000.00", "$962.98"],
    ["10", "$1,000.00", "$958.95"],
    ["11", "$1,000.00", "$954.94"],
    ["12", "$1,000.00", "$950.95"],
  ];

  console.log("Expected Output:");
  console.log("================");
  expected.forEach((row, i) => {
    const cells = row.map((c) => `"${c}"`).join(", ");
    console.log(`Row ${i + 1}: [${cells}]`);
  });

  console.log("\n\nActual Output:");
  console.log("==============");
  const actual = toStringArray(result.data);
  actual.forEach((row, i) => {
    const cells = row.map((c) => `"${c}"`).join(", ");
    console.log(`Row ${i + 1}: [${cells}]`);
  });

  console.log("\n\nComparison:");
  console.log("===========");
  expectSheetOutput(result, expected);

  console.log("✓ All values match expected output!");

  // Verify key calculations
  console.log("\n\nKey Calculations Verification:");
  console.log("==============================");
  console.log(`Monthly Discount Rate: ${actual[3][1]} (expected: 0.42%)`);
  console.log(`Total Present Value: ${actual[4][1]} (expected: $11,678.72)`);
  console.log(`First Month Cash Flow: ${actual[8][1]} (expected: $1,000.00)`);
  console.log(`First Month PV: ${actual[8][2]} (expected: $995.82)`);
  console.log(`Last Month PV: ${actual[19][2]} (expected: $950.95)`);

  // Check for errors
  if (result.errors.length > 0) {
    console.log("\n\n⚠ Errors detected:");
    result.errors.forEach((error) => {
      console.log(
        `  - Row ${error.cell.row}, Col ${error.cell.col}: ${error.error}`,
      );
    });
    process.exit(1);
  }

  console.log("\n\n✓ PV Analysis test passed - all calculations correct!");
  process.exit(0);
} catch (error) {
  console.error("\n❌ Test failed:");
  console.error(error);

  if (error instanceof Error && error.message.includes("Expected")) {
    console.error("\n💡 Hint: The calculated values differ from expected.");
    console.error("   This could be due to rounding differences.");
    console.error(
      "   Check the comparison above to see which values don't match.",
    );
  }

  process.exit(1);
}
