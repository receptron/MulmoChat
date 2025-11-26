# Spreadsheet Generation Benchmark Summary

## How to Update This Summary

This summary is generated from benchmark results in `benchmark/results/`. To update:

1. **Run new benchmarks** to generate result files in `benchmark/results/[model-name]/`
2. **Regenerate summary** by asking Claude Code:
   ```
   Take a look at latest results in benchmark/results and write a summary as benchmark/SUMMARY.md
   ```

### What to Include in Updates

When regenerating, ensure the summary includes:
- **Model Performance Rankings**: Table with avg score, median, pass rate, test completion
- **Performance by Level**: Analysis of Level 1 (Basic), Level 2 (Intermediate), Level 3 (Advanced)
- **Performance by Category**: Breakdown by test categories (Basic, Mathematical, Statistical, Text, Financial, Logical)
- **Test Case Analysis**: Individual test results with common issues identified
- **Key Findings**: Strengths and weaknesses across all models
- **Model-Specific Notes**: Unique characteristics of each model
- **Recommendations**: For model selection, benchmark improvement, and application development

### File Structure

Result files follow this pattern:
```
benchmark/results/
├── [model-name]/
│   └── run-[timestamp].json
```

Each result file contains:
- `metadata`: Model config and run info
- `summary`: Overall statistics (avgScore, passRate, etc.)
- `byLevel`: Performance grouped by difficulty level
- `byCategory`: Performance grouped by test category
- `results[]`: Individual test case results with detailed scoring

### Latest Update

**Date:** November 26, 2025
**Models Tested:** 10 (8 completed full suite)
**Test Cases:** 7 total

---

## Overview

This benchmark evaluates AI model performance on structured spreadsheet generation tasks using JSON format. Models are tested on their ability to generate spreadsheets with proper formulas, formatting, and calculations across various complexity levels and categories.

**Test Date:** November 26, 2025
**Total Test Cases:** 7
**Test Categories:** Basic, Mathematical, Statistical, Text, Financial, Logical

## Model Performance Rankings

| Rank | Model | Avg Score | Median Score | Pass Rate | Perfect Rate | Test Cases |
|------|-------|-----------|--------------|-----------|--------------|------------|
| 1 | **gemini-3-pro-preview** | 58.4 | 49 | 29% | 14% | 7/7 |
| 2 | **gpt-4o-mini** | 56.0 | 57 | 14% | 14% | 7/7 |
| 3 | **claude-sonnet-4-5** | 55.4 | 57 | 14% | 14% | 7/7 |
| 4 | **claude-haiku-4-5** | 55.3 | 57 | 14% | 14% | 7/7 |
| 5 | **gpt-4o** | 53.3 | 49 | 14% | 14% | 7/7 |
| - | claude-3.5-sonnet | 100.0 | 100 | 100% | 100% | 1/7 ⚠️ |
| - | ollama-phi4-mini | 12.0 | 12 | 0% | 0% | 1/7 ⚠️ |
| - | grok-4-1 | 0.0 | 0 | 0% | 0% | 0/7 ❌ |

⚠️ Incomplete results - only partial test suite completed
❌ Failed to complete benchmark

## Performance by Complexity Level

### Level 1 (Basic)
- **Average Score:** 56.5 - 71.5
- **Pass Rate:** 50%
- **Notes:** Most models achieved perfect scores on basic-01 (simple expense tracking) but struggled with basic-02 (percentage-based budget calculations). Gemini-3-pro-preview showed strongest Level 1 performance (71.5 avg).

### Level 2 (Intermediate)
- **Average Score:** 51.0 - 53.3
- **Pass Rate:** 0% - 33%
- **Notes:** Gemini-3-pro-preview achieved 33% pass rate at Level 2 (passing mathematical-01), while other models struggled consistently across statistical analysis, text manipulation, and mathematical calculations

### Level 3 (Advanced)
- **Average Score:** 53.0 - 58.0
- **Pass Rate:** 0%
- **Notes:** Financial calculations and logical operations proved difficult for all models

