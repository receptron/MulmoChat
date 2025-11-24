# Spreadsheet Test Fixtures

This directory contains JSON-based test fixtures for the spreadsheet calculation engine.

## Directory Structure

```
fixtures/
├── README.md           # This file
├── input/              # Input spreadsheet data
│   ├── test1.json
│   └── test2.json
└── expected/           # Expected output (same filenames)
    ├── test1.json
    └── test2.json
```

## Running Tests

Simply run the test runner - it automatically discovers and tests ALL fixtures:

```bash
npx tsx src/tools/models/spreadsheet-engine/__tests__/run-all-fixtures.ts
```

**No parameters needed!** The test runner:
- Finds all `.json` files in `fixtures/input/`
- Matches them with corresponding files in `fixtures/expected/`
- Runs all tests automatically
- Reports comprehensive results

### Example Output

```
=== Spreadsheet Fixture Test Suite ===

Input Directory:    fixtures/input
Expected Directory: fixtures/expected

Found 2 test file(s):

  • basic-arithmetic.json
  • pv-analysis.json

============================================================
Test: basic-arithmetic
============================================================

✓ Calculation completed in 1ms
✓ All values match expected output!

Summary:
  Sheet Name: Basic Arithmetic
  Total Cells: 12
  Formulas: 6
  Errors: 0

✓ PASSED

============================================================
Test: pv-analysis
============================================================

✓ Calculation completed in 1ms
✓ All values match expected output!

Summary:
  Sheet Name: PV Analysis
  Total Cells: 60
  Formulas: 2
  Errors: 0

✓ PASSED

============================================================
Test Suite Summary
============================================================

Total Tests:   2
Passed:        2 ✓
Failed:        0
Total Time:    2ms

Passed Tests:
  ✓ basic-arithmetic (1ms, 12 cells, 6 formulas)
  ✓ pv-analysis (1ms, 60 cells, 2 formulas)

✓ All tests passed!
```

## Input JSON Format

Place input files in `fixtures/input/`

### Cell Format

Each cell is an object with the following properties:

- **`v`** (required): Cell value
  - Number: `{ "v": 123 }`
  - String: `{ "v": "Hello" }`
  - Formula: `{ "v": "=SUM(A1:A10)" }`

- **`f`** (optional): Format code (Excel-compatible)
  - Currency: `"$#,##0.00"` → `$1,000.00`
  - Percentage: `"0.00%"` → `5.00%`
  - Number: `"#,##0.00"` → `1,234.56`

### Example: `input/sales-report.json`

```json
{
  "name": "Sales Report",
  "data": [
    [
      { "v": "Product" },
      { "v": "Price" },
      { "v": "Quantity" },
      { "v": "Total" }
    ],
    [
      { "v": "Widget" },
      { "v": 10.50, "f": "$#,##0.00" },
      { "v": 100 },
      { "v": "=B2*C2", "f": "$#,##0.00" }
    ],
    [
      { "v": "Gadget" },
      { "v": 25.00, "f": "$#,##0.00" },
      { "v": 50 },
      { "v": "=B3*C3", "f": "$#,##0.00" }
    ],
    [
      { "v": "Total" },
      { "v": "" },
      { "v": "=SUM(C2:C3)" },
      { "v": "=SUM(D2:D3)", "f": "$#,##0.00" }
    ]
  ]
}
```

## Expected Output JSON Format

Place expected output files in `fixtures/expected/` with **the same filename** as the input.

The expected output must be a 2D array of strings representing the formatted values:

### Example: `expected/sales-report.json`

```json
[
  ["Product", "Price", "Quantity", "Total"],
  ["Widget", "$10.50", "100", "$1,050.00"],
  ["Gadget", "$25.00", "50", "$1,250.00"],
  ["Total", "", "150", "$2,300.00"]
]
```

### Important Notes

