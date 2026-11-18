import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateSummary,
  calculateByLevel,
  calculateByCategory,
} from "../benchmark/src/stats";
import type { TestCase } from "../benchmark/src/types";

const testCase = (
  id: string,
  level: TestCase["level"],
  category: TestCase["category"],
) => ({ id, level, category });

const result = (
  testCaseId: string,
  score: number,
  passed: boolean,
  maxScore = 100,
) => ({ testCaseId, score, maxScore, passed });

const testCases = [
  testCase("a", 1, "basic"),
  testCase("b", 1, "financial"),
  testCase("c", 2, "basic"),
];
const findTestCase = (id: string) => testCases.find((t) => t.id === id);

describe("calculateSummary", () => {
  it("is all zeros for no results", () => {
    assert.deepEqual(calculateSummary([]), {
      totalPrompts: 0,
      averageScore: 0,
      medianScore: 0,
      passRate: 0,
      perfectRate: 0,
    });
  });

  it("averages, takes the middle pair's mean as median, and rounds", () => {
    const results = [
      result("a", 100, true),
      result("b", 33, false),
      result("c", 70, true),
      result("c", 20, false),
    ];
    assert.deepEqual(calculateSummary(results), {
      totalPrompts: 4,
      averageScore: 55.8,
      medianScore: 51.5,
      passRate: 0.5,
      perfectRate: 0.25,
    });
  });

  it("takes the middle score as median for an odd count", () => {
    const results = [30, 10, 20].map((score) => result("a", score, false));
    assert.equal(calculateSummary(results).medianScore, 20);
  });
});

describe("calculateByLevel / calculateByCategory", () => {
  const results = [
    result("a", 90, true),
    result("b", 40, false),
    result("c", 75, true),
    result("unknown", 100, true),
  ];

  it("groups by the test case's level and skips results with no test case", () => {
    assert.deepEqual(calculateByLevel(results, findTestCase), {
      1: { count: 2, avgScore: 65, passRate: 0.5 },
      2: { count: 1, avgScore: 75, passRate: 1 },
    });
  });

  it("groups by category in the order categories first appear", () => {
    const byCategory = calculateByCategory(results, findTestCase);
    assert.deepEqual(Object.keys(byCategory), ["basic", "financial"]);
    assert.deepEqual(byCategory, {
      basic: { count: 2, avgScore: 82.5, passRate: 1 },
      financial: { count: 1, avgScore: 40, passRate: 0 },
    });
  });

  it("counts every grouped result exactly once", () => {
    const byLevel = calculateByLevel(results, findTestCase);
    const counted = Object.values(byLevel).reduce((sum, s) => sum + s.count, 0);
    const known = results.filter((r) => findTestCase(r.testCaseId)).length;
    assert.equal(counted, known);
  });

  it("is empty for no results", () => {
    assert.deepEqual(calculateByLevel([], findTestCase), {});
    assert.deepEqual(calculateByCategory([], findTestCase), {});
  });
});
