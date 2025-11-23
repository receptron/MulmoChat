# PLAN17: Extract Spreadsheet Calculation Engine

## Overview

Extract the spreadsheet calculation engine from the Vue component (`spreadsheet.vue`) into a standalone, framework-agnostic TypeScript module that can be:
- Tested independently with unit tests
- Reused in other applications (Node.js, browser, workers)
- Maintained separately from UI concerns
- Extended with new functions without touching UI code

## Current State

**Problem**: The calculation engine is tightly coupled with the Vue component:
- Formula evaluation logic lives in `spreadsheet.vue:238-584`
- Cell reference resolution mixed with UI state
- Format number utilities embedded in component
- Difficult to test without Vue component setup
- Cannot be used outside the Vue app

**Current Location**: `src/tools/views/spreadsheet.vue`

**Current Dependencies**:
- Function registry: `src/tools/models/functions/index.ts`
- Cell/range parsing: Inline in Vue component
- Formula evaluation: Inline in Vue component
- Number formatting: Inline in Vue component

## Proposed Architecture

### New Module Structure

```
src/tools/models/spreadsheet-engine/
├── index.ts                    # Main export (SpreadsheetEngine class)
├── types.ts                    # Type definitions
├── calculator.ts               # Core calculation engine
├── parser.ts                   # Cell/range reference parsing
├── formatter.ts                # Number formatting utilities
├── evaluator.ts                # Formula evaluation
└── __tests__/                  # Unit tests with array comparison
    ├── test-utils.ts           # Test helper utilities (toStringArray, expectSheetOutput)
    ├── calculator.test.ts      # Array-based output tests
    ├── parser.test.ts          # Reference parsing tests
    ├── formatter.test.ts       # Number format tests
    ├── evaluator.test.ts       # Formula evaluation tests
    ├── integration.test.ts     # Full workbook tests
    ├── regression.test.ts      # Bug fix validation
    └── performance.test.ts     # Performance benchmarks
```

### Core API Design

#### SpreadsheetEngine Class

```typescript
// Main engine class
class SpreadsheetEngine {
  constructor(options?: EngineOptions);

  // Calculate all formulas in a sheet
  calculate(sheet: SheetData): CalculatedSheet;

  // Calculate formulas across multiple sheets (cross-sheet references)
  calculateWorkbook(sheets: SheetData[]): CalculatedSheet[];

  // Evaluate a single formula with context
  evaluateFormula(formula: string, context: EvaluationContext): CellValue;

  // Format a number value
  formatValue(value: number, format: string): string;

  // Parse cell reference (e.g., "B2" -> {row: 1, col: 1})
  parseCellRef(ref: string): CellRef;

  // Parse range reference (e.g., "A1:B10" -> {start: ..., end: ...})
  parseRangeRef(range: string): RangeRef;
}
```

#### Type Definitions

```typescript
// types.ts
export type CellValue = number | string;

export interface SpreadsheetCell {
  v: CellValue;      // Value or formula (formulas start with "=")
  f?: string;        // Format code (e.g., "$#,##0.00")
}

export interface SheetData {
  name: string;
  data: SpreadsheetCell[][];
}

export interface CalculatedSheet {
  name: string;
  data: CellValue[][];          // Calculated values
  formulas: FormulaInfo[];      // Formula metadata
  errors: CalculationError[];   // Any errors encountered
}

export interface CellRef {
  row: number;
  col: number;
  sheet?: string;        // For cross-sheet refs
  absolute?: {           // For $A$1 style
    row: boolean;
    col: boolean;
  };
}

export interface RangeRef {
  start: CellRef;
  end: CellRef;
}

export interface EvaluationContext {
  currentSheet: string;
  sheets: Map<string, SpreadsheetCell[][]>;
  calculatedValues?: Map<string, CellValue>;  // Cache
}

export interface FormulaInfo {
  cell: CellRef;
  formula: string;
  dependencies: CellRef[];
  result: CellValue;
}

export interface CalculationError {
  cell: CellRef;
  formula: string;
  error: string;
  type: 'circular' | 'invalid_ref' | 'div_zero' | 'syntax' | 'unknown';
}

export interface EngineOptions {
  maxIterations?: number;         // For circular reference detection
  enableCrossSheetRefs?: boolean; // Default: true
  strictMode?: boolean;           // Throw on errors vs. return 0
}
```

