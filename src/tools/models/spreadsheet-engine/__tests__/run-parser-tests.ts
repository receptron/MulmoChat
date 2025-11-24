/**
 * Parser Tests
 * Run with: tsx src/tools/models/spreadsheet-engine/__tests__/run-parser-tests.ts
 */

import {
  columnToIndex,
  indexToColumn,
  parseCellRef,
  parseRangeRef,
  cellRefToA1,
} from "../parser";

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
        throw new Error(`Expected ${expected}, got ${actual}`);
      }
    },
    toEqual(expected: any) {
      const actualStr = JSON.stringify(actual);
      const expectedStr = JSON.stringify(expected);
      if (actualStr !== expectedStr) {
        throw new Error(`Expected ${expectedStr}, got ${actualStr}`);
      }
    },
    toThrow(message?: string) {
      if (typeof actual !== "function") {
        throw new Error("Expected a function");
      }
      try {
        actual();
        throw new Error("Expected function to throw");
      } catch (error) {
        if (message) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          if (!errorMessage.includes(message)) {
            throw new Error(
              `Expected error to include "${message}", got "${errorMessage}"`,
            );
          }
        }
      }
    },
  };
}

console.log("\n=== Parser Tests ===\n");

// Column conversion tests
console.log("Column Conversion:");
test("columnToIndex: A -> 0", () => expect(columnToIndex("A")).toBe(0));
test("columnToIndex: B -> 1", () => expect(columnToIndex("B")).toBe(1));
test("columnToIndex: Z -> 25", () => expect(columnToIndex("Z")).toBe(25));
test("columnToIndex: AA -> 26", () => expect(columnToIndex("AA")).toBe(26));
test("columnToIndex: AB -> 27", () => expect(columnToIndex("AB")).toBe(27));
test("columnToIndex: ZZ -> 701", () => expect(columnToIndex("ZZ")).toBe(701));

test("indexToColumn: 0 -> A", () => expect(indexToColumn(0)).toBe("A"));
test("indexToColumn: 1 -> B", () => expect(indexToColumn(1)).toBe("B"));
test("indexToColumn: 25 -> Z", () => expect(indexToColumn(25)).toBe("Z"));
test("indexToColumn: 26 -> AA", () => expect(indexToColumn(26)).toBe("AA"));
test("indexToColumn: 701 -> ZZ", () => expect(indexToColumn(701)).toBe("ZZ"));

// Round-trip conversion
console.log("\nRound-trip Conversion:");
test("round-trip: 0 -> A -> 0", () => {
  expect(columnToIndex(indexToColumn(0))).toBe(0);
});
test("round-trip: 26 -> AA -> 26", () => {
  expect(columnToIndex(indexToColumn(26))).toBe(26);
});
test("round-trip: 701 -> ZZ -> 701", () => {
  expect(columnToIndex(indexToColumn(701))).toBe(701);
});

// Cell reference parsing
console.log("\nBasic Cell References:");
test("parseCellRef: A1", () => {
  expect(parseCellRef("A1")).toEqual({ row: 0, col: 0 });
});
test("parseCellRef: B2", () => {
  expect(parseCellRef("B2")).toEqual({ row: 1, col: 1 });
});
test("parseCellRef: Z26", () => {
  expect(parseCellRef("Z26")).toEqual({ row: 25, col: 25 });
});
test("parseCellRef: AA1", () => {
  expect(parseCellRef("AA1")).toEqual({ row: 0, col: 26 });
});

console.log("\nAbsolute References:");
test("parseCellRef: $A$1", () => {
  expect(parseCellRef("$A$1")).toEqual({
    row: 0,
    col: 0,
    absolute: { row: true, col: true },
  });
});
test("parseCellRef: $A1", () => {
  expect(parseCellRef("$A1")).toEqual({
    row: 0,
    col: 0,
    absolute: { row: false, col: true },
  });
});
test("parseCellRef: A$1", () => {
  expect(parseCellRef("A$1")).toEqual({
    row: 0,
    col: 0,
    absolute: { row: true, col: false },
  });
});

console.log("\nCross-Sheet References:");
test("parseCellRef: Sheet1!A1", () => {
  expect(parseCellRef("Sheet1!A1")).toEqual({
    row: 0,
    col: 0,
    sheet: "Sheet1",
  });
});
test("parseCellRef: 'My Sheet'!B2", () => {
  expect(parseCellRef("'My Sheet'!B2")).toEqual({
    row: 1,
    col: 1,
    sheet: "My Sheet",
  });
});

console.log("\nError Cases:");
test("parseCellRef: throws on invalid", () => {
  expect(() => parseCellRef("invalid")).toThrow("Invalid cell reference");
});

// Range parsing
console.log("\nRange References:");
test("parseRangeRef: A1:B2", () => {
  expect(parseRangeRef("A1:B2")).toEqual({
    start: { row: 0, col: 0 },
    end: { row: 1, col: 1 },
  });
});
test("parseRangeRef: A1:Z100", () => {
  expect(parseRangeRef("A1:Z100")).toEqual({
    start: { row: 0, col: 0 },
    end: { row: 99, col: 25 },
  });
});

// Cell ref to A1
console.log("\nCell Ref to A1:");
test("cellRefToA1: basic", () => {
  expect(cellRefToA1({ row: 0, col: 0 })).toBe("A1");
});
test("cellRefToA1: absolute", () => {
  expect(
    cellRefToA1({ row: 0, col: 0, absolute: { row: true, col: true } }),
  ).toBe("$A$1");
});
test("cellRefToA1: cross-sheet", () => {
  expect(cellRefToA1({ row: 0, col: 0, sheet: "Sheet1" })).toBe("Sheet1!A1");
});
test("cellRefToA1: cross-sheet with spaces", () => {
  expect(cellRefToA1({ row: 1, col: 1, sheet: "My Sheet" })).toBe(
    "'My Sheet'!B2",
  );
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
