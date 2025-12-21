# PLAN20: Date Support for Spreadsheet Plugin

## Problem Statement

Currently, the spreadsheet plugin treats dates like "01/01/2001" as plain strings, preventing date arithmetic from working. Formulas like `=B3-TODAY()` fail when B3 contains a date string instead of a date serial number.

### Current State
- Date functions (TODAY, NOW, DATE, YEAR, MONTH, DAY, etc.) are implemented and working
- Dates are internally represented as Excel serial numbers (days since Dec 30, 1899)
- Date strings are stored as text, not parsed into serial numbers
- No date format codes exist for displaying serial numbers as formatted dates

### Goal
Enable full Excel-like date support:
1. Parse date strings into serial numbers automatically
2. Display serial numbers as formatted dates
3. Support date arithmetic (subtraction, addition with numbers)
4. Support various date input formats
5. Support Excel-style date format codes

## Architecture Analysis

### Existing Components

**Date Functions** (src/tools/models/spreadsheet-engine/functions/date.ts:1-340)
- ✅ TODAY(), NOW() - return current date/time as serial number
- ✅ DATE(year, month, day) - create date from components
- ✅ YEAR(), MONTH(), DAY() - extract components
- ✅ DATEDIF() - calculate date differences
- ✅ Helper functions: `dateToSerial()`, `serialToDate()`

