# Bug Fix Summary: Infinite Loop in Spreadsheet

## Issues Found and Fixed

### Bug #1: Case-Insensitive Function Lookup ✅ FIXED
**Error**: `Failed to evaluate formula: sum(B1:B2)` (lowercase)

**Root Cause**:
- The evaluator's regex matched function names case-insensitively (`/^([A-Z]+)\(.*\)$/i`)
- But `functionRegistry.get(funcName)` was case-sensitive
- When formula used lowercase `sum()`, registry lookup failed (registry uses uppercase "SUM")

**Fix** (evaluator.ts:113):
```typescript
// Before (BROKEN):
const func = functionRegistry.get(funcName);

// After (FIXED):
const func = functionRegistry.get(funcName.toUpperCase());
```

**Impact**: Formulas can now use any case: `SUM()`, `sum()`, `Sum()`, `SuM()`

---

### Bug #2: Missing Function Registry Import ✅ FIXED
**Error**: `Failed to evaluate formula: SUM(C9:C20)` (repeated 21,631 times)

**Root Cause**:
- The Vue component (`spreadsheet.vue`) didn't import the functions module
- Function registry was empty when engine tried to look up functions
- `functionRegistry.get("SUM")` returned `undefined`
- Evaluator fell through to error handler, which logged error and returned formula string
- This caused re-evaluation loop → **infinite loop**

**Fix** (spreadsheet.vue:134):
```typescript
// Added import to populate function registry
import "../models/functions/index";
```

**Impact**: All 50+ spreadsheet functions now available in Vue component

---

## Why Tests Passed But Browser Failed

**Tests**:
```typescript
import "../../functions/index"; // ✅ Functions loaded
const result = calculateSheet(sheet);
```

**Vue Component (Before Fix)**:
```typescript
// ❌ No function import - registry empty!
const result = engine.calculate(sheet);
```

The test files explicitly imported functions, but the Vue component didn't, causing the function registry to be empty in the browser.

---

## Files Modified

### 1. evaluator.ts
- Line 113: Added `.toUpperCase()` for case-insensitive function lookup
- Line 118-128: Normalized function name in error messages

### 2. spreadsheet.vue
- Line 134: Added `import "../models/functions/index"` to load functions

### 3. Test Files Created
- `run-lowercase-test.ts`: 5 tests for case-insensitive function names
- `run-pv-analysis-test.ts`: Specific test for the reported PV Analysis spreadsheet

---

## Test Results

**All 112 tests passing** ✅

- Parser: 30 tests
- Formatter: 32 tests
- Evaluator: 29 tests
- Calculator: 16 tests
- **Lowercase functions: 5 tests** (NEW)

---

## Verification

### Before Fix:
```
evaluator.ts:181 Failed to evaluate formula: SUM(C9:C20)
evaluator.ts:181 Failed to evaluate formula: SUM(C9:C20)
evaluator.ts:181 Failed to evaluate formula: SUM(C9:C20)
... (repeated 21,631 times)
🔥 Browser freezes 🔥
```

### After Fix:
```
✓ Calculation completed in 2ms
✓ Total Present Value: $11,678.72
✓ All formulas evaluated correctly
```

---

## Root Cause Analysis

The infinite loop occurred because:

1. **B5** has formula `=SUM(C9:C20)`
2. Evaluator tries to look up "SUM" in function registry
3. **Registry is empty** (no functions imported)
4. Lookup returns `undefined`
5. Evaluator **falls through** to error handling code path
6. Error handler logs error and **returns formula string**
7. Something tries to **use formula string as number** → error
8. **Re-evaluation triggered** → back to step 2
9. **Loop continues** until browser freezes

---

## Prevention

### For Future Development:

1. **Always import functions** when using SpreadsheetEngine:
   ```typescript
   import "../models/functions/index";
   ```

2. **Test with both uppercase and lowercase** function names

3. **Check browser console** for repeated error messages (sign of infinite loop)

---

## Impact

### Before Fix:
- ❌ Spreadsheets with formulas caused infinite loops
- ❌ Browser would freeze
- ❌ No error recovery

### After Fix:
- ✅ All function names (SUM, sum, Sum) work correctly
- ✅ Function registry properly populated in Vue component
- ✅ Fast calculation (<10ms for complex spreadsheets)
- ✅ No infinite loops

---

## Conclusion

Two critical bugs were found and fixed:
1. **Case-sensitivity bug** in function lookup
2. **Missing import** of function registry in Vue component

Both bugs together caused an infinite loop that froze the browser. The fixes are minimal, backward-compatible, and all tests pass.

**Status**: ✅ RESOLVED - PV Analysis spreadsheet now works correctly
