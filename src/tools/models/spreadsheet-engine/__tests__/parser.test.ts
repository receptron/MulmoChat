/**
 * Parser Unit Tests
 */

import { describe, test, expect } from "vitest";
import {
  columnToIndex,
  indexToColumn,
  parseCellRef,
  parseRangeRef,
  cellRefToA1,
} from "../parser";

describe("Parser - Column Conversion", () => {
  describe("columnToIndex", () => {
    test("converts single letters correctly", () => {
      expect(columnToIndex("A")).toBe(0);
      expect(columnToIndex("B")).toBe(1);
      expect(columnToIndex("Z")).toBe(25);
    });

    test("converts double letters correctly", () => {
      expect(columnToIndex("AA")).toBe(26);
      expect(columnToIndex("AB")).toBe(27);
      expect(columnToIndex("AZ")).toBe(51);
      expect(columnToIndex("BA")).toBe(52);
      expect(columnToIndex("ZZ")).toBe(701);
    });

    test("converts triple letters correctly", () => {
      expect(columnToIndex("AAA")).toBe(702);
      expect(columnToIndex("AAB")).toBe(703);
    });
  });

  describe("indexToColumn", () => {
    test("converts single digit indices correctly", () => {
      expect(indexToColumn(0)).toBe("A");
      expect(indexToColumn(1)).toBe("B");
      expect(indexToColumn(25)).toBe("Z");
    });

    test("converts double digit indices correctly", () => {
      expect(indexToColumn(26)).toBe("AA");
      expect(indexToColumn(27)).toBe("AB");
      expect(indexToColumn(51)).toBe("AZ");
      expect(indexToColumn(52)).toBe("BA");
      expect(indexToColumn(701)).toBe("ZZ");
    });

    test("converts triple digit indices correctly", () => {
      expect(indexToColumn(702)).toBe("AAA");
      expect(indexToColumn(703)).toBe("AAB");
    });
  });

  test("columnToIndex and indexToColumn are inverses", () => {
    // Test round-trip conversion
    for (let i = 0; i < 1000; i++) {
      const col = indexToColumn(i);
      expect(columnToIndex(col)).toBe(i);
    }

    const testCols = ["A", "Z", "AA", "AZ", "BA", "ZZ", "AAA", "XFD"];
    for (const col of testCols) {
      const index = columnToIndex(col);
      expect(indexToColumn(index)).toBe(col);
    }
  });
});

describe("Parser - Cell References", () => {
  describe("parseCellRef - basic references", () => {
    test("parses simple cell reference", () => {
      expect(parseCellRef("A1")).toEqual({ row: 0, col: 0 });
      expect(parseCellRef("B2")).toEqual({ row: 1, col: 1 });
      expect(parseCellRef("Z26")).toEqual({ row: 25, col: 25 });
    });

    test("parses double letter columns", () => {
      expect(parseCellRef("AA1")).toEqual({ row: 0, col: 26 });
      expect(parseCellRef("AB10")).toEqual({ row: 9, col: 27 });
    });
  });

  describe("parseCellRef - absolute references", () => {
    test("parses fully absolute reference ($A$1)", () => {
      expect(parseCellRef("$A$1")).toEqual({
        row: 0,
        col: 0,
        absolute: { row: true, col: true },
      });
    });

    test("parses column-absolute reference ($A1)", () => {
      expect(parseCellRef("$A1")).toEqual({
        row: 0,
        col: 0,
        absolute: { row: false, col: true },
      });
    });

    test("parses row-absolute reference (A$1)", () => {
      expect(parseCellRef("A$1")).toEqual({
        row: 0,
        col: 0,
        absolute: { row: true, col: false },
      });
    });

    test("parses mixed absolute reference ($B$5)", () => {
      expect(parseCellRef("$B$5")).toEqual({
        row: 4,
        col: 1,
        absolute: { row: true, col: true },
      });
    });
  });

  describe("parseCellRef - cross-sheet references", () => {
    test("parses simple cross-sheet reference", () => {
      expect(parseCellRef("Sheet1!A1")).toEqual({
        row: 0,
        col: 0,
        sheet: "Sheet1",
      });
    });

    test("parses quoted sheet name with spaces", () => {
      expect(parseCellRef("'My Sheet'!B2")).toEqual({
        row: 1,
        col: 1,
        sheet: "My Sheet",
      });
    });

    test("parses cross-sheet with absolute reference", () => {
      expect(parseCellRef("Sheet1!$A$1")).toEqual({
        row: 0,
        col: 0,
        sheet: "Sheet1",
        absolute: { row: true, col: true },
      });
    });
  });

  describe("parseCellRef - error handling", () => {
    test("throws on invalid reference", () => {
      expect(() => parseCellRef("invalid")).toThrow("Invalid cell reference");
      expect(() => parseCellRef("123")).toThrow("Invalid cell reference");
      expect(() => parseCellRef("A")).toThrow("Invalid cell reference");
    });
  });
});

describe("Parser - Range References", () => {
  test("parses simple range", () => {
    expect(parseRangeRef("A1:B2")).toEqual({
      start: { row: 0, col: 0 },
      end: { row: 1, col: 1 },
    });
  });

  test("parses large range", () => {
    expect(parseRangeRef("A1:Z100")).toEqual({
      start: { row: 0, col: 0 },
      end: { row: 99, col: 25 },
    });
  });

  test("parses range with absolute references", () => {
    expect(parseRangeRef("$A$1:$B$10")).toEqual({
      start: { row: 0, col: 0, absolute: { row: true, col: true } },
      end: { row: 9, col: 1, absolute: { row: true, col: true } },
    });
  });

  test("throws on invalid range", () => {
    expect(() => parseRangeRef("A1")).toThrow("Invalid range reference");
    expect(() => parseRangeRef("invalid:range")).toThrow(
      "Invalid cell reference",
    );
  });
});

describe("Parser - Cell Reference to A1", () => {
  test("converts basic cell ref to A1", () => {
    expect(cellRefToA1({ row: 0, col: 0 })).toBe("A1");
    expect(cellRefToA1({ row: 1, col: 1 })).toBe("B2");
    expect(cellRefToA1({ row: 25, col: 25 })).toBe("Z26");
  });

  test("converts absolute references to A1", () => {
    expect(
      cellRefToA1({ row: 0, col: 0, absolute: { row: true, col: true } }),
    ).toBe("$A$1");
    expect(
      cellRefToA1({ row: 0, col: 0, absolute: { row: false, col: true } }),
    ).toBe("$A1");
    expect(
      cellRefToA1({ row: 0, col: 0, absolute: { row: true, col: false } }),
    ).toBe("A$1");
  });

  test("converts cross-sheet references to A1", () => {
    expect(cellRefToA1({ row: 0, col: 0, sheet: "Sheet1" })).toBe("Sheet1!A1");
    expect(cellRefToA1({ row: 1, col: 1, sheet: "My Sheet" })).toBe(
      "'My Sheet'!B2",
    );
  });

  test("round-trip conversion works", () => {
    const testRefs = ["A1", "$A$1", "$A1", "A$1", "Sheet1!A1", "'My Sheet'!B2"];

    for (const ref of testRefs) {
      const parsed = parseCellRef(ref);
      const converted = cellRefToA1(parsed);
      // Re-parse to normalize (e.g., Sheet1!A1 vs 'Sheet1'!A1)
      const reparsed = parseCellRef(converted);
      expect(reparsed).toEqual(parsed);
    }
  });
});
