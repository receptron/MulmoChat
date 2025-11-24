/**
 * Test for lowercase function names bug
 * Run with: npx tsx src/tools/models/spreadsheet-engine/__tests__/run-lowercase-test.ts
 */

import { calculateSheet } from "../calculator";
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

console.log("\n=== Lowercase Function Names Test ===\n");

// Test lowercase function names
console.log("Lowercase Function Names:");

test("calculates lowercase sum", () => {
  const sheet = createSheet("Sheet1", [
    [10, 20, 30],
    ["=sum(A1:C1)"], // lowercase sum
  ]);
  const result = calculateSheet(sheet);
  const expected = [["10", "20", "30"], ["60"]];
  expectSheetOutput(result, expected);
});

test("calculates lowercase average", () => {
  const sheet = createSheet("Sheet1", [
    [10, 20, 30],
    ["=average(A1:C1)"], // lowercase average
  ]);
  const result = calculateSheet(sheet);
  const expected = [["10", "20", "30"], ["20"]];
  expectSheetOutput(result, expected);
});

test("calculates mixed case function", () => {
  const sheet = createSheet("Sheet1", [
    [10, 20, 30],
    ["=SuM(A1:C1)"], // mixed case
  ]);
  const result = calculateSheet(sheet);
  const expected = [["10", "20", "30"], ["60"]];
  expectSheetOutput(result, expected);
});

test("calculates nested lowercase functions", () => {
  const sheet = createSheet("Sheet1", [
    [10, 20, 30],
    ["=round(average(A1:C1), 2)"], // nested lowercase
  ]);
  const result = calculateSheet(sheet);
  const expected = [["10", "20", "30"], ["20"]];
  expectSheetOutput(result, expected);
});

test("PV Analysis with potential lowercase SUM", () => {
  const sheet = createSheet("Test", [
    ["Values", 100, 200],
    ["Total", "=sum(B1:C1)"], // lowercase sum
  ]);
  const result = calculateSheet(sheet);
  const expected = [
    ["Values", "100", "200"],
    ["Total", "300"],
  ];
  expectSheetOutput(result, expected);
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
