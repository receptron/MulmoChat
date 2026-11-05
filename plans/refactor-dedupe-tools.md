# Deduplicate `src/tools` (issue #293, group E)

Part of #293, which works through the open `jscpd/duplicate-code` code scanning alerts. This is the
first group; it also adds the unit test setup the later groups use.

## Changes

- **Plugin selection rule, written three times in `src/tools/index.ts`.** `pluginTools` and
  `getPluginSystemPrompts` filtered plugins with the same role/toggle rule (the second copy said so
  in a comment), and `getEnabledBackends` applied it again without the server credential check.
  The rule moves to `src/tools/pluginSelection.ts` as `isPluginSelected` (pure; the role helpers are
  injected). The first two share `activePlugins` (credential check, then the rule).
  `getEnabledBackends` still skips the credential check.
- **POST-JSON block, five copies in `src/tools/backend`.** `html.ts`, `markdown.ts`, `exa.ts`,
  `browse.ts` and `imageGeneration.ts` each posted JSON, threw `Server error: <statusText>` on a
  failed reply and returned the parsed body. They now call `postJson` (`src/tools/backend/postJson.ts`).
  `pdf.ts` reads the error body instead, so it keeps its own fetch.
- **Tests.** `yarn test` (`tsx --test "test/test_*.ts"`), run in `pull_request.yaml` after lint.

## Verification

- Old and new were run side by side over generated inputs (old functions cut verbatim from the
  previous `index.ts` and backend files), comparing results, thrown errors and the order of every
  call. Plugin selection: generated worlds with varying plugin counts, server checks (including
  throwing ones), toggle values that are not booleans, and role ids including the empty string.
  Backends: a stubbed `fetch` varying `ok`, `statusText`, unparsable bodies and network failure.
  Several seeds, no differences.
- The harness was mutation-checked (each injected break produced differences), and so were the new
  tests (each break in `pluginSelection.ts` and `postJson.ts` turns `yarn test` red).

## Not changed

- `pdf.ts` (different error handling), `src/tools/serverPlugin.ts` and `pluginRuntime.ts` (different
  request shapes).
- Tests are not covered by `yarn typecheck`: `tsconfig.json` includes `src/` only and limits `types`
  to `vite/client`, so adding `test/` there needs its own config.
