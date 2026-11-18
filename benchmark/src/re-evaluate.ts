#!/usr/bin/env node
/**
 * Re-evaluation Tool
 *
 * Re-runs verification on existing benchmark results without regenerating LLM outputs.
 * Useful after fixing bugs in the verification logic.
 */

import * as fs from "fs";
import * as path from "path";
import type { TestCase, BenchmarkRun, VerificationResult } from "./types";
import { verifySpreadsheet } from "./verifier";
import {
  calculateSummary,
  calculateByLevel,
  calculateByCategory,
} from "./stats";
import { benchmarkRootDir as rootDir, readTestCaseFiles } from "./testCases";

/**
 * Load all test cases from prompts directory, keyed by id
 */
function loadAllTestCases(): Map<string, TestCase> {
  return new Map(readTestCaseFiles().map((testCase) => [testCase.id, testCase]));
}

/**
 * Find all result files
 */
function findAllResultFiles(): string[] {
  const resultsDir = path.join(rootDir, "results");
  const resultFiles: string[] = [];

  if (!fs.existsSync(resultsDir)) {
    return resultFiles;
  }

  const modelDirs = fs.readdirSync(resultsDir);
  for (const modelDir of modelDirs) {
    const modelPath = path.join(resultsDir, modelDir);
    if (!fs.statSync(modelPath).isDirectory()) continue;

    const files = fs.readdirSync(modelPath);
    for (const file of files) {
      if (file.endsWith(".json")) {
        resultFiles.push(path.join(modelPath, file));
      }
    }
  }

  return resultFiles;
}

/**
 * Re-verify a single test result
 */
async function reVerifyResult(
  result: VerificationResult,
  testCase: TestCase,
): Promise<VerificationResult> {
  const llmOutputJson = JSON.stringify(result.generatedOutput);
  return await verifySpreadsheet(llmOutputJson, testCase);
}

/**
 * Re-evaluate a single result file
 */
async function reEvaluateFile(
  filePath: string,
  testCasesMap: Map<string, TestCase>,
  dryRun: boolean = false,
): Promise<{ file: string; changes: number; improved: number; degraded: number }> {
  const benchmarkRun: BenchmarkRun = JSON.parse(
    fs.readFileSync(filePath, "utf-8"),
  );

  const oldResults = benchmarkRun.results;
  const newResults: VerificationResult[] = [];
  let changes = 0;
  let improved = 0;
  let degraded = 0;

  for (const oldResult of oldResults) {
    const testCase = testCasesMap.get(oldResult.testCaseId);

    if (!testCase) {
      console.warn(`  ⚠️  Test case not found: ${oldResult.testCaseId}`);
      newResults.push(oldResult);
      continue;
    }

    const newResult = await reVerifyResult(oldResult, testCase);
    newResults.push(newResult);

    if (newResult.score !== oldResult.score) {
      changes++;
      if (newResult.score > oldResult.score) {
        improved++;
      } else {
        degraded++;
      }
    }
  }

  // Update the benchmark run with new results
  benchmarkRun.results = newResults;
  benchmarkRun.summary = calculateSummary(newResults);
  const findTestCase = (id: string) => testCasesMap.get(id);
  benchmarkRun.byLevel = calculateByLevel(newResults, findTestCase);
  benchmarkRun.byCategory = calculateByCategory(newResults, findTestCase);

  // Save updated file (unless dry run)
  if (!dryRun && changes > 0) {
    fs.writeFileSync(filePath, JSON.stringify(benchmarkRun, null, 2));
  }

  return {
    file: path.relative(rootDir, filePath),
    changes,
    improved,
    degraded,
  };
}

/**
 * Main re-evaluation function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run") || args.includes("-d");
  const verbose = args.includes("--verbose") || args.includes("-v");

  console.log("\n🔄 Re-evaluating Benchmark Results");
  console.log("=".repeat(60));

  if (dryRun) {
    console.log("🔍 DRY RUN MODE - No files will be modified\n");
  }

  // Load test cases
  console.log("📋 Loading test cases...");
  const testCasesMap = loadAllTestCases();
  console.log(`   Found ${testCasesMap.size} test cases\n`);

  // Find all result files
  console.log("🔍 Finding result files...");
  const resultFiles = findAllResultFiles();
  console.log(`   Found ${resultFiles.size} result files\n`);

  if (resultFiles.length === 0) {
    console.log("⚠️  No result files found. Nothing to re-evaluate.");
    return;
  }

  // Re-evaluate each file
  console.log("🔄 Re-evaluating results...\n");
  let totalChanges = 0;
  let totalImproved = 0;
  let totalDegraded = 0;
  let filesWithChanges = 0;

  for (const file of resultFiles) {
    if (verbose) {
      console.log(`\n  Processing: ${path.relative(rootDir, file)}`);
    } else {
      process.stdout.write(".");
    }

    const result = await reEvaluateFile(file, testCasesMap, dryRun);

    if (result.changes > 0) {
      filesWithChanges++;
      totalChanges += result.changes;
      totalImproved += result.improved;
      totalDegraded += result.degraded;

      if (verbose) {
        console.log(`    Changes: ${result.changes}`);
        console.log(`    Improved: ${result.improved}`);
        console.log(`    Degraded: ${result.degraded}`);
      }
    }
  }

  if (!verbose) {
    console.log("\n");
  }

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("Summary");
  console.log("=".repeat(60));
  console.log(`Files processed:        ${resultFiles.length}`);
  console.log(`Files with changes:     ${filesWithChanges}`);
  console.log(`Total score changes:    ${totalChanges}`);
  console.log(`  ↑ Improved:           ${totalImproved}`);
  console.log(`  ↓ Degraded:           ${totalDegraded}`);

  if (dryRun) {
    console.log("\n💡 Run without --dry-run to save changes");
  } else if (filesWithChanges > 0) {
    console.log("\n✅ Files updated successfully!");
  } else {
    console.log("\n✅ All results are up to date!");
  }

  console.log("=".repeat(60) + "\n");
}

// Run the re-evaluation
main().catch((error) => {
  console.error("\n❌ Error:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
