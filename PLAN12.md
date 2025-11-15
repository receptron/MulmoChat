# Plan: Implement `presentSpreadsheet` Tool

## Overview
Implement a new plugin that allows the LLM to present Excel-like spreadsheets to users, following the pattern established by the `presentDocument` (markdown) plugin. The tool will use SheetJS (xlsx) to handle spreadsheet data with formula support.

## Goals
- Enable LLM to create and display interactive spreadsheets
- Support Excel formulas (e.g., `SUM`, `AVERAGE`, `cell references`)
- Allow viewing and potentially editing spreadsheet data
- Provide download functionality for Excel files
- Follow existing plugin architecture patterns

## Technical Approach

### 1. Dependencies
- **SheetJS (xlsx)**: Main library for spreadsheet handling
  - Install: `yarn add xlsx`
  - Also install types: `yarn add -D @types/xlsx`
  - Capabilities: Formula support, Excel file generation, browser rendering

### 2. Data Format

The LLM will provide spreadsheet data in a 2D array format (array of arrays):

```typescript
interface SpreadsheetToolData {
  title: string;
  sheets: Array<{
    name: string;
    data: Array<Array<string | number | { f: string }>>; // Cells can be values or formulas
  }>;
}
```

**Example data structure:**
```typescript
{
  title: "Sales Report",
  sheets: [{
    name: "Q1 Sales",
    data: [
      ["Name", "Score 1", "Score 2", "Total", "Average"],
      ["Alice", 80, 90, { f: "B2+C2" }, { f: "(B2+C2)/2" }],
      ["Bob", 70, 85, { f: "B3+C3" }, { f: "(B3+C3)/2" }],
      ["", "", "", "Sum:", { f: "SUM(D2:D4)" }]
    ]
  }]
}
```

### 3. File Structure

Following the existing plugin pattern:

```
src/tools/
├── models/
│   └── spreadsheet.ts          # Plugin definition and execution logic
├── views/
│   └── spreadsheet.vue         # Main view component (full canvas)
├── previews/
│   └── spreadsheet.vue         # Sidebar preview component
└── index.ts                     # Register plugin in pluginList
```

### 4. Implementation Steps

#### Step 1: Install Dependencies
```bash
yarn add xlsx
yarn add -D @types/xlsx
```

#### Step 2: Create Plugin Model (`src/tools/models/spreadsheet.ts`)

**Key features:**
- Tool name: `presentSpreadsheet`
- Tool definition with parameters: `title`, `sheets`
- Execute function that:
  - Validates spreadsheet data
  - Creates workbook using SheetJS
  - Stores workbook data for rendering
  - Returns ToolResult with spreadsheet data

**Tool Definition:**
```typescript
{
  type: "function",
  name: "presentSpreadsheet",
  description: "Display an Excel-like spreadsheet with formulas and calculations",
  parameters: {
    type: "object",
    properties: {
      title: {
        type: "string",
        description: "Title for the spreadsheet"
      },
      sheets: {
        type: "array",
        description: "Array of sheets to display",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Sheet name" },
            data: {
              type: "array",
              description: "2D array of cell data. Cells can be strings, numbers, or formula objects like {f: 'SUM(A1:A10)'}",
              items: { type: "array" }
            }
          },
          required: ["name", "data"]
        }
      }
    },
    required: ["title", "sheets"]
  }
}
```

#### Step 3: Create View Component (`src/tools/views/spreadsheet.vue`)

**Features:**
- **Read-only rendered view** (main display):
  - Render spreadsheet using SheetJS's HTML rendering
  - Display multiple sheets with tabs if provided
  - Show calculated formula results
  - "Download Excel" button using `XLSX.writeFile()`
  - Styling to match Excel-like appearance

- **Collapsible editor** (initially hidden, following markdown pattern):
  - `<details>` element with "Edit Spreadsheet Data" summary
  - Textarea with JSON representation of spreadsheet data
  - "Apply Changes" button (disabled when no changes)
  - State management:
    - `editableData` ref for tracking edits
    - `hasChanges` computed property
    - `applyChanges()` function emitting `updateResult` event
    - Watcher to sync when selectedResult changes

