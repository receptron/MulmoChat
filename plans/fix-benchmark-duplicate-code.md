# fix: duplicated code in benchmark/ (jscpd alerts)

Issue: #318

## Problem

The duplication-scan workflow (jscpd) reports copy-pasted blocks in `benchmark/src/`:

- `re-evaluate.ts` copies the test-case loader and the three statistics functions from `runner.ts`;
  `calculateByLevel` and `calculateByCategory` are near-copies of each other.
- `llm-client.ts` repeats the fetch / status check / latency / error handling in every provider client,
  and the OpenAI-compatible response parsing in OpenAI and Grok.
- `verifier.ts` builds the same "best cell" result object four times.
- `semantic-extractor.ts` repeats the nested row/column loop over every cell.

## Approach

- `benchmark/src/stats.ts` (new, pure): `calculateSummary`, and `calculateByLevel` / `calculateByCategory`
  on one grouping function. They take a `findTestCase` lookup, so the runner (array) and
  re-evaluation (map) share them.
- `benchmark/src/testCases.ts` (new): `readTestCaseFiles()` and the benchmark root directory, used by
  `runner.ts`, `re-evaluate.ts` and `test-runner.ts`.
- `llm-client.ts`: `timedRequest`, `postJSON`, `chatMessages`, `chatCompletionResponse` helpers.
- `verifier.ts`: one ordered fallback (`rightmost(cells, confidence) ?? …`) and one return.
- `semantic-extractor.ts`: a `cellsOf(data)` generator.

## Out of scope

- The `useGoogleLiveSession.ts` alert: it matches the other session composables because each one returns
  the members of `UseRealtimeSessionReturn`. There is nothing shared to extract.
- `benchmark/` imports `src/tools/models/spreadsheet*`, which was removed when the spreadsheet moved to
  `@gui-chat-plugin/spreadsheet`. The benchmark cannot run as it stands, and this change does not fix that.

## Verification

- Old and new code were run side by side on generated inputs (stats, loader, every exported
  semantic-extractor function, `findByLabelWithFormulas`, and every provider client against a mocked
  `fetch`, including error paths), comparing whole results. Deliberate mutations of the new code were
  caught.
- `test/test_benchmarkStats.ts` keeps the statistics properties as a permanent test.
