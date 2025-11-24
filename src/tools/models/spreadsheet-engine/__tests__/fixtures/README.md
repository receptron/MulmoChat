# Spreadsheet Test Fixtures

This directory contains JSON-based test fixtures for the spreadsheet calculation engine.

## Directory Structure

```
fixtures/
├── README.md                          # This file
├── <test-name>-input.json            # Input spreadsheet data
├── <test-name>-expected.json         # Expected output (2D string array)
└── ...
```

## Running Tests

Use the generic test runner to execute any fixture pair:

```bash
npx tsx src/tools/models/spreadsheet-engine/__tests__/run-json-fixtures.ts \
  src/tools/models/spreadsheet-engine/__tests__/fixtures/<test-name>-input.json \
  src/tools/models/spreadsheet-engine/__tests__/fixtures/<test-name>-expected.json
```

### Examples

**PV Analysis Test** (comprehensive financial calculation):
```bash
npx tsx src/tools/models/spreadsheet-engine/__tests__/run-json-fixtures.ts \
  src/tools/models/spreadsheet-engine/__tests__/fixtures/pv-analysis-input.json \
  src/tools/models/spreadsheet-engine/__tests__/fixtures/pv-analysis-expected.json
```

**Basic Arithmetic Test** (simple calculations):
```bash
npx tsx src/tools/models/spreadsheet-engine/__tests__/run-json-fixtures.ts \
  src/tools/models/spreadsheet-engine/__tests__/fixtures/basic-arithmetic-input.json \
  src/tools/models/spreadsheet-engine/__tests__/fixtures/basic-arithmetic-expected.json
```

## Input JSON Format

The input file must follow this structure:

```json
{
  "name": "Test Name",
  "data": [
    [
      { "v": 10 },
      { "v": "=A1+B1" },
      { "v": 100, "f": "$#,##0.00" }
    ]
  ]
}
```

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

### Example Input

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

The expected output must be a 2D array of strings representing the formatted values:

```json
[
  ["Product", "Price", "Quantity", "Total"],
  ["Widget", "$10.50", "100", "$1,050.00"],
  ["Gadget", "$25.00", "50", "$1,250.00"],
  ["Total", "", "150", "$2,300.00"]
]
```

### Important Notes

1. **All values are strings**: Even numbers are represented as strings in the expected output
2. **Formatting applied**: Values should include formatting (currency symbols, commas, etc.)
3. **Same dimensions**: Expected output must have same rows × columns as input
4. **Empty cells**: Use `""` for empty cells

## Adding New Test Cases

To add a new test case:

1. **Create input file**: `<test-name>-input.json`
   - Define your spreadsheet structure
   - Include formulas and format codes

2. **Create expected output file**: `<test-name>-expected.json`
   - Calculate expected values manually or using Excel
   - Include all formatting (currency, percentages, etc.)
   - Convert to 2D string array

3. **Run the test**:
   ```bash
   npx tsx src/tools/models/spreadsheet-engine/__tests__/run-json-fixtures.ts \
     src/tools/models/spreadsheet-engine/__tests__/fixtures/<test-name>-input.json \
     src/tools/models/spreadsheet-engine/__tests__/fixtures/<test-name>-expected.json
   ```

No code changes needed! The test runner automatically:
- Loads both JSON files
- Calculates the spreadsheet
- Compares actual vs expected output
- Reports any differences

## Available Test Cases

### 1. PV Analysis (`pv-analysis-*.json`)
**Description**: Comprehensive financial present value calculation test

**Features tested**:
- Recursive formula evaluation (`=$B$2` references)
- Absolute cell references (`$B$4`)
- SUM function with ranges (`SUM(C9:C20)`)
- Complex formulas (`=B9/(1+$B$4)^A9`)
- Currency formatting (`$#,##0.00`)
- Percentage formatting (`0.00%`)

**Dimensions**: 20 rows × 3 columns

**Formulas**: 14 formulas including nested references

### 2. Basic Arithmetic (`basic-arithmetic-*.json`)
**Description**: Simple arithmetic operations and SUM function

**Features tested**:
- Addition (`=A1+B1`)
- Multiplication (`=A2*B2`)
- Division (`=A3/B3`)
- SUM function (`=SUM(A1:A3)`)

**Dimensions**: 4 rows × 3 columns

**Formulas**: 6 formulas

## Test Runner Features

The `run-json-fixtures.ts` test runner provides:

✓ **Automatic file validation**: Checks if input/expected files exist
✓ **JSON validation**: Verifies correct structure
✓ **Dimension checking**: Compares input/expected/actual dimensions
✓ **Detailed error reporting**: Shows exact cells that don't match
✓ **Performance metrics**: Reports calculation time
✓ **Error detection**: Lists any formula evaluation errors
✓ **Summary statistics**: Shows sheet name, cell count, formula count

### Example Output

```
=== Spreadsheet JSON Fixture Test ===

Input:    fixtures/pv-analysis-input.json
Expected: fixtures/pv-analysis-expected.json

Calculating spreadsheet...

✓ Calculation completed in 2ms

Dimensions:
  Input:    20 rows × 3 columns
  Expected: 20 rows × 3 columns
  Actual:   20 rows × 3 columns

Comparing output...

✓ All values match expected output!

Summary:
========
Sheet Name: PV Analysis
Total Cells: 60
Formulas: 14
Errors: 0

✓ Test PASSED
```

## Troubleshooting

### Test Fails with Differences

The test runner shows exact differences:

```
Differences:
============
  Row 5, Col 2:
    Expected: "$11,678.72"
    Actual:   "11678.72"
```

This indicates:
- Row 5, Column 2 (cell B5)
- Expected formatted currency: `$11,678.72`
- Actual value missing formatting

**Solution**: Check if format code `"f": "$#,##0.00"` is set in input JSON

### JSON Parsing Error

```
❌ JSON parsing error:
Unexpected token } in JSON at position 123
```

**Solution**: Validate JSON syntax using a JSON linter

### File Not Found

```
❌ Input file not found: /path/to/file.json
```

**Solution**: Check file path is correct and relative to current directory

## Tips for Creating Test Cases

1. **Start simple**: Begin with basic arithmetic, then add complexity
2. **Use Excel**: Create spreadsheet in Excel, verify results, then convert to JSON
3. **Test edge cases**: Empty cells, division by zero, circular references
4. **Format consistently**: Use same number of decimal places
5. **Document intent**: Add descriptive test names that explain what's being tested

## Integration with Jest/Vitest

To integrate with a test framework:

```typescript
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import { calculateSheet } from '../calculator';
import { toStringArray } from './test-utils';
import '../../functions/index';

describe('Spreadsheet Fixtures', () => {
  it('PV Analysis', () => {
    const input = JSON.parse(fs.readFileSync('fixtures/pv-analysis-input.json', 'utf-8'));
    const expected = JSON.parse(fs.readFileSync('fixtures/pv-analysis-expected.json', 'utf-8'));

    const result = calculateSheet(input);
    const actual = toStringArray(result.data);

    expect(actual).toEqual(expected);
  });
});
```
