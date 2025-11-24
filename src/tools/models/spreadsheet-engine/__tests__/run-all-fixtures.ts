/**
 * Automated Test Runner for All Spreadsheet Fixtures
 *
 * Automatically discovers and runs all test fixtures in the fixtures directory.
 * No parameters needed - just run it!
 *
 * Usage:
 *   npx tsx src/tools/models/spreadsheet-engine/__tests__/run-all-fixtures.ts
 *
 * Directory Structure:
 *   fixtures/
 *   ├── input/
 *   │   ├── test1.json
 *   │   └── test2.json
 *   └── expected/
 *       ├── test1.json
 *       └── test2.json
 *
 * The test runner will automatically find all JSON files in fixtures/input/
 * and match them with corresponding files in fixtures/expected/
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { calculateSheet } from "../calculator";
import { toStringArray, expectSheetOutput } from "./test-utils";
import "../../functions/index"; // Load all functions

// Get current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define fixture directories
const FIXTURES_DIR = path.join(__dirname, "fixtures");
const INPUT_DIR = path.join(FIXTURES_DIR, "input");
const EXPECTED_DIR = path.join(FIXTURES_DIR, "expected");

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
  cellCount?: number;
  formulaCount?: number;
  errorCount?: number;
}

// Validate directories exist
if (!fs.existsSync(INPUT_DIR)) {
  console.error(`\n❌ Input directory not found: ${INPUT_DIR}\n`);
  process.exit(1);
}

if (!fs.existsSync(EXPECTED_DIR)) {
  console.error(`\n❌ Expected directory not found: ${EXPECTED_DIR}\n`);
  process.exit(1);
}

console.log("\n=== Spreadsheet Fixture Test Suite ===\n");
console.log(`Input Directory:    ${path.relative(process.cwd(), INPUT_DIR)}`);
console.log(
  `Expected Directory: ${path.relative(process.cwd(), EXPECTED_DIR)}\n`,
);

// Discover all test files
const inputFiles = fs
  .readdirSync(INPUT_DIR)
  .filter((file) => file.endsWith(".json"));

if (inputFiles.length === 0) {
  console.log("⚠ No test files found in input directory\n");
  process.exit(0);
}

console.log(`Found ${inputFiles.length} test file(s):\n`);
inputFiles.forEach((file) => {
  console.log(`  • ${file}`);
});
console.log();

const results: TestResult[] = [];
let totalDuration = 0;

// Run each test
for (const inputFile of inputFiles) {
  const testName = path.basename(inputFile, ".json");
  const inputPath = path.join(INPUT_DIR, inputFile);
  const expectedPath = path.join(EXPECTED_DIR, inputFile);

  console.log(`${"=".repeat(60)}`);
  console.log(`Test: ${testName}`);
  console.log(`${"=".repeat(60)}\n`);

  // Check if expected file exists
  if (!fs.existsSync(expectedPath)) {
    console.log(`❌ SKIP: Expected output file not found`);
    console.log(
      `   Looking for: ${path.relative(process.cwd(), expectedPath)}\n`,
    );

    results.push({
      name: testName,
      passed: false,
      error: "Expected output file not found",
      duration: 0,
    });
    continue;
  }

  try {
    // Load input spreadsheet
    const inputContent = fs.readFileSync(inputPath, "utf-8");
    const inputSheet = JSON.parse(inputContent);

    // Load expected output
    const expectedContent = fs.readFileSync(expectedPath, "utf-8");
    const expected = JSON.parse(expectedContent);

    // Validate input structure
    if (!inputSheet.data || !Array.isArray(inputSheet.data)) {
      throw new Error("Input JSON must have a 'data' array property");
    }

    // Validate expected output structure
    if (!Array.isArray(expected)) {
      throw new Error("Expected output JSON must be an array");
    }

    // Calculate spreadsheet
    const startTime = Date.now();
    const result = calculateSheet(inputSheet);
    const endTime = Date.now();
    const duration = endTime - startTime;
    totalDuration += duration;

    console.log(`✓ Calculation completed in ${duration}ms\n`);

    // Convert to string array
    const actual = toStringArray(result.data);

    // Display dimensions
    console.log("Dimensions:");
    console.log(
      `  Input:    ${inputSheet.data.length} rows × ${inputSheet.data[0]?.length || 0} columns`,
    );
    console.log(
      `  Expected: ${expected.length} rows × ${expected[0]?.length || 0} columns`,
    );
    console.log(
      `  Actual:   ${actual.length} rows × ${actual[0]?.length || 0} columns\n`,
    );

    // Compare output
    try {
      expectSheetOutput(result, expected);

      console.log("✓ All values match expected output!\n");

      // Check for calculation errors
      if (result.errors.length > 0) {
        console.log("⚠ Calculation errors detected:");
        result.errors.forEach((error) => {
          console.log(
            `  - Row ${error.cell.row}, Col ${error.cell.col}: ${error.error}`,
          );
        });
        console.log();
      }

      // Display summary
      const cellCount = actual.length * (actual[0]?.length || 0);
      console.log("Summary:");
      console.log(`  Sheet Name: ${result.name || "Unnamed"}`);
      console.log(`  Total Cells: ${cellCount}`);
      console.log(`  Formulas: ${result.formulas.length}`);
      console.log(`  Errors: ${result.errors.length}`);
      console.log();

      console.log("✓ PASSED\n");

      results.push({
        name: testName,
        passed: true,
        duration,
        cellCount,
        formulaCount: result.formulas.length,
        errorCount: result.errors.length,
      });
    } catch {
      console.log("❌ Output does not match expected values\n");

      // Find and display first few differences
      const maxRows = Math.max(expected.length, actual.length);
      const differences: string[] = [];

      for (let i = 0; i < maxRows && differences.length < 5; i++) {
        const expectedRow = expected[i] || [];
        const actualRow = actual[i] || [];
        const maxCols = Math.max(expectedRow.length, actualRow.length);

        for (let j = 0; j < maxCols && differences.length < 5; j++) {
          const expectedCell =
            expectedRow[j] !== undefined ? String(expectedRow[j]) : undefined;
          const actualCell =
            actualRow[j] !== undefined ? String(actualRow[j]) : undefined;

          if (expectedCell !== actualCell) {
            differences.push(
              `  Row ${i + 1}, Col ${j + 1}:\n` +
                `    Expected: "${expectedCell}"\n` +
                `    Actual:   "${actualCell}"`,
            );
          }
        }
      }

      if (differences.length > 0) {
        console.log("First differences found:");
        console.log(differences.join("\n"));
        console.log();
      }

      console.log("❌ FAILED\n");

      results.push({
        name: testName,
        passed: false,
        error: "Output mismatch",
        duration,
      });
    }
  } catch (error) {
    console.log("❌ Test execution failed\n");

    if (error instanceof SyntaxError) {
      console.log("JSON parsing error:");
      console.log(`  ${error.message}\n`);
    } else if (error instanceof Error) {
      console.log(`Error: ${error.message}\n`);
    } else {
      console.log(`Error: ${String(error)}\n`);
    }

    console.log("❌ FAILED\n");

    results.push({
      name: testName,
      passed: false,
      error: error instanceof Error ? error.message : String(error),
      duration: 0,
    });
  }
}

// Display final summary
console.log(`\n${"=".repeat(60)}`);
console.log("Test Suite Summary");
console.log(`${"=".repeat(60)}\n`);

const passedTests = results.filter((r) => r.passed);
const failedTests = results.filter((r) => !r.passed);

console.log(`Total Tests:   ${results.length}`);
console.log(`Passed:        ${passedTests.length} ✓`);
console.log(
  `Failed:        ${failedTests.length} ${failedTests.length > 0 ? "❌" : ""}`,
);
console.log(`Total Time:    ${totalDuration}ms\n`);

if (passedTests.length > 0) {
  console.log("Passed Tests:");
  passedTests.forEach((result) => {
    console.log(
      `  ✓ ${result.name} (${result.duration}ms, ${result.cellCount} cells, ${result.formulaCount} formulas)`,
    );
  });
  console.log();
}

if (failedTests.length > 0) {
  console.log("Failed Tests:");
  failedTests.forEach((result) => {
    console.log(`  ❌ ${result.name} - ${result.error}`);
  });
  console.log();
}

// Exit with appropriate code
if (failedTests.length > 0) {
  console.log("❌ Some tests failed\n");
  process.exit(1);
} else {
  console.log("✓ All tests passed!\n");
  process.exit(0);
}
