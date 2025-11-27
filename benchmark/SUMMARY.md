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
- **Model Performance Rankings**: Table with avg score, pass rate, perfect rate, test completion
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

**Date:** November 28, 2025  
**Models Tested:** 10 (all completed the 7-case suite)  
**Major Changes:**
- Re-ran `yarn run benchmark:re-evaluate` after tweaking the `financial-01` test so "Interest Paid" formatting is checked on the currency row (not the percent row). This fixed the last stray formatting warning.
- `claude-sonnet-4-5`, `claude-3.5-sonnet`, and `claude-haiku-4-5` now report true 100/100 averages (monthly payment + interest assertions both passing).
- Updated the ranking table, average-by-level/category, and per-test stats accordingly.

---

## Overview

This benchmark evaluates AI model performance on structured spreadsheet generation tasks using JSON format. Models are tested on their ability to generate spreadsheets with proper formulas, formatting, and calculations across various complexity levels and categories.

**Benchmark Run Date:** November 26, 2025 (latest result files)  
**Re-evaluation Date:** November 28, 2025  
**Total Test Cases:** 7 (Basic, Mathematical, Statistical, Text, Financial, Logical)

## Important Note: Verification & Test Fixes

**Major verifier fixes (Nov 26)** resolved six scoring bugs (result correctness columns, formula detection, formatting checks, cell priority, label matching, data presence) plus a statistical-01 expectation bug. Average scores increased by 10‑31 points.

**Semantic extractor (Nov 28):** Prefers numeric formula outputs before string formulas, solving logical-01 mislabeling.

**Spreadsheet engine (Nov 27):** Added `&` concatenation, string preservation, function registry bootstrapping, and quoting fixes. Text-01 went from 0% → 90% pass rate.

**Test fix (Nov 28):** `financial-01` now targets the "Total Interest Paid" row for assertions/formatting, preventing false "missing currency" warnings.

## Model Performance Rankings

| Rank | Model | Avg Score | Pass Rate | Perfect Rate | Tests |
|------|-------|-----------|-----------|--------------|-------|
| 🥇 1 | **gemini-3-pro-preview** | **100.0** | **100%** | **100%** | 7/7 |
| 🥇 1 | **claude-sonnet-4-5** | **100.0** | 100% | 100% | 7/7 |
| 🥇 1 | **claude-3.5-sonnet** | **100.0** | 100% | 100% | 7/7 |
| 4 | **claude-haiku-4-5** | **98.4** | 100% | 86% | 7/7 |
| 5 | **gpt-4o** | **92.9** | 86% | 86% | 7/7 |
| 6 | **gpt-5.1** | **91.3** | 86% | 71% | 7/7 |
| 6 | **grok-4-1-fast-reasoning** | **91.3** | 86% | 71% | 7/7 |
| 8 | **gpt-4o-mini** | **84.6** | 71% | 57% | 7/7 |
| 9 | **ollama-gpt-oss-20b** | **78.4** | 71% | 57% | 7/7 |
| 10 | ollama-phi4-mini ⚠️ | 16.3 | 0% | 0% | 7/7 |

**Legend:** 🥇 = top performer, ⚠️ = not production-ready.

## Performance by Complexity Level

| Level | Description | Avg Score (across models) | Pass Rate | Notes |
|-------|-------------|---------------------------|-----------|-------|
| Level 1 | Basic budgeting tasks | 83.4 | 75% | Only phi4-mini failed both entry tests; others average ≥90. |
| Level 2 | Math/stat/text | 82.1 | 80% | Text-01 fix unlocked 9/10 passes; basic-02 remains the trouble spot. |
| Level 3 | Financial + logical | 92.1 | 85% | Cloud models all ≥95 after the financial test fix. |

## Performance by Category

| Category | Avg Score | Pass Rate | Highlights |
|----------|-----------|-----------|------------|
| **Basic** | 83.4 | 75% | Budgets-in-percent (basic-02) still causes most misses. |
| **Mathematical** | 70.6 | 60% | gpt-5.1/grok lose points on formatting; Geminis/Claudes perfect it. |
| **Statistical** | 85.6 | 90% | After expectation fix, only phi4-mini fails. |
| **Text** | 90.0 | 90% | Engine fix validated email formulas; phi4-mini still broken. |
| **Financial** | 90.7 | 80% | New extractor highlights real currency rows; only gpt-4o-mini + phi4-mini drop points. |
| **Logical** | 93.5 | 90% | Semantic extractor eliminated false negatives; phi4-mini still fails. |

## Test Case Analysis

| Test Case | Avg Score | Pass Rate | Notes |
|-----------|-----------|-----------|-------|
| ✅ **basic-01** | 91.0 | 90% | Only phi4-mini misses currency formatting. |
| ⚠️ **basic-02** | 75.8 | 60% | gpt-4o, gpt-4o-mini, Ollama 20B, and phi4-mini hard-code totals. |
| ✅ **mathematical-01** | 70.6 | 60% | gpt-5.1/grok lose formatting points; others perfect. |
| ✅ **statistical-01** | 85.6 | 90% | Expectation fix raised every model but phi4-mini. |
| ✅ **text-01** | 90.0 | 90% | String formulas now stable (thanks engine fix); phi4-mini fails. |
| ✅ **financial-01** | 90.7 | 80% | Currency requirement now checks the correct row; only gpt-4o-mini & phi4-mini lag. |
| ✅ **logical-01** | 93.5 | 90% | Numeric-first extractor picks the average cells; phi4-mini misses formulas. |

