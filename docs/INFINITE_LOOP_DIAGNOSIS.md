# Infinite Loop Diagnosis - PV Analysis Spreadsheet

## Summary

Investigated reported infinite loop issue with SUM function in PV Analysis spreadsheet. **Tests show the calculation engine works correctly** - no infinite loop in the engine itself.

## Test Results ✅

### Test 1: Direct Engine Test
```bash
npx tsx src/tools/models/spreadsheet-engine/__tests__/run-pv-analysis-test.ts
```
**Result**: ✅ PASSED - Calculation completed in 1ms
- Monthly Discount Rate (B4): 0.42%
- Total Present Value (B5): $11,678.72
- All 12 months calculated correctly

### Test 2: Re-calculation Test
```bash
npx tsx src/tools/models/spreadsheet-engine/__tests__/run-recalc-test.ts
```
**Result**: ✅ PASSED - Multiple re-calculations work fine
- Single calculation: Works
- Re-calculate same data: Works
- Calculate with formatted results: Works
- 10 rapid calculations: All work

## Diagnosis

The spreadsheet calculation engine itself is working correctly. The infinite loop, if occurring, must be in the **Vue component's reactivity system**, not in the calculation logic.

## Fixes Applied

### 1. Added Debug Logging
The `renderedHtml` computed property now logs:
```
[Spreadsheet] renderedHtml computed - starting calculation
[Spreadsheet] Calling calculateFormulas for sheet: PV Analysis
[Spreadsheet] Calculation took XXms
[Spreadsheet] Total render time: XXms
```

### 2. Added Infinite Loop Detector
If `calculateFormulas` is called more than 10 times within 100ms, it will:
- Log an error: `INFINITE LOOP DETECTED - compute called N times in rapid succession`
- Throw an error to stop the loop
- Display error message to user

### 3. Enhanced Error Reporting
All errors now include:
- Detailed error messages
- Stack traces
- Timing information

## How to Test

1. **Load the PV Analysis spreadsheet** in the browser
2. **Open Developer Console** (F12 or Cmd+Option+I)
3. **Watch for log messages**:
   - Normal behavior: You should see 1-2 calculation logs
   - Infinite loop: You'll see repeated calculation logs and an error

### Expected Console Output (Normal):
```
[Spreadsheet] renderedHtml computed - starting calculation
[Spreadsheet] Calling calculateFormulas for sheet: PV Analysis
[Spreadsheet] Calculation took 2.50ms
[Spreadsheet] Total render time: 15.30ms
```

### Expected Console Output (Infinite Loop):
```
[Spreadsheet] renderedHtml computed - starting calculation
[Spreadsheet] Calling calculateFormulas for sheet: PV Analysis
[Spreadsheet] Calculation took 2.50ms
[Spreadsheet] renderedHtml computed - starting calculation
[Spreadsheet] Calling calculateFormulas for sheet: PV Analysis
[Spreadsheet] Calculation took 2.50ms
[Spreadsheet] INFINITE LOOP DETECTED - compute called 11 times in rapid succession
Error: Infinite computation loop detected...
```

## Possible Causes (if infinite loop occurs)

1. **Vue Reactivity Issue**: The computed property triggers itself
2. **Watcher Loop**: A watcher modifies data that triggers the computed property
3. **Parent Component**: The parent component is updating props repeatedly
4. **XLSX Library**: The `sheet_to_html` function causes issues

## Spreadsheet Structure

The PV Analysis spreadsheet has:
- **B5**: `=SUM(C9:C20)` - Sums all present values
- **C9-C20**: `=B9/(1+$B$4)^A9` - Present value formulas
- **B9-B20**: `=$B$2` - References to monthly income
- **B4**: `=B3/12` - Monthly discount rate
- **B3**: 0.05 (annual discount rate)
- **B2**: 1000 (monthly income)

**Dependency Chain**:
1. B5 depends on C9:C20
2. Each C cell depends on B cells and B4
3. B cells depend on B2
4. B4 depends on B3
5. B2 and B3 are constants

**Max Recursion Depth**: 3-4 levels (well within safe limits)

## Next Steps

### If No Infinite Loop is Detected:
The issue was likely a one-time glitch or browser-specific issue. The safeguards will prevent future occurrences.

### If Infinite Loop is Detected:
1. **Check console logs** to see which component is triggering re-computation
2. **Check Parent Component**: See if `App.vue` or parent is updating props
3. **Check Browser**: Try different browser (Chrome, Firefox, Safari)
4. **Reduce Logging**: Remove debug logs once issue is identified

### If Calculation is Just Slow:
- The PV Analysis has 12 complex formulas with exponentiation
- Each formula is evaluated recursively
- Total calculation time should be < 10ms
- If > 100ms, there might be a performance issue

## Test Files Created

1. `run-pv-analysis-test.ts` - Direct test of PV Analysis sheet
2. `run-recalc-test.ts` - Test re-calculation scenarios

Both tests pass successfully, confirming the engine works correctly.

## Conclusion

The spreadsheet calculation engine is working correctly. The infinite loop detector and debug logging will help identify if there's a Vue reactivity issue causing repeated re-computation.

**Action Required**: Load the spreadsheet in browser and check console logs to confirm whether an infinite loop actually occurs.
