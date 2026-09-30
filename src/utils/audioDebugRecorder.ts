/* global AudioContext, AudioNode, AudioWorkletNode, document */

// A debug recording of Gemini Live's and Grok's audio (AudioStreamManager),
// for sounds that shouldn't be there, such as a buzz: turned on with
// localStorage "mulmochat_audio_debug" = "1" (then reload), it keeps the last
// KEEP_SECONDS of
//   - what the player renders (its output node, tapped on the audio thread),
//   - what the model sent (the PCM chunks, as received), and
//   - what happened: buffers scheduled, underruns (a buffer that started late),
//     main-thread stalls, playback starts and stops, the context's sample
//     rate, latency and state.
// saveAudioDebugRecording() downloads them as output.wav, received.wav and
// events.json. A sound in output.wav comes from the player or the model (then
// received.wav has it too); a sound in neither happened after the page, in
// the browser's or the system's audio output, and the events show what was
// going on at that time.
//
// OpenAI Realtime plays through WebRTC and an <audio> element, not this
// player, so it isn't recorded.

const FLAG = "mulmochat_audio_debug";
const KEEP_SECONDS = 60;
// The main thread is late by more than this: a stall.
const STALL_MS = 150;

/** Whether the debug recording is on (a localStorage flag). */
export function isAudioDebugEnabled(): boolean {
  try {
    return localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

interface DebugEvent {
  /** Date.now() */
  t: number;
  what: string;
  [key: string]: unknown;
}

interface OutputBlock {
  /** The context's frame at the block's start. */
  frame: number;
  samples: Float32Array;
  /** Date.now() at the block's start, worked out when it arrived, while the
   *  context's clock runs (it stops when the context is closed). */
  t?: number;
}

// Copies its input to the main thread in blocks, on the audio thread: the
// recording stays whole when the main thread stalls (the messages wait).
const TAP_PROCESSOR = `
class MulmoChatAudioTap extends AudioWorkletProcessor {
  constructor() {
    super();
    this.block = new Float32Array(4096);
    this.filled = 0;
    this.start = 0;
  }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    const frames = channel ? channel.length : 128;
    if (this.filled === 0) this.start = currentFrame;
    for (let i = 0; i < frames; i++) {
      this.block[this.filled++] = channel ? channel[i] : 0;
      if (this.filled === this.block.length) {
        this.port.postMessage({ frame: this.start, samples: this.block }, [this.block.buffer]);
        this.block = new Float32Array(4096);
        this.filled = 0;
        this.start = currentFrame + i + 1;
      }
    }
    return true;
  }
}
registerProcessor("mulmochat-audio-tap", MulmoChatAudioTap);
`;

class AudioDebugRecorder {
  private events: DebugEvent[] = [];
  // The contexts' descriptions and state changes, kept whole: a context is
  // made when the session starts, often more than KEEP_SECONDS earlier.
  private contexts: DebugEvent[] = [];
  private received: { t: number; pcm: Int16Array }[] = [];
  private output: OutputBlock[] = [];
  private outputContext: AudioContext | null = null;
  private tapNode: AudioWorkletNode | null = null;
  // Each context's tap: made when the context is (the session starts), so
  // it is ready before the first reply plays; `ready` once it exists.
  private readonly taps = new WeakMap<
    AudioContext,
    Promise<AudioWorkletNode | null>
  >();
  private readonly ready = new WeakMap<AudioContext, AudioWorkletNode>();
  private readonly watched = new WeakSet<AudioContext>();
  // The context watched last: the session's. A tap that finishes loading
  // after a newer context was watched is for an old session and is dropped.
  private latestContext: AudioContext | null = null;
  private lastTick = Date.now();

  constructor() {
    // A stall shows as a timer that fires late.
    setInterval(() => {
      const now = Date.now();
      const late = now - this.lastTick - 50;
      if (late > STALL_MS) this.event("main-thread stall", { ms: late });
      this.lastTick = now;
    }, 50);
  }

  event(what: string, detail: Record<string, unknown> = {}): void {
    this.events.push({ t: Date.now(), what, ...detail });
    const cutoff = Date.now() - KEEP_SECONDS * 1000;
    while (this.events.length && this.events[0].t < cutoff) this.events.shift();
  }

  /** The context's sample rate, latency and state, and its state changes. */
  watchContext(context: AudioContext, role: string): void {
    if (this.watched.has(context)) return;
    this.watched.add(context);
    const describe = () => ({
      role,
      sampleRate: context.sampleRate,
      baseLatency: context.baseLatency,
      outputLatency: context.outputLatency,
      state: context.state,
    });
    this.contexts.push({ t: Date.now(), what: "audio context", ...describe() });
    this.prepareTap(context);
    context.addEventListener("statechange", () =>
      this.contexts.push({
        t: Date.now(),
        what: "audio context state",
        ...describe(),
      }),
    );
  }

  /** A chunk of the model's audio, as received (16-bit PCM, base64). Never
   *  throws: the recording must not keep the chunk from being played. */
  received16(base64: string): void {
    let binary: string;
    try {
      binary = atob(base64);
    } catch (error) {
      this.event("received chunk not base64", { error: String(error) });
      return;
    }
    const bytes = new Uint8Array(binary.length - (binary.length % 2));
    for (let i = 0; i < bytes.length; i++) bytes[i] = binary.charCodeAt(i);
    this.received.push({ t: Date.now(), pcm: new Int16Array(bytes.buffer) });
    if (binary.length % 2) {
      this.event("odd chunk", { bytes: binary.length });
    }
    const cutoff = Date.now() - KEEP_SECONDS * 1000;
    while (this.received.length && this.received[0].t < cutoff) {
      this.received.shift();
    }
  }

  /** Loads the tap into `context` and makes it the recording's: a new
   *  context is a new session, whose frames count from zero, so the old tap
   *  is retired and blocks it had already queued are ignored. */
  private prepareTap(context: AudioContext): Promise<AudioWorkletNode | null> {
    let tap = this.taps.get(context);
    if (tap) return tap;
    this.latestContext = context;
    const url = URL.createObjectURL(
      new Blob([TAP_PROCESSOR], { type: "text/javascript" }),
    );
    tap = context.audioWorklet.addModule(url).then(
      () => {
        if (context.state === "closed" || this.latestContext !== context) {
          return null;
        }
        this.tapNode?.port.close();
        this.output = [];
        const tapNode = new AudioWorkletNode(context, "mulmochat-audio-tap");
        tapNode.port.onmessage = (message) => {
          if (this.tapNode !== tapNode) return;
          const block = message.data as OutputBlock;
          // The context's clock and Date.now(), read together: the block
          // started this long before now (however late the message came).
          const ago = context.currentTime - block.frame / context.sampleRate;
          this.pushOutput({ ...block, t: Date.now() - ago * 1000 });
        };
        // Pulled by the graph through a silent gain.
        const silent = context.createGain();
        silent.gain.value = 0;
        tapNode.connect(silent).connect(context.destination);
        this.tapNode = tapNode;
        this.outputContext = context;
        this.ready.set(context, tapNode);
        return tapNode;
      },
      (error: unknown) => {
        this.event("tap failed", { error: String(error) });
        return null;
      },
    );
    this.taps.set(context, tap);
    return tap;
  }

  /** Records what `node` (the player's output) renders, from now on when
   *  the tap is ready (the usual case: it is made with the context). If it
   *  isn't, the audio until it is goes unrecorded, and an event says how
   *  long. A node the player dropped meanwhile (`isCurrent()` false) isn't
   *  connected: it would record what nobody hears. */
  tapOutput(
    context: AudioContext,
    node: AudioNode,
    isCurrent: () => boolean,
  ): void {
    this.watchContext(context, "playback");
    const tap = this.ready.get(context);
    if (tap && this.tapNode === tap) {
      node.connect(tap);
      return;
    }
    const asked = Date.now();
    void this.prepareTap(context).then((late) => {
      if (!late || this.tapNode !== late || !isCurrent()) return;
      node.connect(late);
      this.event("output recorded late", { ms: Date.now() - asked });
    });
  }

  private pushOutput(block: OutputBlock): void {
    this.output.push(block);
    const rate = this.outputContext?.sampleRate ?? 48000;
    const keep = KEEP_SECONDS * rate;
    let total = this.output.reduce((n, b) => n + b.samples.length, 0);
    while (this.output.length && total - this.output[0].samples.length > keep) {
      total -= this.output.shift()!.samples.length;
    }
  }

  /** Downloads output.wav, received.wav and events.json. */
  save(): void {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const context = this.outputContext;
    const outputRate = context?.sampleRate ?? 48000;
    // The output's blocks, in order, with the frames between them (none
    // expected) filled with silence so times stay true.
    const first = this.output[0]?.frame ?? 0;
    const last = this.output[this.output.length - 1];
    const length = last ? last.frame + last.samples.length - first : 0;
    const rendered = new Float32Array(Math.max(0, length));
    for (const block of this.output) {
      const at = block.frame - first;
      if (at >= 0 && at + block.samples.length <= rendered.length) {
        rendered.set(block.samples, at);
      }
    }
    const receivedLength = this.received.reduce((n, c) => n + c.pcm.length, 0);
    const received = new Int16Array(receivedLength);
    let offset = 0;
    const receivedChunks = this.received.map((chunk) => {
      received.set(chunk.pcm, offset);
      const entry = { t: chunk.t, offset, samples: chunk.pcm.length };
      offset += chunk.pcm.length;
      return entry;
    });
    const outputStart = this.output[0]?.t ?? null;
    const report = {
      savedAt: Date.now(),
      userAgent: navigator.userAgent,
      output: {
        sampleRate: outputRate,
        seconds: length / outputRate,
        // Date.now() at output.wav's first sample (approximate: the
        // context's clock and Date.now() drift apart a little).
        startedAt: outputStart,
        contextTime: context?.currentTime,
        baseLatency: context?.baseLatency,
        outputLatency: context?.outputLatency,
      },
      received: { sampleRate: 24000, chunks: receivedChunks },
      contexts: this.contexts,
      events: this.events,
    };
    download(
      `mulmochat-audio-${stamp}-output.wav`,
      wav(floatTo16(rendered), outputRate),
    );
    download(`mulmochat-audio-${stamp}-received.wav`, wav(received, 24000));
    download(
      `mulmochat-audio-${stamp}-events.json`,
      new Blob([JSON.stringify(report, null, 1)], { type: "application/json" }),
    );
    this.event("saved");
  }
}

function floatTo16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/** A mono 16-bit WAV file. */
function wav(samples: Int16Array, sampleRate: number): Blob {
  const header = new DataView(new ArrayBuffer(44));
  const text = (at: number, s: string) =>
    [...s].forEach((c, i) => header.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF");
  header.setUint32(4, 36 + samples.byteLength, true);
  text(8, "WAVE");
  text(12, "fmt ");
  header.setUint32(16, 16, true);
  header.setUint16(20, 1, true); // PCM
  header.setUint16(22, 1, true); // mono
  header.setUint32(24, sampleRate, true);
  header.setUint32(28, sampleRate * 2, true);
  header.setUint16(32, 2, true);
  header.setUint16(34, 16, true);
  text(36, "data");
  header.setUint32(40, samples.byteLength, true);
  return new Blob([header.buffer, samples.buffer as ArrayBuffer], {
    type: "audio/wav",
  });
}

function download(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** The recorder, or null when the debug recording is off. */
export const audioDebug: AudioDebugRecorder | null = isAudioDebugEnabled()
  ? new AudioDebugRecorder()
  : null;

/** Saves the recording (a no-op when it is off). */
export function saveAudioDebugRecording(): void {
  audioDebug?.save();
}
