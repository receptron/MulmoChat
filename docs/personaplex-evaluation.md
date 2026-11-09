# PersonaPlex: evaluation as a MulmoChat voice transport

As of 2026-11-09. Sources were read, the model was not run (it needs a CUDA GPU).

## Summary

Don't add [PersonaPlex](https://github.com/NVIDIA/personaplex) as a MulmoChat transport yet: it can't
call tools, and the ~30 tool plugins are most of what MulmoChat does. Its full-duplex turn-taking is
better than any transport we have, so it would fit only a tool-free English conversation role, for
someone with a CUDA GPU to host it. Look again once upstream ships tool calling
([#93](https://github.com/NVIDIA/personaplex/issues/93)).

## What it is

A 7B full-duplex speech-to-speech model from NVIDIA, fine-tuned from Kyutai's
[Moshi](https://arxiv.org/abs/2410.00037). It listens and speaks at the same time.

| Attribute       | Value                                                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Persona control | Text role prompt plus a voice embedding, both fixed when the session connects                                                            |
| Voices          | 18 bundled: NATF0–3, NATM0–3 (natural), VARF0–4, VARM0–4 (variety)                                                                       |
| Context         | 2048 frames at 12.5 per second. The system prompt stays pinned; conversation memory is a sliding window of about 2.5 minutes             |
| License         | Code MIT; weights [NVIDIA Open Model License](https://huggingface.co/nvidia/personaplex-7b-v1), accepted on Hugging Face before download |
| Hardware        | Self-hosted, PyTorch on a CUDA GPU; `--cpu-offload` for small GPUs. No Apple Silicon or MLX path in the repo                             |
| Paper           | [arXiv 2602.06053](https://arxiv.org/abs/2602.06053)                                                                                     |

## Wire protocol

The client can send only audio; everything else is fixed in the connect URL
(`moshi/moshi/server.py`).

- **Connect:** WebSocket `GET /api/chat?text_prompt=…&voice_prompt=NATF2.pt&seed=…` (aiohttp, port
  8998 by default).
- **Frames:** binary; the first byte is the type.

| Byte          | Direction       | Content                                          |
| ------------- | --------------- | ------------------------------------------------ |
| `0x00`        | server → client | Handshake, sent once the system prompt is loaded |
| `0x01`        | both            | Opus audio                                       |
| `0x02`        | server → client | One text token (UTF-8) as the model speaks it    |
| anything else | client → server | Logged as "unknown message kind" and dropped     |

- **One session at a time:** the whole session runs inside `async with self.lock`, so a second
  connection waits until the first closes.

## Transport matrix

In the terms of the transport matrix in `CLAUDE.md`, PersonaPlex can do less than Grok or
ElevenLabs, our most limited voice transports. It is ahead only on turn-taking.

| Capability               | PersonaPlex                                                              | Grok / ElevenLabs                | OpenAI Realtime                    |
| ------------------------ | ------------------------------------------------------------------------ | -------------------------------- | ---------------------------------- |
| Key in the browser       | none; self-hosted, but needs a server proxy with the plugin-route guards | client secret                    | ephemeral key from `/api/start`    |
| Tool calls               | **none**                                                                 | yes                              | yes                                |
| Follow-up instructions   | **impossible**: the prompt is fixed in the URL                           | user message + `response.create` | system message + `response.create` |
| Overlapping replies      | n/a: full-duplex, talks over the user by design                          | held until `response.done`       | held until `response.done`         |
| Images to the model      | **none**                                                                 | none                             | `input_image`                      |
| Text shown as it streams | yes, token by token (`0x02`)                                             | none                             | `response.text.delta` only         |
| Languages                | English only                                                             | multilingual                     | multilingual                       |
| Concurrent sessions      | one per server                                                           | per API key                      | per API key                        |

## Blockers

Tool calling decides it; the other three would narrow a transport, not rule it out.

1. **No tool calling.** Issues [#93](https://github.com/NVIDIA/personaplex/issues/93) and
   [#66](https://github.com/NVIDIA/personaplex/issues/66) ask for it; the only replies are other users
   saying "currently no", and NVIDIA hasn't responded. Without it no plugin can run.
2. **English only.** Trained on the Fisher English corpus plus synthetic English dialogues.
3. **Narrow training.** A fixed "teacher" assistant, customer-service roles and casual talk.
   [#97](https://github.com/NVIDIA/personaplex/issues/97) reports it can't keep its role apart from the
   user's; [#16](https://github.com/NVIDIA/personaplex/issues/16) reports slow responses and
   hallucination.
4. **Path traversal.** `voice_prompt` is joined to a directory unchecked; open
   [PR #101](https://github.com/NVIDIA/personaplex/pull/101) fixes it. Behind our server the voice name
   would need a whitelist, as `VOICES.elevenlabs` does.

## Where it could still be useful

- **A tool-free conversation role**, such as English conversation practice (empty `availablePlugins`).
  Its interruptions and backchannels would feel more natural than any turn-based API.
- **A hybrid:** a separate text model reads the `0x02` transcript and calls tools. The results can't
  be fed back into the voice model, so it would talk without knowing what is on the screen. Worth it
  only for a full-duplex demo.

## What would change the verdict

Native tool calling on the live `/api/chat` stream. If it lands, the wiring would be:

1. A new `SessionTransportKind` value; the compiler then lists the `Record<SessionTransportKind, …>`
   tables to fill (capabilities, `VOICE_MODELS_FOR_KIND`, `VOICE_PROVIDER_FOR_KIND`).
2. The `if` chains it doesn't list: `resolveStoredModelKind`, and in `Sidebar.vue` the option,
   `isVoiceMode`, the model select and `needsConnectionToSend`.
3. A server WebSocket proxy to the GPU host, guarded like `/api/start/elevenlabs`
   (`localClientOnly`, `requireTrustedOrigin`), with the voice name checked against a whitelist.
4. `sendImagesToModel` returning false, and follow-up instructions unsupported unless upstream adds a
   way to send text mid-session.
5. A new row in the `CLAUDE.md` transport matrix.