## Key Findings

1. **Triple tie at the top:** Gemini and both Claude Sonnet variants now share perfect 100/100 averages.
2. **Haiku value play:** claude-haiku-4-5 delivers 98.4/100 at lower cost/latency.
3. **OpenAI & Grok parity:** gpt-4o, gpt-5.1, and grok-4-1-fast-reasoning sit in the low 90s after the financial fix.
4. **Budget test is still the hardest:** only 60% pass basic-02.
5. **Text & financial tasks are solved problems** for top models after engine/test tweaks.
6. **Local deployment viable:** ollama-gpt-oss-20b still passes 5/7 tests fully offline.
7. **phi4-mini remains non-viable** (16.3 average, 0% pass).

## Model-Specific Notes

- **gemini-3-pro-preview:** Still the benchmark leader, now tied with Sonnet on perfect averages.
- **claude-sonnet-4-5 / claude-3.5-sonnet:** 100/100 averages after financial fix; fully production-ready.
- **claude-haiku-4-5:** 98.4 average, 41 s runtime, best cost/performance.
- **gpt-4o:** 92.9 average, still only misses basic-02.
- **gpt-5.1:** 91.3 average; minor formatting nits on mathematical-01 remain.
- **grok-4-1-fast-reasoning:** 91.3 average, 120 s run; similar issues as gpt-5.1.
- **gpt-4o-mini:** 84.6 average; passes 5/7 tests, budget-friendly cloud option.
- **ollama-gpt-oss-20b:** 78.4 average; best on-prem choice once paired with verification.
- **ollama-phi4-mini:** 16.3 average; fails all tests.

## Verification & Test Improvements

- Verifier fixes (Nov 26) cover result correctness, formula usage, formatting, and label matching.
- Semantic extractor (Nov 28) ensures value lookup prioritizes numeric outputs.
- Spreadsheet engine (Nov 27) fully supports string operations.
- Financial-01 update (Nov 28) aligns assertions/formatting with "Interest Paid" row.

### Re-Evaluation Impact

- Latest re-evaluation processed 10 files, updating 3 (all improvements).
- Financial test scores jumped for the Claude models (now 100s instead of 82s).
- No regressions observed; summary stats above reflect those fixes.

## Recommendations

### Model Selection
1. **Best overall:** gemini-3-pro-preview or the Sonnet models (all 100/100 averages).
2. **Best value:** claude-haiku-4-5 (98.4 average, low latency/cost).
3. **Best OpenAI stack:** gpt-5.1 for flagship accuracy, gpt-4o-mini for budget workloads.
4. **Fast reasoning:** grok-4-1-fast-reasoning balances speed and accuracy.
5. **Privacy/offline:** ollama-gpt-oss-20b for local deployments.

### Application Guidance
- Keep the verifier in loop for every generated spreadsheet.
- Provide explicit instructions for percentage budgets to avoid hard-coded totals.
- Use the text/financial tasks with confidence—engine and tests now reflect reality.
- For local deployments, pair Ollama outputs with automated verification to catch formatting slips.

### Benchmark Improvements
1. Add new scenarios (pivot tables, lookups, conditional formatting).
2. Introduce adversarial/error-handling cases.
3. Automate summary regeneration (scripts already output aggregated stats).
4. Continue auditing test-case expectations (statistical-01, financial-01 fixes proved worthwhile).

## Conclusion

Modern LLMs can generate production-ready spreadsheets across the full difficulty range. After the latest fixes:
- **Gemini + Claude Sonnet** share the #1 spot with flawless averages.
- **Haiku, GPT-4o, GPT-5.1, and Grok** deliver low-90s reliability, with only the budget test requiring manual prompting.
- **Text/financial logic** are fully solved for top-tier models.
- **Only ollama-phi4-mini** remains unsuitable for production.

### Production Readiness
- **Tier 1 (≥98 avg, 100% pass):** gemini-3-pro-preview; claude-sonnet-4-5; claude-3.5-sonnet; claude-haiku-4-5.
- **Tier 2 (90‑95 avg, ≥86% pass):** gpt-4o; gpt-5.1; grok-4-1-fast-reasoning.
- **Tier 3 (75‑89 avg, ≥71% pass):** gpt-4o-mini; ollama-gpt-oss-20b.
- **Not ready:** ollama-phi4-mini.

### Next Steps
1. Re-run the benchmark after any new engine/verifier changes.
2. Expand test coverage (lookups, conditional formatting, error handling).
3. Cross-validate with Excel/Google Sheets outputs where possible.
4. Provide targeted prompts/examples for the budget test to improve pass rates.

With the re-evaluated results and updated tests, the benchmark now accurately captures the state of LLM spreadsheet generation.
