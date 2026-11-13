# Haru: evaluation as a MulmoChat voice transport

As of 2026-11-13, one day after the repository was published. Sources and the model card were read,
the model was not run.

## Summary

Don't add [Haru](https://github.com/higurashi-ai/Haru) as a MulmoChat transport yet: it can't call
tools, and the ~30 tool plugins are most of what MulmoChat does. Haru-4B is a pretrained base model
that, in its authors' words, "does not follow instructions the way an assistant does". It is still
the stronger candidate of the two full-duplex models we have looked at: unlike
[PersonaPlex](personaplex-evaluation.md) it is multilingual (Japanese included), Apache 2.0 for code
and weights, runs on Apple silicon, and serves many conversations from one GPU. Look again when an
instruction-following release with tool calling appears.

## What it is

A 4B full-duplex speech-to-speech model from higurashi-ai, built on the Qwen3.5-4B text backbone. It
listens and speaks at the same time: every 133 ms it takes one frame of the user's audio and
produces one frame of its own audio and text.

| Attribute       | Value                                                                                                                                             |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Persona control | A "character card" with a fixed layout (persona, name, relationship, situation) as the system prompt, at most 4000 characters, fixed at the start |
| Voices          | None bundled. The voice is cloned from a reference clip of 3 seconds to 3 minutes, uploaded or recorded by the user                               |
| Languages       | English, Spanish, Portuguese, German, French, Chinese, Japanese, Russian, Korean                                                                  |
| Audio           | 24 kHz, 7.5 frames per second (3200 samples each), continuous latents from the VibeVoice codec                                                    |
| Session length  | The demo server ends a conversation after one hour (`--time-limit`). The usable context length is not documented                                  |
| License         | Apache 2.0 for the code and the [weights](https://huggingface.co/higurashi-ai/Haru-4B)                                                            |
| Hardware        | Self-hosted. PyTorch on a CUDA GPU with about 12 GB, or MLX on Apple silicon (10 GB checkpoint, optional 8-bit backbone)                          |
| Write-up        | [Technical blog](https://blog.higurashi.ai/melte/haru4b/) ([Japanese](https://blog.higurashi.ai/melte/haru4b-ja/)); not read for this evaluation  |

## Wire protocol

There are three ways in, and none of them carries anything but audio once the conversation runs.

**The demo server** (`haru/haru/server.py`, aiohttp, port 8998, CUDA only) is derived from Moshi's,
as PersonaPlex's is, but the session is set up over HTTP first:

- `POST /api/reference_audio` — the voice clip as the body (up to 50 MB) → `{id}`.
- `POST /api/session` — `{system_prompt, reference_audio_id, guidance_scale}` → `{id}`.
- WebSocket `GET /api/chat?session_id=…`, or WebRTC through `/api/webrtc/offer`.
- **Frames:** binary; the first byte is the type.

| Byte          | Direction       | Content                                                             |
| ------------- | --------------- | ------------------------------------------------------------------- |
| `0x00`        | server → client | Handshake, sent once the prompt has run                             |
| `0x01`        | both            | Ogg/Opus pages, 24 kHz mono                                         |
| `0x02`        | server → client | The model's text as it speaks it; errors arrive here as `[error] …` |
| `0x06`        | server → client | Ping, every 3 seconds                                               |
| anything else | client → server | Dropped: the server reads only `0x01`                               |

- The server closes a WebSocket that sends no microphone audio for 15 seconds.
- **Sessions:** `--max-sessions`, default 1; others wait for a slot.

**vLLM-Omni** (`haru_vllm/`, CUDA only) serves many conversations at
`ws://localhost:8000/v1/realtime?duplex=1` with OpenAI Realtime event names, but not their turn
model:

- `session.update` carries the card as `instructions` and the voice as `ref_audio` (a data URI).
- The client appends one 3200-sample frame (`pcm_f32le`) with `input_audio_buffer.append`; frame `k`
  is answered by one `response.output_audio.delta` (PCM16) for frame `k + 1`, plus a
  `response.output_audio_transcript.delta` when that frame has text.
- There is no `response.create`, no `response.done`, no conversation items and no tools.

**The Mac path** (`haru_mlx/haru_mlx/native.py`) is a Unix socket for the native macOS app, one
client at a time. A browser can't reach it; the web demo server has no MLX backend.

## Transport matrix

In the terms of the transport matrix in `CLAUDE.md`. Haru can do what PersonaPlex can, in more
languages and on more hardware; it is behind Grok and ElevenLabs on everything but turn-taking.

| Capability               | Haru                                                                     | PersonaPlex                      | Grok / ElevenLabs                |
| ------------------------ | ------------------------------------------------------------------------ | -------------------------------- | -------------------------------- |
| Key in the browser       | none; self-hosted, but needs a server proxy with the plugin-route guards | same                             | client secret                    |
| Tool calls               | **none**                                                                 | **none**                         | yes                              |
| Follow-up instructions   | **impossible**: the card is fixed when the session is created            | **impossible**: fixed in the URL | user message + `response.create` |
| Overlapping replies      | n/a: full-duplex, talks over the user by design                          | same                             | held until `response.done`       |
| Images to the model      | **none**                                                                 | **none**                         | none                             |
| Text shown as it streams | yes, frame by frame (`0x02`, or the transcript delta)                    | yes, token by token              | none                             |
| User's speech as text    | **none**: only the model's own words come back                           | **none**                         | Grok yes; ElevenLabs tagged      |
| Languages                | nine, Japanese included                                                  | English only                     | multilingual                     |
| Concurrent sessions      | 1 by default on the demo server; many with vLLM-Omni                     | one per server                   | per API key                      |
| Runs on a Mac            | yes, but only behind the native app's Unix socket                        | no                               | n/a (hosted)                     |

## Blockers

Tool calling decides it; the others would narrow a transport, not rule it out.

1. **No tool calling, and no assistant behaviour to build it on.** The model card: "a pretrained
   base model, released for research … not a reliable source of facts and does not follow
   instructions the way an assistant does". The prompt is a character card for a phone call between
   two people, not an instruction to an assistant, so even MulmoChat's role prompts would not be
   followed. Nothing in any of the three protocols carries a tool call or a tool result, and no issue
   asks for one yet (the repository has one issue, about packaging).
2. **No way to say anything to the model mid-session except by voice.** No follow-up instructions,
   no tool results, no typed message.
3. **Voice cloning.** The voice is whatever clip the client sends. Behind our server the voice would
   have to be one of a fixed set of clips we ship or the user installs, chosen by name against a
   whitelist as `VOICES.elevenlabs` is, not an upload route.
4. **No browser path on a Mac.** The WebSocket and WebRTC servers need CUDA. On Apple silicon we
   would have to write our own bridge from a WebSocket to `haru_mlx`'s `DuplexSession` (or to the
   native app's socket protocol).
5. **One day old.** The vLLM plugin "uses model-runner hooks of vLLM-Omni that may change between
   versions", and it is pinned to vLLM 0.32.0. Wire shapes may move.

## Where it could still be useful

- **A tool-free conversation role** (empty `availablePlugins`), such as conversation practice in any
  of the nine languages. Interruptions and backchannels would feel more natural than on any
  turn-based API, and unlike PersonaPlex it would work in Japanese. The character card is casual
  talk between two named people, which is what such a role wants.
- **A hybrid:** a separate text model calls the tools. As with PersonaPlex, the text stream carries
  only Haru's own speech, so the user's speech needs its own transcription (an ASR on the
  microphone), and the results can't be fed back into the voice model, so it would talk without
  knowing what is on the screen. Worth it only for a full-duplex demo.
- **Trying it by hand first.** The macOS app (`haru_mlx/swift/build_app.sh`) runs on the machines
  MulmoChat is developed on. Judging its Japanese conversation before any wiring costs an hour and
  tells us whether the model is worth waiting for.

## What would change the verdict

An instruction-following release that can call tools on the live stream and take each tool's result
back into the session: plugins such as `manageJingleScript` return text the model has to read.
Outbound calls alone are not enough. If both land, the wiring would be:

1. A client transport of its own. The demo server's binary protocol is not the OpenAI Realtime
   events. vLLM-Omni's endpoint uses those event names, but the client must push a frame every
   133 ms and gets a frame back for each, with no `response.create` / `response.done` cycle, so it
   is not a `RealtimeDialect` of `useRealtimeWebSocketSession` as it stands. Which of the two to
   target depends on what a tool-calling release speaks.
2. A new `SessionTransportKind` value; the compiler then lists the `Record<SessionTransportKind, …>`
   tables to fill (capabilities, `VOICE_MODELS_FOR_KIND`, `VOICE_PROVIDER_FOR_KIND`).
3. The `if` chains it doesn't list: `resolveStoredModelKind`, and in `Sidebar.vue` the option,
   `isVoiceMode`, the model select and `needsConnectionToSend`.
4. A server WebSocket proxy to the model host, guarded like `/api/start/elevenlabs`
   (`localClientOnly`, `requireTrustedOrigin`), which creates the session itself so the card and the
   voice clip never come from the browser unchecked.
5. On a Mac, the bridge to `haru_mlx` from blocker 4.
6. `sendImagesToModel` returning false, and follow-up instructions unsupported unless upstream adds a
   way to send text mid-session.
7. A new row in the `CLAUDE.md` transport matrix.
