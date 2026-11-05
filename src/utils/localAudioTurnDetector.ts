import { decodePCM16ToFloat32 } from "./audioCodec";

/** Endpoint PCM16 microphone turns locally. Keep a short lead-in so a word's
 * opening consonant is included. Silence is never sent outside a turn. */
export function createLocalAudioTurnDetector(sampleRate: number) {
  let speaking = false;
  let silenceMs = 0;
  let durationMs = 0;
  let pending: { chunk: string; ms: number }[] = [];
  const reset = () => {
    speaking = false;
    silenceMs = 0;
    durationMs = 0;
    pending = [];
  };
  return {
    reset,
    isSpeaking: () => speaking,
    push(chunk: string) {
      const samples = decodePCM16ToFloat32(chunk);
      const ms = (samples.length / sampleRate) * 1000;
      const rms = Math.sqrt(
        samples.reduce((sum, sample) => sum + sample * sample, 0) /
          Math.max(samples.length, 1),
      );
      const voiced = rms >= 0.015;
      const started = !speaking && voiced;
      let chunks: string[] = [];
      if (!speaking) {
        pending.push({ chunk, ms });
        // Retain at least the latest chunk, even with a large capture buffer.
        while (
          pending.length > 1 &&
          pending.reduce((sum, p) => sum + p.ms, 0) > 300
        ) {
          pending.shift();
        }
        if (started) {
          speaking = true;
          chunks = pending.map((p) => p.chunk);
          pending = [];
        }
      } else {
        chunks = [chunk];
      }
      if (speaking) {
        durationMs += ms;
        silenceMs = voiced ? 0 : silenceMs + ms;
      }
      // Bound turns so an open microphone cannot fill the context indefinitely.
      const ended = speaking && (silenceMs >= 700 || durationMs >= 30000);
      if (ended) reset();
      return { chunks, started, ended };
    },
  };
}
