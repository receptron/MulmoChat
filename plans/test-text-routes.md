# Tests for the text routes (issue #293 follow-up)

#296 removed the session routes from `server/routes/textLLM.ts` and left `GET /api/text/providers`
and `POST /api/text/generate` without tests. This adds them, with no production change.

## Approach

`test/test_textRoutes.ts` mounts the real router on an Express app with the server's JSON body
parser, listens on an ephemeral loopback port and sends real HTTP requests. Only the provider's
upstream call is stubbed (`globalThis.fetch` for non-loopback URLs), so the route's parsing, the
text service's validation, the provider and the error mapping all run as in the app.

Covered:

- `/text/providers`: order of providers and `hasCredentials` following the environment
- `/text/generate` success: what reaches the provider (system prompt, roles, `tool_call_id` only on
  tool messages, `tool_calls` only on assistant ones, images, sampling only when numeric, tools only
  when non-empty) and the response shape
- every 400 a request can reach, from the route and the service (provider, model, messages, roles,
  content, images). The service's own array and role checks are not reachable: the route rejects
  those first.
- errors: an upstream status passes through as the response status, a missing key is a 500 with
  its message, anything else is a 500 "Failed to generate text" with the error's message as details
  ("Unknown error" when what was thrown is not an Error)

## Verification

The route was broken one rule at a time and the file run against each break (the commands are in
the PR). Two breaks stay green because no provider can observe them: `tool_call_id` kept on a
non-tool message, and an empty `tools` list passed on. Every provider reads `tool_call_id` only on
tool messages and sends tools only when the list is non-empty, so what reaches the provider is the
same either way.

Not covered here: how a provider maps the request beyond OpenAI's chat completions. The tests use
OpenAI as the provider, which sends the system messages as they are, so the service's joined
`systemPrompt` (read by Anthropic and Google) is not observable through them.
