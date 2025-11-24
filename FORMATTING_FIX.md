# Formatting Fix: Recursive Formula Evaluation

## Issue

When formulas were recursively evaluated (e.g., `=$B$2` referencing another cell), the formatting information was lost. Cells that should display `$1,000.00` were showing `1000` instead.

## Root Cause

The calculation engine processes cells in two phases:

1. **Recursive evaluation** (during dependency resolution):
   - When `SUM(C9:C20)` is evaluated, it needs values from C9-C20
   - Each C cell has a formula like `=B9/(1+$B$4)^A9`
   - These formulas reference B cells like `=$B$2`
   - During recursive evaluation, the engine cached **numeric results** in the `calculated` array
   - This overwrote the original cell objects `{v: "=$B$2", f: "$#,##0.00"}` with plain numbers

2. **Main processing loop**:
   - The loop checked `if (cell && typeof cell === "object" && "v" in cell)`
   - But cells already evaluated were **numbers**, not objects
   - The loop skipped them, **never applying the format**

## Fix

Modified `calculator.ts` lines 265-322:

### Before (Broken):
```typescript
for (let rowIdx = 0; rowIdx < calculated.length; rowIdx++) {
  for (let colIdx = 0; colIdx < calculated[rowIdx].length; colIdx++) {
    const cell = calculated[rowIdx][colIdx]; // Gets number for pre-evaluated cells

    if (cell && typeof cell === "object" && "v" in cell) {
      // This check fails for pre-evaluated cells!
      // Formatting is never applied
    }
  }
}
```

### After (Fixed):
```typescript
for (let rowIdx = 0; rowIdx < data.length; rowIdx++) {
  for (let colIdx = 0; colIdx < data[rowIdx].length; colIdx++) {
    const originalCell = data[rowIdx][colIdx];      // Original cell with format
    const calculatedCell = calculated[rowIdx][colIdx]; // May be pre-evaluated

    // Check if already recursively evaluated
    if (typeof calculatedCell === "number" && originalCell && typeof originalCell === "object" && "f" in originalCell) {
      // Apply formatting to pre-evaluated cells
      const format = originalCell.f;
      if (format) {
        calculated[rowIdx][colIdx] = formatNumber(calculatedCell, format);
      }
      continue;
    }

    // ... rest of processing
  }
}
```

## Key Changes

1. **Loop over original data**: `for (let rowIdx = 0; rowIdx < data.length; rowIdx++)`
   - Ensures we always have access to original cell definitions

2. **Check both arrays**: Get `originalCell` from `data[][]` and `calculatedCell` from `calculated[][]`
   - Original has the format information
   - Calculated has the computed value

3. **Apply format to pre-evaluated cells**:
   ```typescript
   if (typeof calculatedCell === "number" && ... "f" in originalCell) {
     calculated[rowIdx][colIdx] = formatNumber(calculatedCell, format);
   }
   ```

## Test Results

### PV Analysis Test Output:
```
Expected:
["1", "$1,000.00", "$995.82"]
["2", "$1,000.00", "$991.65"]
...

Actual:
["1", "$1,000.00", "$995.82"]  ✅
["2", "$1,000.00", "$991.65"]  ✅
...
```

### All Tests Passing:
- ✅ Parser: 30 tests
- ✅ Formatter: 32 tests
- ✅ Evaluator: 29 tests
- ✅ Calculator: 16 tests
- ✅ Lowercase: 5 tests
- ✅ **PV Analysis: 1 test (NEW)**

**Total: 113 tests passing**

## Impact

### Before Fix:
```
Cash Flow: 1000          ❌ Missing formatting
Present Value: 995.8175  ❌ Full precision, no formatting
```

### After Fix:
```
Cash Flow: $1,000.00     ✅ Formatted
Present Value: $995.82   ✅ Formatted and rounded
```

## Files Modified

1. **calculator.ts** (lines 265-322):
   - Changed loop to iterate over original `data` array
   - Added check for pre-evaluated cells
   - Apply formatting to pre-evaluated cells before continuing

2. **run-pv-analysis-complete-test.ts** (NEW):
   - Comprehensive test with 21 rows of expected formatted output
   - Verifies all calculations and formatting
   - Tests recursive formula evaluation with formatting

## Why This Matters

Spreadsheets rely heavily on **presentation**. Users expect:
- Currency values: `$1,000.00` not `1000`
- Percentages: `5.00%` not `0.05`
- Rounded values: `$995.82` not `995.8175662218682`

Without proper formatting:
- Financial reports look unprofessional
- Values are hard to read
- Users lose confidence in calculations

## Conclusion

The fix ensures that **all cells respect their format codes**, even when their values are computed through recursive formula evaluation. This maintains the professional appearance and usability of spreadsheets.