**SheetJS Integration:**
```typescript
// Convert data to worksheet
const worksheet = XLSX.utils.aoa_to_sheet(sheetData);

// Generate HTML table
const html = XLSX.utils.sheet_to_html(worksheet);

// For download:
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
XLSX.writeFile(workbook, `${title}.xlsx`);
```

**Editor Format:**
Users can edit the spreadsheet data as JSON:
```json
{
  "sheets": [
    {
      "name": "Sheet1",
      "data": [
        ["A1", "B1", "C1"],
        ["A2", {"f": "SUM(A1:B1)"}, "C2"]
      ]
    }
  ]
}
```

#### Step 4: Create Preview Component (`src/tools/previews/spreadsheet.vue`)

**Features:**
- Show thumbnail preview of spreadsheet
- Display title and sheet count
- Show first few rows/columns
- Icon indicating spreadsheet type

#### Step 5: Register Plugin

Update `src/tools/index.ts`:
```typescript
import * as SpreadsheetPlugin from "./models/spreadsheet";

const pluginList = [
  // ... existing plugins
  SpreadsheetPlugin,
];
```

### 5. User Experience Flow

1. **User Request**: "Create a spreadsheet showing quarterly sales data"
2. **LLM Calls**: `presentSpreadsheet` with structured data and formulas
3. **Plugin Execution**:
   - Validates data format
   - Creates SheetJS workbook
   - Returns result with spreadsheet data
4. **Display**:
   - Sidebar shows preview thumbnail
   - Main canvas shows full interactive spreadsheet
   - User can view calculated results
   - User can download as Excel file

### 6. Advanced Features (Future Enhancements)

- **Editable Mode**: Allow users to edit cell values and see formula recalculations
- **Cell Formatting**: Support colors, fonts, borders
- **Charts**: Add chart generation from data
- **Multiple Sheets**: Tab navigation between sheets
- **CSV Export**: Alternative download format
- **Cell Validation**: Data validation rules
- **Conditional Formatting**: Highlight cells based on values

## Files to Create/Modify

### New Files:
1. `src/tools/models/spreadsheet.ts` - Plugin model
2. `src/tools/views/spreadsheet.vue` - View component
3. `src/tools/previews/spreadsheet.vue` - Preview component
4. `PLAN12.md` - This plan document

### Modified Files:
1. `src/tools/index.ts` - Register plugin
2. `package.json` - Add xlsx dependency (via yarn)

## Testing Plan

1. **Basic Display**: Create simple spreadsheet with text and numbers
2. **Formulas**: Test arithmetic formulas (A1+B1)
3. **Functions**: Test Excel functions (SUM, AVERAGE, MAX, MIN)
4. **Multiple Sheets**: Test workbook with multiple sheets
5. **Download**: Verify Excel file download works correctly
6. **Edge Cases**: Empty cells, invalid formulas, large datasets

### Good Test Prompts

1. **Present Value Calculation (Complex Formulas)**:
   ```
   "Shows me the present value of $1000 monthly income over a year, making it easy to change the discount rate."
   ```
   - Tests: Currency formatting, percentage strings, exponentiation (^), absolute references ($B$4), division, cell references
   - Expected: Shows 12 months with discount factors and present values, total PV around $11,618

2. **Sales Performance Dashboard (Multiple Sheets)**:
   ```
   "Create a sales tracking spreadsheet with two sheets: one for Q1 sales by region (North, South, East, West) with monthly data, and another for summary statistics showing total sales, average, and growth percentages."
   ```
   - Tests: Multiple sheets, SUM across ranges, AVERAGE, percentage calculations, formatting
   - Expected: Two sheets with cross-sheet references, formatted currency, percentages

3. **Student Grade Calculator (Weighted Averages)**:
   ```
   "Create a gradebook spreadsheet for 5 students with assignments (30%), midterm (30%), and final exam (40%) scores. Calculate weighted averages and show letter grades."
   ```
   - Tests: Weighted calculations, arithmetic with cell references, conditional logic (if possible)
   - Expected: Shows scores, weighted totals, final percentages

