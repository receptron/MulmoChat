// A streaming resampler for the model's audio (24 kHz) to the context's rate,
// so the player hands Chrome buffers at the context's own rate and Chrome
// doesn't resample them. A buzz recorded with the audio debug recorder (a
// 128-sample block, one render quantum, repeating for 1.4 s on top of intact
// speech) was in what the graph rendered, not in the audio the model sent or
// the player queued; Chrome's resampling of 24 kHz buffers is the suspect.
//
// Windowed sinc (Blackman), cut off below the lower rate's Nyquist. It keeps
// the input's last samples between calls, so buffers join without a seam,
// and holds back HALF_WIDTH input samples (0.7 ms at 24 kHz) until the next
// call or flush().

const HALF_WIDTH = 16;

export class StreamResampler {
  private readonly step: number;
  private readonly cutoff: number;
  // Input not yet fully used: the last samples, for the filter's left side
  // and the next outputs.
  private pending: Float32Array;
  // The next output's position in `pending`, in input samples.
  private position = HALF_WIDTH;
  // The filter's weights for each fractional position (24 kHz to 48 kHz has
  // two; 24 kHz to 44.1 kHz, 147).
  private readonly weights = new Map<number, Float32Array>();

  constructor(
    readonly inputRate: number,
    readonly outputRate: number,
  ) {
    this.step = inputRate / outputRate;
    this.cutoff = Math.min(1, outputRate / inputRate) * 0.95;
    this.pending = new Float32Array(HALF_WIDTH);
  }

  /** The output for `input`, continuing from the previous call. */
  process(input: Float32Array): Float32Array {
    if (this.inputRate === this.outputRate) return input;
    const all = new Float32Array(this.pending.length + input.length);
    all.set(this.pending);
    all.set(input, this.pending.length);
    const out = this.render(all, all.length - HALF_WIDTH);
    this.keep(all);
    return out;
  }

  /** The held-back output, with silence after the input: at the end of a
   *  reply. The next process() starts afresh. */
  flush(): Float32Array {
    if (this.inputRate === this.outputRate) return new Float32Array(0);
    const all = new Float32Array(this.pending.length + HALF_WIDTH);
    all.set(this.pending);
    const out = this.render(all, this.pending.length);
    this.reset();
    return out;
  }

  reset(): void {
    this.pending = new Float32Array(HALF_WIDTH);
    this.position = HALF_WIDTH;
  }

  // Outputs for positions before `end`, each from the HALF_WIDTH input
  // samples on either side.
  private render(all: Float32Array, end: number): Float32Array {
    const count = Math.max(0, Math.ceil((end - this.position) / this.step));
    const out = new Float32Array(count);
    for (let k = 0; k < count; k++) {
      const x = this.position + k * this.step;
      const center = Math.floor(x);
      const w = this.weightsFor(x - center);
      const first = center - HALF_WIDTH + 1;
      let sum = 0;
      for (let j = 0; j < w.length; j++) sum += (all[first + j] ?? 0) * w[j];
      out[k] = sum;
    }
    this.position += count * this.step;
    return out;
  }

  private weightsFor(fraction: number): Float32Array {
    const key = Math.round(fraction * 1e6);
    let w = this.weights.get(key);
    if (!w) {
      w = new Float32Array(2 * HALF_WIDTH);
      for (let j = 0; j < w.length; j++) {
        w[j] = this.kernel(key / 1e6 + HALF_WIDTH - 1 - j);
      }
      this.weights.set(key, w);
    }
    return w;
  }

  private kernel(d: number): number {
    const t = d * this.cutoff;
    const sinc = t === 0 ? 1 : Math.sin(Math.PI * t) / (Math.PI * t);
    const w = (d + HALF_WIDTH) / (2 * HALF_WIDTH);
    if (w <= 0 || w >= 1) return 0;
    const blackman =
      0.42 - 0.5 * Math.cos(2 * Math.PI * w) + 0.08 * Math.cos(4 * Math.PI * w);
    return this.cutoff * sinc * blackman;
  }

  // Keeps what the next call needs: HALF_WIDTH samples before the next
  // position, and everything after it.
  private keep(all: Float32Array): void {
    const from = Math.max(0, Math.floor(this.position) - HALF_WIDTH);
    this.pending = all.slice(from);
    this.position -= from;
  }
}
