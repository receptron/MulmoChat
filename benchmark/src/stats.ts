/**
 * Benchmark statistics shared by the runner and the re-evaluation tool
 */

import type { TestCase, BenchmarkRun, VerificationResult } from "./types";

type ScoredResult = Pick<
  VerificationResult,
  "testCaseId" | "score" | "maxScore" | "passed"
>;
type GroupStats = BenchmarkRun["byCategory"][string];
type FindTestCase = (
  testCaseId: string,
) => Pick<TestCase, "level" | "category"> | undefined;

const roundToTenth = (value: number): number => Math.round(value * 10) / 10;
const roundToHundredth = (value: number): number =>
  Math.round(value * 100) / 100;

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
};

/**
 * Calculate summary statistics
 */
export function calculateSummary(
  results: ScoredResult[],
): BenchmarkRun["summary"] {
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
  const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const passCount = results.filter((r) => r.passed).length;
  const perfectCount = results.filter((r) => r.score === r.maxScore).length;

  return {
    totalPrompts: results.length,
    averageScore: roundToTenth(averageScore),
    medianScore: roundToTenth(median(scores)),
    passRate: roundToHundredth(passCount / results.length),
    perfectRate: roundToHundredth(perfectCount / results.length),
  };
}

const groupResults = (
  results: ScoredResult[],
  groupKeyOf: (result: ScoredResult) => string | undefined,
): Map<string, ScoredResult[]> =>
  results.reduce((groups, result) => {
    const key = groupKeyOf(result);
    if (key !== undefined) {
      groups.set(key, [...(groups.get(key) ?? []), result]);
    }
    return groups;
  }, new Map<string, ScoredResult[]>());

const statsOf = (group: ScoredResult[]): GroupStats => {
  const scoreSum = group.reduce((sum, r) => sum + r.score, 0);
  const passCount = group.filter((r) => r.passed).length;
  return {
    count: group.length,
    avgScore: roundToTenth(scoreSum / group.length),
    passRate: roundToHundredth(passCount / group.length),
  };
};

const calculateByGroup = (
  results: ScoredResult[],
  groupKeyOf: (result: ScoredResult) => string | undefined,
): Record<string, GroupStats> =>
  Object.fromEntries(
    [...groupResults(results, groupKeyOf)].map(([key, group]) => [
      key,
      statsOf(group),
    ]),
  );

/**
 * Calculate statistics by level
 */
export function calculateByLevel(
  results: ScoredResult[],
  findTestCase: FindTestCase,
): BenchmarkRun["byLevel"] {
  return calculateByGroup(results, (r) => {
    const level = findTestCase(r.testCaseId)?.level;
    return level === undefined ? undefined : String(level);
  });
}

/**
 * Calculate statistics by category
 */
export function calculateByCategory(
  results: ScoredResult[],
  findTestCase: FindTestCase,
): BenchmarkRun["byCategory"] {
  return calculateByGroup(results, (r) => findTestCase(r.testCaseId)?.category);
}