4. **Investment Portfolio Tracker (Formatting Variety)**:
   ```
   "Create an investment portfolio showing 8 stocks with shares owned, purchase price, current price, total value, and gain/loss. Format values as currency and percentages appropriately."
   ```
   - Tests: Multiple columns with formulas, positive/negative numbers, currency and percentage formatting
   - Expected: Shows portfolio with formatted values, calculated gains/losses

5. **Monthly Budget Planner (Categories & Totals)**:
   ```
   "Create a household budget spreadsheet with income sources and expense categories (rent, utilities, food, transportation, entertainment, savings). Show totals and remaining balance."
   ```
   - Tests: SUM function, multiple categories, currency formatting, simple subtraction
   - Expected: Clean budget layout with categorized expenses and remaining balance

6. **Loan Amortization Schedule (Advanced Financial)**:
   ```
   "Create a loan amortization schedule for a $250,000 mortgage at 6% annual interest over 30 years with monthly payments. Show payment number, payment amount, interest, principal, and remaining balance for the first year."
   ```
   - Tests: Complex financial formulas, exponentiation, division, currency formatting, running calculations
   - Expected: 12 rows showing payment breakdown with decreasing balance

7. **Unit Conversion Table (Constants & Formulas)**:
   ```
   "Create a temperature conversion table showing Celsius values from 0 to 100 in increments of 10, with corresponding Fahrenheit and Kelvin values."
   ```
   - Tests: Formula replication, arithmetic operations, decimal formatting
   - Expected: Conversion table with accurate calculations (F = C × 9/5 + 32, K = C + 273.15)

8. **Compound Interest Calculator (Parameter Design)**:
   ```
   "Create a compound interest calculator showing the growth of $10,000 invested at different annual interest rates (3%, 5%, 7%, 10%) over 10 years. Show yearly balances. Make sure the interest rates can be easily modified."
   ```
   - Tests: Exponentiation (^), absolute references, parameter design, currency formatting, formula copying
   - Expected: Table showing investment growth with rates in header cells that formulas reference (e.g., `B3*(1+B$1)` instead of `B3*1.03`), allowing easy modification of rates

9. **Product Inventory with Reorder Alerts (Calculations)**:
   ```
   "Create an inventory spreadsheet for 10 products showing current stock, reorder point (20 units), unit cost, and total inventory value. Format costs as currency."
   ```
   - Tests: Simple multiplication, currency formatting, basic data organization
   - Expected: Clean inventory table with calculated totals

10. **Time Tracking & Billing (Time Calculations)**:
   ```
   "Create a timesheet for a freelancer showing 10 projects with hours worked and hourly rate ($150/hr). Calculate total earnings per project and overall total."
   ```
   - Tests: Multiplication, SUM function, currency formatting, decimal hours
   - Expected: Timesheet with calculated billing amounts

## Example LLM Usage

```
User: "Create a spreadsheet showing my monthly expenses"

LLM calls presentSpreadsheet:
{
  title: "Monthly Expenses",
  sheets: [{
    name: "January 2025",
    data: [
      ["Category", "Amount", "Budget", "Difference"],
      ["Rent", 1500, 1500, { f: "C2-B2" }],
      ["Food", 400, 500, { f: "C3-B3" }],
      ["Transport", 150, 200, { f: "C4-B4" }],
      ["Total", { f: "SUM(B2:B4)" }, { f: "SUM(C2:C4)" }, { f: "SUM(D2:D4)" }]
    ]
  }]
}
```

## References

- SheetJS Documentation: https://docs.sheetjs.com/
- Similar Plugin: `src/tools/models/markdown.ts`
- Plugin Architecture: `src/tools/types.ts`
- Sample Code: Provided by user (creating workbook with formulas)

## Implementation Order

1. ✅ Create PLAN12.md (this document)
2. Install xlsx and @types/xlsx
3. Create spreadsheet.ts model
4. Create spreadsheet.vue view
5. Create spreadsheet.vue preview
6. Register in index.ts
7. Test with sample data
8. Refine UI/UX based on testing
