# Deduplicate `server/llm/providers` (issue #293, group B)

Part of #293. Builds on group E (#294), which adds `yarn test`.

## Changes

`grok.ts` and `openai.ts` (its chat completions path) built the same request and parsed the same
reply. `ollama.ts` repeated the tool conversion and the request/error handling, and `openai.ts`'s
`/v1/responses` path repeated the request/error handling again. All of it moves to
`server/llm/providers/chatCompletions.ts`:

- `toChatCompletionMessages`: messages, tool_call_id, image_url parts, assistant tool_calls
- `toChatCompletionSampling`: max_tokens / temperature / top_p, only when set
- `toFunctionTools`: tool definitions
- `postProviderJson`: POST with an optional bearer key, then `TextGenerationError("<label> API error: …", status)`
- `toChatCompletionResult`: text, tool calls, usage

What each provider does differently stays in it: OpenAI's o-series `parallel_tool_calls`,
`reasoning_effort`, and the `/v1/responses` path; Ollama's message shape, `options` and reply parsing.

## Verification

- Old vs new over generated params (roles, empty and present tool_call_id, image lists, tool calls,
  zero and unset sampling values, tool lists, every model routing), replies (chat, responses, ollama,
  empty, null, unparsable), failures (status, body, network) and environments (key unset, empty,
  set; Ollama base URL). The comparison covered the request sent (URL, method, headers, body text) and the result or
  error. Several seeds, no differences. `Date.now` / `Math.random` (Ollama's generated call ids)
  were made deterministic for both sides.
- The harness was mutation-checked, and so were the new tests in `test/test_chatCompletions.ts`.
  The one mutation the tests don't catch is the order of the two request headers, which the server
  can't observe.
