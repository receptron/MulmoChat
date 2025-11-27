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

**Date:** November 28, 2025  
**Models Tested:** 10 (all completed the 7-case suite)  
**Major Changes:**
- Re-ran `yarn run benchmark:re-evaluate` after improving the semantic extractor so label lookups prefer numeric formula outputs (fixes the logical-01 "Alice/Bob" formatting error).
- Text manipulation benchmark (`text-01`) is now fully operational post engine fixes—9 of 10 models pass with an average score of 90/100.
- Updated ranking table, per-level/category rollups, and recommendations to reflect the re-evaluated results.

---

## Overview

This benchmark evaluates AI model performance on structured spreadsheet generation tasks using JSON format. Models are tested on their ability to generate spreadsheets with proper formulas, formatting, and calculations across various complexity levels and categories.

**Benchmark Run Date:** November 26, 2025 (latest result files)  
**Re-evaluation Date:** November 28, 2025  
**Total Test Cases:** 7 (Basic, Mathematical, Statistical, Text, Financial, Logical)

## Important Note: Verification Bug Fixes

**⚠️ Major Update (Nov 26, 2025):** Six critical verifier bugs plus one test-case issue were fixed (see details below). Average scores jumped by 10‑31 points; old results are not comparable.

**NEW (Nov 28, 2025):** Added a semantic-extraction refinement so label lookups prefer numeric formula outputs before textual formulas. This eliminates false negatives in logical-01 (averages now mapped to numeric cells instead of letter grades).

### Bugs Fixed (Nov 26, 2025)
1. **Result Correctness:** Assertions sometimes read percentage helper columns instead of final dollar results. Fixed column targeting.
2. **Formula Usage:** Hard-coded detection checked the wrong cells. Now inspects the actual result column.
3. **Formatting Check:** Format validation ran on percentage columns. Now aligns with the labels under test.
4. **Cell Priority:** When no formula existed, the verifier grabbed the leftmost numeric cell (inputs) instead of the computed value. Now prefers rightmost outputs.
5. **Label Matching:** Introduced a scoring heuristic (exact > starts-with > contains) with length penalties to disambiguate labels such as "Interest" vs. "Total Interest Earned".
6. **Data Presence:** Value checks now use the improved label finder instead of the legacy implementation.
7. **Test Case Bug:** `statistical-01` expected incorrect totals/averages and referenced the wrong label. Fixed values (10,300 total / 2,060 average) and extractor ("Total").

### Spreadsheet Engine Fixes (Nov 27, 2025)
String formulas now run correctly:
- Added `&` concatenation support, proper quoting for string literals/cell references, and comprehensive CONCATENATE handling.
- Preserved raw string values instead of coercing them to `0`.
- Ensured built-in functions (LOWER, CONCATENATE, etc.) load automatically.
- Text-01 now reflects model ability, not engine limitations (pass rate jumped from 0% → 90%).

## Model Performance Rankings

| Rank | Model | Avg Score | Pass Rate | Perfect Rate | Tests |
|------|-------|-----------|-----------|--------------|-------|
| 🥇 1 | **gemini-3-pro-preview** | **100.0** | **100%** | **100%** | 7/7 |
| 🥈 2 | **claude-sonnet-4-5** | **97.4** | 100% | 86% | 7/7 |
| 🥈 2 | **claude-3.5-sonnet** | **97.4** | 100% | 86% | 7/7 |
| 4 | **claude-haiku-4-5** | **95.9** | 100% | 71% | 7/7 |
| 5 | **gpt-4o** | **92.9** | 86% | 86% | 7/7 |
| 6 | **gpt-5.1** | **91.3** | 86% | 71% | 7/7 |
| 6 | **grok-4-1-fast-reasoning** | **91.3** | 86% | 71% | 7/7 |
| 8 | **gpt-4o-mini** | **84.6** | 71% | 57% | 7/7 |
| 9 | **ollama-gpt-oss-20b** | **78.4** | 71% | 57% | 7/7 |
| 10 | ollama-phi4-mini ⚠️ | 16.3 | 0% | 0% | 7/7 |

**Legend:** 🥇 = top performer, 🥈 = tied for second, ⚠️ = not production-ready.

## Performance by Complexity Level

