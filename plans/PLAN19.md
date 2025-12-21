# PLAN19: LLM Spreadsheet Capability Benchmark

## Overview

A command-line benchmarking system to evaluate Large Language Models' ability to generate accurate, formula-based spreadsheets. The benchmark tests LLMs on creating structured spreadsheet data with formulas, which are then verified by our spreadsheet engine.

## 🔑 Key Design Decision: Structure-Agnostic Verification

**Critical Insight**: LLMs can structure spreadsheets in infinitely many valid ways. The same task might produce:
- Vertical vs horizontal layouts
- Different starting positions (A1 vs B2)
- Different cell orderings
- Various formula approaches (SUM vs manual addition)

**Our Solution**: Verify *semantic correctness* (what data exists and what results are calculated), NOT structural properties (which cell contains what). We use:
- **Label-based lookup**: Find values by nearby text labels
- **Assertion-based testing**: Check calculated results match expected values
- **Pattern matching**: Identify formulas and functions used
- **Flexible extraction**: Support multiple valid structural arrangements

This approach ensures fair evaluation across different LLM reasoning patterns while maintaining rigor.

## Goals

1. **Objective Evaluation**: Quantitatively measure LLM performance on spreadsheet generation tasks
2. **No UI Required**: Pure CLI-based workflow for automation and CI/CD integration
3. **Comprehensive Testing**: Cover all function categories (statistical, mathematical, financial, logical, text, date, lookup)
4. **Automated Verification**: Use the spreadsheet engine to validate formula correctness
5. **Cross-Model Comparison**: Enable direct comparison between different LLMs (GPT-4, Claude, Gemini, etc.)

## Architecture

### Components

```
benchmark/
├── prompts/                    # Benchmark prompts
│   ├── basic/                  # Basic arithmetic and formulas
│   ├── statistical/            # SUM, AVERAGE, COUNT, etc.
│   ├── financial/              # PV, PMT, FV, etc.
│   ├── logical/                # IF, AND, OR, etc.
│   ├── lookup/                 # VLOOKUP, HLOOKUP
│   ├── text/                   # CONCAT, TRIM, UPPER, etc.
│   ├── date/                   # DATE, TODAY, DATEDIF, etc.
│   ├── mathematical/           # ROUND, ABS, SQRT, etc.
│   └── complex/                # Multi-sheet, nested functions
├── expected/                   # Expected outputs (ground truth)
│   └── [same structure as prompts]
├── results/                    # LLM-generated outputs
│   ├── gpt-4/
│   ├── claude-3.5-sonnet/
│   ├── gemini-pro/
│   └── ...
├── src/
│   ├── runner.ts              # Main benchmark runner
│   ├── llm-client.ts          # LLM API client abstraction
│   ├── verifier.ts            # Spreadsheet verification logic
│   ├── scorer.ts              # Scoring and metrics
│   └── reporter.ts            # Result reporting and visualization
└── config.json                # Benchmark configuration
```

### Data Flow

```
1. Load Prompt → 2. Send to LLM → 3. Parse Response → 4. Verify Formulas → 5. Score Result → 6. Generate Report
```

## Prompt Design Strategy

### Prompt Structure

Each benchmark prompt follows this structure:

```
System Prompt:
You are a spreadsheet generation assistant. Generate spreadsheets using the presentSpreadsheet function.
Always use formulas (starting with =) for calculations. Never hard-code calculated values.

User Prompt:
[Specific task description]

Output Format:
{
  "title": "...",
  "sheets": [
    {
      "name": "...",
      "data": [
        [{"v": "...", "f": "..."}, ...]
      ]
    }
  ]
}
```

### Difficulty Levels

**Level 1: Basic (10 prompts)**
- Simple arithmetic formulas
- Single sheet, 3-5 rows
- Basic cell references (A1, B2)
- Functions: SUM, basic arithmetic

**Level 2: Intermediate (15 prompts)**
- Multiple functions per category
- Cell ranges (A1:A10)
- 5-10 rows, 3-5 columns
- Functions: AVERAGE, COUNT, MAX, MIN, IF

**Level 3: Advanced (15 prompts)**
- Nested functions
- Cross-references within sheet
- 10-20 rows, 5-8 columns
- Functions: VLOOKUP, nested IF, ROUND(SUM(...))