1. **All values are strings**: Even numbers are represented as strings
2. **Formatting applied**: Values include formatting (currency symbols, commas, etc.)
3. **Same dimensions**: Expected output must match input dimensions (rows × columns)
4. **Empty cells**: Use `""` for empty cells
5. **Same filename**: Input and expected files must have identical names

## Adding New Test Cases

To add a new test case, create TWO files with the SAME name:

### Step 1: Create input file

**File**: `fixtures/input/tax-calculator.json`

```json
{
  "name": "Tax Calculator",
  "data": [
    [
      { "v": "Income" },
      { "v": 50000, "f": "$#,##0.00" }
    ],
    [
      { "v": "Tax Rate" },
      { "v": 0.25, "f": "0.00%" }
    ],
    [
      { "v": "Tax Amount" },
      { "v": "=B1*B2", "f": "$#,##0.00" }
    ]
  ]
}
```

### Step 2: Create expected output file

**File**: `fixtures/expected/tax-calculator.json`

```json
[
  ["Income", "$50,000.00"],
  ["Tax Rate", "25.00%"],
  ["Tax Amount", "$12,500.00"]
]
```

### Step 3: Run tests

```bash
npx tsx src/tools/models/spreadsheet-engine/__tests__/run-all-fixtures.ts
```

The test runner will **automatically discover** the new test and include it!

```
Found 3 test file(s):
  • basic-arithmetic.json
  • pv-analysis.json
  • tax-calculator.json       ← NEW!
```

**No code changes needed!**

## Available Test Cases

### 1. Basic Arithmetic (`basic-arithmetic.json`)

**Description**: Simple arithmetic operations and SUM function

**Features tested**:
- Addition (`=A1+B1`)
- Multiplication (`=A2*B2`)
- Division (`=A3/B3`)
- SUM function (`=SUM(A1:A3)`)

**Dimensions**: 4 rows × 3 columns

**Formulas**: 6 formulas

**Files**:
- `input/basic-arithmetic.json`
- `expected/basic-arithmetic.json`

### 2. PV Analysis (`pv-analysis.json`)

**Description**: Comprehensive financial present value calculation test

**Features tested**:
- Recursive formula evaluation (`=$B$2` references)
- Absolute cell references (`$B$4`)
- SUM function with ranges (`SUM(C9:C20)`)
- Complex formulas (`=B9/(1+$B$4)^A9`)
- Currency formatting (`$#,##0.00`)
- Percentage formatting (`0.00%`)

**Dimensions**: 20 rows × 3 columns

**Formulas**: 14 formulas

**Files**:
- `input/pv-analysis.json`
- `expected/pv-analysis.json`

## Test Runner Features

The automated test runner provides:

✓ **Zero configuration**: No parameters needed, just run it
✓ **Automatic discovery**: Finds all test fixtures automatically
✓ **File validation**: Checks if input/expected files exist and match
✓ **JSON validation**: Verifies correct structure
✓ **Dimension checking**: Compares input/expected/actual dimensions
✓ **Detailed error reporting**: Shows exact cells that don't match (first 5 differences)
✓ **Performance metrics**: Reports calculation time for each test
✓ **Error detection**: Lists any formula evaluation errors
✓ **Summary statistics**: Shows comprehensive results for all tests

### Test Result Details

For each test, the runner shows:
- Calculation time (in milliseconds)
- Dimensions (rows × columns)
- Sheet name
- Total cells
- Formula count
- Error count

### Final Summary

```
Test Suite Summary
==================
Total Tests:   2
Passed:        2 ✓
Failed:        0
Total Time:    2ms

Passed Tests:
  ✓ basic-arithmetic (1ms, 12 cells, 6 formulas)
  ✓ pv-analysis (1ms, 60 cells, 2 formulas)
```

## Troubleshooting

### Missing Expected Output File

```
❌ SKIP: Expected output file not found
   Looking for: fixtures/expected/my-test.json
```

**Solution**: Create `expected/my-test.json` with the same filename as the input file

