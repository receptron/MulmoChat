# Text Model Support Roadmap

## Goal
Enable MulmoChat to switch between the existing GPT Realtime voice experience and purely text-based large language models (e.g., GPT-5 text, Claude 3.5 Sonnet), while keeping tool interoperability and minimizing UI disruption.

## Context Snapshot
- Voice sessions rely on `/api/start` to mint an OpenAI Realtime ephemeral key and then stream audio/text via WebRTC (`useRealtimeSession`).
- Outgoing messages and tool traffic ride over the Realtime data channel; the client assumes audio streams exist.
- Tool execution is decoupled (`useToolResults`) and should stay agnostic to the transport, provided we can deliver tool call arguments and capture tool outputs.
- **Update:** The server now exposes consolidated text-generation endpoints (`GET /api/text/providers`, `POST /api/text/generate`) that proxy OpenAI, Anthropic, Google Gemini, and Ollama behind a shared contract, with quick verification scripts under `server/tests/`.

## Development Phases

### Phase 1 – Design + Model Registry
- Inventory target text models (OpenAI `responses` GPT-5 series, Anthropic Claude Sonnet 4) and capture their API capabilities (streaming, tool call schema, max tokens) in a shared config module.
- Extend `useUserPreferences` (and persisted state) to represent a `modelKind` (`realtime-voice` vs `text-only`) and selected `modelId`.
- Update `/api/start` to return the advertised model catalogue so the client can render available options without another round trip.

### Phase 2 – Transport Abstraction _(In Progress)_
- ✅ Added `useSessionTransport` wrapper that augments the existing realtime hook with transport metadata/capabilities and centralizes future switching logic.
- ☐ Extract the WebRTC implementation into a dedicated voice adapter and introduce a REST-based `useTextSession` that conforms to the shared contract.
- ☐ Expand the abstraction to dynamically instantiate transports based on user preferences (voice vs text) and fall back gracefully when audio is unavailable.

### Phase 3 – Server Text Proxy Endpoints _(Completed)_
- ✅ Added unified text routes (`GET /api/text/providers`, `POST /api/text/generate`) that validate payloads and surface provider availability metadata.
- ✅ Implemented provider adapters for OpenAI chat completions, Anthropic Messages, Google Gemini (`gemini-2.5-*`), and Ollama (`gpt-oss:20b` default) with normalized usage reporting and error handling.
- ✅ Documented the API surface and environment variables in `README.md`, plus shipped CLI smoketests (`server/tests/test-text-*.ts`).

### Phase 4 – Client Text Session Hook
- Build `useTextSession` to call the new REST endpoints, maintain conversation state, emit deltas, and surface tool call events to `useToolResults`.
- Reuse the current retry logic for message sends; ensure we queue `response.create` equivalents so tool calls still resolve through the same pathways.
- Wire the composable selection in `App.vue` based on the chosen `modelKind`, and adjust UI affordances (disable audio recorder, rename controls to “Connect/Disconnect” where appropriate).
- ✅ Created an internal `text-response` pseudo tool and corresponding preview/canvas components so assistant turns from a text transport can flow through the existing tool-results UI without exposing the helper to the LLM.
- ✅ Updated the `text-response` helper to rely on the canonical `ToolResult.data` payload so downstream views no longer depend on ad-hoc fields.

### Phase 5 – UI/UX Enhancements
- Expose a model selector in `Sidebar.vue` (or a dedicated settings modal) that lists voice vs text models, shows availability badges (e.g., Claude requires configured key), and triggers the `switchMode` helper.
- Provide inline feedback when attempting to send audio while in text mode, and optionally surface transcription via the existing upload flow if we want to keep voice input for text models.
- Update instruction builder logic so mode- or provider-specific system prompts are injected automatically.

### Phase 6 – Tool & Conversation Alignment
- Verify that tool payloads from text providers map cleanly to the existing `processToolCall` contract; add translation shims where schema names differ (e.g., Anthropic `tool_use` events).
- Ensure `sendFunctionCallOutput` works for both transports: send on the Realtime data channel for voice, POST to `/api/text-session/tool-output` (or piggyback on message endpoint) for text.
- Add safeguards for token budgeting (truncate history, surface “context trimmed” warnings) since text models will likely rely on turn-based context windows.

### Phase 7 – Testing & Hardening
- Set up mocked provider clients (via MSW or node interceptors) so we can exercise both adapters without live API keys. _(TODO)_
- Add integration smoke scripts: one for voice (existing) and one that spins a text session, sends a tool-enabled prompt, and validates the UI updates. _(Server-side CLI scripts shipped; UI automation still pending)_
- Document environment variable expectations in README (new `ANTHROPIC_API_KEY`, optional custom model IDs) and capture manual test steps. _(Completed)_

## Risks & Mitigations
- **Streaming mismatch**: Providers differ in streaming formats. Mitigate by normalizing server responses into a shared SSE schema consumed by the client.
- **Tool schema divergence**: Anthropic vs OpenAI tool call shapes differ. Introduce translation utilities and add unit tests that feed synthetic payloads through the pipeline.
- **UI complexity**: Extra selector clutter. Keep defaults simple (voice model highlighted) and hide text models when keys are missing.
- **Audio/UX regressions**: Ensure voice adapter remains untouched by guarding new code behind feature flags and re-running the audio handshake tests.

## Deliverables Checklist
- [ ] Configurable text-model registry surfaced to the client (current realtime selector only covers voice models).
- [ ] Dual transport session hooks (`useVoiceRealtimeSession`, `useTextSession`).
- [x] New server endpoints proxying text models with normalized responses.
- [ ] Updated UI for model selection and mode-aware controls.
- [ ] End-to-end tests or mocks covering tool-call translation and session switching (CLI smoke scripts exist; automated coverage pending).
- [x] Documentation updates (README, verification scripts, env vars).