**Level 4: Expert (10 prompts)**
- Multi-sheet references
- Complex nested formulas
- 20+ rows, 8+ columns
- Functions: All categories combined, Sheet1!A1 references

## Test Scenarios

### 1. Basic Arithmetic (Level 1)
**Prompt**: "Create a spreadsheet showing monthly expenses (Rent: $1200, Food: $400, Transport: $200) with a total."
**Verification Criteria**:
- Required labels: Rent, Food, Transport, Total
- Required values: 1200, 400, 200
- Assertion: Total calculates to 1800
- Formula requirement: Total uses a formula (not hard-coded)
- Expected functions: SUM or arithmetic operators
**Tests**: Basic cell references, SUM function, label-based lookup

### 2. Sales Analysis (Level 2)
**Prompt**: "Create a sales spreadsheet with Product, Unit Price, Quantity, and Total columns for 5 products. Include sum, average, and highest sale."
**Verification Criteria**:
- Required elements: 5 product names, prices, quantities, calculated totals
- Assertions:
  - Each product total = price × quantity (5 checks)
  - Sum of totals present
  - Average of totals present
  - Maximum total present
- Formula requirements: Totals use formulas, aggregations use functions
- Expected functions: Multiplication operator or formula, SUM, AVERAGE, MAX
**Tests**: Multiple functions, ranges, basic math, multi-assertion

### 3. Budget Planning (Level 2)
**Prompt**: "Create a monthly budget with Income ($5000) and categories (Housing 30%, Food 15%, Transport 10%, Savings 20%, Other 25%). Show dollar amounts and remaining balance."
**Expected**:
- Dollar amounts: =B1*30% or =B1*0.3
- Total expenses: =SUM(amounts)
- Remaining: =Income-Expenses
**Tests**: Percentage calculations, cell references

### 4. Grade Calculator (Level 3)
**Prompt**: "Create a grade sheet for 6 students with 3 test scores each. Calculate average, assign letter grade (A≥90, B≥80, C≥70, D≥60, F<60)."
**Expected**:
- Average: =AVERAGE(B2:D2)
- Grade: =IF(E2>=90,"A",IF(E2>=80,"B",IF(E2>=70,"C",IF(E2>=60,"D","F"))))
**Tests**: Nested IF, AVERAGE, complex logic

### 5. Loan Calculator (Level 3)
**Prompt**: "Create a loan calculator showing: Principal ($100,000), Annual Rate (5%), Years (30), Monthly Payment, Total Paid, Total Interest."
**Expected**:
- Monthly rate: =B2/12
- Months: =B3*12
- Payment: =PMT(rate, nper, pv)
- Total paid: =Monthly*Months
- Interest: =TotalPaid-Principal
**Tests**: Financial functions, multi-step calculations

### 6. Sales Commission (Level 3)
**Prompt**: "Create a sales commission sheet for 8 salespeople. Commission: 5% on sales up to $10,000, 7% on sales $10,001-$25,000, 10% above $25,000."
**Expected**:
- Tiered commission formula using nested IF or multiple conditions
- Proper range handling
**Tests**: Complex IF logic, tiered calculations

### 7. Inventory Lookup (Level 3)
**Prompt**: "Create two sheets: 1) Product catalog (Product ID, Name, Price, Stock) for 10 products. 2) Order form where entering Product ID looks up Name, Price, calculates Total (Qty*Price)."
**Expected**:
- VLOOKUP for name and price from catalog
- Calculated total
**Tests**: VLOOKUP, cross-table references

### 8. Date Calculations (Level 3)
**Prompt**: "Create a project timeline with tasks, start dates, duration (days), end dates, and days until deadline (Dec 31, 2025)."
**Expected**:
- End date: =A2+B2 (if duration in days)
- Days until: =DATE(2025,12,31)-C2
**Tests**: Date arithmetic, DATE function

### 9. Text Processing (Level 2)
**Prompt**: "Create a contact list with Full Name (First Last), Email (first.last@company.com). Generate email from names."
**Expected**:
- Split or concat names
- Email: =LOWER(CONCAT(A2,".",B2,"@company.com"))
**Tests**: Text functions, CONCAT, LOWER

