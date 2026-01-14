/**
 * Audio codec utilities for Google Live API
 * Handles conversion between Float32Array (Web Audio API) and 16-bit PCM (Google format)
 */

/**
 * Convert Float32Array audio data to 16-bit PCM base64 string
 * @param float32Data - Audio data from Web Audio API (-1.0 to 1.0)
 * @returns Base64-encoded 16-bit PCM data
 */
export function encodeAudioToPCM16(float32Data: Float32Array): string {
  const pcm16 = new Int16Array(float32Data.length);

  for (let i = 0; i < float32Data.length; i++) {
    // Clamp to -1.0 to 1.0 range
    const clamped = Math.max(-1, Math.min(1, float32Data[i]));
    // Convert to 16-bit signed integer (-32768 to 32767)
    pcm16[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }

  // Convert Int16Array to Uint8Array for base64 encoding
  const uint8 = new Uint8Array(pcm16.buffer);

  // Convert to base64
  let binary = "";
  const len = uint8.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8[i]);
  }

  return globalThis.btoa(binary);
}

/**
 * Convert base64-encoded 16-bit PCM to Float32Array
 * @param base64PCM - Base64-encoded PCM data from Google
 * @returns Float32Array audio data for Web Audio API
 */
export function decodePCM16ToFloat32(base64PCM: string): Float32Array {
  // Decode base64 to binary string
  const binary = globalThis.atob(base64PCM);

  // Convert binary string to Uint8Array
  const uint8 = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    uint8[i] = binary.charCodeAt(i);
  }

  // Interpret as Int16Array
  const pcm16 = new Int16Array(uint8.buffer);

  // Convert to Float32Array
  const float32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    // Convert from 16-bit signed integer to -1.0 to 1.0 range
    float32[i] = pcm16[i] < 0 ? pcm16[i] / 0x8000 : pcm16[i] / 0x7fff;
  }

  return float32;
}

/**
 * Resample audio from one sample rate to another using high-quality browser resampling
 * @param audioData - Input audio data
 * @param sourceSampleRate - Source sample rate in Hz
 * @param targetSampleRate - Target sample rate in Hz
 * @returns Resampled audio data (Promise for async processing)
 */
export async function resampleAudio(
  audioData: Float32Array,
  sourceSampleRate: number,
  targetSampleRate: number,
): Promise<Float32Array> {
  if (sourceSampleRate === targetSampleRate) {
    return audioData;
  }

  // Use OfflineAudioContext for high-quality browser-based resampling
  const offlineContext = new globalThis.OfflineAudioContext(
    1, // mono
    Math.ceil((audioData.length * targetSampleRate) / sourceSampleRate),
    targetSampleRate,
  );

  // Create a buffer with source data
  const sourceBuffer = offlineContext.createBuffer(
    1,
    audioData.length,
    sourceSampleRate,
  );
  sourceBuffer.copyToChannel(audioData as Float32Array<ArrayBuffer>, 0);

  // Create source node and connect to destination
  const source = offlineContext.createBufferSource();
  source.buffer = sourceBuffer;
  source.connect(offlineContext.destination);
  source.start(0);

  // Render the resampled audio
  const renderedBuffer = await offlineContext.startRendering();
  return renderedBuffer.getChannelData(0);
}

/**
 * Synchronous fallback resampling using cubic interpolation (better quality than linear)
 * @param audioData - Input audio data
 * @param sourceSampleRate - Source sample rate in Hz
 * @param targetSampleRate - Target sample rate in Hz
 * @returns Resampled audio data
 */
export function resampleAudioSync(
  audioData: Float32Array,
  sourceSampleRate: number,
  targetSampleRate: number,
): Float32Array {
  if (sourceSampleRate === targetSampleRate) {
    return audioData;
  }

  const ratio = sourceSampleRate / targetSampleRate;
  const targetLength = Math.floor(audioData.length / ratio);
  const resampled = new Float32Array(targetLength);

  // Helper function for cubic interpolation
  const cubicInterpolate = (
    p0: number,
    p1: number,
    p2: number,
    p3: number,
    t: number,
  ) => {
    const a0 = p3 - p2 - p0 + p1;
    const a1 = p0 - p1 - a0;
    const a2 = p2 - p0;
    const a3 = p1;
    return a0 * t * t * t + a1 * t * t + a2 * t + a3;
  };

  for (let i = 0; i < targetLength; i++) {
    const sourceIndex = i * ratio;
    const index = Math.floor(sourceIndex);
    const fraction = sourceIndex - index;

    // Get 4 neighboring samples for cubic interpolation
    const p0 = audioData[Math.max(0, index - 1)];
    const p1 = audioData[index];
    const p2 = audioData[Math.min(audioData.length - 1, index + 1)];
    const p3 = audioData[Math.min(audioData.length - 1, index + 2)];

    resampled[i] = cubicInterpolate(p0, p1, p2, p3, fraction);
  }

  return resampled;
}
