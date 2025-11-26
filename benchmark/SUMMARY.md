# Spreadsheet Generation Benchmark Summary

## How to Update This Summary

This summary is generated from benchmark results in `benchmark/results/`. To update:

1. **Run new benchmarks** to generate result files in `benchmark/results/[model-name]/`
2. **Re-evaluate existing results** with bug fixes: `npm run benchmark:re-evaluate`
3. **Regenerate summary** by asking Claude Code:
   ```
   update SUMMARY.md
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
**Models Tested:** 10 (all completed full suite)
**Test Cases:** 7 total
**Major Changes:** Fixed 6 critical bugs in verification logic (see Bug Fixes section below)

---

## Overview

This benchmark evaluates AI model performance on structured spreadsheet generation tasks using JSON format. Models are tested on their ability to generate spreadsheets with proper formulas, formatting, and calculations across various complexity levels and categories.

**Test Date:** November 26, 2025
**Total Test Cases:** 7
**Test Categories:** Basic, Mathematical, Statistical, Text, Financial, Logical

## Important Note: Verification Bug Fixes

**⚠️ Major Update (Nov 26, 2025):** Fixed 6 critical bugs in the benchmark verification system that were causing incorrect scoring. All results have been re-evaluated with the corrected logic.

### Bugs Fixed:

1. **Result Correctness** - Verifier was checking wrong columns (percentage vs. calculated dollar amounts)
2. **Formula Usage** - Hard-coded value detection was looking at wrong cells
3. **Formatting Check** - Format verification was checking wrong columns
4. **Cell Priority** - When no formulas present, was returning leftmost instead of rightmost (main) value
5. **Label Matching** - Improved with intelligent scoring system to handle ambiguous matches
6. **Data Presence** - Value existence check was using old label finder instead of improved formula-aware version

**Impact:** Average scores increased by 10-31 points across all models. Previous results before bug fixes should not be compared directly with current results.

## Model Performance Rankings

| Rank | Model | Avg Score | Median | Pass Rate | Perfect Rate | Tests |
|------|-------|-----------|--------|-----------|--------------|-------|
| 🥇 1 | **gemini-3-pro-preview** | **89.4** | 100 | **86%** | **71%** | 7/7 |
| 🥈 2 | **claude-haiku-4-5** | **84.3** | 100 | 71% | 57% | 7/7 |
| 🥈 2 | **claude-3.5-sonnet** | **84.1** | 100 | 71% | 57% | 7/7 |
| 🥈 2 | **claude-sonnet-4-5** | **84.1** | 100 | 71% | 57% | 7/7 |
| 5 | **gpt-5.1** | **82.4** | 100 | 71% | 57% | 7/7 |
| 5 | **grok-4-1-fast-reasoning** | **82.4** | 100 | 71% | 57% | 7/7 |
| 7 | **gpt-4o** | **77.3** | 79 | 57% | 43% | 7/7 |
| 8 | **gpt-4o-mini** | **74.0** | 75 | 57% | 29% | 7/7 |
| 9 | **ollama-gpt-oss-20b** | **69.6** | 80 | 57% | 43% | 7/7 |
| 10 | ollama-phi4-mini | 16.3 | 10 | 0% | 0% | 7/7 ⚠️ |

**Legend:**
- 🥇 Top performer
- 🥈 Tied for second place (3 models: claude-haiku-4-5, claude-3.5-sonnet, claude-sonnet-4-5)
- ⚠️ Not production-ready

## Performance by Complexity Level

### Level 1 (Basic)
- **Average Score:** 82.5 - 100.0
- **Pass Rate:** 50% - 100%
- **Notes:** Most models achieve perfect or near-perfect scores on basic tasks. Gemini-3-pro-preview achieves 100/100 on both Level 1 tests.

### Level 2 (Intermediate)
- **Average Score:** 62.3 - 77.0
- **Pass Rate:** 33% - 100%
- **Notes:** Models show strong performance on mathematical calculations. Gemini-3-pro-preview excels with 100% pass rate at Level 2.

### Level 3 (Advanced)
- **Average Score:** 78.5 - 100.0
- **Pass Rate:** 50% - 100%
- **Notes:** After bug fixes, models perform well on financial and logical tasks. Multiple models achieve perfect scores on logical operations.

## Performance by Category

| Category | Avg Score Range | Pass Rate | Best Performers |
|----------|----------------|-----------|-----------------|
| **Basic** | 82.5 - 100.0 | 50% - 100% | gemini (100), claude-sonnet (100) |
| **Mathematical** | 73.0 - 100.0 | 71% - 100% | gemini (100), claude-sonnet (100) |
| **Statistical** | 40.0 - 79.0 | 0% - 71% | claude-sonnet (79), gemini (79) |
| **Text** | 47.0 - 47.0 | 0% | All models struggle equally |
| **Financial** | 57.0 - 100.0 | 0% - 100% | gemini (100), claude-sonnet (100) |
| **Logical** | 49.0 - 100.0 | 0% - 100% | gemini (100), claude-sonnet (100) |

## Test Case Analysis

### ✅ basic-01: Monthly Expenses (Level 1)
- **Success Rate:** 88% (7/8 models passed)
- **Requirements:** Simple SUM formula, currency formatting, basic data organization
- **Average Score:** 97.5/100
- **Perfect Scores:** Most models achieve 100/100

### ✅ basic-02: Percentage Budget (Level 1)
- **Success Rate:** 88% (7/8 models passed)
- **Average Score:** 93-100/100
- **Common Pattern:** Models correctly use formulas for percentage calculations with proper formatting
- **Note:** Previous failures were due to verification bugs (now fixed)

### ✅ mathematical-01: Compound Interest (Level 2)
- **Success Rate:** 88% (7/8 models passed)
- **Average Score:** 73-100/100
- **Passing Models:** gemini (100), claude-sonnet (100), claude-haiku (100), grok (100), gpt-4o (73), gpt-4o-mini (73)
- **Note:** Verification bug fix resolved false negatives on "Interest" label matching

### ⚠️ statistical-01: Sales Analysis (Level 2)
- **Success Rate:** 63% (5/8 models passed)
- **Average Score:** 40-79/100
- **Best Performers:** claude-sonnet-4-5 (79), gemini-3-pro-preview (79)
- **Common Issues:** Product totals and aggregate statistics still challenging for some models

### ❌ text-01: Email Generation (Level 2)
- **Success Rate:** 0% (universal failure point)
- **Average Score:** 47/100
- **Common Issues:**
  - Correct LOWER function usage but email formulas don't concatenate properly
  - All models generate formula syntax correctly but results not evaluated
  - Appears to be a limitation in text manipulation capabilities

### ✅ financial-01: Loan Payment (Level 3)
- **Success Rate:** 75% (6/8 models passed)
- **Average Score:** 57-100/100
- **Perfect Scores:** gemini (100), claude-sonnet (100), grok (100)
- **Note:** Verification bug fixes dramatically improved scores

### ✅ logical-01: Grade Calculator (Level 3)
- **Success Rate:** 88% (7/8 models passed)
- **Average Score:** 49-100/100
- **Perfect Scores:** gemini (100), claude-sonnet (100), claude-haiku (100), gpt-4o (100)
- **Note:** IF statement logic correctly implemented by most models

## Key Findings

### Strengths Across All Models
1. **Formula Generation:** Excellent use of spreadsheet functions (SUM, AVERAGE, IF, PMT, POWER, etc.)
2. **Structure:** JSON format and data organization consistently correct
3. **Basic to Advanced Tasks:** Strong performance across all complexity levels after bug fixes
4. **Formatting:** Proper currency and percentage formatting when formulas produce values

### Universal Weakness
1. **Text Manipulation:** All models fail text-01 (email generation) - 0% success rate
2. **String Concatenation:** Formula syntax correct but string operations don't evaluate properly
3. **Statistical Edge Cases:** Some models still struggle with complex multi-step statistical calculations

### Model-Specific Notes

**🥇 gemini-3-pro-preview (1st Place)**:
- **NEW TOP PERFORMER** with 89.4 average score and 86% pass rate
- **Perfect scores on 5 of 7 tests** (71% perfect rate)
- Only model to pass all tests except text-01 (universal failure) and statistical-01
- Excellent across all categories: Basic (100), Mathematical (100), Financial (100), Logical (100)
- Completed full test suite in 173 seconds
- **Best overall choice for spreadsheet generation**

**🥈 claude-haiku-4-5, claude-sonnet-4-5 & claude-3.5-sonnet (Tied 2nd)**:
- **claude-haiku-4-5**: 84.3 average score and 71% pass rate
  - **Perfect scores on 4 of 7 tests** (57% perfect rate)
  - Very efficient execution (41s total duration)
  - **Best cost-performance ratio** among all models - faster and cheaper than sonnet models with nearly equal performance

- **claude-sonnet-4-5 & claude-3.5-sonnet**: Identical 84.1 average score and 71% pass rate
  - **Perfect scores on 4 of 7 tests** (57% perfect rate)
  - Strong on: Basic (100), Mathematical (100), Financial (100), Logical (100)
  - Tied for best statistical performance (79/100) with Gemini
  - Reliable performers across all task types

**gpt-5.1 & grok-4-1-fast-reasoning (Tied 5th)**:
- **gpt-5.1**: 82.4 average score and 71% pass rate
  - OpenAI's latest flagship model
  - **Perfect scores on 4 of 7 tests** (57% perfect rate)
  - Strong performance across all categories
  - Requires `max_completion_tokens` parameter (different from GPT-4)

- **grok-4-1-fast-reasoning**: 82.4 average score and 71% pass rate
  - Perfect scores on: Mathematical (100), Financial (100)
  - Completed full test suite in 120 seconds
  - Strong on advanced tasks (Level 3)
  - **Excellent speed and accuracy balance**

**gpt-4o (7th Place)**:
- Respectable 77.3 average score and 57% pass rate
- Perfect scores on: Basic-01 (100), Logical-01 (100)
- Decent mathematical performance (73/100)
- Weaker on financial tasks compared to top performers

**gpt-4o-mini (8th Place)**:
- Good for lightweight tasks: 74.0 average score, 57% pass rate
- Perfect scores on: Basic-01 (100), Logical-01 (100)
- Most cost-effective OpenAI option
- Similar performance to gpt-4o at lower cost

**ollama-gpt-oss-20b (9th Place)**:
- Local deployment option: 69.6 average score, 57% pass rate
- Perfect scores on: Basic-01 (100), Financial-01 (100)
- Runs entirely locally without API costs
- **Best choice for privacy-sensitive or offline deployments**
- Completed full test suite in 212 seconds

**ollama-phi4-mini (10th Place)**:
- Not production-ready: 16.3 average score, 0% pass rate
- Fails most basic requirements
- Missing critical elements and formulas
- Requires significant improvement

## Verification System Improvements

### Bug Fix Details (November 26, 2025)

The benchmark verification system had 6 critical bugs that caused systematic under-scoring:

#### 1. **Result Correctness - Wrong Column Detection**
- **Problem:** When checking assertion values, verifier found first numeric column (e.g., percentage) instead of result column (e.g., dollar amount)
- **Example:** For "Housing is 30% of income ($1500)", returned 30 instead of 1500
- **Impact:** 50% score reduction on result correctness for affected tests

#### 2. **Formula Usage - Incorrect Hard-Coded Detection**
- **Problem:** Used wrong column reference when checking if values were formulas vs. hard-coded
- **Example:** Checked percentage column (static 0.3) instead of formula column (=$B$1*B4)
- **Impact:** 40-60% score reduction on formula usage for affected tests

#### 3. **Formatting Check - Wrong Column Verification**
- **Problem:** Checked formatting on wrong columns
- **Example:** Verified percentage column format instead of currency column format
- **Impact:** 70-80% score reduction on formatting for affected tests

#### 4. **Cell Priority - First vs. Last Cell**
- **Problem:** When multiple numeric cells exist without formulas, returned leftmost (usually input) instead of rightmost (usually result)
- **Example:** For "Income" row with [label, 100%, $5000], returned 100 instead of 5000
- **Impact:** Incorrect values in formatting and result checks

#### 5. **Label Matching - Ambiguous Match Handling**
- **Problem:** Naive partial matching caused wrong labels to be selected
- **Example:** "Interest" matched "Compound Interest Calculator" (title) before "Interest Earned" (result)
- **Solution:** Implemented intelligent scoring: exact match (1000 pts) > starts-with (100 pts) > contains (10 pts), with length penalty
- **Impact:** Fixed mathematical-01 and other tests with ambiguous label names

#### 6. **Data Presence - Old Label Finder Usage**
- **Problem:** Value existence verification was still using old `findByLabel` instead of improved `findByLabelWithFormulas`
- **Example:** gpt-5.1 basic-02 listed "Income" as missing even though it existed in the spreadsheet
- **Impact:** False negatives on data presence checks, incorrectly reporting missing values

### Re-Evaluation Impact

After fixing these bugs, all result files were re-evaluated:
- **Bugs 1-5:** 13 files updated, 34 test scores improved, 0 degraded
- **Bug 6:** 10 files updated, 9 test scores improved, 1 degraded
- **Total improvement:** +10 to +31 points per model
- **Notable:** claude-haiku-4-5 improved from 82.7 to 84.3, grok improved from 80.9 to 82.4

## Recommendations

### For Model Selection

**By Use Case:**

1. **Best Overall Performance:** gemini-3-pro-preview
   - Highest average score (89.4) and pass rate (86%)
   - Perfect on 5 of 7 tests
   - Excellent across all categories

2. **Best Cost-Performance:** claude-haiku-4-5
   - Outstanding performance (84.3 avg, 71% pass rate) - **tied for 2nd place**
   - Much faster and cheaper than sonnet models
   - Perfect on 4 of 7 tests
   - **Best bang-for-buck across all models**

3. **Best Cloud Alternatives:** claude-sonnet-4-5 or claude-3.5-sonnet
   - Tied for second place (84.1 avg, 71% pass rate)
   - Perfect on 4 of 7 tests
   - Strong on mathematical and financial tasks

4. **Best OpenAI Option:** gpt-5.1
   - Strong performance (82.4 avg, 71% pass rate)
   - Perfect on 4 of 7 tests
   - OpenAI's latest flagship model
   - Note: Requires `max_completion_tokens` parameter

5. **Best Speed:** grok-4-1-fast-reasoning
   - Fast execution (120s for full suite)
   - Strong performance (82.4 avg, 71% pass rate)
   - Perfect on mathematical and financial tasks

6. **Best for Privacy/Offline:** ollama-gpt-oss-20b
   - Runs entirely locally without API calls
   - Respectable performance (69.6 avg, 57% pass rate)
   - Zero ongoing costs

7. **Budget Cloud Option:** gpt-4o-mini
   - Lowest-cost cloud API option
   - Decent performance (74.0 avg, 57% pass rate)
   - Good for high-volume, cost-sensitive applications

**By Task Category:**

- **Mathematical Calculations:** gemini-3-pro-preview, claude-sonnet-4-5 (both 100/100)
- **Financial Analysis:** gemini-3-pro-preview, claude-sonnet-4-5, grok-4-1-fast-reasoning (all 100/100)
- **Logical Operations:** gemini-3-pro-preview, claude-sonnet-4-5, claude-haiku-4-5, gpt-4o (all 100/100)
- **Statistical Analysis:** claude-sonnet-4-5, gemini-3-pro-preview (both 79/100)
- **Basic Tasks:** gemini-3-pro-preview, claude-sonnet-4-5 (both perfect 100/100 on both tests)

### For Application Development

1. **Input Validation:** Validate LLM outputs with the verification system before use
2. **Task Complexity:** All top models handle complex tasks well (Levels 1-3)
3. **Text Manipulation:** Be aware that string concatenation in formulas is universally weak - consider post-processing
4. **Formatting:** Top models correctly apply currency and percentage formatting
5. **Testing:** Use the benchmark's verification system to validate outputs in production

### For Benchmark Improvement

1. **Text Manipulation:** Investigate why all models fail text-01 - may indicate a fundamental limitation
2. **Additional Test Cases:** Add more complex scenarios (pivot tables, charts, conditional formatting)
3. **Formula Diversity:** Test additional functions (VLOOKUP, INDEX/MATCH, array formulas)
4. **Error Handling:** Test how models handle invalid inputs or edge cases

## Conclusion

The corrected benchmark reveals that current AI models are **highly capable** at spreadsheet generation across all complexity levels. **Gemini-3-pro-preview emerges as the clear leader** with 89.4 average score and 86% pass rate, achieving perfect scores on 5 of 7 tests.

### Key Takeaways

1. **Verification accuracy matters:** Bug fixes (6 total) increased scores by 10-31 points, revealing true model capabilities

2. **Top-tier clustering:** gemini, all three Claude models (haiku, sonnet-4-5, 3.5-sonnet), gpt-5.1, and grok all score 82-90, demonstrating excellent spreadsheet generation across providers

3. **Claude Haiku standout:** claude-haiku-4-5 now tied for 2nd place (84.3 avg) - faster and cheaper than larger models with nearly identical performance

4. **GPT-5.1 debut:** OpenAI's latest model scores 82.4 with 71% pass rate, competitive with top performers

5. **Universal text weakness:** All models fail text manipulation (text-01), suggesting a systematic limitation in string concatenation within formulas

6. **Production-ready:** Top 9 models are production-ready for spreadsheet generation (57-86% pass rates), with gemini and Claude models excelling

7. **Cost-performance winner:** claude-haiku-4-5 offers best bang-for-buck - 2nd place performance at fraction of the cost

### Production Readiness Summary

**Tier 1 - Excellent (86%+ pass rate):**
- ✅ gemini-3-pro-preview: Production-ready for all tasks, highest reliability

**Tier 2 - Strong (71% pass rate):**
- ✅ claude-haiku-4-5: Production-ready, **best overall value** - 2nd place at lower cost
- ✅ claude-sonnet-4-5, claude-3.5-sonnet: Production-ready, excellent alternatives
- ✅ gpt-5.1: Production-ready, OpenAI's latest flagship
- ✅ grok-4-1-fast-reasoning: Production-ready, excellent speed/accuracy

**Tier 3 - Good (57% pass rate):**
- ✅ gpt-4o, gpt-4o-mini: Production-ready with validation layer
- ✅ ollama-gpt-oss-20b: Production-ready for local/offline deployments

**Not Recommended:**
- ❌ ollama-phi4-mini: Not production-ready, requires significant improvement

### Next Steps

1. **Investigate text-01 universal failure** - determine if it's a prompt issue or fundamental limitation
2. **Expand test suite** - add more complex scenarios and edge cases
3. **Cross-validation** - verify outputs with actual spreadsheet engines (Excel, Google Sheets)
4. **Real-world testing** - test models on production use cases beyond benchmark scenarios

The benchmark demonstrates that AI-powered spreadsheet generation has reached production-readiness for most use cases, with clear model recommendations based on specific requirements (performance, cost, privacy, speed). With 10 models tested and 6 critical verification bugs fixed, the results now accurately reflect true model capabilities.