### 10. Multi-Sheet Analysis (Level 4)
**Prompt**: "Create 3 sheets: Q1 Sales, Q2 Sales (Product, Revenue for 5 products each), and Summary sheet totaling each product across quarters."
**Expected**:
- Summary: =Q1!B2+Q2!B2 (or similar)
- Cross-sheet references
**Tests**: Multi-sheet formulas, cross-references

### 11. Pivot-Style Summary (Level 4)
**Prompt**: "Create a sales data sheet (Date, Region, Product, Amount for 20 rows) and a summary sheet calculating total by Region and by Product."
**Expected**:
- SUMIF formulas: =SUMIF(Region_Range,"East",Amount_Range)
- Multiple SUMIF for different criteria
**Tests**: SUMIF, conditional aggregation

### 12. Financial Ratios (Level 3)
**Prompt**: "Create a financial statement with Revenue, COGS, Operating Expenses, Net Income. Calculate Gross Margin %, Operating Margin %, Net Margin %."
**Expected**:
- Gross Margin: =(Revenue-COGS)/Revenue
- Operating Margin: =(Revenue-COGS-OpEx)/Revenue
- Net Margin: =NetIncome/Revenue
- Format as percentages
**Tests**: Complex formulas, percentage formatting, dependencies

### 13. Statistics Dashboard (Level 3)
**Prompt**: "Create a dataset of 15 numbers and calculate: Mean, Median, Mode (if applicable), Standard Deviation, Min, Max, Range."
**Expected**:
- AVERAGE, MEDIAN, MIN, MAX
- Range: =MAX()-MIN()
- Standard deviation (if available)
**Tests**: Statistical functions

### 14. Compound Interest (Level 2)
**Prompt**: "Create a compound interest calculator: Principal ($1000), Annual Rate (6%), Years (10), Compounds (12/year). Show final amount and interest earned."
**Expected**:
- Formula: =P*(1+r/n)^(n*t)
- Interest: =FinalAmount-Principal
**Tests**: Exponentiation, complex formulas

### 15. Time Sheet Calculator (Level 3)
**Prompt**: "Create a timesheet for 5 employees with Clock In, Clock Out, Break (hrs), Hours Worked, Hourly Rate, Pay. Calculate totals."
**Expected**:
- Hours: =ClockOut-ClockIn-Break
- Pay: =Hours*Rate
- Totals using SUM
**Tests**: Time calculations, multiplication, aggregation

## Verification Strategy

### Key Insight: Structure-Agnostic Verification

**Important**: LLMs can structure spreadsheets in many valid ways. A "Monthly Expenses" spreadsheet could be:
- Vertical layout (expenses in rows)
- Horizontal layout (expenses in columns)
- Different starting positions
- Different label naming
- Various formula approaches (SUM vs manual addition)

**All are correct as long as they produce the right results!**

### Verification Process

```typescript
// Pseudo-code
function verifySpreadsheet(
  llmOutput: string,
  testCase: TestCase
): VerificationResult {
  // 1. Parse LLM output as JSON
  const generated = JSON.parse(llmOutput);

  // 2. Calculate formulas using spreadsheet engine
  const calculated = engine.calculate(generated.sheets[0]);

  // 3. Extract semantic values (not position-based!)
  const extractedValues = extractSemanticValues(calculated, testCase.extractors);

  // 4. Verify against expected assertions
  return {
    dataPresence: checkRequiredData(calculated, testCase.requiredElements),
    resultCorrectness: verifyAssertions(extractedValues, testCase.assertions),
    formulaUsage: analyzeFormulas(generated, testCase.expectedFunctions),
    functionUsage: extractFunctions(generated),
    errors: collectErrors(calculated)
  };
}
```

### Test Case Structure

Each test case defines **what to verify** rather than **where**:

```json
{
  "id": "basic-01",
  "prompt": "Create a spreadsheet showing monthly expenses...",
  "requiredElements": [
    {"type": "label", "value": "Rent", "caseSensitive": false},
    {"type": "label", "value": "Food", "caseSensitive": false},
    {"type": "label", "value": "Transport", "caseSensitive": false},
    {"type": "label", "value": "Total", "caseSensitive": false}
  ],
  "requiredValues": [
    {"label": "Rent", "value": 1200, "tolerance": 0},
    {"label": "Food", "value": 400, "tolerance": 0},
    {"label": "Transport", "value": 200, "tolerance": 0}
  ],
  "assertions": [
    {
      "name": "Total is correct",
      "extractor": "findByLabel('Total')",
      "expected": 1800,
      "tolerance": 0.01
    }
  ],
  "formulaRequirements": [
    {
      "description": "Total uses a formula, not hard-coded value",
      "check": "cellWithLabel('Total').hasFormula()"
    },
    {
      "description": "Total uses SUM or addition",
      "check": "cellWithLabel('Total').usesFunction(['SUM', '+'])"
    }
  ],
  "expectedFunctions": ["SUM"],
  "level": 1,
  "category": "basic"
}
```

