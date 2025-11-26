# Benchmark Re-Evaluation Tool

## Overview

The re-evaluation tool re-runs verification on existing benchmark results without regenerating LLM outputs. This is useful when:
- Bugs in verification logic are fixed
- Test case definitions are updated
- Scoring algorithms are improved

## Usage

### Basic Usage

Re-evaluate all benchmark results and update the files:

```bash
npm run benchmark:re-evaluate
```

### Dry Run Mode

Preview changes without modifying files:

```bash
npm run benchmark:re-evaluate -- --dry-run
```

### Verbose Mode

Show detailed information about each file being processed:

```bash
npm run benchmark:re-evaluate -- --verbose
```

### Combined Options

```bash
npm run benchmark:re-evaluate -- --dry-run --verbose
```

## How It Works

1. **Loads test cases** from `benchmark/prompts/` directory
2. **Scans result files** in `benchmark/results/` directory
3. **Re-verifies each result** using the current verification logic
4. **Updates scores** and statistics if they changed
5. **Saves updated files** (unless in dry-run mode)

## Output

The tool provides a summary showing:
- **Files processed**: Total number of result files scanned
- **Files with changes**: Number of files that had score changes
- **Total score changes**: Total number of individual test results that changed
- **Improved**: Number of scores that increased
- **Degraded**: Number of scores that decreased

### Example Output

```
🔄 Re-evaluating Benchmark Results
============================================================
📋 Loading test cases...
   Found 7 test cases

🔍 Finding result files...
   Found 23 result files

🔄 Re-evaluating results...

.......................

============================================================
Summary
============================================================
Files processed:        23
Files with changes:     13
Total score changes:    35
  ↑ Improved:           33
  ↓ Degraded:           2

✅ Files updated successfully!
============================================================
```

## Recent Changes

### 2025-11-26: Fixed Column Selection Bug

**Problem**: The verification was reading the wrong columns in spreadsheets with multiple numeric columns (e.g., percentage column vs. calculated dollar amount column).

**Fix**: Updated `findByLabel` to:
- Search the entire row instead of just adjacent cells
- Prioritize cells with formulas over static values
- Return the rightmost formula cell (typically the final result)

**Impact**:
- 13 result files updated
- 33 scores improved
- 2 scores degraded
- Overall improvement in accuracy

### Example: gemini-3-pro-preview

**Before fix:**
- Average score: 58.4/100
- Pass rate: 29%
- Median score: 49/100

**After fix:**
- Average score: 71/100 ✓ (+12.6)
- Pass rate: 71% ✓ (+42%)
- Median score: 73/100 ✓ (+24)

## Technical Details

### File Structure

Each result file (`benchmark/results/<model>/run-<timestamp>.json`) contains:
- `metadata`: Model info, timestamp, duration, config
- `summary`: Overall statistics (avg score, pass rate, etc.)
- `byLevel`: Statistics grouped by difficulty level
- `byCategory`: Statistics grouped by test category
- `results`: Array of individual test results with `generatedOutput`

### Re-verification Process

For each test result:
1. Extract `generatedOutput` (the LLM's JSON response)
2. Load the corresponding test case from `prompts/`
3. Run `verifySpreadsheet(generatedOutput, testCase)`
4. Compare new scores with old scores
5. Update the result if scores changed

### What Gets Updated

- Individual test scores and assertions
- Summary statistics (average, median, pass rate)
- Statistics by level and category

### What Doesn't Change

- `generatedOutput` (the original LLM response)
- `metadata` (timestamp, duration, model config)
- Test case definitions

## Troubleshooting

### No changes detected

If the tool reports 0 changes, it means:
- All scores are already up to date
- The verification logic hasn't changed
- Or files were already re-evaluated

### Circular reference warnings

Some spreadsheet test cases intentionally test circular references. These warnings are expected and can be ignored.

### Missing test cases

If you see warnings about missing test cases, ensure:
- All test case JSON files exist in `benchmark/prompts/`
- Test case IDs match between results and prompt files

## See Also

- [Benchmark README](README.md) - Main benchmark documentation
- [SUMMARY.md](SUMMARY.md) - Latest benchmark results summary
- `benchmark/src/verifier.ts` - Verification logic
- `benchmark/src/semantic-extractor.ts` - Spreadsheet value extraction
