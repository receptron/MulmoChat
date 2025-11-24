/**
 * Test for PV Analysis infinite loop bug
 */

import { calculateSheet } from "../calculator";
import "../../functions/index"; // Load all functions

console.log("\n=== PV Analysis Test ===\n");

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
  console.log("Testing PV Analysis sheet calculation...");
  console.log(
    "This test will timeout after 5 seconds if there's an infinite loop",
  );

  const timeout = setTimeout(() => {
    console.error("\n❌ TIMEOUT: Infinite loop detected!");
    console.error("The calculation did not complete within 5 seconds");
    process.exit(1);
  }, 5000);

  const startTime = Date.now();
  const result = calculateSheet(pvAnalysisSheet);
  const endTime = Date.now();

  clearTimeout(timeout);

  console.log(`✓ Calculation completed in ${endTime - startTime}ms`);
  console.log("\nResults:");
  console.log("Monthly Discount Rate (B4):", result.data[3][1]);
  console.log("Total Present Value (B5):", result.data[4][1]);
  console.log("\nFirst few months:");
  for (let i = 8; i <= 11; i++) {
    console.log(
      `Month ${result.data[i][0]}: Cash Flow ${result.data[i][1]}, PV ${result.data[i][2]}`,
    );
  }

  if (result.errors.length > 0) {
    console.log("\nErrors:");
    result.errors.forEach((error) => {
      console.log(`  ${error.cell.row},${error.cell.col}: ${error.error}`);
    });
  }

  console.log("\n✓ Test passed - no infinite loop");
  process.exit(0);
} catch (error) {
  console.error("\n❌ Test failed with error:");
  console.error(error);
  process.exit(1);
}