### Semantic Extraction Strategies

**1. Label-Based Lookup**
- Find cell by label/header text (case-insensitive)
- Extract adjacent numeric value
- Works regardless of layout orientation

```typescript
function findByLabel(sheet: any[], label: string): number {
  // Search all cells for label
  for (let row of sheet) {
    for (let i = 0; i < row.length; i++) {
      if (matchesLabel(row[i], label)) {
        // Check right, below, or nearby cells for value
        return findAdjacentValue(sheet, row, i);
      }
    }
  }
}
```

**2. Pattern Matching**
- Identify calculation patterns (e.g., last row often contains totals)
- Find cells with specific formulas (contains "SUM", "AVERAGE", etc.)
- Detect semantic relationships

**3. Result Validation**
- Calculate what the answer *should* be from inputs
- Find any cell matching that result
- Verify it uses a formula, not hard-coded

### Verification Criteria

1. **Data Presence (15%)**
   - All required labels/headers present
   - All required input values present
   - Correct data types (numbers vs text)
   - **NOT checked**: Specific positions or dimensions

2. **Result Correctness (50%)**
   - Assertions pass (extracted values match expected)
   - Calculated results are mathematically correct
   - Tolerance: ±0.01 for floating point
   - Percentage calculations handle both 0.05 and 5%
   - **NOT checked**: Which cell contains the result

3. **Formula Usage (25%)**
   - Uses formulas for calculations (not hard-coded)
   - Uses appropriate functions for the task
   - Formula complexity matches requirement
   - No circular references
   - **NOT checked**: Exact formula syntax if result is correct

4. **Formatting (10%)**
   - Appropriate format codes for currency, percentages
   - Consistent formatting within categories
   - **NOT checked**: Aesthetic choices, colors, etc.

### Example Verification

**Prompt**: "Monthly expenses: Rent $1200, Food $400, Transport $200, show total"

**Valid Output A** (Vertical):
```
| Rent      | $1200        |
| Food      | $400         |
| Transport | $200         |
| Total     | =SUM(B1:B3)  |  → Calculates to $1800 ✓
```

**Valid Output B** (Horizontal):
```
| Category | Rent | Food | Transport | Total        |
| Amount   | 1200 | 400  | 200       | =SUM(B2:D2) |  → Calculates to 1800 ✓
```

**Valid Output C** (With Headers):
```
| Category  | Amount    |
| Rent      | 1200      |
| Food      | 400       |
| Transport | 200       |
| Total     | =B2+B3+B4 |  → Calculates to 1800 ✓
```

**All three pass verification** because:
- ✓ Required labels present (Rent, Food, Transport, Total)
- ✓ Required values present (1200, 400, 200)
- ✓ Total calculates to 1800
- ✓ Total uses a formula (not hard-coded)

**Invalid Output D**:
```
| Rent      | 1200 |
| Food      | 400  |
| Transport | 200  |
| Total     | 1800 |  → Hard-coded, no formula ✗
```

**Fails because**: Total is hard-coded instead of using a formula

### Error Categories

- **Parse Error**: Invalid JSON output
- **Missing Data**: Required labels or values not found
- **Formula Error**: Invalid formula syntax
- **Reference Error**: Invalid cell references
- **Calculation Error**: Wrong result (assertion failed)
- **Missing Formula**: Hard-coded value instead of formula
- **Wrong Function**: Used incorrect or suboptimal function
- **Circular Reference**: Detected circular dependency

## Scoring System

### Per-Prompt Score (0-100)

```
Score = (
  Data Presence (0-15) +
  Result Correctness (0-50) +
  Formula Usage (0-25) +
  Formatting (0-10)
)
```

**Data Presence (0-15)**:
- All required labels found: 7 points
- All required values found: 8 points
- Deduction for missing elements: -3 per missing item

