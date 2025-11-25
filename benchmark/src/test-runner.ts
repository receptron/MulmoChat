/**
 * Test Runner
 *
 * Simple script to test the verification engine with sample data
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import type { TestCase } from "./types";
import { verifySpreadsheet } from "./verifier";

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

/**
 * Load test case from JSON file
 */
function loadTestCase(testCaseId: string): TestCase {
  // Find the test case file
  const promptsDir = path.join(rootDir, "prompts");
  const categories = fs.readdirSync(promptsDir);

  for (const category of categories) {
    const categoryPath = path.join(promptsDir, category);
    if (!fs.statSync(categoryPath).isDirectory()) continue;

    const files = fs.readdirSync(categoryPath);
    for (const file of files) {
      if (file.endsWith(".json")) {
        const filePath = path.join(categoryPath, file);
        const testCase = JSON.parse(
          fs.readFileSync(filePath, "utf-8"),
        ) as TestCase;

        if (testCase.id === testCaseId) {
          return testCase;
        }
      }
    }
  }

  throw new Error(`Test case not found: ${testCaseId}`);
}

/**
 * Run verification on a test case with provided output
 */
async function runTest(testCaseId: string, outputJson: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Testing: ${testCaseId}`);
  console.log("=".repeat(60));

  const testCase = loadTestCase(testCaseId);
  console.log(`\nTest Case: ${testCase.title}`);
  console.log(`Level: ${testCase.level} | Category: ${testCase.category}`);

  const result = await verifySpreadsheet(outputJson, testCase);

  console.log(`\n${result.passed ? "✓ PASSED" : "✗ FAILED"}`);
  console.log(`Score: ${result.score}/${result.maxScore}`);

  console.log(`\nData Presence: ${result.dataPresence.score}/${result.dataPresence.maxScore}`);
  console.log(`  Found elements: ${result.dataPresence.foundElements.join(", ")}`);
  if (result.dataPresence.missingElements.length > 0) {
    console.log(
      `  Missing elements: ${result.dataPresence.missingElements.join(", ")}`,
    );
  }

  console.log(
    `\nResult Correctness: ${result.resultCorrectness.score}/${result.resultCorrectness.maxScore}`,
  );
  console.log(
    `  Passed: ${result.resultCorrectness.passedCount}/${result.resultCorrectness.totalCount} assertions`,
  );
  for (const assertion of result.resultCorrectness.assertions) {
    const icon = assertion.passed ? "✓" : "✗";
    console.log(
      `  ${icon} ${assertion.name}: expected ${assertion.expected}, got ${assertion.actual}`,
    );
  }

  console.log(
    `\nFormula Usage: ${result.formulaUsage.score}/${result.formulaUsage.maxScore}`,
  );
  console.log(`  Formulas: ${result.formulaUsage.formulaCount}`);
  console.log(`  Hard-coded: ${result.formulaUsage.hardCodedCount}`);
  console.log(`  Functions used: ${result.formulaUsage.functionsUsed.join(", ")}`);

  console.log(
    `\nFormatting: ${result.formatting.score}/${result.formatting.maxScore}`,
  );
  console.log(`  Currency: ${result.formatting.hasCurrency ? "✓" : "✗"}`);
  console.log(`  Percentage: ${result.formatting.hasPercentage ? "✓" : "✗"}`);
  console.log(
    `  Number formatting: ${result.formatting.hasNumberFormatting ? "✓" : "✗"}`,
  );

  if (result.errors.length > 0) {
    console.log(`\nErrors:`);
    result.errors.forEach((error) => console.log(`  - ${error}`));
  }

  if (result.warnings.length > 0) {
    console.log(`\nWarnings:`);
    result.warnings.forEach((warning) => console.log(`  - ${warning}`));
  }

  console.log(`\nExecution time: ${result.executionTime}ms`);

  return result;
}

// Export for use in other scripts
export { runTest, loadTestCase };

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const testCaseId = process.argv[2];
  const outputFile = process.argv[3];

  if (!testCaseId || !outputFile) {
    console.error("Usage: tsx test-runner.ts <test-case-id> <output-json-file>");
    console.error("Example: tsx test-runner.ts basic-01 sample-output.json");
    process.exit(1);
  }

  try {
    const outputJson = fs.readFileSync(outputFile, "utf-8");
    await runTest(testCaseId, outputJson);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