### Module Breakdown

#### 1. `calculator.ts` - Core Calculation Engine

Extract from `spreadsheet.vue:238-584`:
- `calculateFormulas()` function → `Calculator.calculate()`
- Circular reference detection
- Cross-sheet reference support
- Calculation caching
- Error handling and reporting

**Responsibilities**:
- Orchestrate formula evaluation
- Manage calculation order (dependency graph)
- Detect and handle circular references
- Cache calculated results
- Track formula dependencies

#### 2. `parser.ts` - Reference Parsing

Extract from `spreadsheet.vue:218-236, 338-421`:
- `colToIndex()` → `Parser.columnToIndex()`
- `indexToCol()` → `Parser.indexToColumn()`
- Cell reference parsing (`parseCellRef()`)
- Range reference parsing (`parseRangeRef()`)
- Cross-sheet reference parsing

**Responsibilities**:
- Parse A1 notation to row/col indices
- Handle absolute references ($A$1)
- Parse cross-sheet references ('Sheet1'!A1)
- Validate reference syntax
- Extract ranges (A1:B10)

#### 3. `evaluator.ts` - Formula Evaluation

Extract from `spreadsheet.vue:472-548`:
- `evaluateFormula()` function
- Function call parsing (`parseFunctionArgs()`)
- Arithmetic expression evaluation
- Cell/range value resolution

**Responsibilities**:
- Evaluate formula strings
- Parse and execute function calls
- Handle nested functions
- Resolve cell and range references
- Evaluate arithmetic expressions
- Integrate with function registry

#### 4. `formatter.ts` - Number Formatting

Extract from `spreadsheet.vue:170-215`:
- `formatNumber()` function
- Currency formatting
- Percentage formatting
- Decimal/comma formatting

