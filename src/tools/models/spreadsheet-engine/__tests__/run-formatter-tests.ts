/**
 * Formatter Tests
 * Run with: tsx src/tools/models/spreadsheet-engine/__tests__/run-formatter-tests.ts
 */

import { formatNumber } from "../formatter";

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
  }
}

function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected) {
        throw new Error(`Expected "${expected}", got "${actual}"`);
      }
    },
  };
}

console.log("\n=== Formatter Tests ===\n");

// Currency formatting
console.log("Currency Formatting:");
test("$#,##0.00: 1234.56", () => {
  expect(formatNumber(1234.56, "$#,##0.00")).toBe("$1,234.56");
});
test("$#,##0.00: 100", () => {
  expect(formatNumber(100, "$#,##0.00")).toBe("$100.00");
});
test("$#,##0.00: 0", () => {
  expect(formatNumber(0, "$#,##0.00")).toBe("$0.00");
});
test("$#,##0: 1234.56 (rounds)", () => {
  expect(formatNumber(1234.56, "$#,##0")).toBe("$1,235");
});
test("$#,##0: 1234", () => {
  expect(formatNumber(1234, "$#,##0")).toBe("$1,234");
});
test("$#,##0.00: -1234.56 (negative)", () => {
  expect(formatNumber(-1234.56, "$#,##0.00")).toBe("-$1,234.56");
});
test("$#,##0: 1000000 (large)", () => {
  expect(formatNumber(1000000, "$#,##0")).toBe("$1,000,000");
});

// Percentage formatting
console.log("\nPercentage Formatting:");
test("0.00%: 0.5", () => {
  expect(formatNumber(0.5, "0.00%")).toBe("50.00%");
});
test("0.00%: 0.25", () => {
  expect(formatNumber(0.25, "0.00%")).toBe("25.00%");
});
test("0.00%: 1", () => {
  expect(formatNumber(1, "0.00%")).toBe("100.00%");
});
test("0.0%: 0.5", () => {
  expect(formatNumber(0.5, "0.0%")).toBe("50.0%");
});
test("0.00%: 0.333", () => {
  expect(formatNumber(0.333, "0.00%")).toBe("33.30%");
});
test("0.00%: 1.5 (>100%)", () => {
  expect(formatNumber(1.5, "0.00%")).toBe("150.00%");
});
test("0.00%: 0.0417 (small)", () => {
  expect(formatNumber(0.0417, "0.00%")).toBe("4.17%");
});
test("0.00%: 0", () => {
  expect(formatNumber(0, "0.00%")).toBe("0.00%");
});

// Integer with commas
console.log("\nInteger with Commas:");
test("#,##0: 1234", () => {
  expect(formatNumber(1234, "#,##0")).toBe("1,234");
});
test("#,##0: 1000", () => {
  expect(formatNumber(1000, "#,##0")).toBe("1,000");
});
test("#,##0: 1000000", () => {
  expect(formatNumber(1000000, "#,##0")).toBe("1,000,000");
});
test("#,##0: 100 (no commas)", () => {
  expect(formatNumber(100, "#,##0")).toBe("100");
});
test("#,##0: 1234.5 (rounds)", () => {
  expect(formatNumber(1234.5, "#,##0")).toBe("1,235");
});
test("#,##0: -1234 (negative)", () => {
  expect(formatNumber(-1234, "#,##0")).toBe("-1,234");
});
test("#,##0: 0", () => {
  expect(formatNumber(0, "#,##0")).toBe("0");
});

// Decimal formatting
console.log("\nDecimal Formatting:");
test("0.00: 123.456", () => {
  expect(formatNumber(123.456, "0.00")).toBe("123.46");
});
test("0.00: 100", () => {
  expect(formatNumber(100, "0.00")).toBe("100.00");
});
test("0.00: 0.5", () => {
  expect(formatNumber(0.5, "0.00")).toBe("0.50");
});
test("0.000: 123.4567", () => {
  expect(formatNumber(123.4567, "0.000")).toBe("123.457");
});
test("#,##0.00: 1234.567", () => {
  expect(formatNumber(1234.567, "#,##0.00")).toBe("1,234.57");
});
test("0.00: 1.235 (rounds up)", () => {
  expect(formatNumber(1.235, "0.00")).toBe("1.24");
});
test("0.00: 1.234 (rounds down)", () => {
  expect(formatNumber(1.234, "0.00")).toBe("1.23");
});

// Edge cases
console.log("\nEdge Cases:");
test("empty format: 1234.56", () => {
  expect(formatNumber(1234.56, "")).toBe("1234.56");
});
test("$#,##0: very large number", () => {
  expect(formatNumber(9999999999, "$#,##0")).toBe("$9,999,999,999");
});
test("0.00000: very small decimal", () => {
  expect(formatNumber(0.00001, "0.00000")).toBe("0.00001");
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