## Performance by Category

| Category | Avg Score Range | Pass Rate | Best Performer |
|----------|----------------|-----------|----------------|
| **Basic** | 56.5 - 71.5 | 50% | gemini-3-pro-preview (71.5) |
| **Mathematical** | 67.0 - 73.0 | 0% - 100% | gemini-3-pro-preview (73, passed) |
| **Statistical** | 39.0 - 44.0 | 0% | gpt-4o-mini (44) |
| **Text** | 47.0 | 0% | All top 5 models (tied) |
| **Financial** | 57.0 | 0% | All top 5 models (tied) |
| **Logical** | 49.0 - 59.0 | 0% | claude-sonnet-4-5 (59) |

## Test Case Analysis

### ✅ basic-01: Monthly Expenses (Level 1)
- **Success Rate:** 100% (all models passed)
- **Requirements:** Simple SUM formula, currency formatting, basic data organization
- **Average Score:** 100/100

### ⚠️ basic-02: Percentage Budget (Level 1)
- **Success Rate:** 0%
- **Average Score:** 13-18/100
- **Common Issues:**
  - Incorrect percentage calculations (showing 30% instead of $1500)
  - Missing currency formatting on calculated amounts
  - Incorrect total calculation

### ✅ mathematical-01: Compound Interest (Level 2)
- **Success Rate:** 12.5% (1/8 models passed)
- **Average Score:** 67-73/100
- **Passing Model:** gemini-3-pro-preview (73/100)
- **Common Issues:**
  - Most models correctly calculated final amount (~$13,488.50)
  - Some models incorrectly displayed interest earned (showing raw percentage instead of dollar amount)
  - Missing currency format on interest field in some outputs

### ❌ statistical-01: Sales Analysis (Level 2)
- **Success Rate:** 0%
- **Average Score:** 39-44/100
- **Common Issues:**
  - Product totals not calculated (showing unit price instead of price × quantity)
  - Statistical functions (SUM, AVERAGE, MAX, MIN) correctly used but values not computed
  - Some models missing currency formatting on aggregate statistics

### ❌ text-01: Email Generation (Level 2)
- **Success Rate:** 0%
- **Average Score:** 47/100
- **Common Issues:**
  - Correct LOWER function usage for email generation
  - Email formulas don't evaluate correctly (missing CONCAT or equivalent)
  - All models generated formula strings but not evaluated results

### ⚠️ financial-01: Loan Payment (Level 3)
- **Success Rate:** 0%
- **Average Score:** 57/100
- **Common Issues:**
  - Correct number of payments (360)
  - PMT function used correctly
  - Monthly payment showing incorrect value (360 instead of ~$1,267)
  - Missing currency format on some calculated fields

### ⚠️ logical-01: Grade Calculator (Level 3)
- **Success Rate:** 0%
- **Average Score:** 49-59/100
- **Common Issues:**
  - AVERAGE and IF functions correctly implemented
  - Some student averages incorrect (hard-coded test scores vs. calculated averages)
  - Formula logic correct but some calculation errors

## Key Findings

### Strengths Across All Models
1. **Formula Generation:** All models correctly used spreadsheet functions (SUM, AVERAGE, IF, PMT, etc.)
2. **Structure:** JSON format and data organization generally correct
3. **Basic Tasks:** Perfect performance on simple calculations with clear requirements

### Universal Weaknesses
1. **Complex Calculations:** Models struggled with multi-step percentage-based calculations
2. **Data Type Consistency:** Confusion between displaying percentages vs. calculated amounts
3. **Formatting Edge Cases:** Incomplete currency/percentage formatting on calculated fields
4. **Formula Evaluation:** Generated correct formula syntax but values don't compute properly in some cases

### Model-Specific Notes

**gemini-3-pro-preview**:
- **Best overall performance** with highest average score (58.4) and pass rate (29%)
- **Only model to pass mathematical-01** (compound interest) test
- Strongest on basic tasks (71.5/100 average)
- Only model to achieve >20% pass rate
- Completed full test suite in 173 seconds
- Well-balanced across categories with no major weaknesses

