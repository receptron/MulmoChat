#!/usr/bin/env node
/**
 * Re-evaluation Tool
 *
 * Re-runs verification on existing benchmark results without regenerating LLM outputs.
 * Useful after fixing bugs in the verification logic.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import type { TestCase, BenchmarkRun, VerificationResult } from "./types";
import { verifySpreadsheet } from "./verifier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

/**
 * Load all test cases from prompts directory
 */
function loadAllTestCases(): Map<string, TestCase> {
  const promptsDir = path.join(rootDir, "prompts");
  const testCases = new Map<string, TestCase>();

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
        testCases.set(testCase.id, testCase);
      }
    }
  }

  return testCases;
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
 * Calculate summary statistics
 */
function calculateSummary(results: VerificationResult[]): BenchmarkRun["summary"] {
  if (results.length === 0) {
    return {
      totalPrompts: 0,
      averageScore: 0,
      medianScore: 0,
      passRate: 0,
      perfectRate: 0,
    };
  }

  const scores = results.map((r) => r.score);
  const sortedScores = [...scores].sort((a, b) => a - b);

  const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const medianScore =
    sortedScores.length % 2 === 0
      ? (sortedScores[sortedScores.length / 2 - 1] +
          sortedScores[sortedScores.length / 2]) /
        2
      : sortedScores[Math.floor(sortedScores.length / 2)];

  const passCount = results.filter((r) => r.passed).length;
  const perfectCount = results.filter((r) => r.score === r.maxScore).length;

  return {
    totalPrompts: results.length,
    averageScore: Math.round(averageScore * 10) / 10,
    medianScore: Math.round(medianScore * 10) / 10,
    passRate: Math.round((passCount / results.length) * 100) / 100,
    perfectRate: Math.round((perfectCount / results.length) * 100) / 100,
  };
}

/**
 * Calculate statistics by level
 */
function calculateByLevel(
  results: VerificationResult[],
  testCasesMap: Map<string, TestCase>,
): BenchmarkRun["byLevel"] {
  const byLevel: BenchmarkRun["byLevel"] = {};

  for (const result of results) {
    const testCase = testCasesMap.get(result.testCaseId);
    if (!testCase) continue;

    if (!byLevel[testCase.level]) {
      byLevel[testCase.level] = {
        count: 0,
        avgScore: 0,
        passRate: 0,
      };
    }

    byLevel[testCase.level].count++;
  }

  for (const level in byLevel) {
    const levelResults = results.filter((r) => {
      const tc = testCasesMap.get(r.testCaseId);
      return tc && tc.level === parseInt(level);
    });

    const avgScore =
      levelResults.reduce((sum, r) => sum + r.score, 0) / levelResults.length;
    const passCount = levelResults.filter((r) => r.passed).length;

    byLevel[level].avgScore = Math.round(avgScore * 10) / 10;
    byLevel[level].passRate =
      Math.round((passCount / levelResults.length) * 100) / 100;
  }

  return byLevel;
}

/**
 * Calculate statistics by category
 */
function calculateByCategory(
  results: VerificationResult[],
  testCasesMap: Map<string, TestCase>,
): BenchmarkRun["byCategory"] {
  const byCategory: BenchmarkRun["byCategory"] = {};

  for (const result of results) {
    const testCase = testCasesMap.get(result.testCaseId);
    if (!testCase) continue;

    if (!byCategory[testCase.category]) {
      byCategory[testCase.category] = {
        count: 0,
        avgScore: 0,
        passRate: 0,
      };
    }

    byCategory[testCase.category].count++;
  }

  for (const category in byCategory) {
    const categoryResults = results.filter((r) => {
      const tc = testCasesMap.get(r.testCaseId);
      return tc && tc.category === category;
    });

    const avgScore =
      categoryResults.reduce((sum, r) => sum + r.score, 0) /
      categoryResults.length;
    const passCount = categoryResults.filter((r) => r.passed).length;

    byCategory[category].avgScore = Math.round(avgScore * 10) / 10;
    byCategory[category].passRate =
      Math.round((passCount / categoryResults.length) * 100) / 100;
  }

  return byCategory;
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
  benchmarkRun.byLevel = calculateByLevel(newResults, testCasesMap);
  benchmarkRun.byCategory = calculateByCategory(newResults, testCasesMap);

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
