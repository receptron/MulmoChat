/**
 * Generic Test Runner for Spreadsheet JSON Fixtures
 *
 * Usage:
 *   npx tsx src/tools/models/spreadsheet-engine/__tests__/run-json-fixtures.ts <input.json> <expected.json>
 *
 * Example:
 *   npx tsx src/tools/models/spreadsheet-engine/__tests__/run-json-fixtures.ts \
 *     src/tools/models/spreadsheet-engine/__tests__/fixtures/pv-analysis-input.json \
 *     src/tools/models/spreadsheet-engine/__tests__/fixtures/pv-analysis-expected.json
 */

import * as fs from "fs";
import * as path from "path";
import { calculateSheet } from "../calculator";
import { toStringArray, expectSheetOutput } from "./test-utils";
import "../../functions/index"; // Load all functions

// Parse command-line arguments
const args = process.argv.slice(2);

if (args.length !== 2) {
  console.error("\n❌ Usage: npx tsx run-json-fixtures.ts <input.json> <expected.json>\n");
  console.error("Example:");
  console.error("  npx tsx run-json-fixtures.ts fixtures/pv-analysis-input.json fixtures/pv-analysis-expected.json\n");
  process.exit(1);
}

const [inputPath, expectedPath] = args;

// Resolve paths relative to current working directory
const resolvedInputPath = path.resolve(process.cwd(), inputPath);
const resolvedExpectedPath = path.resolve(process.cwd(), expectedPath);

// Validate that files exist
if (!fs.existsSync(resolvedInputPath)) {
  console.error(`\n❌ Input file not found: ${resolvedInputPath}\n`);
  process.exit(1);
}

if (!fs.existsSync(resolvedExpectedPath)) {
  console.error(`\n❌ Expected output file not found: ${resolvedExpectedPath}\n`);
  process.exit(1);
}

console.log(`\n=== Spreadsheet JSON Fixture Test ===\n`);
console.log(`Input:    ${inputPath}`);
console.log(`Expected: ${expectedPath}\n`);

try {
  // Load input spreadsheet from JSON
  const inputContent = fs.readFileSync(resolvedInputPath, "utf-8");
  const inputSheet = JSON.parse(inputContent);

  // Load expected output from JSON
  const expectedContent = fs.readFileSync(resolvedExpectedPath, "utf-8");
  const expected = JSON.parse(expectedContent);

  // Validate input structure
  if (!inputSheet.data || !Array.isArray(inputSheet.data)) {
    console.error("❌ Input JSON must have a 'data' array property\n");
    process.exit(1);
  }

  // Validate expected output structure
  if (!Array.isArray(expected)) {
    console.error("❌ Expected output JSON must be an array\n");
    process.exit(1);
  }

  console.log("Calculating spreadsheet...\n");
  const startTime = Date.now();
  const result = calculateSheet(inputSheet);
  const endTime = Date.now();

  console.log(`✓ Calculation completed in ${endTime - startTime}ms\n`);

  // Convert calculated result to string array
  const actual = toStringArray(result.data);

  // Display dimensions
  console.log("Dimensions:");
  console.log(`  Input:    ${inputSheet.data.length} rows × ${inputSheet.data[0]?.length || 0} columns`);
  console.log(`  Expected: ${expected.length} rows × ${expected[0]?.length || 0} columns`);
  console.log(`  Actual:   ${actual.length} rows × ${actual[0]?.length || 0} columns\n`);

  // Compare output
  console.log("Comparing output...\n");

  try {
    expectSheetOutput(result, expected);

    console.log("✓ All values match expected output!\n");

    // Check for errors
    if (result.errors.length > 0) {
      console.log("⚠ Errors detected during calculation:");
      result.errors.forEach(error => {
        console.log(`  - Row ${error.cell.row}, Col ${error.cell.col}: ${error.error}`);
      });
      console.log();
      process.exit(1);
    }

    // Display summary
    console.log("Summary:");
    console.log("========");
    console.log(`Sheet Name: ${result.name || "Unnamed"}`);
    console.log(`Total Cells: ${actual.length * (actual[0]?.length || 0)}`);
    console.log(`Formulas: ${result.formulas.length}`);
    console.log(`Errors: ${result.errors.length}`);
    console.log();

    console.log("✓ Test PASSED\n");
    process.exit(0);

  } catch (error) {
    console.error("❌ Output does not match expected values\n");

    // Display detailed comparison
    console.log("Expected Output:");
    console.log("================");
    expected.forEach((row, i) => {
      console.log(`Row ${i + 1}: [${row.map(c => `"${c}"`).join(", ")}]`);
    });

    console.log("\n\nActual Output:");
    console.log("==============");
    actual.forEach((row, i) => {
      console.log(`Row ${i + 1}: [${row.map(c => `"${c}"`).join(", ")}]`);
    });

    console.log("\n\nDifferences:");
    console.log("============");

    // Find and display differences
    const maxRows = Math.max(expected.length, actual.length);
    for (let i = 0; i < maxRows; i++) {
      const expectedRow = expected[i] || [];
      const actualRow = actual[i] || [];
      const maxCols = Math.max(expectedRow.length, actualRow.length);

      for (let j = 0; j < maxCols; j++) {
        const expectedCell = expectedRow[j] !== undefined ? String(expectedRow[j]) : undefined;
        const actualCell = actualRow[j] !== undefined ? String(actualRow[j]) : undefined;

        if (expectedCell !== actualCell) {
          console.log(`  Row ${i + 1}, Col ${j + 1}:`);
          console.log(`    Expected: "${expectedCell}"`);
          console.log(`    Actual:   "${actualCell}"`);
        }
      }
    }

    console.log();

    if (error instanceof Error) {
      console.error(`Error: ${error.message}\n`);
    }

    process.exit(1);
  }

} catch (error) {
  console.error("\n❌ Test failed:\n");

  if (error instanceof SyntaxError) {
    console.error("JSON parsing error:");
    console.error(error.message);
    console.error();
  } else if (error instanceof Error) {
    console.error(error.message);
    console.error();

    if (error.stack) {
      console.error("Stack trace:");
      console.error(error.stack);
      console.error();
    }
  } else {
    console.error(String(error));
    console.error();
  }

  process.exit(1);
}
