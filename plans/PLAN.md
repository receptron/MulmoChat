# MulmoChat Refactor Plan

## Goals
- Decouple UI presentation in `App.vue` from connection, tool, and preference management logic.
- Support multiple LLM backends, including text-only models, without rewriting the UI layer.
- Improve reusability and testability of session, tool execution, and persistence code paths.

## Current Pain Points
- `src/App.vue` mixes UI layout, user preference persistence, WebRTC setup, tool execution logic, and audio control, making changes risky.
- The WebRTC-specific workflow is tightly coupled to the rest of the app, so introducing a text-only or HTTP-based model would require touching many files.
- Tool handling depends on direct access to the data channel, preventing shared use across different transports.

## Proposed Architecture

### 1. Session Abstraction
- Introduce a `useSession` composable (or service) that provides a model-agnostic interface:
  - `connect()`, `disconnect()`, `sendUserMessage(content)`, `sendToolOutput(callId, payload)`, `setAudioEnabled(enabled)`.
  - Reactive state: `status`, `conversationActive`, `supportsAudio`, `supportsTools`, `supportsStreaming`.
- Implement adapters:
  - `realtimeWebRtcSession` for the existing OpenAI Realtime/WebRTC flow.
  - `textOnlySession` for models using text-based transports (e.g., REST or SSE).
- Each adapter handles its own transport setup, event parsing, and resource cleanup, emitting normalized events to the composable.

### 2. Modular Messaging Pipeline
- Create an event bus or callback registry within `useSession` for message types like `onTextDelta`, `onToolCall`, `onConversationStateChange`.
- Move the existing `messageHandler` logic into the WebRTC adapter, translating raw messages to the shared event format.
- Ensure adapters report capability flags so the UI can enable or disable audio controls dynamically.

### 3. Tool Execution Layer
- Add a dedicated module (e.g., `useToolExecutor`) that:
  - Accepts a `ToolContext` plus the normalized tool-call event.
  - Invokes `toolExecute` and updates shared state (`toolResults`, `selectedResult`).
  - Uses the `useSession` interface to send `function_call_output` and follow-up instructions.
- Consolidate scrolling and selection helpers into this layer to keep `App.vue` simple.

### 4. User Preferences Composable
- Extract language, system prompt, custom instructions, and enabled plugin management into `useUserPreferences`.
- Provide getters/setters that persist to `localStorage` and expose a single reactive object for the UI.

### 5. Listener Mode & Audio Control
- Create an audio controller module that tracks speech timing and handles intentional mute gaps.
- Only activate this logic when the active session supports audio; make it configurable for future adapters.

### 6. Model Registry & Selection
- Define a registry describing each supported model: `{ id, label, adapter, defaultPromptId, capabilities }`.
- Persist the chosen model in preferences and expose a selector in the sidebar; switching models re-instantiates the session with the selected adapter.

## Implementation Steps
1. Scaffold `useSession` with a minimal interface, migrate existing WebRTC setup into `realtimeWebRtcSession` while keeping `App.vue` unchanged via wrapper calls.
2. Extract user preference watchers into `useUserPreferences` and update `App.vue` to consume it.
3. Build `useToolResults` / `useToolExecutor` to manage tool state and move `processToolCall` logic out of `App.vue`.
4. Introduce the normalized event pipeline; adjust WebRTC adapter to emit events instead of mutating UI state directly.
5. Add the audio controller module; wire it through the session composable using capability flags.
6. Define the model registry, persistence, and selector UI; implement the `textOnlySession` adapter as a stub or initial integration target.
7. Update `App.vue` to become a thin orchestrator that binds composable state to the layout and forwards sidebar events to the session/tool modules.
8. Write unit tests or harnesses for the new composables/adapters, especially ensuring session lifecycle handling works independently of the UI.

## Testing Strategy
- Use Vitest for unit coverage of new composables (`useSession`, `useUserPreferences`, `useToolExecutor`), stubbing browser APIs (WebRTC, `localStorage`, `navigator.mediaDevices`).
- Provide fake session adapters to simulate text-only and audio-capable transports, validating event normalization and capability flags without network calls.
- Add integration-style component tests with `@vue/test-utils` for `App.vue` (or a simplified host component) that mount against mocked composables and verify sidebar interactions update state as expected.
- Create a smoke-test script that exercises the tool execution pipeline with mocked tool plugins, ensuring `function_call_output` and instruction flows remain intact after refactors.
- Document test entry points in `package.json` (e.g., `yarn test`, `yarn test:watch`) and add CI guidance so new adapters/composables must ship with corresponding tests.

## Open Questions
- What text-only models are highest priority (e.g., REST-based GPT, local LLM), and what transport protocol do they require?
- Should the session composable handle retries/reconnects, or remain a thin wrapper with hooks for higher-level policies?
- How should we surface adapter-specific configuration (e.g., model name, API endpoints) in the UI without cluttering the sidebar?

## Future Enhancements
- Add logging hooks within adapters for better observability and debugging.
- Consider centralizing conversation transcripts in a dedicated store to enable history persistence or export features.
- Evaluate whether tool result updates should transition to Vuex/Pinia or stay in module-level composables depending on app growth.