| Level | Description | Avg Score (across models) | Pass Rate | Notes |
|-------|-------------|---------------------------|-----------|-------|
| Level 1 | Basic budgeting tasks | 83.4 | 75% | Only ollama-phi4-mini failed both entry tests; everyone else averages ≥90. |
| Level 2 | Intermediate math/stat/text | 82.1 | 80% | Text-01 now passes for 9/10 models; mis-budgeting on basic-02 is the remaining trouble spot. |
| Level 3 | Financial + logical reasoning | 89.4 | 85% | All cloud models score ≥95; only phi4-mini fails consistently. |

## Performance by Category

| Category | Avg Score | Pass Rate | Highlights |
|----------|-----------|-----------|------------|
| **Basic** | 83.4 | 75% | Most misses stem from the budgets-in-percent test (basic-02) where 4 models under-format totals. |
| **Mathematical** | 70.6 | 60% | gpt-5.1 and grok now hit 50/100 due to small precision issues; others (Gemini/Claude) score 100. |
| **Statistical** | 85.6 | 90% | Only ollama-phi4-mini fails after the corrected expectations. |
| **Text** | 90.0 | 90% | Engine fix unlocked string formulas—only ollama-phi4-mini fails now. |
| **Financial** | 85.3 | 80% | gpt-4o-mini struggles with PMT formatting; everyone else lands ≥90. |
| **Logical** | 93.5 | 90% | Semantic-extractor fix removed false negatives; phi4-mini remains the lone failure. |

## Test Case Analysis

| Test Case | Avg Score | Pass Rate | Notes |
|-----------|-----------|-----------|-------|
| ✅ **basic-01: Monthly Expenses** | 91.0 | 90% | Only ollama-phi4-mini (10/100) misses currency formatting. |
| ⚠️ **basic-02: Percentage Budget** | 75.8 | 60% | gpt-4o, gpt-4o-mini, ollama-gpt-oss-20b, and phi4-mini hard-code totals instead of referencing the income cell. |
| ✅ **mathematical-01: Compound Interest** | 70.6 | 60% | gpt-5.1 + grok now hit 50/100 (correct math but missing PV formatting); Geminis/Claudes ace it. |
| ✅ **statistical-01: Sales Analysis** | 85.6 | 90% | All but phi4-mini reach ≥79/100 after the test-case fix. |
| ✅ **text-01: Email Generation** | 90.0 | 90% | Engine fix verified—Gemini, Claude family, GPTs, Grok, and Ollama 20B all output valid emails; phi4-mini fails with malformed strings. |
| ✅ **financial-01: Loan Payment** | 85.3 | 80% | gpt-4o-mini (67/100) and phi4-mini (40/100) under-format monthly payment; others perfect. |
| ✅ **logical-01: Grade Calculator** | 93.5 | 90% | Semantic-extractor fix ensures averages map to numeric cells; only phi4-mini (35/100) misses formulas. |

## Key Findings

1. **Gemini sweeps the board** with perfect scores across all seven tests after re-evaluation.
2. **Claude family consistency:** all three Claude variants score ≥95 and now pass every test, providing multiple price/performance tiers.
3. **OpenAI & Grok rebound:** gpt-4o, gpt-5.1, and grok-4-1-fast-reasoning now exceed 90 average score with only isolated misses (basic-02, mathematical-01 formatting).
4. **Text manipulation verified:** 9/10 models generate correct email formulas; the previous "universal failure" was purely an engine limitation.
5. **Cost-sensitive wins:** gpt-4o-mini (84.6) and claude-haiku-4-5 (95.9) deliver strong results with lower cost/latency.
6. **Local deployment viable:** ollama-gpt-oss-20b reaches 78.4/100 and passes 5/7 tests entirely offline.
7. **Remaining weak spot:** percentage budgets (basic-02) still trip up four models due to missing references/formatting.

## Model-Specific Notes

- **🥇 gemini-3-pro-preview:** Perfect 100/100 on every test, 173 s total runtime, best-in-class accuracy.
- **🥈 claude-sonnet-4-5 & claude-3.5-sonnet:** 97.4 average, 100% pass, 86% perfect-rate. Seamless across all categories.
- **claude-haiku-4-5:** 95.9 average with the same 100% pass rate at a fraction of the cost/time (41 s total). Best value.
- **gpt-4o:** 92.9 average; only fails basic-02 (hard-coded percentages). Already perfect on text/logical tests.
- **gpt-5.1:** 91.3 average; nails every test except mathematical-01 (needs better formatting). Requires `max_completion_tokens` parameter.
- **grok-4-1-fast-reasoning:** 91.3 average, 120 s total runtime, misses only mathematical-01 for the same formatting reason.
- **gpt-4o-mini:** 84.6 average; budget-friendly option that still passes 5/7 tests (basic-02 + financial-01 need formula cleanup).
- **ollama-gpt-oss-20b:** 78.4 average; passes 5/7 tests locally. Struggles with percentage budgets and compound interest.
- **ollama-phi4-mini:** 16.3 average, fails every test. Not suitable for production yet.