### Test Fails with Differences

```
❌ Output does not match expected values

First differences found:
  Row 5, Col 2:
    Expected: "$11,678.72"
    Actual:   "11678.72"
```

**Solution**:
- Check if format code `"f": "$#,##0.00"` is set in input JSON
- Verify expected values are correctly formatted as strings

### JSON Parsing Error

```
❌ Test execution failed
JSON parsing error:
  Unexpected token } in JSON at position 123
```

**Solution**: Validate JSON syntax using a JSON linter

### Dimension Mismatch

```
Dimensions:
  Input:    4 rows × 3 columns
  Expected: 4 rows × 2 columns  ← Mismatch!
  Actual:   4 rows × 3 columns
```

**Solution**: Ensure expected output has same number of rows and columns as input

## Tips for Creating Test Cases

1. **Start simple**: Begin with basic arithmetic, then add complexity
2. **Use Excel**: Create spreadsheet in Excel, verify results, then convert to JSON
3. **Test edge cases**: Empty cells, division by zero, circular references
4. **Format consistently**: Use same number of decimal places across tests
5. **Descriptive names**: Use clear test names that explain what's being tested
6. **Same filenames**: Always use identical names for input/expected pairs
7. **Validate JSON**: Check JSON syntax before running tests

## File Naming Convention

✓ **Good**:
```
input/pv-analysis.json
expected/pv-analysis.json      ← Same name
```

✓ **Good**:
```
input/financial-calculations.json
expected/financial-calculations.json
```

❌ **Bad**:
```
input/pv-analysis-input.json
expected/pv-analysis-output.json   ← Different names!
```

❌ **Bad**:
```
input/test1.json
expected/test2.json                ← Different names!
```

## Integration with Jest/Vitest

To integrate with a test framework, create a test file that calls the fixtures:

```typescript
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { calculateSheet } from '../calculator';
import { toStringArray } from './test-utils';
import '../../functions/index';

const INPUT_DIR = path.join(__dirname, 'fixtures', 'input');
const EXPECTED_DIR = path.join(__dirname, 'fixtures', 'expected');

const inputFiles = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.json'));

describe('Spreadsheet Fixtures', () => {
  inputFiles.forEach(file => {
    it(path.basename(file, '.json'), () => {
      const input = JSON.parse(
        fs.readFileSync(path.join(INPUT_DIR, file), 'utf-8')
      );
      const expected = JSON.parse(
        fs.readFileSync(path.join(EXPECTED_DIR, file), 'utf-8')
      );

      const result = calculateSheet(input);
      const actual = toStringArray(result.data);

      expect(actual).toEqual(expected);
    });
  });
});
```

This creates one test case per fixture file automatically!

## Workflow Example

### Adding a New "Loan Calculator" Test

1. **Create** `fixtures/input/loan-calculator.json`:
   ```json
   {
     "name": "Loan Calculator",
     "data": [
       [{ "v": "Principal" }, { "v": 100000, "f": "$#,##0.00" }],
       [{ "v": "Rate" }, { "v": 0.05, "f": "0.00%" }],
       [{ "v": "Interest" }, { "v": "=B1*B2", "f": "$#,##0.00" }]
     ]
   }
   ```

2. **Create** `fixtures/expected/loan-calculator.json`:
   ```json
   [
     ["Principal", "$100,000.00"],
     ["Rate", "5.00%"],
     ["Interest", "$5,000.00"]
   ]
   ```

3. **Run tests**:
   ```bash
   npx tsx src/tools/models/spreadsheet-engine/__tests__/run-all-fixtures.ts
   ```

4. **See results**:
   ```
   Found 3 test file(s):
     • basic-arithmetic.json
     • loan-calculator.json      ← Automatically discovered!
     • pv-analysis.json

   Test: loan-calculator
   ✓ PASSED
   ```

Done! No code changes, no configuration - just add two JSON files.
