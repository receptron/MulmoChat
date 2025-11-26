/**
 * Benchmark Runner
 *
 * Main orchestration logic for running benchmarks against LLMs
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import type { TestCase, BenchmarkRun, VerificationResult } from "./types";
import { getLLMConfig, sanitizeConfig, DEFAULT_BENCHMARK_CONFIG } from "./config";
import { createLLMClient, extractJSON } from "./llm-client";
import { verifySpreadsheet } from "./verifier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

/**
 * Load all test cases from prompts directory
 */
export function loadAllTestCases(): TestCase[] {
  const promptsDir = path.join(rootDir, "prompts");
  const testCases: TestCase[] = [];

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
        testCases.push(testCase);
      }
    }
  }

  return testCases.sort((a, b) => {
    // Sort by level, then by id
    if (a.level !== b.level) return a.level - b.level;
    return a.id.localeCompare(b.id);
  });
}

/**
 * Filter test cases by criteria
 */
export function filterTestCases(
  testCases: TestCase[],
  options: {
    category?: string;
    level?: number;
    ids?: string[];
  },
): TestCase[] {
  let filtered = testCases;

  if (options.category) {
    filtered = filtered.filter((tc) => tc.category === options.category);
  }

  if (options.level !== undefined) {
    filtered = filtered.filter((tc) => tc.level === options.level);
  }

  if (options.ids && options.ids.length > 0) {
    filtered = filtered.filter((tc) => options.ids!.includes(tc.id));
  }

  return filtered;
}

/**
 * Run a single test case against an LLM
 */
async function runSingleTest(
  testCase: TestCase,
  modelName: string,
  verbose: boolean = false,
): Promise<VerificationResult | null> {
  if (verbose) {
    console.log(`\n  Running: ${testCase.id} - ${testCase.title}`);
  }

  try {
    // Get LLM configuration (API key loaded from env)
    const llmConfig = getLLMConfig(modelName);
    const client = createLLMClient(llmConfig);

    // Generate spreadsheet
    if (verbose) {
      console.log(`  Calling ${client.name}...`);
    }
    const response = await client.generateSpreadsheet(
      testCase.prompt,
      testCase.systemPrompt,
    );

    if (response.error) {
      console.error(`  ✗ LLM Error: ${response.error}`);
      return null;
    }

    // Extract JSON from response
    const jsonContent = extractJSON(response.content);

    if (verbose) {
      console.log(
        `  Response received (${response.latency}ms, ${response.usage?.totalTokens || 0} tokens)`,
      );
    }

    // Verify spreadsheet
    const result = await verifySpreadsheet(jsonContent, testCase);

    if (verbose) {
      const icon = result.passed ? "✓" : "✗";
      console.log(
        `  ${icon} Score: ${result.score}/${result.maxScore} (${result.executionTime}ms)`,
      );
    }

    return result;
  } catch (error) {
    console.error(
      `  ✗ Error: ${error instanceof Error ? error.message : String(error)}`,
    );
    return null;
  }
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
  testCases: TestCase[],
): BenchmarkRun["byLevel"] {
  const byLevel: BenchmarkRun["byLevel"] = {};

  for (const testCase of testCases) {
    const result = results.find((r) => r.testCaseId === testCase.id);
    if (!result) continue;

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
      const tc = testCases.find((t) => t.id === r.testCaseId);
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
  testCases: TestCase[],
): BenchmarkRun["byCategory"] {
  const byCategory: BenchmarkRun["byCategory"] = {};

  for (const testCase of testCases) {
    const result = results.find((r) => r.testCaseId === testCase.id);
    if (!result) continue;

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
      const tc = testCases.find((t) => t.id === r.testCaseId);
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
 * Run benchmark against an LLM model
 */
export async function runBenchmark(
  modelName: string,
  options: {
    category?: string;
    level?: number;
    ids?: string[];
    verbose?: boolean;
    saveResults?: boolean;
  } = {},
): Promise<BenchmarkRun> {
  const startTime = Date.now();
  const verbose = options.verbose ?? true;

  if (verbose) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`🔧 LLM Spreadsheet Benchmark`);
    console.log(`Model: ${modelName}`);
    console.log(`Date: ${new Date().toISOString().split("T")[0]}`);
    console.log("=".repeat(60));
  }

  // Load and filter test cases
  const allTestCases = loadAllTestCases();
  const testCases = filterTestCases(allTestCases, options);

  if (testCases.length === 0) {
    throw new Error("No test cases found matching criteria");
  }

  if (verbose) {
    console.log(`\nRunning ${testCases.length} test cases...`);
  }

  // Run tests sequentially (to respect rate limits)
  const results: VerificationResult[] = [];
  for (const testCase of testCases) {
    const result = await runSingleTest(testCase, modelName, verbose);
    if (result) {
      results.push(result);
    }

    // Add delay between requests
    if (DEFAULT_BENCHMARK_CONFIG.execution.retryDelayMs > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, DEFAULT_BENCHMARK_CONFIG.execution.retryDelayMs),
      );
    }
  }

  const duration = Math.round((Date.now() - startTime) / 1000);

  // Calculate statistics (API keys removed from config)
  const llmConfig = getLLMConfig(modelName);
  const sanitizedConfig = sanitizeConfig(llmConfig);

  const benchmarkRun: BenchmarkRun = {
    metadata: {
      model: modelName,
      timestamp: new Date().toISOString(),
      duration,
      config: sanitizedConfig,
    },
    summary: calculateSummary(results),
    byLevel: calculateByLevel(results, testCases),
    byCategory: calculateByCategory(results, testCases),
    results,
  };

  // Print summary
  if (verbose) {
    printSummary(benchmarkRun);
  }

  // Save results
  if (options.saveResults !== false) {
    saveResults(benchmarkRun, modelName);
  }

  return benchmarkRun;
}

