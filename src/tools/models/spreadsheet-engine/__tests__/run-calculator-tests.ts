/**
 * Calculator Tests with Array-Based Output Comparison
 * Run with: npx tsx src/tools/models/spreadsheet-engine/__tests__/run-calculator-tests.ts
 */

import { calculateSheet, calculateWorkbook } from "../calculator";
import { createSheet, toStringArray, expectSheetOutput } from "./test-utils";
import "../../functions/index"; // Load all functions

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
    console.error(`  ${message}`);
  }
}

console.log("\n=== Calculator Tests - Array Output Comparison ===\n");

// Simple formulas
console.log("Simple Formulas:");
test("calculates addition formula", () => {
  const sheet = createSheet("Sheet1", [[10, 20, "=A1+B1"]]);
  const result = calculateSheet(sheet);
  const expected = [["10", "20", "30"]];
  expectSheetOutput(result, expected);
});

test("calculates multiplication formula", () => {
  const sheet = createSheet("Sheet1", [[5, 4, "=A1*B1"]]);
  const result = calculateSheet(sheet);
  const expected = [["5", "4", "20"]];
  expectSheetOutput(result, expected);
});

test("calculates division formula", () => {
  const sheet = createSheet("Sheet1", [[20, 4, "=A1/B1"]]);
  const result = calculateSheet(sheet);
  const expected = [["20", "4", "5"]];
  expectSheetOutput(result, expected);
});

// Sales calculation with formatting
console.log("\nSales Calculation with Formatting:");
test("sales table with formulas and formatting", () => {
  const sheet = {
    name: "Sales",
    data: [
      [{ v: "Product" }, { v: "Price" }, { v: "Qty" }, { v: "Total" }],
      [
        { v: "Widget" },
        { v: 10, f: "$#,##0.00" },
        { v: 100 },
        { v: "=B2*C2", f: "$#,##0.00" },
      ],
      [
        { v: "Gadget" },
        { v: 25, f: "$#,##0.00" },
        { v: 50 },
        { v: "=B3*C3", f: "$#,##0.00" },
      ],
      [
        { v: "Total" },
        { v: "" },
        { v: "=C2+C3" },
        { v: "=SUM(D2:D3)", f: "$#,##0.00" },
      ],
    ],
  };

  const result = calculateSheet(sheet);

  const expected = [
    ["Product", "Price", "Qty", "Total"],
    ["Widget", "$10.00", "100", "$1,000.00"],
    ["Gadget", "$25.00", "50", "$1,250.00"],
    ["Total", "", "150", "$2,250.00"],
  ];

  expectSheetOutput(result, expected);
});

// Percentage calculations
console.log("\nPercentage Calculations:");
test("year-over-year growth percentages", () => {
  const sheet = createSheet("Growth", [
    ["Year", "Revenue", "Growth"],
    [2022, 100000, ""],
    [2023, 120000, { v: "=B3/B2-1", f: "0.00%" }],
    [2024, 150000, { v: "=B4/B3-1", f: "0.00%" }],
  ]);

  const result = calculateSheet(sheet);

  const expected = [
    ["Year", "Revenue", "Growth"],
    ["2022", "100000", ""],
    ["2023", "120000", "20.00%"],
    ["2024", "150000", "25.00%"],
  ];

  expectSheetOutput(result, expected);
});

// Financial model with multiple formula types
console.log("\nFinancial Model:");
test("quarterly budget with SUM and AVERAGE", () => {
  const sheet = createSheet("Budget", [
    ["Category", "Q1", "Q2", "Q3", "Q4", "Total", "Avg"],
    ["Marketing", 5000, 6000, 5500, 7000, "=SUM(B2:E2)", "=AVERAGE(B2:E2)"],
    [
      "Engineering",
      15000,
      16000,
      15500,
      17000,
      "=SUM(B3:E3)",
      "=AVERAGE(B3:E3)",
    ],
    ["Sales", 8000, 9000, 8500, 10000, "=SUM(B4:E4)", "=AVERAGE(B4:E4)"],
    [
      "Total",
      "=SUM(B2:B4)",
      "=SUM(C2:C4)",
      "=SUM(D2:D4)",
      "=SUM(E2:E4)",
      "=SUM(F2:F4)",
      "=AVERAGE(F2:F4)",
    ],
  ]);

  const result = calculateSheet(sheet);

  const expected = [
    ["Category", "Q1", "Q2", "Q3", "Q4", "Total", "Avg"],
    ["Marketing", "5000", "6000", "5500", "7000", "23500", "5875"],
    ["Engineering", "15000", "16000", "15500", "17000", "63500", "15875"],
    ["Sales", "8000", "9000", "8500", "10000", "35500", "8875"],
    [
      "Total",
      "28000",
      "31000",
      "29500",
      "34000",
      "122500",
      "40833.333333333336",
    ],
  ];

  expectSheetOutput(result, expected);
});

// Statistical functions
console.log("\nStatistical Functions:");
test("MAX, MIN, MEDIAN calculations", () => {
  const sheet = createSheet("Stats", [
    ["Values", 10, 50, 30, 20, 40],
    ["MAX", "=MAX(B1:F1)"],
    ["MIN", "=MIN(B1:F1)"],
    ["AVERAGE", "=AVERAGE(B1:F1)"],
    ["MEDIAN", "=MEDIAN(B1:F1)"],
  ]);

  const result = calculateSheet(sheet);

  const expected = [
    ["Values", "10", "50", "30", "20", "40"],
    ["MAX", "50"],
    ["MIN", "10"],
    ["AVERAGE", "30"],
    ["MEDIAN", "30"],
  ];

  expectSheetOutput(result, expected);
});

