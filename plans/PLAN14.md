# PLAN14: Expand Spreadsheet Function Support

## Current State

The spreadsheet component (`src/tools/views/spreadsheet.vue`) currently supports only 6 functions:
- **Statistical**: SUM, AVERAGE, MAX, MIN, COUNT
- **Logical**: IF

## Objective

Expand function support to cover the most commonly used Excel functions, improving the spreadsheet tool's utility for real-world use cases.

## Prioritized Function Categories

### Phase 1: Essential Functions (High Priority)

#### Mathematical Functions
- **ROUND(number, digits)** - Round to specified decimal places
- **ROUNDUP(number, digits)** - Round up
- **ROUNDDOWN(number, digits)** - Round down
- **FLOOR(number, significance)** - Round down to nearest multiple
- **CEILING(number, significance)** - Round up to nearest multiple
- **ABS(number)** - Absolute value
- **POWER(base, exponent)** - Power function (alternative to ^)
- **SQRT(number)** - Square root
- **MOD(number, divisor)** - Modulo/remainder

#### Statistical Functions (Extended)
- **MEDIAN(range)** - Middle value
- **MODE(range)** - Most frequent value
- **STDEV(range)** - Standard deviation
- **VAR(range)** - Variance
- **COUNTA(range)** - Count non-empty cells
- **COUNTIF(range, criteria)** - Conditional count
- **SUMIF(range, criteria, [sum_range])** - Conditional sum
- **AVERAGEIF(range, criteria, [average_range])** - Conditional average

#### Logical Functions
- **AND(condition1, condition2, ...)** - All conditions true
- **OR(condition1, condition2, ...)** - Any condition true
- **NOT(condition)** - Negate condition
- **IFERROR(value, value_if_error)** - Error handling
- **IFNA(value, value_if_na)** - Handle N/A errors
- **IFS(condition1, value1, condition2, value2, ...)** - Multiple conditions

#### Text Functions
- **CONCATENATE(text1, text2, ...)** or **CONCAT()** - Join strings
- **LEFT(text, num_chars)** - Extract from left
- **RIGHT(text, num_chars)** - Extract from right
- **MID(text, start, num_chars)** - Extract middle
- **LEN(text)** - String length
- **UPPER(text)** - Convert to uppercase
- **LOWER(text)** - Convert to lowercase
- **TRIM(text)** - Remove extra spaces
- **SUBSTITUTE(text, old, new)** - Replace text

### Phase 2: Date/Time Functions (Medium Priority)

- **TODAY()** - Current date
- **NOW()** - Current date and time
- **DATE(year, month, day)** - Create date
- **YEAR(date)** - Extract year
- **MONTH(date)** - Extract month
- **DAY(date)** - Extract day
- **HOUR(time)** - Extract hour
- **MINUTE(time)** - Extract minute
- **SECOND(time)** - Extract second
- **DATEDIF(start_date, end_date, unit)** - Date difference
- **WEEKDAY(date)** - Day of week
- **EOMONTH(start_date, months)** - End of month

### Phase 3: Lookup & Reference (Medium Priority)

- **VLOOKUP(lookup_value, table_array, col_index, [range_lookup])** - Vertical lookup
- **HLOOKUP(lookup_value, table_array, row_index, [range_lookup])** - Horizontal lookup
- **INDEX(array, row, [column])** - Get value by position
- **MATCH(lookup_value, lookup_array, [match_type])** - Find position
- **CHOOSE(index, value1, value2, ...)** - Select from list

### Phase 4: Financial Functions (Lower Priority)

- **PMT(rate, nper, pv)** - Loan payment
- **FV(rate, nper, pmt)** - Future value
- **PV(rate, nper, pmt)** - Present value
- **RATE(nper, pmt, pv)** - Interest rate
- **NPV(rate, value1, value2, ...)** - Net present value
- **IRR(values)** - Internal rate of return

## Implementation Architecture

### 1. Refactor Formula Evaluation System

**Current Problem**: The `evaluateFormula` function (lines 411-574) is becoming large and hard to maintain.

**Solution**: Extract function handlers into a registry pattern

```typescript
// New file: src/tools/models/spreadsheet-functions.ts

type CellGetter = (ref: string) => number | string;
type RangeGetter = (range: string) => (number | string)[];

interface FunctionContext {
  getCellValue: CellGetter;
  getRangeValues: RangeGetter;
  evaluateFormula: (formula: string) => number | string;
}

type FunctionHandler = (
  args: string[],
  context: FunctionContext
) => number | string;

interface FunctionDefinition {
  name: string;
  handler: FunctionHandler;
  minArgs?: number;
  maxArgs?: number;
  description?: string;
  examples?: string[];
}

class FunctionRegistry {
  private functions = new Map<string, FunctionDefinition>();

  register(def: FunctionDefinition) {
    this.functions.set(def.name.toUpperCase(), def);
  }

  get(name: string): FunctionDefinition | undefined {
    return this.functions.get(name.toUpperCase());
  }

  hasFunction(name: string): boolean {
    return this.functions.has(name.toUpperCase());
  }

  getAllFunctions(): FunctionDefinition[] {
    return Array.from(this.functions.values());
  }
}

export const functionRegistry = new FunctionRegistry();
```

