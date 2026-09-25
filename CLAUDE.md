# CLAUDE.md — MulmoChat

Working notes for AI coding agents in this repo: the rules, and the traps that typecheck, lint, CI
and the review bots do not catch. How the app is built (layout, transports, tool results,
preferences, roles, plugin system, server routes, environment variables, data flow) is in
**[`docs/architecture.md`](docs/architecture.md)** — read it for anything not covered here. What
MulmoChat is and how to install it is in `README.md`; plugin authors read
`docs/plugin-development-guide.md`.

MulmoChat is a Vue 3 + Express app for multimodal chat: voice (OpenAI Realtime, Gemini Live, Grok
Voice) or typed text (OpenAI, Anthropic, Google, Grok, Ollama), with ~30 tool plugins that render
visual, interactive results. It is a reference implementation of
**[gui-chat-protocol](https://github.com/receptron/gui-chat-protocol)**: plugins are framework-agnostic
npm packages that any compliant host can run, so a change here should keep them working in the
other hosts too.

## Commands

The project uses yarn (`yarn.lock`); `npm run <script>` also works.

- `yarn dev` — Vite client plus `tsx server/index.ts` on port 3001. `yarn dev:client` / `yarn dev:server` for one side.
- `yarn typecheck` (`vue-tsc --noEmit`), `yarn lint`, `yarn format`, `yarn knip` (dead code, report-only).
- Provider smoke tests call real APIs with the keys in `.env`: `yarn test:text:<openai|anthropic|google|ollama>`, `yarn test:tools:<provider>`, `yarn test:image:<comfy|openai>`. Benchmark: `yarn benchmark:llm`.
- **Do NOT run `npm run build`, `build:server`, `preview` or `start`.** They create build artifacts the repo doesn't want. CI builds on every PR.

There is no unit test suite, so CI (`.github/workflows/pull_request.yaml`: typecheck, lint, build on
Node 22/24 × ubuntu/windows/macos) is the whole safety net, and everything below is what it cannot
see. One CI trap: the Windows runners check files out with CRLF unless `.gitattributes` forces LF,
and prettier then fails lint on every line. Keep `* text=auto eol=lf`.

## Plugin code stays out of the shell

HomeView, App.vue and the composables reach plugins only through `src/tools/index.ts`
(`toolExecute`, `getToolPlugin`, `pluginTools`, …). A plugin's special case belongs in its package,
in `src/tools/`, or in a host binding under `server/plugins/`, not in an `if (toolName === "…")` in
the view. Two names are known exceptions and not a pattern to extend: `text-response`, the pseudo
tool that carries chat text (HomeView, `useTextSession`, `useToolResults`), and `setImageStyle` in
`PLUGINS_WITH_SET_CONFIG` (`useToolResults`), the one plugin allowed to write host config.

Plugins are external npm packages, not source in this repo. To add one: add the package, import its
`/vue` entry in `src/tools/index.ts`, append it to `registeredPlugins`, and add its tool name to the
`availablePlugins` of every fixed role that should have it (`src/config/roles.ts`). A plugin missing
from a fixed role's list is silently absent in that role, with no error anywhere.

### A server-run plugin is registered in two lists

A plugin whose `execute()` runs on the server needs BOTH `runOnServer(…)` around its entry in
`src/tools/index.ts` AND its package in `PLUGIN_PACKAGES` (`server/plugins/config.ts`). Nothing
checks that the two agree: the browser happily posts to `/api/plugin/<tool>` and gets a 404 only
when the model calls the tool. If the package handles View actions outside `execute()`, it also
needs an entry in `pluginHostHandlers` (`server/plugins/dispatch.ts`). A host tool, one that no
gui-chat-protocol package registers (renderShapeScript, and the X tools from the server-only
`@mulmoclaude/x-plugin`), lives in `dispatch.ts` (`pluginHostHandlers` and `hostToolDefinitions()`)
plus a placeholder in `src/tools/` built with `hostToolDefinition()`, which the server's definition
fills in at startup.

## MulmoClaude is the reference host — read it before wiring a shared package

MulmoClaude (`../mulmoclaude`) and MulmoTerminal (`../mulmoterminal`) drive the same
`@mulmoclaude/*` packages over the same workspace on disk (`~/mulmoclaude`), so for anything those
packages define they are not other apps: they are the existing answer. MulmoChat's host bindings
(`server/plugins/*Host.ts`, `fileOps.ts`, `pluginRuntime.ts`) were adapted from **MulmoTerminal**,
not checked against MulmoClaude. Before writing or changing one, `grep` the feature under
`../mulmoclaude/{server,src}` and match it on:

- **`/api/*` route paths** — MulmoClaude keeps them in `src/config/apiRoutes.ts`.
- **Which failures are an HTTP status and which are a field on a 200.** Plugins send `!ok` and a
  successful body to different places in their UI, so this is behaviour, not style.
- **User-facing wording** for the same condition. Someone running two hosts must not get two
  explanations for one setup problem.
- **Wire shapes**, including fields neither side reads yet.

Why this needs saying: we own both ends here, the Express route and the Vue binding that calls it,
so a divergent path or status is self-consistent and works. typecheck, CI and the review bots all
pass; only someone comparing the repos sees it. (MulmoTerminal learned this in its #907: a
`/calendar/push` route shipped green against MulmoClaude's `/calendar-push`.)

Deliberate divergence is fine: say so in a comment with the reason, and flag it in the PR. The ones
MulmoChat has today, each commented at its site:

- Files stay inside the workspace: no absolute paths and no `files.byPath` (presentDocument,
  presentHtml, presentShapeScript, presentMulmoScript), because MulmoChat's tools are driven by
  voice and text models, not by an agent the user launched in a directory.
- presentHtml pages are served only from `artifacts/html/` (no `/htmlfile` mount), and `packHtml`
  is implemented (MulmoTerminal doesn't).
- presentDocument has no Marp workspace themes and keeps MulmoChat's own system prompt.
- renderShapeScript returns the image to the model (`imagesForModel`) instead of a path to read.

## Say where a boundary is enforced, not where it looks enforced

A check in the browser is a courtesy; the boundary is whatever the server refuses. Current state:

| What | Enforced by |
|---|---|
| `/api/plugin/*` (server-run plugins) | `requireLocalClient` (loopback socket unless `MULMOCHAT_ALLOW_REMOTE_PLUGINS`), `requireTrustedOrigin` (loopback or `MULMOCHAT_ALLOWED_ORIGINS`, never the Host header), JSON only — `server/utils/trustedOrigin.ts` |
| `/api/plugin-events`, `/api/mulmoscript/media`, `/artifacts/html/*` | `requireLocalClient` + `requireLoopbackHost` (DNS rebinding), CORS header dropped; media is also rate-limited and extension-limited |
| Plugin files | the rooted `FileOps` (`server/plugins/fileOps.ts`): lexical check, then realpath, so `..` and symlinks out of `artifacts/` are refused |
| Model-written HTML pages | the response's CSP (`sandbox allow-scripts`, CDN allowlist, `connect-src 'none'`) in `htmlHost.ts`, not the View's iframe attribute |
| Images sent to text models | `server/llm/images.ts` / `parseMessageImages`, whatever the client filtered |

**Known gap:** every other route has no guard. The server listens on `0.0.0.0` with `cors()` open
to any origin, so `/api/start` (which returns `GEMINI_API_KEY` and mints OpenAI keys),
`/api/text/generate`, the image routes, `/api/browse` and the PDF routes answer any machine on the
network, and any web page the user visits can read them through `localhost:3001`. Treat this as the
current state, not an invariant: a new route with a secret or a side effect gets the plugin routes'
guards, and closing the gap for the old ones is its own change.

Two incidents show why the table matters: the CodeQL "missing rate limiting" alert on the media
route (#220), and the old movie routes (`/generate-movie`, `/download-movie`, `/viewer-json`), which
read arbitrary paths from the request body and were removed rather than guarded (#220).

## One value, one definition

A value both sides decide from — a limit, a default, a pattern, a list — is defined once. The client
already imports server modules (`src/tools/types.ts` imports `server/types.ts`), so a shared value
goes in a browser-safe module under `server/` that `src/` imports; the server can't import `src/`.
Do not add a second copy with a "keep in sync" comment. The copies that exist today are debt, not
precedent:

- the default image models: `src/config/imageModels.ts` and `server/utils/imageModelDefaults.ts`
- `MAX_MESSAGE_IMAGES` and the image data-URL pattern: `src/composables/useTextSession.ts`,
  `src/tools/index.ts` and `server/llm/images.ts`
- the presentHtml CDN allowlist: `server/plugins/htmlHost.ts` (copied from `@mulmoclaude/core`,
  whose subpath didn't resolve under the old module resolution) and `PRESENT_HTML_PROMPT`
- the default realtime model: `server/routes/api.ts` and `src/config/models.ts`

## "Can transport X do Y?" is a matrix, not a yes/no

The four transports share one interface (`UseRealtimeSessionReturn`), which hides that they answer
the same call in different ways. Check the row before assuming a feature works everywhere.

| | OpenAI Realtime | Gemini Live | Grok Voice | Text |
|---|---|---|---|---|
| Key in the browser | ephemeral key from `/api/start` | the raw `GEMINI_API_KEY` | client secret (`?voice=grok`) | none (server calls providers) |
| Follow-up instructions | `response.create` with `instructions` (replaces the session prompt for that reply) | a user turn | a user message + `response.create` | a `[System instruction]` user message, sent with the next request; `instructionsRequired` ones get a follow-up turn right away (with images, at most 3 in a row) |
| Overlapping replies | **not handled**: a follow-up sent while a reply runs is rejected with `conversation_already_has_active_response` | n/a | held until `response.done`, once | n/a (turn-based) |
| Images to the model | `input_image` | `inlineData` (open turn) | **none**: the API drops `input_image` silently | per provider in `server/llm/providers/`; Ollama untested |
| Text shown as it streams | `response.text.delta` only (no audio transcript) | `part.text` | none | yes |

When adding a transport, `SessionTransportKind` gains a value, but most per-kind code is `if`
chains, so the compiler won't list what you missed. The places #221 had to touch for Grok:
`useSessionTransport.ts` (`sessionFor`, `capabilities`, `registerEventHandlers`),
`useUserPreferences.ts` (`resolveStoredModelKind`, `resolveStoredModelId`, the kind watcher),
`Sidebar.vue` (the option, `isVoiceMode`, the model select, `needsConnectionToSend`), `HomeView.vue`
(`getModelId`, `statusLine`), `config/models.ts`, `server/routes/api.ts` and `server/types.ts`. Write a
new per-kind table as `Record<SessionTransportKind, …>` so the next one is a type error.

Session lifecycles have their own traps, all found in review of #221: a WebSocket's close handler
must be bound to its socket (a stale close from a replaced socket otherwise ends the new chat);
`stopChat` must cancel a start still awaiting `/api/start` or the microphone; and `chatActive`
turns on only when the connection is actually open, or a typed message in the gap is dropped.

## Deliberate behaviour — don't "fix" it

- **Gemini TTS refuses very short narration** ("Model tried to generate text…") when mulmocast
  generates a movie from a one-line beat. It is the API, not our code; longer narration works.
- **Switching role reconnects the voice session** and the model loses the conversation so far:
  instructions and tools are fixed at connect time on every voice API.
- **The text transport's `isDataChannelOpen()` is always false**, so nothing sends a message between
  an assistant tool call and its outputs (the APIs reject that order). Its images for the model are
  held until the turn's tool outputs are in for the same reason.
- **Grok's `sendImagesToModel` returns false.** Not a TODO: the API ignores images.
- **The Configuration button is hidden while connected**, which is why the transport can't change
  mid-session from the UI. The model-kind watcher still stops the previous transport by kind.

## Plugin documentation sync

When a plugin implementation policy or constraint changes, update the guides plugin authors read:
`docs/plugin-development-guide.md` and `.ja.md` here, and in the sibling repos
`GUIChatPluginTemplate/README.md`, `TEMPLATE.md`, `docs/plugin-development-guide.md`,
`docs/getting-started.md`, `docs/getting-started.ja.md`, and `MulmoChatPluginQuiz/README.md`,
`TEMPLATE.md`. Nothing checks this; a policy that exists only here is one plugin authors never see.

A fact belongs in one place in this repo too: architecture in `docs/architecture.md`, rules and traps
here, the short version in `AGENTS.md`. When a change moves a fact, update the one place that owns
it rather than adding it to a second.