## Verification System Improvements

- **Result correctness, formula usage, formatting, data presence**: see bug list above.
- **Semantic extractor (Nov 28):** Prefers numeric formula cells first, then string formulas, then raw values. Eliminates misaligned formatting/score extractions in logical tasks.
- **Text engine (Nov 27):** Added concatenation support, string preservation, function registry bootstrap, and quoting fixes.

### Re-Evaluation Impact

- `yarn run benchmark:re-evaluate` processed 10 files, updating 9 (all improvements).
- Logical-01 now reports correct formatting for all major models (scores increased by 15-25 points there).
- Text-01 pass rate jumped from 0% → 90% after re-evaluation confirmed the engine fixes.

## Recommendations

### Model Selection
1. **Best overall:** gemini-3-pro-preview (100 average, 100% pass/perfect) for mission-critical spreadsheets.
2. **Best premium alternatives:** claude-sonnet-4-5 / claude-3.5-sonnet (97.4 average) with flawless pass rates.
3. **Best value:** claude-haiku-4-5 (95.9 average) or gpt-4o-mini (84.6) when cost matters more than perfection.
4. **Best OpenAI flagship:** gpt-5.1 (91.3 average) once configured with `max_completion_tokens`.
5. **Best speed:** grok-4-1-fast-reasoning balances 91.3 accuracy with fast turnaround.
6. **Best offline/privacy option:** ollama-gpt-oss-20b (78.4) for local deployments.

### Application Guidance
- Keep the verification suite in the loop—every production spreadsheet should be validated before delivery.
- Embrace Level 2/3 tasks: top-tier models now routinely exceed 95/100 even on complex logic or PMT workbooks.
- After the text fix, models can safely emit string-concatenation formulas; no server-side post-processing is required for email generation.
- For percentage-driven budgets, explicitly remind models to reference income cells (basic-02 remains the most common failure).

### Benchmark Improvements
1. Expand scenarios (pivot tables, lookups, conditional formatting) to differentiate top performers further.
2. Add adversarial/error-handling cases (missing data, zero divisions, etc.).
3. Keep validating test-case expectations—statistical-01 bug showed inaccuracies hide inside fixtures.
4. Automate summary generation from result files (scripts already provide data; integrate into CI).

## Conclusion

Re-evaluation confirms that modern LLMs can produce production-ready spreadsheets end-to-end:
- **Gemini** leads with a clean 100 average, while **Claude Sonnet/Haiku**, **GPT-4o/5.1**, and **Grok** all surpass 90.
- **Text manipulations** are no longer a blocker—string formulas evaluate correctly across engines.
- **Only ollama-phi4-mini** remains below the production threshold; every other tested model passes ≥5 of 7 tests with validation safeguards.

### Production Readiness
- **Tier 1 (≥95 average, 100% pass):** gemini-3-pro-preview; claude-sonnet-4-5; claude-3.5-sonnet; claude-haiku-4-5.
- **Tier 2 (90‑94 average, ≥86% pass):** gpt-4o; gpt-5.1; grok-4-1-fast-reasoning.
- **Tier 3 (75‑89 average, ≥71% pass):** gpt-4o-mini; ollama-gpt-oss-20b (with validation guardrails).
- **Not Ready:** ollama-phi4-mini (fails all tests).

### Next Steps
1. Re-run the full benchmark after future engine/verifier updates to maintain parity.
2. Add new scenarios covering lookups, conditional formatting, and error handling.
3. Integrate real spreadsheet engines (Excel/Sheets) for cross-validation where feasible.
4. Continue monitoring the percentage-budget test—provide targeted prompt hints or adjust scoring to reward partial credit.

The benchmark now accurately reflects LLM spreadsheet capabilities, with results grounded in re-evaluated data and a fully functional text engine. Gemini remains the gold standard, Claude/GPT/Grok deliver dependable alternatives, and even local Ollama models can participate when paired with verification.