**Result Correctness (0-50)**:
- Each assertion passes: proportional points
- Example: 3 assertions → ~16.7 points each
- Tolerance respected for floating point
- Handles multiple valid result formats

**Formula Usage (0-25)**:
- Uses formulas (not hard-coded): 15 points
- Uses appropriate functions: 7 points
- Best practices (e.g., SUM over addition): 3 points
- Deduction for hard-coded calculations: -5 per instance
- Deduction for inefficient formulas: -2 per instance

**Formatting (0-10)**:
- Appropriate format codes: 10 points
- Partial credit for some formatting
- Currency symbols: 3 points
- Percentage format: 3 points
- Number formatting (decimals, thousands): 4 points

### Aggregate Metrics

**Overall Score**: Average across all prompts

**Category Scores**: Average by difficulty level
- Basic (Level 1)
- Intermediate (Level 2)
- Advanced (Level 3)
- Expert (Level 4)

**Function Category Performance**:
- Statistical functions
- Mathematical functions
- Financial functions
- Logical functions
- Text functions
- Date functions
- Lookup functions

**Success Metrics**:
- **Pass Rate**: % of prompts scoring ≥70
- **Perfect Rate**: % of prompts scoring 100
- **Average Score**: Mean score across all prompts
- **Median Score**: Median to handle outliers

## Implementation Plan

### Phase 1: Infrastructure Setup (Week 1)

1. Create benchmark directory structure
2. Implement LLM client abstraction
   - OpenAI API client
   - Anthropic API client
   - Google Gemini API client
   - Configurable providers
3. Implement verification engine
   - JSON parser with error handling
   - Spreadsheet engine integration
   - Comparison logic with tolerance
4. Implement scoring system
   - Score calculation functions
   - Aggregate metrics computation

### Phase 2: Prompt Development (Week 1-2)

1. Write 50 benchmark prompts across all levels
2. Create expected outputs (ground truth)
   - Manually create correct spreadsheets
   - Validate with engine
   - Document formula rationale
3. Test prompts with sample LLM to ensure clarity
4. Iterate on prompt wording for consistency

### Phase 3: Runner Implementation (Week 2)

1. Main benchmark runner script
   - Load prompts from directory
   - Execute against configured LLMs
   - Save results with timestamps
   - Handle API errors and retries
2. Batch execution support
   - Parallel execution where possible
   - Rate limiting
   - Progress tracking
3. CLI interface
   ```bash
   npm run benchmark:llm -- --model gpt-4 --category all
   npm run benchmark:llm -- --model claude-3.5-sonnet --level 1
   npm run benchmark:llm -- --models all --prompt-id basic-01
   ```

### Phase 4: Reporting (Week 2-3)

1. Console output
   - Real-time progress
   - Per-prompt results
   - Summary statistics
2. JSON report export
   - Detailed results
   - Machine-readable format
3. HTML report generation
   - Tables with scores
   - Charts (score distribution, category performance)
   - Side-by-side comparisons
4. Markdown report
   - GitHub-friendly
   - Leaderboard format

### Phase 5: Testing & Validation (Week 3)

1. Test with multiple LLMs
2. Validate scoring consistency
3. Refine prompts based on results
4. Document findings

## CLI Interface

### Commands

```bash
# Run full benchmark for one model
npm run benchmark:llm -- --model gpt-4

# Run specific category
npm run benchmark:llm -- --model claude-3.5-sonnet --category financial

# Run specific difficulty level
npm run benchmark:llm -- --model gemini-pro --level 3

# Compare multiple models
npm run benchmark:compare -- --models gpt-4,claude-3.5-sonnet,gemini-pro

# Run single prompt for testing
npm run benchmark:test -- --prompt-id basic-01 --model gpt-4

# Generate report from existing results
npm run benchmark:report -- --input ./results --format html
```

### Configuration File (config.json)

```json
{
  "models": {
    "gpt-4": {
      "provider": "openai",
      "apiKey": "${OPENAI_API_KEY}",
      "model": "gpt-4-turbo-preview",
      "temperature": 0.0,
      "systemPrompt": "..."
    },
    "claude-3.5-sonnet": {
      "provider": "anthropic",
      "apiKey": "${ANTHROPIC_API_KEY}",
      "model": "claude-3-5-sonnet-20241022",
      "temperature": 0.0,
      "systemPrompt": "..."
    },
    "gemini-pro": {
      "provider": "google",
      "apiKey": "${GOOGLE_API_KEY}",
      "model": "gemini-1.5-pro",
      "temperature": 0.0,
      "systemPrompt": "..."
    }
  },
  "verification": {
    "tolerance": 0.01,
    "timeoutMs": 30000
  },
  "execution": {
    "parallel": true,
    "maxConcurrent": 3,
    "retryCount": 2,
    "retryDelayMs": 1000
  }
}
```