### 2. Organize Functions by Category

Create separate files for each category:

```
src/tools/models/
  spreadsheet-functions.ts          # Core registry
  functions/
    statistical.ts                   # SUM, AVERAGE, MAX, MIN, etc.
    mathematical.ts                  # ROUND, ABS, SQRT, etc.
    logical.ts                       # IF, AND, OR, NOT, etc.
    text.ts                          # CONCATENATE, LEFT, RIGHT, etc.
    datetime.ts                      # TODAY, NOW, DATE, etc.
    lookup.ts                        # VLOOKUP, INDEX, MATCH, etc.
    financial.ts                     # PMT, FV, PV, etc.
    index.ts                         # Export all
```

### 3. Example Implementation

**statistical.ts**:
```typescript
import { functionRegistry, type FunctionHandler } from '../spreadsheet-functions';

const sumHandler: FunctionHandler = (args, context) => {
  if (args.length !== 1) throw new Error('SUM requires 1 argument');
  const values = context.getRangeValues(args[0]);
  return values.reduce((sum, val) => sum + Number(val), 0);
};

const averageHandler: FunctionHandler = (args, context) => {
  if (args.length !== 1) throw new Error('AVERAGE requires 1 argument');
  const values = context.getRangeValues(args[0]);
  return values.length > 0
    ? values.reduce((sum, val) => sum + Number(val), 0) / values.length
    : 0;
};

const medianHandler: FunctionHandler = (args, context) => {
  if (args.length !== 1) throw new Error('MEDIAN requires 1 argument');
  const values = context.getRangeValues(args[0])
    .map(v => Number(v))
    .sort((a, b) => a - b);

  if (values.length === 0) return 0;
  const mid = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? (values[mid - 1] + values[mid]) / 2
    : values[mid];
};

const countifHandler: FunctionHandler = (args, context) => {
  if (args.length !== 2) throw new Error('COUNTIF requires 2 arguments');
  const values = context.getRangeValues(args[0]);
  const criteria = args[1].trim();

  // Parse criteria (e.g., ">5", "<=10", "text", etc.)
  let compareFn: (val: any) => boolean;

  const opMatch = criteria.match(/^([><=!]+)(.+)$/);
  if (opMatch) {
    const [, op, value] = opMatch;
    const numValue = Number(value);
    switch (op) {
      case '>': compareFn = (v) => Number(v) > numValue; break;
      case '>=': compareFn = (v) => Number(v) >= numValue; break;
      case '<': compareFn = (v) => Number(v) < numValue; break;
      case '<=': compareFn = (v) => Number(v) <= numValue; break;
      case '=': case '==': compareFn = (v) => v == value; break;
      case '!=': case '<>': compareFn = (v) => v != value; break;
      default: compareFn = () => false;
    }
  } else {
    // Exact match
    compareFn = (v) => v == criteria.replace(/^["']|["']$/g, '');
  }

  return values.filter(compareFn).length;
};

// Register all functions
functionRegistry.register({
  name: 'SUM',
  handler: sumHandler,
  minArgs: 1,
  maxArgs: 1,
  description: 'Returns the sum of all numbers in a range',
  examples: ['SUM(A1:A10)', 'SUM(B2:B20)']
});

functionRegistry.register({
  name: 'AVERAGE',
  handler: averageHandler,
  minArgs: 1,
  maxArgs: 1,
  description: 'Returns the average of all numbers in a range',
  examples: ['AVERAGE(A1:A10)']
});

functionRegistry.register({
  name: 'MEDIAN',
  handler: medianHandler,
  minArgs: 1,
  maxArgs: 1,
  description: 'Returns the median value in a range',
  examples: ['MEDIAN(A1:A10)']
});

functionRegistry.register({
  name: 'COUNTIF',
  handler: countifHandler,
  minArgs: 2,
  maxArgs: 2,
  description: 'Counts cells matching a criteria',
  examples: ['COUNTIF(A1:A10, ">5")', 'COUNTIF(B1:B10, "Yes")']
});
```

### 4. Update evaluateFormula Function

