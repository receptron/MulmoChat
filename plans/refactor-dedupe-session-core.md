# Share the session preamble across the transports (issue #293, group D)

Part of #293. `useGoogleLiveSession`, `useRealtimeSession`, `useTextSession` and
`useRealtimeWebSocketSession` each started with the same handler registry (a `let handlers` copied
from `options.handlers`, replaced by `registerEventHandlers`) and the same five refs
(`chatActive`, `conversationActive`, `connecting`, `isMuted`, `startResponse`).

## Changes

- `src/composables/sessionBase.ts`: `useSessionBase(options.handlers)` returns
  `currentHandlers()`, `registerEventHandlers` and the five refs. Registration still REPLACES the
  handler object (spread), it does not mutate it, so the registry behaves exactly as before,
  including an own `__proto__` key staying data.
- Every `handlers.<name>` read in the four transports becomes `currentHandlers().<name>`: the
  same object at the same moment, and the same `this` for a handler called as a method.

## Not changed

- The object each transport returns (`useGoogleLiveSession.ts` ↔ `useRealtimeWebSocketSession.ts`
  in the jscpd report) lists the members `UseRealtimeSessionReturn` requires; merging it would only
  hide which transport supplies what, so that alert stays.

## Verification

- Text: after normalising (`currentHandlers().` back to `handlers.`, the preamble back to its old
  form), the four files are identical to the old ones apart from one line prettier re-wrapped.
- Running: the old preamble (verbatim) and `useSessionBase` over generated registration sequences
  (plain, JSON with own `__proto__` / `constructor`, getters, methods reading `this`), comparing
  every read, the object read before a registration, getter call order and the refs. Several
  seeds, no differences; the harness and `test/test_sessionBase.ts` were both mutation-checked.
- App: this checkout's server and Vite on separate ports, text transport driven in a browser with
  `/api/start` and `/api/text/generate` mocked (the local OpenAI key is invalid): a turn with a
  `manageTodoList` tool call and a follow-up reply. Old and new code sent the same requests and
  showed the same result, with no console errors.
- Not exercised: the voice transports (OpenAI Realtime, Gemini Live, Grok, ElevenLabs), which need
  a microphone and real keys.
