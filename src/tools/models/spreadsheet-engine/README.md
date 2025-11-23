# Spreadsheet Engine

A framework-agnostic TypeScript spreadsheet calculation engine with full formula support, cross-sheet references, and Excel-compatible number formatting.

## Features

- ✅ **Formula Evaluation**: Supports 50+ spreadsheet functions (SUM, AVERAGE, IF, VLOOKUP, etc.)
- ✅ **Cell References**: A1 notation with absolute references ($A$1, $A1, A$1)
- ✅ **Cross-Sheet References**: 'Sheet1'!A1 or Sheet1!A1
- ✅ **Number Formatting**: Excel-compatible format codes ($#,##0.00, 0.00%, etc.)
- ✅ **Circular Reference Detection**: Detects and reports circular dependencies
- ✅ **Arithmetic Expressions**: Full support for +, -, *, /, ^ operators
- ✅ **Nested Functions**: ROUND(SUM(A1:A10)/COUNT(A1:A10), 2)
- ✅ **Type-Safe**: Full TypeScript support with comprehensive type definitions

## Installation

```typescript
import { SpreadsheetEngine } from '@/tools/models/spreadsheet-engine';
```

## Quick Start

```typescript
// Create engine instance
const engine = new SpreadsheetEngine();

// Create a simple sheet
const sheet = engine.createSheet('Sales', [
  ['Product', 'Price', 'Qty', 'Total'],
  ['Widget', 10, 100, '=B2*C2'],
  ['Gadget', 25, 50, '=B3*C3'],
  ['Total', '', '=C2+C3', '=SUM(D2:D3)']
]);

// Calculate formulas
const result = engine.calculate(sheet);

// Get results as string array
const output = engine.toStringArray(result);
console.log(output);
// [
//   ['Product', 'Price', 'Qty', 'Total'],
//   ['Widget', '10', '100', '1000'],
//   ['Gadget', '25', '50', '1250'],
//   ['Total', '', '150', '2250']
// ]
```

## API Reference

### SpreadsheetEngine Class

#### Constructor

```typescript
new SpreadsheetEngine(options?: EngineOptions)
```

**Options:**
- `maxIterations?: number` - Maximum calculation iterations (default: 100)
- `enableCrossSheetRefs?: boolean` - Enable cross-sheet references (default: true)
- `strictMode?: boolean` - Strict error handling (default: false)

#### Methods

##### `calculate(sheet, allSheets?)`

Calculate a single sheet with formulas.

```typescript
calculate(sheet: SheetData, allSheets?: SheetData[]): CalculatedSheet
```

**Parameters:**
- `sheet: SheetData` - Sheet to calculate
- `allSheets?: SheetData[]` - All sheets (for cross-sheet references)

**Returns:** `CalculatedSheet` with evaluated formulas and metadata

**Example:**
```typescript
const result = engine.calculate({
  name: 'Budget',
  data: [
    [{v: 'Revenue'}, {v: 1000}],
    [{v: 'Expenses'}, {v: 600}],
    [{v: 'Profit'}, {v: '=B1-B2'}]
  ]
});
// result.data[2][1] === 400
```

##### `calculateWorkbook(sheets)`

Calculate multiple sheets with cross-sheet reference support.

```typescript
calculateWorkbook(sheets: SheetData[]): CalculatedSheet[]
```

**Example:**
```typescript
const results = engine.calculateWorkbook([
  { name: 'Data', data: [[{v: 100}]] },
  { name: 'Summary', data: [[{v: '=Data!A1*2'}]] }
]);
// results[1].data[0][0] === 200
```

##### `createSheet(name, data)`

Helper to create a sheet from simple arrays.

```typescript
createSheet(name: string, data: Array<Array<SpreadsheetCell | string | number>>): SheetData
```

**Example:**
```typescript
const sheet = engine.createSheet('Sales', [
  ['Product', 'Price', 'Qty', 'Total'],
  ['Widget', 10, 100, '=B2*C2']
]);
```

##### `toStringArray(calculated)`

Convert calculated results to 2D string array.

```typescript
toStringArray(calculated: CalculatedSheet): string[][]
```

**Example:**
```typescript
const result = engine.calculate(sheet);
const strings = engine.toStringArray(result);
```

##### `getOptions()` / `setOptions(options)`

Get or update engine configuration.

```typescript
getOptions(): Required<EngineOptions>
setOptions(options: Partial<EngineOptions>): void
```

**Example:**
```typescript
engine.setOptions({ strictMode: true });
const opts = engine.getOptions();
```

## Cell Format

Cells can be defined in two ways:

### Simple Format (Convenience)

```typescript
const sheet = engine.createSheet('Sheet1', [
  ['Header', 100, '=A1+B1']  // Auto-converts to cell format
]);
```

### Full Format (Maximum Control)

```typescript
const sheet = {
  name: 'Sheet1',
  data: [
    [
      {v: 'Product'},
      {v: 10, f: '$#,##0.00'},           // Number with currency format
      {v: 0.05, f: '0.00%'},             // Number with percentage format
      {v: '=B1*C1', f: '$#,##0.00'}      // Formula with currency format
    ]
  ]
};
```

**Cell Properties:**
- `v: string | number` - Cell value or formula (formulas start with `=`)
- `f?: string` - Optional format code (Excel-compatible)

## Number Formats

The engine supports Excel-compatible format codes:

| Format | Example Input | Example Output |
|--------|---------------|----------------|
| `$#,##0.00` | 1234.56 | $1,234.56 |
| `$#,##0` | 1234.56 | $1,235 |
| `0.00%` | 0.5 | 50.00% |
| `0.0%` | 0.333 | 33.3% |
| `#,##0` | 1234 | 1,234 |
| `0.00` | 123.456 | 123.46 |

**Example:**
```typescript
const sheet = engine.createSheet('Formatted', [
  ['Revenue', {v: 1234.56, f: '$#,##0.00'}],   // $1,234.56
  ['Growth', {v: 0.25, f: '0.00%'}],           // 25.00%
  ['Count', {v: 1000, f: '#,##0'}]             // 1,000
]);
```

## Formula Syntax

### Cell References

```typescript
'=A1'           // Simple reference
'=$A$1'         // Absolute reference
'=Sheet1!A1'    // Cross-sheet reference
'=\'My Sheet\'!B2'  // Cross-sheet with spaces
```

### Arithmetic

```typescript
'=A1+B1'        // Addition
'=A1-B1'        // Subtraction
'=A1*B1'        // Multiplication
'=A1/B1'        // Division
'=A1^2'         // Exponentiation
'=(A1+B1)*2'    // Parentheses
```

### Functions

The engine supports 50+ functions across multiple categories:

**Math:** SUM, AVERAGE, COUNT, MAX, MIN, ROUND, ABS, POWER, SQRT, EXP, LN, LOG, MOD, SIGN, TRUNC, CEILING, FLOOR, RAND, RANDBETWEEN

**Statistical:** MEDIAN, MODE, STDEV, VAR, COUNTA, COUNTBLANK, COUNTIF, SUMIF, AVERAGEIF

**Logical:** IF, AND, OR, NOT, IFERROR, IFNA, ISBLANK, ISNUMBER, ISTEXT, ISERROR

**Text:** CONCATENATE, LEFT, RIGHT, MID, LEN, UPPER, LOWER, TRIM, SUBSTITUTE, REPLACE

**Lookup:** VLOOKUP, HLOOKUP, INDEX, MATCH

**Date:** TODAY, NOW, DATE, YEAR, MONTH, DAY

**Financial:** PMT, FV, PV, RATE, NPER

**Example:**
```typescript
const sheet = engine.createSheet('Functions', [
  ['Values', 10, 20, 30, 40, 50],
  ['SUM', '=SUM(B1:F1)'],                      // 150
  ['AVERAGE', '=AVERAGE(B1:F1)'],              // 30
  ['MAX', '=MAX(B1:F1)'],                      // 50
  ['Rounded Avg', '=ROUND(AVERAGE(B1:F1), 2)'] // 30
]);
```

### Nested Formulas

```typescript
'=ROUND(SUM(A1:A10)/COUNT(A1:A10), 2)'     // Average rounded to 2 decimals
'=IF(SUM(A1:A10)>100, "High", "Low")'      // Conditional based on sum
'=SUM(B1:B10)*AVERAGE(C1:C10)'             // Multiple functions
```

## Cross-Sheet References

```typescript
const sheets = [
  engine.createSheet('Revenue', [
    ['Jan', 10000],
    ['Feb', 12000],
    ['Mar', 11000]
  ]),
  engine.createSheet('Summary', [
    ['Total', '=SUM(Revenue!B1:B3)'],          // 33000
    ['Average', '=AVERAGE(Revenue!B1:B3)'],    // 11000
    ['Max Month', '=MAX(Revenue!B1:B3)']       // 12000
  ])
];

const results = engine.calculateWorkbook(sheets);
```

## Error Handling

The engine detects and reports errors:

```typescript
const result = engine.calculate(sheet);

// Check for errors
if (result.errors.length > 0) {
  result.errors.forEach(error => {
    console.log(`Error at ${error.cell.row},${error.cell.col}:`, error.error);
    console.log(`Type: ${error.type}`); // 'circular', 'reference', 'formula', etc.
  });
}

// Check formula metadata
result.formulas.forEach(formula => {
  console.log(`Cell ${formula.cell.row},${formula.cell.col}:`, formula.formula);
  console.log(`Result:`, formula.result);
});
```

**Error Types:**
- `circular` - Circular reference detected
- `reference` - Invalid cell reference
- `formula` - Formula evaluation error
- `unknown` - Other errors

## Testing

The engine includes comprehensive tests with array-based output comparison:

```typescript
// Test utilities
import { createSheet, toStringArray, expectSheetOutput } from './__tests__/test-utils';

// Create test sheet
const sheet = createSheet('Test', [
  ['Values', 10, 20, 30],
  ['Sum', '=SUM(B1:D1)']
]);

// Calculate
const result = calculateSheet(sheet);

// Compare with expected output
const expected = [
  ['Values', '10', '20', '30'],
  ['Sum', '60']
];
expectSheetOutput(result, expected);
```

Run tests:
```bash
npx tsx src/tools/models/spreadsheet-engine/__tests__/run-calculator-tests.ts
npx tsx src/tools/models/spreadsheet-engine/__tests__/run-evaluator-tests.ts
npx tsx src/tools/models/spreadsheet-engine/__tests__/run-formatter-tests.ts
npx tsx src/tools/models/spreadsheet-engine/__tests__/run-parser-tests.ts
```

## Architecture

The engine is composed of modular components:

- **types.ts** - TypeScript type definitions
- **parser.ts** - Cell reference and range parsing (A1 notation)
- **formatter.ts** - Number formatting (Excel-compatible)
- **evaluator.ts** - Formula evaluation and expression parsing
- **calculator.ts** - Core calculation engine with dependency resolution
- **engine.ts** - High-level API wrapper

This modular design allows for:
- **Framework-agnostic** usage (Vue, React, Angular, vanilla JS)
- **Independent testing** of each component
- **Easy extension** with new functions or features
- **Reusability** in other applications

## Example: Financial Model

```typescript
const engine = new SpreadsheetEngine();

const budget = engine.createSheet('Budget', [
  ['Category', 'Q1', 'Q2', 'Q3', 'Q4', 'Total', 'Avg'],
  ['Marketing', 5000, 6000, 5500, 7000, '=SUM(B2:E2)', '=AVERAGE(B2:E2)'],
  ['Engineering', 15000, 16000, 15500, 17000, '=SUM(B3:E3)', '=AVERAGE(B3:E3)'],
  ['Sales', 8000, 9000, 8500, 10000, '=SUM(B4:E4)', '=AVERAGE(B4:E4)'],
  ['Total', '=SUM(B2:B4)', '=SUM(C2:C4)', '=SUM(D2:D4)', '=SUM(E2:E4)', '=SUM(F2:F4)', '=AVERAGE(F2:F4)']
]);

const result = engine.calculate(budget);
const output = engine.toStringArray(result);

console.log(output);
// [
//   ['Category', 'Q1', 'Q2', 'Q3', 'Q4', 'Total', 'Avg'],
//   ['Marketing', '5000', '6000', '5500', '7000', '23500', '5875'],
//   ['Engineering', '15000', '16000', '15500', '17000', '63500', '15875'],
//   ['Sales', '8000', '9000', '8500', '10000', '35500', '8875'],
//   ['Total', '28000', '31000', '29500', '34000', '122500', '40833.33...']
// ]
```

## License

Part of the MulmoChat project.