## Output Formats

### Console Output

```
🔧 LLM Spreadsheet Benchmark
Model: gpt-4-turbo-preview
Date: 2025-11-25

Running 50 prompts...

[Basic] basic-01: Monthly Expenses ........................ ✓ 95/100
[Basic] basic-02: Simple Budget ........................... ✓ 100/100
[Intermediate] intermediate-01: Sales Analysis ............ ✓ 88/100
[Advanced] advanced-01: Grade Calculator .................. ✗ 65/100
  ⚠ Formula error in cell D2: Expected AVERAGE(B2:D2), got SUM(B2:D2)/3

...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Summary Statistics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Overall Score:        84.2 / 100
Pass Rate (≥70):      92%
Perfect Score Rate:   38%

By Level:
  Level 1 (Basic):       96.5 / 100
  Level 2 (Intermediate): 86.3 / 100
  Level 3 (Advanced):     78.9 / 100
  Level 4 (Expert):       71.2 / 100

By Function Category:
  Statistical:   92%
  Mathematical:  88%
  Financial:     76%
  Logical:       82%
  Text:          90%
  Date:          85%
  Lookup:        68%

Time: 2m 34s
```

### JSON Output (results/gpt-4/run-2025-11-25.json)

```json
{
  "metadata": {
    "model": "gpt-4-turbo-preview",
    "timestamp": "2025-11-25T10:30:00Z",
    "duration": 154,
    "config": {...}
  },
  "summary": {
    "totalPrompts": 50,
    "averageScore": 84.2,
    "medianScore": 87.0,
    "passRate": 0.92,
    "perfectRate": 0.38
  },
  "byLevel": {
    "1": {"count": 10, "avgScore": 96.5},
    "2": {"count": 15, "avgScore": 86.3},
    "3": {"count": 15, "avgScore": 78.9},
    "4": {"count": 10, "avgScore": 71.2}
  },
  "byCategory": {
    "statistical": {"avgScore": 92, "count": 8},
    "financial": {"avgScore": 76, "count": 6}
  },
  "prompts": [
    {
      "id": "basic-01",
      "title": "Monthly Expenses",
      "level": 1,
      "category": "basic",
      "score": 95,
      "breakdown": {
        "structure": 20,
        "formulas": 45,
        "functions": 20,
        "formatting": 10
      },
      "errors": [],
      "generatedOutput": {...},
      "expectedOutput": {...},
      "executionTime": 2.3
    }
  ]
}
```

## Success Criteria

The benchmark is successful if:

1. ✅ Runs completely automated via CLI
2. ✅ Tests 50+ diverse spreadsheet scenarios
3. ✅ Accurately verifies formula correctness
4. ✅ Provides clear scoring and comparison metrics
5. ✅ Works with multiple LLM providers
6. ✅ Generates useful reports for analysis
7. ✅ Reproducible results (deterministic with temp=0)

## Future Enhancements

1. **Adversarial Testing**: Prompts designed to trick LLMs
2. **Ambiguous Prompts**: Test interpretation capabilities
3. **Incremental Edits**: Test ability to modify existing sheets
4. **Error Recovery**: Provide broken spreadsheet, ask to fix
5. **Natural Language Queries**: "Show me total sales by region"
6. **Multilingual Prompts**: Test in different languages
7. **Domain-Specific**: Accounting, Engineering, Science prompts
8. **Collaborative**: Multi-turn prompts building complex sheets
9. **Performance Metrics**: Token usage, latency per model
10. **Continuous Benchmark**: Track model improvements over time

## References

- Spreadsheet Engine: `src/tools/models/spreadsheet-engine/`
- Tool Definition: `src/tools/models/spreadsheet.ts`
- Existing Tests: `src/tools/models/spreadsheet-engine/__tests__/`
- Function Registry: `src/tools/models/spreadsheet-engine/functions/`