**Responsibilities**:
- Apply Excel-style format codes
- Handle currency ($#,##0.00)
- Handle percentages (0.00%)
- Handle decimals and integers
- Comma thousand separators

#### 5. `index.ts` - Main Export

```typescript
export { SpreadsheetEngine } from './calculator';
export * from './types';
export { Parser } from './parser';
export { Formatter } from './formatter';
export { Evaluator } from './evaluator';

// Convenience exports
export { functionRegistry } from '../spreadsheet-functions';
```

## Migration Steps

### Phase 1: Extract Core Utilities (Non-breaking)
1. Create `src/tools/models/spreadsheet-engine/` directory
2. Extract `formatter.ts` from `spreadsheet.vue:170-215`
3. Extract `parser.ts` from `spreadsheet.vue:218-236`
4. Write unit tests for parser and formatter
5. No changes to Vue component yet

### Phase 2: Extract Evaluation Logic
1. Extract `evaluator.ts` from `spreadsheet.vue:472-548`
2. Extract `parseFunctionArgs()` helper
3. Integrate with function registry
4. Write unit tests for evaluator
5. Test with sample formulas

### Phase 3: Extract Calculator
1. Extract `calculator.ts` from `spreadsheet.vue:238-584`
2. Refactor to use extracted parser/evaluator/formatter
3. Add dependency graph tracking
4. Improve error handling and reporting
5. Write comprehensive unit tests

### Phase 4: Create Main Engine Class
1. Create `SpreadsheetEngine` class in `index.ts`
2. Implement public API methods
3. Add options and configuration
4. Write integration tests
5. Document API usage

### Phase 5: Refactor Vue Component
1. Import `SpreadsheetEngine` in `spreadsheet.vue`
2. Replace inline calculation logic with engine calls
3. Simplify component to focus on UI concerns
4. Update to use engine's error reporting
5. Verify all functionality still works

### Phase 6: Documentation & Testing
1. Create test utilities (`test-utils.ts`) with:
   - `toStringArray()` - Convert calculated data to string arrays
   - `createSheet()` - Helper to build test sheets
   - `expectSheetOutput()` - Compare expected vs actual arrays
2. Write comprehensive test suite using array comparison:
   - Unit tests for each module
   - Integration tests with full sheet comparisons
   - Regression tests for known issues
   - Performance tests with output validation
3. Add JSDoc comments to public API
4. Create usage examples
5. Update CLAUDE.md with new architecture
6. Consider adding to npm package if broadly useful

## Testing Strategy

### Core Principle: Array-Based Output Comparison

**All tests should compare expected output (string arrays) with actual output (string arrays).** This approach:
- Mirrors how spreadsheets are visually represented
- Makes test expectations clear and readable
- Easy to update when functionality changes
- Catches formatting regressions
- Supports snapshot testing for complex sheets

### Test Utilities

```typescript
// __tests__/test-utils.ts

/**
 * Convert calculated sheet data to string array for comparison
 */
export function toStringArray(data: CellValue[][]): string[][] {
  return data.map(row =>
    row.map(cell => String(cell ?? ''))
  );
}

/**
 * Helper to create test sheet from simple data
 */
export function createSheet(
  name: string,
  data: Array<Array<SpreadsheetCell | string | number>>
): SheetData {
  return {
    name,
    data: data.map(row =>
      row.map(cell => {
        if (typeof cell === 'object' && 'v' in cell) {
          return cell as SpreadsheetCell;
        }
        return { v: cell };
      })
    )
  };
}

/**
 * Compare expected and actual output with helpful diff
 */
export function expectSheetOutput(
  actual: CalculatedSheet,
  expected: string[][]
): void {
  const actualStrings = toStringArray(actual.data);

  // Deep equality check
  expect(actualStrings).toEqual(expected);

  // Additional check: dimensions match
  expect(actualStrings.length).toBe(expected.length);
  actualStrings.forEach((row, i) => {
    expect(row.length).toBe(expected[i].length);
  });
}
```

### Unit Tests

```typescript
// __tests__/parser.test.ts
describe('Parser', () => {
  test('columnToIndex: A -> 0, Z -> 25, AA -> 26', () => {
    expect(Parser.columnToIndex('A')).toBe(0);
    expect(Parser.columnToIndex('Z')).toBe(25);
    expect(Parser.columnToIndex('AA')).toBe(26);
  });

  test('parseCellRef: B2 -> {row: 1, col: 1}', () => {
    expect(Parser.parseCellRef('B2')).toEqual({row: 1, col: 1});
  });

  test('parseCellRef: $B$2 -> absolute reference', () => {
    expect(Parser.parseCellRef('$B$2')).toEqual({
      row: 1,
      col: 1,
      absolute: {row: true, col: true}
    });
  });

  test('parseCellRef: Sheet1!B2 -> cross-sheet reference', () => {
    expect(Parser.parseCellRef('Sheet1!B2')).toEqual({
      row: 1,
      col: 1,
      sheet: 'Sheet1'
    });
  });
});

// __tests__/formatter.test.ts
describe('Formatter', () => {
  test('currency format: $#,##0.00', () => {
    expect(Formatter.format(1234.56, '$#,##0.00')).toBe('$1,234.56');
  });

  test('percentage format: 0.00%', () => {
    expect(Formatter.format(0.5, '0.00%')).toBe('50.00%');
  });

  test('integer format: #,##0', () => {
    expect(Formatter.format(1234567, '#,##0')).toBe('1,234,567');
  });
});

// __tests__/evaluator.test.ts
describe('Evaluator', () => {
  test('evaluates simple arithmetic: 2+3', () => {
    expect(evaluator.evaluate('2+3')).toBe(5);
  });

  test('evaluates cell reference: A1+B1', () => {
    const context = createContext([
      [{v: 10}, {v: 20}]
    ]);
    expect(evaluator.evaluate('A1+B1', context)).toBe(30);
  });

  test('evaluates function call: SUM(A1:A3)', () => {
    const context = createContext([
      [{v: 10}],
      [{v: 20}],
      [{v: 30}]
    ]);
    expect(evaluator.evaluate('SUM(A1:A3)', context)).toBe(60);
  });

  test('evaluates nested functions: ROUND(SUM(A1:A3)/3, 2)', () => {
    // Test formula composition
  });
});

// __tests__/calculator.test.ts - ARRAY COMPARISON EXAMPLES
describe('Calculator - Array Output Comparison', () => {
  const engine = new SpreadsheetEngine();

  test('calculates simple formulas - compare full output array', () => {
    const sheet = createSheet('Sheet1', [
      [10, 20, '=A1+B1']
    ]);

    const result = engine.calculate(sheet);

    const expected = [
      ['10', '20', '30']
    ];

    expectSheetOutput(result, expected);
  });

  test('sales calculation with formatting', () => {
    const sheet = {
      name: 'Sales',
      data: [
        [{v: 'Product'}, {v: 'Price'}, {v: 'Qty'}, {v: 'Total'}],
        [{v: 'Widget'}, {v: 10, f: '$#,##0.00'}, {v: 100}, {v: '=B2*C2', f: '$#,##0.00'}],
        [{v: 'Gadget'}, {v: 25, f: '$#,##0.00'}, {v: 50}, {v: '=B3*C3', f: '$#,##0.00'}],
        [{v: 'Total'}, {v: ''}, {v: '=C2+C3'}, {v: '=SUM(D2:D3)', f: '$#,##0.00'}],
      ]
    };

    const result = engine.calculate(sheet);

    const expected = [
      ['Product',  'Price',      'Qty',  'Total'      ],
      ['Widget',   '$10.00',     '100',  '$1,000.00'  ],
      ['Gadget',   '$25.00',     '50',   '$1,250.00'  ],
      ['Total',    '',           '150',  '$2,250.00'  ],
    ];

    expectSheetOutput(result, expected);
  });

  test('percentage calculations', () => {
    const sheet = createSheet('Growth', [
      ['Year', 'Revenue', 'Growth'],
      [2022, 100000, ''],
      [2023, 120000, {v: '=B3/B2-1', f: '0.00%'}],
      [2024, 150000, {v: '=B4/B3-1', f: '0.00%'}],
    ]);

    const result = engine.calculate(sheet);

    const expected = [
      ['Year',   'Revenue',  'Growth'  ],
      ['2022',   '100000',   ''        ],
      ['2023',   '120000',   '20.00%'  ],
      ['2024',   '150000',   '25.00%'  ],
    ];

    expectSheetOutput(result, expected);
  });

  test('financial model with multiple formula types', () => {
    const sheet = createSheet('Budget', [
      ['Category',      'Q1',    'Q2',    'Q3',    'Q4',    'Total',           'Avg'              ],
      ['Marketing',     5000,    6000,    5500,    7000,    '=SUM(B2:E2)',     '=AVERAGE(B2:E2)'  ],
      ['Engineering',   15000,   16000,   15500,   17000,   '=SUM(B3:E3)',     '=AVERAGE(B3:E3)'  ],
      ['Sales',         8000,    9000,    8500,    10000,   '=SUM(B4:E4)',     '=AVERAGE(B4:E4)'  ],
      ['Total',         '=SUM(B2:B4)', '=SUM(C2:C4)', '=SUM(D2:D4)', '=SUM(E2:E4)', '=SUM(F2:F4)', '=AVERAGE(F2:F4)' ],
    ]);

    const result = engine.calculate(sheet);

    const expected = [
      ['Category',      'Q1',    'Q2',    'Q3',    'Q4',    'Total',   'Avg'     ],
      ['Marketing',     '5000',  '6000',  '5500',  '7000',  '23500',   '5875'    ],
      ['Engineering',   '15000', '16000', '15500', '17000', '63500',   '15875'   ],
      ['Sales',         '8000',  '9000',  '8500',  '10000', '35500',   '8875'    ],
      ['Total',         '28000', '31000', '29500', '34000', '122500',  '30625'   ],
    ];

    expectSheetOutput(result, expected);
  });

  test('handles cross-sheet references with array comparison', () => {
    const sheets = [
      createSheet('Sheet1', [[100]]),
      createSheet('Sheet2', [['=Sheet1!A1*2']])
    ];

    const results = engine.calculateWorkbook(sheets);

    expectSheetOutput(results[0], [['100']]);
    expectSheetOutput(results[1], [['200']]);
  });

  test('detects circular references', () => {
    const sheet = createSheet('Sheet1', [
      ['=B1', '=A1']
    ]);

    const result = engine.calculate(sheet);

    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].type).toBe('circular');
  });

  test('complex formula with formatting - array comparison', () => {
    const sheet = {
      name: 'Commission',
      data: [
        [{v: 'Sales Rep'}, {v: 'Sales'}, {v: 'Rate'}, {v: 'Commission'}],
        [{v: 'Alice'}, {v: 50000, f: '$#,##0'}, {v: 0.05, f: '0.00%'}, {v: '=B2*C2', f: '$#,##0.00'}],
        [{v: 'Bob'}, {v: 75000, f: '$#,##0'}, {v: 0.07, f: '0.00%'}, {v: '=B3*C3', f: '$#,##0.00'}],
        [{v: 'Total'}, {v: '=SUM(B2:B3)', f: '$#,##0'}, {v: ''}, {v: '=SUM(D2:D3)', f: '$#,##0.00'}],
      ]
    };

    const result = engine.calculate(sheet);

    const expected = [
      ['Sales Rep',  'Sales',    'Rate',    'Commission' ],
      ['Alice',      '$50,000',  '5.00%',   '$2,500.00'  ],
      ['Bob',        '$75,000',  '7.00%',   '$5,250.00'  ],
      ['Total',      '$125,000', '',        '$7,750.00'  ],
    ];

    expectSheetOutput(result, expected);
  });
});
```

### Integration Tests with Full Sheet Comparison

```typescript
// __tests__/integration.test.ts
describe('SpreadsheetEngine Integration - Full Sheet Comparison', () => {
  const engine = new SpreadsheetEngine();

  test('complete workbook calculation', () => {
    const sheets = [
      createSheet('Revenue', [
        ['Month',    'Amount'],
        ['January',  {v: 10000, f: '$#,##0'}],
        ['February', {v: 12000, f: '$#,##0'}],
        ['March',    {v: 11000, f: '$#,##0'}],
      ]),
      createSheet('Summary', [
        ['Total Revenue',   {v: '=SUM(Revenue!B2:B4)', f: '$#,##0'}],
        ['Average Revenue', {v: '=AVERAGE(Revenue!B2:B4)', f: '$#,##0'}],
        ['Max Revenue',     {v: '=MAX(Revenue!B2:B4)', f: '$#,##0'}],
      ])
    ];

    const results = engine.calculateWorkbook(sheets);

    // Verify Revenue sheet
    const expectedRevenue = [
      ['Month',     'Amount'  ],
      ['January',   '$10,000' ],
      ['February',  '$12,000' ],
      ['March',     '$11,000' ],
    ];
    expectSheetOutput(results[0], expectedRevenue);

    // Verify Summary sheet
    const expectedSummary = [
      ['Total Revenue',   '$33,000'],
      ['Average Revenue', '$11,000'],
      ['Max Revenue',     '$12,000'],
    ];
    expectSheetOutput(results[1], expectedSummary);
  });

  test('real-world financial model - complete output comparison', () => {
    const sheet = createSheet('Financial Model', [
      ['Metric',              'Year 1',  'Year 2',  'Year 3'  ],
      ['Revenue',             100000,    120000,    150000    ],
      ['COGS',                40000,     48000,     60000     ],
      ['Gross Profit',        '=B2-B3',  '=C2-C3',  '=D2-D3'  ],
      ['Gross Margin',        {v: '=B4/B2', f: '0.0%'}, {v: '=C4/C2', f: '0.0%'}, {v: '=D4/D2', f: '0.0%'}],
      ['Operating Expenses',  30000,     35000,     40000     ],
      ['Operating Income',    '=B4-B6',  '=C4-C6',  '=D4-D6'  ],
      ['Operating Margin',    {v: '=B7/B2', f: '0.0%'}, {v: '=C7/C2', f: '0.0%'}, {v: '=D7/D2', f: '0.0%'}],
    ]);

    const result = engine.calculate(sheet);

    const expected = [
      ['Metric',              'Year 1',  'Year 2',  'Year 3'  ],
      ['Revenue',             '100000',  '120000',  '150000'  ],
      ['COGS',                '40000',   '48000',   '60000'   ],
      ['Gross Profit',        '60000',   '72000',   '90000'   ],
      ['Gross Margin',        '60.0%',   '60.0%',   '60.0%'   ],
      ['Operating Expenses',  '30000',   '35000',   '40000'   ],
      ['Operating Income',    '30000',   '37000',   '50000'   ],
      ['Operating Margin',    '30.0%',   '30.8%',   '33.3%'   ],
    ];

    expectSheetOutput(result, expected);

    // Verify no errors
    expect(result.errors).toHaveLength(0);
  });

  test('snapshot testing for complex sheets', () => {
    const sheet = loadComplexTestSheet();
    const result = engine.calculate(sheet);

    // Use Jest snapshots for very large/complex sheets
    expect(toStringArray(result.data)).toMatchSnapshot();
  });
});
```

### Regression Testing

```typescript
// __tests__/regression.test.ts
describe('Regression Tests - Array Comparison', () => {
  const engine = new SpreadsheetEngine();

  test('Issue #123: Percentage formatting regression', () => {
    const sheet = createSheet('Test', [
      [0.5,    {v: 0.5, f: '0.00%'}],
      [0.0417, {v: 0.0417, f: '0.00%'}],
      [1.5,    {v: 1.5, f: '0.00%'}],
    ]);

    const result = engine.calculate(sheet);

    const expected = [
      ['0.5',    '50.00%'  ],
      ['0.0417', '4.17%'   ],
      ['1.5',    '150.00%' ],
    ];

    expectSheetOutput(result, expected);
  });

  test('Issue #456: Cross-sheet formula calculation order', () => {
    // Verify that sheets are calculated in correct order
    // to resolve dependencies
  });
});
```

### Performance Testing with Output Validation

```typescript
// __tests__/performance.test.ts
describe('Performance Tests', () => {
  const engine = new SpreadsheetEngine();

  test('large sheet calculation (1000x100 cells)', () => {
    const rows = 1000;
    const cols = 100;

    // Build large sheet with formulas
    const data = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        row.push({ v: r * cols + c });
      }
      data.push(row);
    }

    const sheet = createSheet('Large', data);

    const startTime = performance.now();
    const result = engine.calculate(sheet);
    const endTime = performance.now();

    // Verify calculation completed
    expect(result.data.length).toBe(rows);
    expect(result.data[0].length).toBe(cols);

    // Verify specific cells (spot check)
    expect(result.data[0][0]).toBe('0');
    expect(result.data[999][99]).toBe('99999');

    // Performance threshold
    expect(endTime - startTime).toBeLessThan(5000); // 5 seconds
  });
});
```

## Usage Examples

### Basic Usage

```typescript
import { SpreadsheetEngine } from '@/tools/models/spreadsheet-engine';

const engine = new SpreadsheetEngine();

const sheet = {
  name: 'Sales',
  data: [
    [{v: 'Product'}, {v: 'Price'}, {v: 'Quantity'}, {v: 'Total'}],
    [{v: 'Widget'}, {v: 10, f: '$#,##0.00'}, {v: 100}, {v: '=B2*C2', f: '$#,##0.00'}],
    [{v: 'Gadget'}, {v: 25, f: '$#,##0.00'}, {v: 50}, {v: '=B3*C3', f: '$#,##0.00'}],
    [{v: 'Total'}, {v: ''}, {v: '=SUM(C2:C3)'}, {v: '=SUM(D2:D3)', f: '$#,##0.00'}],
  ]
};

const result = engine.calculate(sheet);

console.log(result.data[1][3]); // "$1,000.00"
console.log(result.data[2][3]); // "$1,250.00"
console.log(result.data[3][3]); // "$2,250.00"
```

### Cross-Sheet References

```typescript
const sheets = [
  {
    name: 'Revenue',
    data: [
      [{v: 'Q1'}, {v: 100000, f: '$#,##0'}],
      [{v: 'Q2'}, {v: 120000, f: '$#,##0'}],
      [{v: 'Q3'}, {v: 110000, f: '$#,##0'}],
      [{v: 'Q4'}, {v: 130000, f: '$#,##0'}],
    ]
  },
  {
    name: 'Summary',
    data: [
      [{v: 'Total Revenue'}, {v: '=SUM(Revenue!B1:B4)', f: '$#,##0'}],
      [{v: 'Average'}, {v: '=AVERAGE(Revenue!B1:B4)', f: '$#,##0'}],
    ]
  }
];

const results = engine.calculateWorkbook(sheets);
console.log(results[1].data[0][1]); // "$460,000"
```

### Error Handling

```typescript
const result = engine.calculate(sheet);

if (result.errors.length > 0) {
  for (const error of result.errors) {
    console.error(
      `Error in ${error.cell.sheet}!${Parser.cellRefToA1(error.cell)}: ${error.error}`
    );
  }
}
```

### In Vue Component

```typescript
// spreadsheet.vue
import { SpreadsheetEngine } from '@/tools/models/spreadsheet-engine';

const engine = new SpreadsheetEngine({
  maxIterations: 100,
  strictMode: false
});

const renderedHtml = computed(() => {
  const sheet = props.selectedResult.data?.sheets[activeSheetIndex.value];
  if (!sheet) return '';

  // Calculate formulas using engine
  const result = engine.calculate(sheet);

  // Check for errors
  if (result.errors.length > 0) {
    console.warn('Calculation errors:', result.errors);
  }

  // Convert to XLSX and render
  const worksheet = XLSX.utils.aoa_to_sheet(result.data);
  return XLSX.utils.sheet_to_html(worksheet);
});
```

## Benefits

### Testability
- Pure functions, no Vue dependencies
- Easy to write unit tests
- Fast test execution (no DOM required)
- High code coverage achievable

### Reusability
- Use in Node.js scripts for batch processing
- Use in Web Workers for performance
- Use in other UI frameworks (React, Svelte, etc.)
- Potential npm package for community

### Maintainability
- Clear separation of concerns
- Easier to understand and debug
- Simpler Vue component (UI only)
- Better error messages and debugging

### Performance
- Can run in Web Worker (off main thread)
- Better optimization opportunities
- Calculation caching built-in
- Efficient dependency tracking

### Extensibility
- Easy to add new functions
- Easy to add new format types
- Clear extension points
- No UI coupling

## Future Enhancements

### Advanced Features
1. **Dependency Graph Visualization**: Export dependency info for debugging
2. **Partial Recalculation**: Only recalc cells affected by changes
3. **Formula Auditing**: Trace precedents/dependents
4. **Custom Functions**: Allow runtime function registration
5. **Performance Metrics**: Track calculation time per cell/sheet

### Additional Capabilities
1. **Formula Parsing AST**: Build proper abstract syntax tree
2. **Type Inference**: Infer cell value types
3. **Range Names**: Support named ranges (e.g., "Sales" instead of "A1:A10")
4. **Array Formulas**: Support Excel array formula syntax
5. **Lazy Evaluation**: Calculate only visible cells initially

### NPM Package
If broadly useful, consider publishing:
```
@mulmochat/spreadsheet-engine
```

With separate packages for:
- Core engine (framework-agnostic)
- Vue plugin
- React hooks
- Web Worker wrapper

## Test Data & Examples

### Test Case Categories

To ensure comprehensive coverage, create test cases for each category:

1. **Basic Arithmetic**
   - Simple formulas: `=A1+B1`, `=10*5`, `=A1/B1`
   - Order of operations: `=2+3*4`, `=(2+3)*4`
   - Negative numbers: `=-A1`, `=A1-B1`

2. **Statistical Functions**
   - `SUM`, `AVERAGE`, `MAX`, `MIN`, `COUNT`
   - `MEDIAN`, `MODE`, `STDEV`, `VAR`
   - Conditional: `COUNTIF`, `SUMIF`, `AVERAGEIF`

3. **Number Formatting**
   - Currency: `$#,##0.00`, `$#,##0`
   - Percentage: `0.00%`, `0.0%`
   - Integers: `#,##0`, `0`
   - Decimals: `0.00`, `0.000`

4. **Cell References**
   - Relative: `A1`, `B2`
   - Absolute: `$A$1`, `$B$2`
   - Mixed: `$A1`, `A$1`
   - Cross-sheet: `Sheet1!A1`, `'My Sheet'!B2`

5. **Range Operations**
   - Simple ranges: `A1:A10`
   - Multi-column: `A1:C10`
   - Full row/column: `A:A`, `1:1`
   - Cross-sheet ranges: `Sheet1!A1:B10`

6. **Complex Formulas**
   - Nested functions: `ROUND(SUM(A1:A10)/COUNT(A1:A10), 2)`
   - Multiple references: `=A1+B1+C1+D1`
   - Conditional logic: `IF(A1>100, "High", "Low")`

7. **Edge Cases**
   - Empty cells
   - Division by zero
   - Circular references
   - Invalid references
   - Very large numbers
   - Very small decimals

### Example Test Data Files

Create reusable test data:

```typescript
// __tests__/fixtures/financial-model.ts
export const financialModelSheet = createSheet('P&L', [
  ['Metric',              'Q1',    'Q2',    'Q3',    'Q4',    'Total',        'Avg'             ],
  ['Revenue',             100000,  120000,  110000,  130000,  '=SUM(B2:E2)',  '=AVERAGE(B2:E2)' ],
  ['COGS',                40000,   48000,   44000,   52000,   '=SUM(B3:E3)',  '=AVERAGE(B3:E3)' ],
  ['Gross Profit',        '=B2-B3','=C2-C3','=D2-D3','=E2-E3','=SUM(B4:E4)',  '=AVERAGE(B4:E4)' ],
  ['Gross Margin %',      {v:'=B4/B2',f:'0.0%'}, {v:'=C4/C2',f:'0.0%'}, {v:'=D4/D2',f:'0.0%'}, {v:'=E4/E2',f:'0.0%'}, {v:'=F4/F2',f:'0.0%'}, '' ],
]);

export const financialModelExpected = [
  ['Metric',          'Q1',     'Q2',     'Q3',     'Q4',     'Total',   'Avg'      ],
  ['Revenue',         '100000', '120000', '110000', '130000', '460000',  '115000'   ],
  ['COGS',            '40000',  '48000',  '44000',  '52000',  '184000',  '46000'    ],
  ['Gross Profit',    '60000',  '72000',  '66000',  '78000',  '276000',  '69000'    ],
  ['Gross Margin %',  '60.0%',  '60.0%',  '60.0%',  '60.0%',  '60.0%',   ''         ],
];

// __tests__/fixtures/sales-report.ts
export const salesReportSheet = createSheet('Sales', [
  ['Rep',     'Product',  'Units',  'Price',              'Total'                      ],
  ['Alice',   'Widget',   50,       {v:100,f:'$#,##0'},   {v:'=C2*D2',f:'$#,##0.00'}   ],
  ['Alice',   'Gadget',   30,       {v:200,f:'$#,##0'},   {v:'=C3*D3',f:'$#,##0.00'}   ],
  ['Bob',     'Widget',   75,       {v:100,f:'$#,##0'},   {v:'=C4*D4',f:'$#,##0.00'}   ],
  ['Bob',     'Gadget',   40,       {v:200,f:'$#,##0'},   {v:'=C5*D5',f:'$#,##0.00'}   ],
  ['Total',   '',         '=SUM(C2:C5)', '',              {v:'=SUM(E2:E5)',f:'$#,##0.00'} ],
]);

export const salesReportExpected = [
  ['Rep',     'Product',  'Units',  'Price',   'Total'       ],
  ['Alice',   'Widget',   '50',     '$100',    '$5,000.00'   ],
  ['Alice',   'Gadget',   '30',     '$200',    '$6,000.00'   ],
  ['Bob',     'Widget',   '75',     '$100',    '$7,500.00'   ],
  ['Bob',     'Gadget',   '40',     '$200',    '$8,000.00'   ],
  ['Total',   '',         '195',    '',        '$26,500.00'  ],
];
```

## Success Criteria

- [ ] All calculation logic extracted from Vue component
- [ ] Comprehensive unit test suite (>90% coverage)
- [ ] Integration tests with real-world examples using array comparison
- [ ] All test cases verify expected string arrays vs actual string arrays
- [ ] Test utilities (`toStringArray`, `expectSheetOutput`) implemented
- [ ] Test fixtures created for common scenarios (financial, sales, etc.)
- [ ] Vue component successfully refactored to use engine
- [ ] All existing functionality preserved
- [ ] Performance equal or better than before
- [ ] Documentation complete with examples
- [ ] Zero regressions in spreadsheet tool
- [ ] Snapshot tests for complex sheets

## Timeline Estimate

- Phase 1 (Extract utilities): 2-3 hours
- Phase 2 (Extract evaluator): 3-4 hours
- Phase 3 (Extract calculator): 4-5 hours
- Phase 4 (Create engine class): 2-3 hours
- Phase 5 (Refactor Vue component): 2-3 hours
- Phase 6 (Documentation & testing): 3-4 hours

**Total**: 16-22 hours of focused development

## Notes

- Maintain backward compatibility during migration
- Keep existing function registry system intact
- Preserve all current spreadsheet functionality
- Add comprehensive error handling
- Document all public APIs with JSDoc
- Consider adding debug logging for formula evaluation