**Formatter** (src/tools/models/spreadsheet-engine/formatter.ts:1-87)
- ✅ Handles currency ($#,##0.00), percentage (0.00%), decimals (0.00)
- ❌ No date format codes (MM/DD/YYYY, DD-MMM-YYYY, etc.)

**Cell Data Structure** (src/tools/models/spreadsheet-engine/types.ts:7-10)
```typescript
export interface SpreadsheetCell {
  v: CellValue; // Value or formula (formulas start with "=")
  f?: string;   // Format code (e.g., "$#,##0.00")
}
```

**Current Type Definition** (src/tools/models/spreadsheet-engine/types.ts:5)
```typescript
export type CellValue = number | string;
```

## Implementation Plan

### Phase 1: Date Parsing Infrastructure

#### 1.1 Create Date Parser Module
**File**: `src/tools/models/spreadsheet-engine/date-parser.ts`

**Purpose**: Parse various date string formats into Excel serial numbers

**Features**:
- Support common formats:
  - MM/DD/YYYY (01/15/2001)
  - DD/MM/YYYY (15/01/2001)
  - YYYY-MM-DD (2001-01-15) - ISO format
  - MMM DD, YYYY (Jan 15, 2001)
  - DD-MMM-YYYY (15-Jan-2001)
- Locale-aware parsing (configurable default format)
- Return `null` for non-date strings
- Validate parsed dates (reject invalid dates like 13/45/2001)

**API**:
```typescript
/**
 * Parse a date string into Excel serial number
 * @param dateStr - String that might contain a date
 * @param locale - Optional locale hint (default: 'en-US')
 * @returns Serial number or null if not a valid date
 */
export function parseDate(dateStr: string, locale?: string): number | null;

/**
 * Check if a string looks like a date
 * @param str - String to check
 * @returns true if string matches common date patterns
 */
export function isDateLike(str: string): boolean;
```

**Implementation Notes**:
- Use regex patterns to detect date-like strings
- Try multiple formats in priority order
- For ambiguous dates (01/02/2001), use locale to determine MM/DD vs DD/MM
- Leverage existing `dateToSerial()` from date.ts
- Handle 2-digit years (00-29 → 2000-2029, 30-99 → 1930-1999)

#### 1.2 Integrate Parser into Engine
**File**: `src/tools/models/spreadsheet-engine/engine.ts`

**Changes**:
- When loading cell data, check string values with `isDateLike()`
- Auto-convert date strings to serial numbers
- Preserve format code if not provided (default to "MM/DD/YYYY")
- Track which cells had auto-parsed dates for user transparency

**Example**:
```typescript
// Input: { v: "01/15/2001", f: "" }
// After parsing: { v: 36930, f: "MM/DD/YYYY" }
```

### Phase 2: Date Formatting

#### 2.1 Extend Formatter with Date Codes
**File**: `src/tools/models/spreadsheet-engine/formatter.ts`

**Add Support For**:
- **MM/DD/YYYY** - 01/15/2001
- **DD/MM/YYYY** - 15/01/2001
- **YYYY-MM-DD** - 2001-01-15
- **M/D/YYYY** - 1/15/2001 (no leading zeros)
- **MMM D, YYYY** - Jan 15, 2001
- **DD-MMM-YYYY** - 15-Jan-2001
- **MMMM D, YYYY** - January 15, 2001
- **ddd, MMM D** - Mon, Jan 15
- **dddd, MMMM D, YYYY** - Monday, January 15, 2001

**DateTime Formats**:
- **MM/DD/YYYY h:mm AM/PM** - 01/15/2001 2:30 PM
- **YYYY-MM-DD HH:mm:ss** - 2001-01-15 14:30:00

**Implementation**:
```typescript
/**
 * Detect if format code is a date format
 */
function isDateFormat(format: string): boolean {
  return /[MDYHms]/.test(format);
}

/**
 * Format a serial number as a date string
 */
export function formatDate(serial: number, format: string): string {
  const date = serialToDate(serial);

  // Replace format tokens:
  // YYYY → full year (2001)
  // YY → 2-digit year (01)
  // MMMM → full month name (January)
  // MMM → short month name (Jan)
  // MM → 2-digit month (01)
  // M → month (1)
  // DD → 2-digit day (15)
  // D → day (15)
  // etc.

  return formattedString;
}
```

**Update formatNumber()**:
```typescript
export function formatNumber(value: number, format: string): string {
  if (!format) return value.toString();

  // Check if it's a date format
  if (isDateFormat(format)) {
    return formatDate(value, format);
  }

  // Existing currency/percentage/decimal logic...
}
```

#### 2.2 Import Date Serial Conversion
**File**: `src/tools/models/spreadsheet-engine/formatter.ts`

**Add Import**:
```typescript
import { serialToDate } from "./functions/date";
```

**Consideration**: May need to refactor `serialToDate` to a shared utility module to avoid circular dependencies.

### Phase 3: User Interface Updates

#### 3.1 Update Tool Definition
**File**: `src/tools/models/spreadsheet.ts`

**Changes**:
- Update parameter description to mention date support
- Add examples showing date usage
- Update format code documentation

**Example Addition** (src/tools/models/spreadsheet.ts:47):
```typescript
description: 'Rows of cells. Each cell is an object with \'v\' (value) and \'f\' (format).
  Use Excel-style A1 notation in formulas.

  Values can be:
  - Text: {"v": "Revenue"}
  - Numbers: {"v": 1500000}
  - Dates: {"v": "01/15/2001"} or {"v": 36930}
  - Formulas: {"v": "=SUM(A1:A10)"}

  Format codes:
  - Currency: \'$#,##0.00\'
  - Percent: \'0.00%\'
  - Integer: \'#,##0\'
  - Decimal: \'0.00\'
  - Date: \'MM/DD/YYYY\', \'DD-MMM-YYYY\', \'YYYY-MM-DD\'
  - DateTime: \'MM/DD/YYYY h:mm AM/PM\''
```

#### 3.2 Update System Prompt
**File**: `src/tools/models/spreadsheet.ts`

**Update** (src/tools/models/spreadsheet.ts:136):
```typescript
systemPrompt: `Use ${toolName} whenever the user needs a spreadsheet-style table,
  multi-step math, or dynamic what-if analysis—do not summarize in text.

  Build LIVE sheets where every cell is an object {"v": value, "f": format}.

  For DATES, use date strings like "01/15/2001" or the DATE() function.
  The spreadsheet will auto-parse common date formats (MM/DD/YYYY, YYYY-MM-DD, etc.)
  into date serial numbers for calculations. Format dates with codes like
  "MM/DD/YYYY" or "DD-MMM-YYYY".

  For FORMULAS, set "v" to a string starting with "=" (e.g., {"v": "=B2*1.05", "f": "$#,##0.00"}).
  Date arithmetic works with formulas like "=B3-TODAY()" when B3 contains a date.

  Never pre-calculate; let the spreadsheet compute using cell refs, functions
  (SUM, AVERAGE, IF, TODAY, DATE, DATEDIF, etc.), and arithmetic.`
```

#### 3.3 Mini Editor Enhancement
**File**: `src/tools/views/spreadsheet.vue`

**Optional Enhancement**: Add date picker UI for date cells
- Detect when a cell contains a date serial number
- Show formatted date in mini editor
- Optionally provide a date picker widget
- Preserve serial number representation internally

**Priority**: Low (nice-to-have, not essential for MVP)

### Phase 4: Testing & Validation

#### 4.1 Unit Tests
**Files**:
- `src/tools/models/spreadsheet-engine/__tests__/date-parser.test.ts`
- `src/tools/models/spreadsheet-engine/__tests__/date-formatter.test.ts`

**Test Cases**:

**Date Parsing**:
- ✓ Parse MM/DD/YYYY (01/15/2001 → 36930)
- ✓ Parse YYYY-MM-DD (2001-01-15 → 36930)
- ✓ Parse DD-MMM-YYYY (15-Jan-2001 → 36930)
- ✓ Reject invalid dates (13/45/2001 → null)
- ✓ Handle 2-digit years (01/15/01 → 36930)
- ✓ Return null for non-dates ("Revenue" → null)
- ✓ Handle edge cases (02/29/2000 leap year)

**Date Formatting**:
- ✓ Format MM/DD/YYYY (36930 → "01/15/2001")
- ✓ Format DD-MMM-YYYY (36930 → "15-Jan-2001")
- ✓ Format MMMM D, YYYY (36930 → "January 15, 2001")
- ✓ Format with time (36930.5 → "01/15/2001 12:00 PM")
- ✓ Handle serial 1 (1 → "01/01/1900")
- ✓ Handle TODAY() result (current date)

**Date Arithmetic**:
- ✓ Subtraction: DATE(2001,1,15) - DATE(2001,1,1) → 14 days
- ✓ Addition: DATE(2001,1,1) + 30 → 30 days later
- ✓ TODAY() comparison: TODAY() - DATE(2000,1,1)
- ✓ DATEDIF with parsed dates

#### 4.2 Integration Tests
**File**: `src/tools/models/spreadsheet-engine/__tests__/date-integration.test.ts`

**Scenarios**:
1. Create sheet with date strings → verify auto-parsing
2. Use date formulas (=B3-TODAY()) → verify calculation
3. Format dates with different codes → verify display
4. Mix dates, numbers, and text → verify correct handling
5. Cross-sheet date references → verify Sheet1!A1 date usage

#### 4.3 Manual Testing Checklist
- [ ] Input "01/15/2001" in cell → displays as date
- [ ] Formula "=B3-TODAY()" works when B3 has date
- [ ] Download Excel file → dates preserved correctly
- [ ] Edit date in mini editor → updates properly
- [ ] Multiple date formats parse correctly
- [ ] Non-date strings not mis-parsed as dates
- [ ] TODAY() function returns current date
- [ ] DATE() function creates valid dates
- [ ] Format codes render dates correctly

## Implementation Risks & Mitigations

### Risk 1: Ambiguous Date Formats
**Problem**: "01/02/2001" could be Jan 2 or Feb 1

**Mitigation**:
- Default to US format (MM/DD/YYYY) unless locale specified
- Add engine option: `{ dateLocale: 'en-US' | 'en-GB' | ... }`
- Document assumption in system prompt
- Consider adding DATEVALUE() function that accepts format hint

### Risk 2: Breaking Existing Spreadsheets
**Problem**: Existing sheets might have date-like strings that aren't dates

**Mitigation**:
- Only auto-parse strings that strongly match date patterns
- Require at least one separator (/, -, space)
- Require 4-digit year for YYYY-MM-DD
- Validate parsed dates are in reasonable range (1900-2100)
- Allow users to escape auto-parsing with apostrophe ('01/15/2001)

### Risk 3: Performance Impact
**Problem**: Parsing every string value could slow down large sheets

**Mitigation**:
- Use fast regex pre-check with `isDateLike()`
- Only parse on initial load, not during recalculation
- Cache parsed results
- Limit parsing to cells without formulas

### Risk 4: Excel Export Compatibility
**Problem**: XLSX.js might not handle serial numbers correctly

**Mitigation**:
- Test Excel export with date serial numbers
- Verify XLSX.js applies date formatting automatically
- May need to set cell type metadata: `{ t: 'n', z: 'mm/dd/yyyy' }`
- Fallback: convert to Excel DATE formula if needed

### Risk 5: Circular Dependencies
**Problem**: formatter.ts needs serialToDate from date.ts

**Mitigation**:
- Extract `serialToDate` and `dateToSerial` to separate utility file
- New file: `src/tools/models/spreadsheet-engine/date-utils.ts`
- Import in both formatter.ts and functions/date.ts
- Prevents circular import issues

## Implementation Order

### Sprint 1: Core Date Infrastructure
1. ✅ Create `date-utils.ts` with serialToDate/dateToSerial (refactor from date.ts)
2. ✅ Create `date-parser.ts` with parseDate() and isDateLike()
3. ✅ Create unit tests for date-parser.ts
4. ✅ Update `functions/date.ts` to import from date-utils.ts

### Sprint 2: Date Formatting
1. ✅ Extend `formatter.ts` with date format support
2. ✅ Implement formatDate() with common format codes
3. ✅ Create unit tests for date formatter
4. ✅ Update formatNumber() to detect and handle date formats

### Sprint 3: Engine Integration
1. ✅ Update `engine.ts` to auto-parse date strings on load
2. ✅ Integrate date parser into calculate() workflow
3. ✅ Add engine option for date locale preference
4. ✅ Create integration tests

### Sprint 4: UI & Documentation
1. ✅ Update tool definition with date examples
2. ✅ Update system prompt to guide LLM on date usage
3. ✅ Test Excel export with dates
4. ✅ Manual testing and bug fixes

### Sprint 5: Polish & Optimization
1. ✅ Performance testing with large date datasets
2. ✅ Edge case handling and validation
3. ✅ Documentation updates
4. ✅ User-facing examples and demos

## Success Criteria

### Functional Requirements
- ✅ Date strings automatically parse to serial numbers
- ✅ Date arithmetic works (subtraction, addition)
- ✅ TODAY() and NOW() work in formulas with date cells
- ✅ Date format codes display dates correctly
- ✅ Multiple date input formats supported
- ✅ Excel export preserves dates correctly

### Non-Functional Requirements
- ✅ Performance: No noticeable slowdown on 1000+ cell sheets
- ✅ Compatibility: Existing spreadsheets continue working
- ✅ Accuracy: Date calculations match Excel behavior
- ✅ Usability: Date input feels natural and intuitive

### User Experience
- ✅ LLM creates spreadsheets with dates without special syntax
- ✅ User can type "01/15/2001" and it "just works"
- ✅ Formulas like "=B3-TODAY()" work as expected
- ✅ Downloaded Excel files open correctly with dates

## Alternative Approaches Considered

### Alternative 1: DATEVALUE() Function Only
**Approach**: Don't auto-parse, require users to use DATEVALUE("01/15/2001")

**Pros**:
- Explicit and unambiguous
- No risk of mis-parsing non-dates
- Simpler implementation

**Cons**:
- Poor user experience
- Requires LLM to know about DATEVALUE
- Doesn't match Excel behavior (Excel auto-parses dates)
- More verbose syntax

**Decision**: ❌ Rejected - Auto-parsing provides better UX

### Alternative 2: Separate Date Type
**Approach**: Add a third value type: `CellValue = number | string | Date`

**Pros**:
- Type-safe date handling
- No ambiguity about date vs number
- Could store timezone info

**Cons**:
- Doesn't match Excel's model (Excel uses numbers for dates)
- JSON serialization complexity (Date → string → back)
- Breaks existing architecture
- More complex formatting logic

**Decision**: ❌ Rejected - Stick with Excel's serial number model

### Alternative 3: ISO Strings Only
**Approach**: Only support YYYY-MM-DD format, no parsing of MM/DD/YYYY

**Pros**:
- Unambiguous format
- International standard
- No locale issues

**Cons**:
- Doesn't match common user input (01/15/2001)
- LLM might generate MM/DD/YYYY anyway
- Less flexible

**Decision**: ❌ Rejected - Support multiple formats for better UX

## Open Questions

1. **Locale Detection**: How to determine user's preferred date format?
   - **Resolution**: Default to MM/DD/YYYY, add engine option for override

2. **Time-only Values**: Should we support "2:30 PM" as 0.xxx serial number?
   - **Resolution**: Yes, parse time strings if they match time patterns

3. **Date Validation Range**: What range of dates to accept?
   - **Resolution**: 1900-01-01 to 2100-12-31 (reasonable spreadsheet range)

4. **Format Code Discovery**: How do users learn available format codes?
   - **Resolution**: Document in tool definition, rely on LLM knowledge

5. **Error Handling**: What to show when date parsing fails?
   - **Resolution**: Leave as string if parsing fails, no error

## References

- Excel Date System: https://support.microsoft.com/en-us/office/date-systems-in-excel
- Excel Format Codes: https://support.microsoft.com/en-us/office/number-format-codes
- Existing Implementation: src/tools/models/spreadsheet-engine/functions/date.ts
- XLSX.js Documentation: https://github.com/SheetJS/sheetjs

## Appendix: Example Usage

### Before (Not Working)
```typescript
{
  "sheets": [{
    "name": "Project Timeline",
    "data": [
      [{"v": "Task"}, {"v": "Due Date"}, {"v": "Days Until"}],
      [{"v": "Launch"}, {"v": "01/15/2025"}, {"v": "=B2-TODAY()"}]
      //                      ^^^^^^^^^^^           ^^^^^^^^^^^
      //                      Treated as string     Formula fails
    ]
  }]
}
```

### After (Working)
```typescript
{
  "sheets": [{
    "name": "Project Timeline",
    "data": [
      [{"v": "Task"}, {"v": "Due Date", "f": ""}, {"v": "Days Until"}],
      [{"v": "Launch"}, {"v": "01/15/2025", "f": "MM/DD/YYYY"}, {"v": "=B2-TODAY()", "f": "#,##0"}]
      //                      ^^^^^^^^^^^^^^^^^^^^^^^^^^^             ^^^^^^^^^^^^^^^^^^^^^
      //                      Parsed to serial 45672                  Calculates: 45672 - TODAY()
      //                      Displays as: 01/15/2025                 Displays as: 45 (or whatever)
    ]
  }]
}
```

### Example: Age Calculator
```typescript
{
  "sheets": [{
    "name": "Ages",
    "data": [
      [{"v": "Name"}, {"v": "Birth Date"}, {"v": "Age"}],
      [{"v": "Alice"}, {"v": "03/15/1990", "f": "MM/DD/YYYY"}, {"v": "=DATEDIF(B2,TODAY(),\"Y\")", "f": "#,##0"}],
      [{"v": "Bob"}, {"v": "07/22/1985", "f": "MM/DD/YYYY"}, {"v": "=DATEDIF(B3,TODAY(),\"Y\")", "f": "#,##0"}]
    ]
  }]
}
```

### Example: Project Gantt Data
```typescript
{
  "sheets": [{
    "name": "Project Schedule",
    "data": [
      [{"v": "Phase"}, {"v": "Start"}, {"v": "End"}, {"v": "Duration"}],
      [{"v": "Planning"}, {"v": "2025-01-01", "f": "YYYY-MM-DD"}, {"v": "2025-01-15", "f": "YYYY-MM-DD"}, {"v": "=C2-B2", "f": "#,##0"}],
      [{"v": "Development"}, {"v": "2025-01-16", "f": "YYYY-MM-DD"}, {"v": "2025-03-15", "f": "YYYY-MM-DD"}, {"v": "=C3-B3", "f": "#,##0"}]
    ]
  }]
}
```
