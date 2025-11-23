/**
 * Formatter Unit Tests
 */

import { describe, test, expect } from "vitest";
import { formatNumber } from "../formatter";

describe("Formatter - Currency", () => {
  test("formats basic currency with 2 decimals", () => {
    expect(formatNumber(1234.56, "$#,##0.00")).toBe("$1,234.56");
    expect(formatNumber(100, "$#,##0.00")).toBe("$100.00");
    expect(formatNumber(0, "$#,##0.00")).toBe("$0.00");
  });

  test("formats currency without decimals", () => {
    expect(formatNumber(1234.56, "$#,##0")).toBe("$1,235");
    expect(formatNumber(1234, "$#,##0")).toBe("$1,234");
    expect(formatNumber(100, "$#,##0")).toBe("$100");
  });

  test("formats negative currency", () => {
    expect(formatNumber(-1234.56, "$#,##0.00")).toBe("-$1,234.56");
    expect(formatNumber(-100, "$#,##0")).toBe("-$100");
  });

  test("formats large currency amounts", () => {
    expect(formatNumber(1000000, "$#,##0")).toBe("$1,000,000");
    expect(formatNumber(1234567.89, "$#,##0.00")).toBe("$1,234,567.89");
  });

  test("formats small currency amounts", () => {
    expect(formatNumber(0.01, "$#,##0.00")).toBe("$0.01");
    expect(formatNumber(0.99, "$#,##0.00")).toBe("$0.99");
  });
});

describe("Formatter - Percentage", () => {
  test("formats basic percentages", () => {
    expect(formatNumber(0.5, "0.00%")).toBe("50.00%");
    expect(formatNumber(0.25, "0.00%")).toBe("25.00%");
    expect(formatNumber(1, "0.00%")).toBe("100.00%");
  });

  test("formats percentages with different precision", () => {
    expect(formatNumber(0.5, "0.0%")).toBe("50.0%");
    expect(formatNumber(0.333, "0.00%")).toBe("33.30%");
    expect(formatNumber(0.6667, "0.00%")).toBe("66.67%");
  });

  test("formats percentages over 100%", () => {
    expect(formatNumber(1.5, "0.00%")).toBe("150.00%");
    expect(formatNumber(2, "0.00%")).toBe("200.00%");
    expect(formatNumber(10, "0.00%")).toBe("1000.00%");
  });

  test("formats small percentages", () => {
    expect(formatNumber(0.0001, "0.00%")).toBe("0.01%");
    expect(formatNumber(0.0417, "0.00%")).toBe("4.17%");
  });

  test("formats zero percentage", () => {
    expect(formatNumber(0, "0.00%")).toBe("0.00%");
  });
});

describe("Formatter - Integer with Commas", () => {
  test("formats integers with thousand separators", () => {
    expect(formatNumber(1234, "#,##0")).toBe("1,234");
    expect(formatNumber(1000, "#,##0")).toBe("1,000");
    expect(formatNumber(1000000, "#,##0")).toBe("1,000,000");
  });

  test("formats small integers without commas", () => {
    expect(formatNumber(100, "#,##0")).toBe("100");
    expect(formatNumber(999, "#,##0")).toBe("999");
  });

  test("rounds decimals to integers", () => {
    expect(formatNumber(1234.5, "#,##0")).toBe("1,235");
    expect(formatNumber(1234.4, "#,##0")).toBe("1,234");
  });

  test("formats negative integers", () => {
    expect(formatNumber(-1234, "#,##0")).toBe("-1,234");
    expect(formatNumber(-1000000, "#,##0")).toBe("-1,000,000");
  });

  test("formats zero", () => {
    expect(formatNumber(0, "#,##0")).toBe("0");
  });
});

describe("Formatter - Decimals", () => {
  test("formats with 2 decimal places", () => {
    expect(formatNumber(123.456, "0.00")).toBe("123.46");
    expect(formatNumber(100, "0.00")).toBe("100.00");
    expect(formatNumber(0.5, "0.00")).toBe("0.50");
  });

  test("formats with 3 decimal places", () => {
    expect(formatNumber(123.4567, "0.000")).toBe("123.457");
    expect(formatNumber(100, "0.000")).toBe("100.000");
  });

  test("formats decimals with commas", () => {
    expect(formatNumber(1234.567, "#,##0.00")).toBe("1,234.57");
    expect(formatNumber(1234567.89, "#,##0.00")).toBe("1,234,567.89");
  });

  test("rounds decimals correctly", () => {
    expect(formatNumber(1.235, "0.00")).toBe("1.24");
    expect(formatNumber(1.234, "0.00")).toBe("1.23");
  });
});

describe("Formatter - Edge Cases", () => {
  test("returns plain number when format is empty", () => {
    expect(formatNumber(1234.56, "")).toBe("1234.56");
  });

  test("handles very large numbers", () => {
    expect(formatNumber(9999999999, "$#,##0")).toBe("$9,999,999,999");
    expect(formatNumber(1e10, "#,##0")).toBe("10,000,000,000");
  });

  test("handles very small decimals", () => {
    expect(formatNumber(0.00001, "0.00000")).toBe("0.00001");
    expect(formatNumber(0.000001, "0.000000")).toBe("0.000001");
  });

  test("handles zero with different formats", () => {
    expect(formatNumber(0, "$#,##0.00")).toBe("$0.00");
    expect(formatNumber(0, "0.00%")).toBe("0.00%");
    expect(formatNumber(0, "#,##0")).toBe("0");
    expect(formatNumber(0, "0.00")).toBe("0.00");
  });

  test("handles negative zero", () => {
    expect(formatNumber(-0, "$#,##0.00")).toBe("$0.00");
  });
});

describe("Formatter - Error Handling", () => {
  test("returns string representation on error", () => {
    // Should not throw, should return string
    const result = formatNumber(1234.56, "invalid format");
    expect(typeof result).toBe("string");
    expect(result).toBe("1234.56");
  });
});