**In spreadsheet.vue** (simplified):
```typescript
import { functionRegistry } from '../models/spreadsheet-functions';
import '../models/functions'; // Import all function registrations

const evaluateFormula = (formula: string): number | string => {
  try {
    // Check if it's a function call
    const funcMatch = formula.match(/^([A-Z]+)\((.+)\)$/i);
    if (funcMatch) {
      const [, funcName, argsStr] = funcMatch;
      const func = functionRegistry.get(funcName);

      if (func) {
        const args = parseFunctionArgs(argsStr);

        // Validate argument count
        if (func.minArgs && args.length < func.minArgs) {
          throw new Error(`${funcName} requires at least ${func.minArgs} arguments`);
        }
        if (func.maxArgs && args.length > func.maxArgs) {
          throw new Error(`${funcName} accepts at most ${func.maxArgs} arguments`);
        }

        // Execute function with context
        return func.handler(args, {
          getCellValue,
          getRangeValues,
          evaluateFormula
        });
      }
    }

    // Handle arithmetic expressions...
    // (existing code)

  } catch (error) {
    console.error(`Failed to evaluate formula: ${formula}`, error);
    return formula;
  }
};
```

## Testing Strategy

### 1. Unit Tests for Each Function

Create test file: `src/tools/models/__tests__/spreadsheet-functions.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { functionRegistry } from '../spreadsheet-functions';
import '../functions'; // Load all functions

describe('Statistical Functions', () => {
  const mockContext = {
    getCellValue: (ref: string) => {
      const values: Record<string, number> = {
        'A1': 10, 'A2': 20, 'A3': 30
      };
      return values[ref] ?? 0;
    },
    getRangeValues: (range: string) => {
      if (range === 'A1:A3') return [10, 20, 30];
      return [];
    },
    evaluateFormula: (f: string) => 0
  };

  it('should calculate SUM correctly', () => {
    const sum = functionRegistry.get('SUM');
    expect(sum).toBeDefined();
    const result = sum!.handler(['A1:A3'], mockContext);
    expect(result).toBe(60);
  });

  it('should calculate MEDIAN correctly', () => {
    const median = functionRegistry.get('MEDIAN');
    expect(median).toBeDefined();
    const result = median!.handler(['A1:A3'], mockContext);
    expect(result).toBe(20);
  });

  it('should handle COUNTIF with criteria', () => {
    const countif = functionRegistry.get('COUNTIF');
    expect(countif).toBeDefined();
    const result = countif!.handler(['A1:A3', '>15'], mockContext);
    expect(result).toBe(2); // 20 and 30
  });
});
```

### 2. Integration Tests

Test formulas in actual spreadsheet context with sample data.

### 3. Error Handling Tests

Test invalid inputs, missing arguments, type errors, etc.

## Documentation

### 1. In-App Help

Add a help panel to the spreadsheet component showing available functions:

```vue
<details class="function-help">
  <summary>Available Functions ({{ availableFunctions.length }})</summary>
  <div class="function-list">
    <div v-for="func in availableFunctionsByCategory" :key="func.name">
      <h4>{{ func.category }}</h4>
      <div v-for="fn in func.functions" class="function-item">
        <code>{{ fn.name }}({{ fn.signature }})</code>
        <p>{{ fn.description }}</p>
        <div class="examples">
          <span v-for="ex in fn.examples">{{ ex }}</span>
        </div>
      </div>
    </div>
  </div>
</details>
```

### 2. Update CLAUDE.md

Add section documenting the spreadsheet function capabilities.

## Migration Strategy

### Step 1: Refactor Existing Functions
- Create the registry system
- Move SUM, AVERAGE, MAX, MIN, COUNT, IF to new structure
- Ensure all existing functionality still works

### Step 2: Add Phase 1 Functions
- Implement mathematical functions
- Add extended statistical functions
- Expand logical functions
- Add basic text functions

### Step 3: Add Remaining Phases
- Phase 2: Date/Time
- Phase 3: Lookup & Reference
- Phase 4: Financial

### Step 4: Testing & Documentation
- Write comprehensive tests
- Add in-app documentation
- Update user guide

## Success Metrics

- [ ] Support for 50+ Excel functions
- [ ] All functions have unit tests
- [ ] Zero regression in existing functionality
- [ ] Performance maintained (formulas calculate in <100ms for typical sheets)
- [ ] In-app documentation available
- [ ] User can discover functions through help panel

## Future Enhancements

1. **Formula autocomplete** - Suggest functions as user types
2. **Error indicators** - Show which cells have formula errors
3. **Array formulas** - Support for formulas that return multiple values
4. **Custom functions** - Allow users to define JavaScript-based custom functions
5. **Formula debugging** - Show formula evaluation steps
6. **Performance optimization** - Memoize formula results, only recalculate on dependency changes

## Timeline Estimate

- **Phase 1**: 2-3 days (refactoring + essential functions)
- **Phase 2**: 1-2 days (date/time functions)
- **Phase 3**: 2-3 days (lookup functions are complex)
- **Phase 4**: 1-2 days (financial functions)
- **Testing & Documentation**: 1-2 days

**Total**: ~1-2 weeks for comprehensive implementation
