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
└── __tests__/                  # Unit tests
    ├── calculator.test.ts
    ├── parser.test.ts
    ├── formatter.test.ts
    └── evaluator.test.ts
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
1. Write comprehensive test suite
2. Add JSDoc comments to public API
3. Create usage examples
4. Update CLAUDE.md with new architecture
5. Consider adding to npm package if broadly useful

## Testing Strategy

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

// __tests__/calculator.test.ts
describe('Calculator', () => {
  test('calculates simple formulas', () => {
    const sheet = {
      name: 'Sheet1',
      data: [
        [{v: 10}, {v: 20}, {v: '=A1+B1'}]
      ]
    };
    const result = calculator.calculate(sheet);
    expect(result.data[0][2]).toBe(30);
  });

  test('handles cross-sheet references', () => {
    const sheets = [
      {name: 'Sheet1', data: [[{v: 100}]]},
      {name: 'Sheet2', data: [[{v: '=Sheet1!A1*2'}]]}
    ];
    const results = calculator.calculateWorkbook(sheets);
    expect(results[1].data[0][0]).toBe(200);
  });

  test('detects circular references', () => {
    const sheet = {
      name: 'Sheet1',
      data: [
        [{v: '=B1'}, {v: '=A1'}]
      ]
    };
    const result = calculator.calculate(sheet);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0].type).toBe('circular');
  });

  test('applies number formatting', () => {
    const sheet = {
      name: 'Sheet1',
      data: [
        [{v: 1234.567, f: '$#,##0.00'}]
      ]
    };
    const result = calculator.calculate(sheet);
    expect(result.data[0][0]).toBe('$1,234.57');
  });
});
```

### Integration Tests

```typescript
// __tests__/integration.test.ts
describe('SpreadsheetEngine Integration', () => {
  test('complete workbook calculation', () => {
    const engine = new SpreadsheetEngine();
    const sheets = loadTestWorkbook();
    const results = engine.calculateWorkbook(sheets);

    // Verify all formulas evaluated correctly
    // Verify cross-sheet references work
    // Verify formatting applied
    // Verify no errors
  });

  test('real-world financial model', () => {
    // Test with complex financial formulas
    // PMT, NPV, IRR, etc.
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

## Success Criteria

- [ ] All calculation logic extracted from Vue component
- [ ] Comprehensive unit test suite (>90% coverage)
- [ ] Integration tests with real-world examples
- [ ] Vue component successfully refactored to use engine
- [ ] All existing functionality preserved
- [ ] Performance equal or better than before
- [ ] Documentation complete with examples
- [ ] Zero regressions in spreadsheet tool

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