/**
 * Print summary statistics
 */
function printSummary(run: BenchmarkRun): void {
  console.log(`\n${"━".repeat(60)}`);
  console.log("Summary Statistics");
  console.log("━".repeat(60));
  console.log(`Overall Score:        ${run.summary.averageScore} / 100`);
  console.log(`Pass Rate (≥70):      ${(run.summary.passRate * 100).toFixed(0)}%`);
  console.log(
    `Perfect Score Rate:   ${(run.summary.perfectRate * 100).toFixed(0)}%`,
  );

  if (Object.keys(run.byLevel).length > 0) {
    console.log(`\nBy Level:`);
    for (const level in run.byLevel) {
      const stats = run.byLevel[level];
      console.log(
        `  Level ${level}:  ${stats.avgScore} / 100  (${stats.count} tests, ${(stats.passRate * 100).toFixed(0)}% pass)`,
      );
    }
  }

  if (Object.keys(run.byCategory).length > 0) {
    console.log(`\nBy Category:`);
    for (const category in run.byCategory) {
      const stats = run.byCategory[category];
      console.log(
        `  ${category.padEnd(12)}: ${stats.avgScore.toFixed(1)} / 100  (${stats.count} tests)`,
      );
    }
  }

  console.log(`\nTime: ${formatDuration(run.metadata.duration)}`);
  console.log("━".repeat(60));
}

/**
 * Save results to file
 */
function saveResults(run: BenchmarkRun, modelName: string): void {
  const resultsDir = path.join(rootDir, "results", modelName);
  fs.mkdirSync(resultsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `run-${timestamp}.json`;
  const filepath = path.join(resultsDir, filename);

  fs.writeFileSync(filepath, JSON.stringify(run, null, 2));
  console.log(`\n💾 Results saved to: ${path.relative(process.cwd(), filepath)}`);
}

/**
 * Format duration in human-readable format
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}