// Math functions
console.log("\nMath Functions:");
test("ROUND, ABS, POWER functions", () => {
  const sheet = createSheet("Math", [
    ["ROUND(3.14159, 2)", "=ROUND(3.14159, 2)"],
    ["ABS(-42)", "=ABS(-42)"],
    ["POWER(2, 8)", "=POWER(2, 8)"],
    ["SQRT(144)", "=SQRT(144)"],
  ]);

  const result = calculateSheet(sheet);

  const expected = [
    ["ROUND(3.14159, 2)", "3.14"],
    ["ABS(-42)", "42"],
    ["POWER(2, 8)", "256"],
    ["SQRT(144)", "12"],
  ];

  expectSheetOutput(result, expected);
});

// Cross-sheet references
console.log("\nCross-Sheet References:");
test("calculates cross-sheet references", () => {
  const sheets = [
    createSheet("Sheet1", [[100]]),
    createSheet("Sheet2", [["=Sheet1!A1*2"]]),
  ];

  const results = calculateWorkbook(sheets);

  expectSheetOutput(results[0], [["100"]]);
  expectSheetOutput(results[1], [["200"]]);
});

test("complex cross-sheet workbook", () => {
  const sheets = [
    createSheet("Revenue", [
      ["Month", "Amount"],
      ["January", { v: 10000, f: "$#,##0" }],
      ["February", { v: 12000, f: "$#,##0" }],
      ["March", { v: 11000, f: "$#,##0" }],
    ]),
    createSheet("Summary", [
      ["Total Revenue", { v: "=SUM(Revenue!B2:B4)", f: "$#,##0" }],
      ["Average Revenue", { v: "=AVERAGE(Revenue!B2:B4)", f: "$#,##0" }],
      ["Max Revenue", { v: "=MAX(Revenue!B2:B4)", f: "$#,##0" }],
    ]),
  ];

  const results = calculateWorkbook(sheets);

  // Verify Revenue sheet
  const expectedRevenue = [
    ["Month", "Amount"],
    ["January", "$10,000"],
    ["February", "$12,000"],
    ["March", "$11,000"],
  ];
  expectSheetOutput(results[0], expectedRevenue);

  // Verify Summary sheet
  const expectedSummary = [
    ["Total Revenue", "$33,000"],
    ["Average Revenue", "$11,000"],
    ["Max Revenue", "$12,000"],
  ];
  expectSheetOutput(results[1], expectedSummary);
});

// Nested formulas
console.log("\nNested Formulas:");
test("simple SUM of first row", () => {
  const sheet = createSheet("Simple", [
    ["Values", 10, 20, 30],
    ["Sum", "=SUM(B1:D1)"],
  ]);

  const result = calculateSheet(sheet);

  const expected = [
    ["Values", "10", "20", "30"],
    ["Sum", "60"],
  ];

  expectSheetOutput(result, expected);
});

test("simple COUNT of first row", () => {
  const sheet = createSheet("Count", [
    ["Values", 10, 20, 30],
    ["Count", "=COUNT(B1:D1)"],
  ]);

  const result = calculateSheet(sheet);

  const expected = [
    ["Values", "10", "20", "30"],
    ["Count", "3"],
  ];

  expectSheetOutput(result, expected);
});

test("simple division SUM/COUNT", () => {
  const sheet = createSheet("Division", [
    ["Values", 10, 20, 30],
    ["Average", "=SUM(B1:D1)/COUNT(B1:D1)"],
  ]);

  const result = calculateSheet(sheet);

  const expected = [
    ["Values", "10", "20", "30"],
    ["Average", "20"],
  ];

  expectSheetOutput(result, expected);
});

test("nested ROUND(SUM/COUNT)", () => {
  const sheet = createSheet("Nested", [
    ["Values", 10, 20, 30],
    ["Average (rounded)", "=ROUND(SUM(B1:D1)/COUNT(B1:D1), 2)"],
  ]);

  const result = calculateSheet(sheet);

  const expected = [
    ["Values", "10", "20", "30"],
    ["Average (rounded)", "20"],
  ];

  expectSheetOutput(result, expected);
});

// Commission calculation
console.log("\nCommission Calculation:");
test("sales commission with rates", () => {
  const sheet = {
    name: "Commission",
    data: [
      [{ v: "Sales Rep" }, { v: "Sales" }, { v: "Rate" }, { v: "Commission" }],
      [
        { v: "Alice" },
        { v: 50000, f: "$#,##0" },
        { v: 0.05, f: "0.00%" },
        { v: "=B2*C2", f: "$#,##0.00" },
      ],
      [
        { v: "Bob" },
        { v: 75000, f: "$#,##0" },
        { v: 0.07, f: "0.00%" },
        { v: "=B3*C3", f: "$#,##0.00" },
      ],
      [
        { v: "Total" },
        { v: "=SUM(B2:B3)", f: "$#,##0" },
        { v: "" },
        { v: "=SUM(D2:D3)", f: "$#,##0.00" },
      ],
    ],
  };

  const result = calculateSheet(sheet);

  const expected = [
    ["Sales Rep", "Sales", "Rate", "Commission"],
    ["Alice", "$50,000", "5.00%", "$2,500.00"],
    ["Bob", "$75,000", "7.00%", "$5,250.00"],
    ["Total", "$125,000", "", "$7,750.00"],
  ];

  expectSheetOutput(result, expected);
});

// Error detection
console.log("\nError Detection:");
test("detects circular references", () => {
  const sheet = createSheet("Circular", [["=B1", "=A1"]]);

  const result = calculateSheet(sheet);

  // Should have errors
  if (result.errors.length === 0) {
    throw new Error("Expected circular reference errors but got none");
  }
  if (result.errors[0].type !== "circular") {
    throw new Error(
      `Expected circular error type, got ${result.errors[0].type}`,
    );
  }
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