**gpt-4o-mini**:
- Second-best overall performance (56.0 average score)
- Strongest on statistical tasks (44/100 - highest among all models)
- Most consistent across categories
- Faster execution than Gemini models

**claude-sonnet-4-5**:
- Strong on logical operations (59/100 - highest among all models)
- Nearly identical performance to claude-haiku-4-5
- Excellent formula generation

**claude-haiku-4-5**:
- Nearly identical performance to claude-sonnet-4-5 despite being a "lighter" model
- Slightly better on statistical tasks than sonnet-4-5
- Very efficient (41s total duration vs 65s for sonnet-4-5)

**gpt-4o**:
- Lowest average score among tested models (53.3)
- Weakest on logical operations (49/100)
- Missing number formatting in logical-01 test

**ollama-phi4-mini**:
- Failed most basic requirements
- Only scored 12/100 on basic-01 test
- Missing critical elements (Total row) and formulas
- Not ready for production use on this benchmark

**grok-4-1**:
- Failed to complete any test cases
- Empty results suggest API or configuration issues
- Requires investigation

## Recommendations

### For Model Selection
1. **General Use:** gemini-3-pro-preview offers best overall performance with 29% pass rate
2. **Mathematical Tasks:** gemini-3-pro-preview is the only model to pass compound interest calculations
3. **Statistical Analysis:** gpt-4o-mini shows best performance (44/100)
4. **Logical Operations:** claude-sonnet-4-5 excels in grade calculations and conditional logic (59/100)
5. **Cost-Sensitive:** claude-haiku-4-5 matches claude-sonnet-4-5 performance at potentially lower cost
6. **Second Choice:** gpt-4o-mini for balanced performance across all categories

### For Benchmark Improvement
1. **Test Validation:** Review basic-02 test expectations - all models failed despite correct formula logic
2. **Scoring Granularity:** Consider partial credit for correct formulas with minor formatting issues
3. **Formula Evaluation:** Clarify whether formulas should be evaluated or remain as strings
4. **Documentation:** Add expected output examples for each test case

### For Application Development
1. **Task Complexity:** Keep tasks simple and well-defined (basic-01 style)
2. **Validation:** Implement validation layers for complex percentage calculations
3. **Formatting:** Explicitly specify all formatting requirements in prompts
4. **Testing:** Test multi-step calculations separately before combining

## Conclusion

The benchmark reveals that current AI models excel at structured spreadsheet generation with clear requirements but struggle with complex multi-step calculations and formatting edge cases. **Google's gemini-3-pro-preview emerges as the clear leader** with a 29% pass rate and 58.4 average score, nearly doubling the pass rate of other tested models.

### Key Takeaways

1. **Gemini-3-pro-preview leads the pack**: The only model to achieve >20% pass rate and successfully handle compound interest calculations, demonstrating superior mathematical reasoning.

2. **Performance clustering among non-Gemini models**: OpenAI and Anthropic models cluster tightly (53-56 average score), suggesting similar capability levels for this task type.

3. **Mathematical reasoning gap**: Gemini's ability to pass the mathematical-01 test while all other models failed highlights a significant advantage in complex formula generation.

4. **All models struggle with advanced tasks**: Despite Gemini's lead, even the best model only achieved 29% pass rate, indicating substantial room for improvement across the board.

Future improvements may require:
- Enhanced training on spreadsheet-specific tasks (particularly for non-Gemini models)
- Better handling of multi-step numerical calculations
- Improved understanding of when to format as percentage vs. calculated amount
- More robust formula evaluation logic

### Production Readiness

- **gemini-3-pro-preview**: Production-ready for Level 1 and some Level 2 tasks (especially mathematical)
- **gpt-4o-mini, claude-sonnet-4-5, claude-haiku-4-5**: Production-ready for simple spreadsheet generation (Level 1), requires validation for intermediate and advanced use cases
- **gpt-4o**: Suitable for basic tasks, needs careful validation for complex operations
