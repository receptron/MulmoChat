# Baseten Realtime Voice: evaluation as a MulmoChat voice transport

As of 2026-11-17, one day after the announcement. The blog post and the documentation were read; the
service is in private preview and was not run. Every number below is Baseten's own.

## Summary

Worth evaluating, and the first thing to do is join the
[waitlist](https://www.baseten.co/talk-to-us/realtime-voice-private-preview/): nothing can be tried
until Baseten enables it for an organization. Unlike [Haru](haru-evaluation.md) and
[PersonaPlex](personaplex-evaluation.md), Baseten Realtime Voice calls tools, takes their results
back, and speaks the OpenAI Realtime events over a WebSocket, so it would be a `RealtimeDialect` of
`useRealtimeWebSocketSession` like Grok and ElevenLabs. Three things can't be judged from the
documents and decide whether it is worth wiring: its Japanese, what happens to a tool that takes
longer than 30 seconds, and what a single user pays. It also needs a part no transport here has: a
WebSocket relay on our server, because the API key can't be given to the browser.

## What it is

Two products, announced together
([blog](https://www.baseten.co/blog/introducing-the-baseten-voice-agent-stack/)):

- **Baseten Voice Agent Stack** — infrastructure for hosting a voice agent's models and orchestrator
  in one place, each scaling on its own, with any model swappable or post-trained.
- **Baseten Realtime Voice** — a voice agent built on that stack from open-weight models. This is
  the one a MulmoChat transport would talk to.

It is a cascade (speech-to-text, then a text model, then text-to-speech), not a full-duplex
speech-to-speech model: turn-based, like every transport MulmoChat has today.

| Attribute      | Value                                                                                                                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Speech-to-text | Qwen3-ASR in the reference setup; Whisper also listed. Chosen with `x_stt`, only before any audio is sent                                                                                                                                                     |
| Text model     | Gemma-4-31B built in (`internal`); any Baseten Model APIs model or an OpenAI-compatible endpoint through `x_llm`, switchable per turn                                                                                                                         |
| Text-to-speech | Qwen3-TTS (named voices such as `ryan`) or Magpie (`Magpie-Multilingual.EN-US.Mia`). The session lists them in `x_providers.tts.voices`                                                                                                                       |
| Delegation     | Optional: the fast model keeps talking while a stronger one (GLM-5.3 in the reference setup) makes the tool calls and decisions                                                                                                                               |
| Orchestrator   | Baseten's own, based on Pipecat, hosted beside the models                                                                                                                                                                                                     |
| Languages      | Not stated. Every example is English, and the benchmark is the English split                                                                                                                                                                                  |
| Latency        | Median time to first audio 0.94 s at 1 call, 1.14 s at 56 concurrent calls, with up to 16K tokens of context                                                                                                                                                  |
| Price          | About $0.01 per audio minute: $18.39 per hour of dedicated hardware divided by 32 fully used concurrent sessions. Delegation is billed on top                                                                                                                 |
| Benchmarks     | τ²-Bench Voice 73.5% pass^1 (cascaded baseline 31.2%, system not named); Full-Duplex-Bench 93.01% weighted overall                                                                                                                                            |
| Access         | Private preview. Baseten gives the organization a Chain ID when it is enabled                                                                                                                                                                                 |
| Documentation  | [Overview](https://docs.baseten.co/inference/audio/realtime-voice/overview), [recipes](https://docs.baseten.co/inference/audio/realtime-voice/recipes), [API reference](https://docs.baseten.co/reference/inference-api/predict-endpoints/realtime-voice-api) |

The benchmark figures deserve less weight than the post gives them. The τ²-Bench Voice score was
measured by Baseten on Sierra's harness, and the blog itself says it is not directly comparable to
Artificial Analysis's results. The [τ-Voice paper](https://arxiv.org/abs/2603.13686) reports 31–51%
for voice agents in clean conditions, which may not be the same setup either.

## Wire protocol

`wss://chain-<chain_id>.api.baseten.co/environments/production/websocket` (or
`/development/websocket`, or `/deployment/<id>/websocket`). WebSocket only, no WebRTC. Every message
is a JSON text frame with base64 audio, which is what `useRealtimeWebSocketSession` already speaks.

- **Authentication:** `Authorization: Bearer <BASETEN_API_KEY>` only. No ephemeral key, no query
  parameter, no subprotocol. The documentation says browsers must connect through a backend that
  holds the key and relays the socket.
- **Client events:** `session.update`, `input_audio_buffer.append` / `commit` / `clear`,
  `output_audio_buffer.clear`, `conversation.item.create` / `retrieve` / `truncate` / `delete`,
  `response.create`, `response.cancel`.
- **Server events:** the OpenAI set, including `response.function_call_arguments.done`,
  `response.output_audio.delta`, `response.output_audio_transcript.delta`, `response.done`,
  `input_audio_buffer.speech_started` / `speech_stopped`, and
  `conversation.item.input_audio_transcription.delta` / `completed` for the user's speech.
- **Conversation items:** `user` messages take `input_text` and `input_audio`; `system` messages
  take `input_text`; `function_call_output` takes `call_id` and `output`. **`input_image` is not
  listed.**
- **Audio:** `audio/pcm`, 16-bit mono, 24 kHz by default; any rate is accepted and converted. G.711
  at 8 kHz for telephony.
- **Turn detection:** `server_vad` (default) or `semantic_vad`, or `null` for push-to-talk (not
  available with delegation). Short acknowledgments such as "mm-hmm" do not cancel a reply.
- **`response.create` while a response runs** is queued and runs after it. Its `instructions` add to
  the session's instead of replacing them.

Where it differs from OpenAI, as documented:

- Baseten's own options are `x_`-prefixed fields on the session (`x_llm`, `x_tts`, `x_stt`,
  `x_delegation`, `x_idle_timeout_secs`, `x_auto_continue`). Unknown fields are ignored without an
  error.
- `tool_acknowledgement` (default on): the agent says a short line before a slow tool call.
- `x_auto_continue` (default off): the next response starts after a tool result without a
  `response.create`.
- `spoken_style` (default on); what it changes is not described in what was read.
- An unknown voice name gives replies with no audio, and no error.
- `conversation.item.truncate` also cancels the response in progress.

Limits:

- **A client tool call times out after 30 seconds.**
- The session closes after 300 seconds without speech (`x_idle_timeout_secs`, 10 to 3600). Text
  events do not reset the countdown.
- The connection may be held up to 45 minutes while models start. Close code `1013` means not ready
  or full (retry with backoff), `1011` means startup failed.

## Transport matrix

In the terms of the transport matrix in `CLAUDE.md`. "Per the documents" throughout: none of the
Baseten column has been observed.

| Capability               | Baseten Realtime Voice                                                                                           | Grok / ElevenLabs                               | OpenAI Realtime                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | -------------------------------------- |
| Key in the browser       | **none possible**: the API key stays on our server, which relays the socket                                      | client secret                                   | ephemeral key                          |
| Tool calls               | yes; client function tools, results as `function_call_output`. **30 s limit**                                    | yes                                             | yes                                    |
| Follow-up instructions   | a `system` message item, or `response.create` `instructions`, which add to the session's                         | user message + `response.create`                | system message, then `response.create` |
| Overlapping replies      | a `response.create` sent while one runs is queued                                                                | dropped silently, so held until `response.done` | refused with an error, so held         |
| Images to the model      | **none documented** (`input_image` is not an accepted part)                                                      | none                                            | `input_image`                          |
| Text shown as it streams | `response.output_audio_transcript.delta` is sent, but the shared session shows only `response.output_text.delta` | none                                            | `response.text.delta` only             |
| User's speech as text    | yes, `…input_audio_transcription.completed`                                                                      | Grok yes; ElevenLabs tagged                     | yes                                    |
| Typed messages           | `input_text`, but typing does not reset the idle countdown                                                       | yes                                             | yes                                    |
| Languages                | not stated                                                                                                       | multilingual                                    | multilingual                           |
| Turn-taking              | turn-based, server VAD or semantic VAD                                                                           | turn-based                                      | turn-based                             |

## Open questions

The first three decide whether to wire it; the rest shape the wiring.

1. **Japanese.** Nothing in the documents mentions a language other than English. The upstream
   Qwen3-ASR and Qwen3-TTS models are multilingual (from memory, not checked against Baseten's
   deployment), `session.language` takes an ISO 639-1 code for sentence splitting, and transcription
   has its own `language`. Whether the built-in voices speak Japanese well is something only
   listening will tell.
2. **The 30-second tool limit.** Image generation, `makeMovie` and the browse and PDF tools can take
   longer. What the model is told when a call times out, and whether a `function_call_output` that
   arrives late is accepted or refused, is not documented. If late results are dropped, slow tools
   need a way to answer early ("started") and deliver the result as a follow-up instruction, which
   is a larger change than a dialect.
3. **Cost for one user.** The endpoint is a Chain of dedicated deployments, and $0.01 per minute
   assumes 32 concurrent sessions fully used. One developer talking to it now and then pays for the
   hardware, not the minutes, unless the preview is billed differently. Ask before deploying.
4. **Images.** `input_image` is not listed, so `sendImagesToModel` would return false, as for Grok
   and ElevenLabs. Whether the event is refused or dropped silently should be checked: Grok drops it
   and ElevenLabs accepts it and sees nothing. Gemma is a vision model, so this may change.
5. **`tool_acknowledgement` against our own handling.** The spoken line before a tool call is a
   response the client didn't ask for, like ElevenLabs' chained responses. The held-response
   bookkeeping in `useRealtimeWebSocketSession` (by response id, until the last `response.done`)
   has to be checked against it, or the setting turned off.
6. **Queued `response.create`.** Baseten queues what Grok drops. The shared session holds
   instructions until `response.done` anyway, so this should be harmless, but a queued one plus a
   held one must not become two replies.
7. **Echo.** The documentation's example "doesn't cancel echo, so on speakers the agent hears itself
   and stops mid-reply". The browser's `getUserMedia` echo cancellation should cover it, as it does
   for Grok; confirm on speakers.
8. **Idle close in typed use.** 300 seconds without speech ends the session even while the user is
   typing. Set `x_idle_timeout_secs` to its maximum (3600) and treat the close as a normal end.

## What wiring it would take

Not to be started before access arrives and questions 1 to 3 have answers.

1. **A WebSocket relay on the server**, the one new part. The server has no WebSocket endpoint
   today (no `ws` dependency, no `upgrade` handler): Grok and ElevenLabs pass a short-lived secret
   as a subprotocol and the browser connects to the provider itself. The relay adds the
   `Authorization` header, forwards frames both ways, and closes each side when the other closes.
   It spends the account's money on every connection, so it gets the guards of
   `/api/start/elevenlabs` (`localClientOnly`, `requireTrustedOrigin`), checked on the upgrade
   request, where Express middleware does not run. `BASETEN_API_KEY` and the Chain ID stay in
   `.env`.
2. **Decide what the relay lets through.** A plain pipe lets the page send any `session.update`,
   including `x_llm.base_url` (an endpoint of the caller's choosing) and `x_delegation` (billed to
   the account). ElevenLabs fixes the model and voice in the secret on the server; the equivalent
   here is the relay checking or rewriting `session.update`: voice against a `VOICES.baseten` list,
   `x_` fields from an allowlist.
3. **A `RealtimeDialect`** (`useBasetenVoiceSession.ts`): `requiresSecret: false`, `url` pointing at
   our relay, `protocols: () => []`, `inputSampleRate: 24000`, and a `session` with `audio/pcm`
   formats, the voice, `turn_detection`, the transcription language and `x_idle_timeout_secs`.
4. **A new `SessionTransportKind` value**; the compiler then lists the
   `Record<SessionTransportKind, …>` tables to fill (capabilities, `VOICE_MODELS_FOR_KIND`,
   `VOICE_PROVIDER_FOR_KIND`).
5. **The `if` chains it doesn't list:** `resolveStoredModelKind`, and in `Sidebar.vue` the option,
   `isVoiceMode`, the model select and `needsConnectionToSend`; plus `/api/start/baseten` in
   `server/routes/api.ts` and `server/types.ts`, which reports whether the key and Chain ID are set.
6. **Close codes:** `1013` (models starting or replica full) wants a "starting up, try again"
   message and not the generic failure alert. A cold start can take minutes.
7. **A new column in the `CLAUDE.md` transport matrix and its "Say where a boundary is enforced"
   table** (the relay), and `docs/architecture.md`.

## What to check first once access arrives

With the documentation's Python example, before any wiring:

- A Japanese conversation with each TTS model, and Japanese transcription with Qwen3-ASR and
  Whisper.
- A function tool that sleeps 40 seconds before returning: what the model says, and what the server
  does with the late `function_call_output`.
- An `input_image` part: error, silence, or an answer.
- A `system` message item followed by `response.create`, to confirm follow-up instructions are
  acted on.
- The bill after an hour of one idle deployment.
