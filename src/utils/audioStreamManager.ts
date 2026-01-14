/* global AudioContext, MediaStreamAudioSourceNode, ScriptProcessorNode, BiquadFilterNode, AudioBufferSourceNode, GainNode, MediaStream */

import {
  encodeAudioToPCM16,
  decodePCM16ToFloat32,
  resampleAudioSync,
} from "./audioCodec";

/**
 * Manages audio capture from microphone and playback for Google Live API
 */
export class AudioStreamManager {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private playbackQueue: Float32Array[] = [];
  private isPlayingAudio = false;
  private playbackSourceNode: AudioBufferSourceNode | null = null;
  private nextPlaybackTime = 0;
  private playbackGainNode: GainNode | null = null;
  private scheduledBuffersCount = 0;

  /**
   * Start capturing audio from microphone
   * @param stream - MediaStream from getUserMedia
   * @param onAudioChunk - Callback for each audio chunk (base64 PCM)
   * @param targetSampleRate - Target sample rate for encoding (default 16000 for Google)
   */
  startCapture(
    stream: MediaStream,
    onAudioChunk: (pcm: string) => void,
    targetSampleRate = 16000,
  ): void {
    if (this.audioContext) {
      console.warn("Audio capture already started");
      return;
    }

    // Create audio context
    this.audioContext = new globalThis.AudioContext();
    const sourceSampleRate = this.audioContext.sampleRate;

    // Create source from microphone stream
    this.sourceNode = this.audioContext.createMediaStreamSource(stream);

    // Create low-pass filter to reduce noise and prevent aliasing
    // Set cutoff frequency just below Nyquist frequency of target sample rate
    this.filterNode = this.audioContext.createBiquadFilter();
    this.filterNode.type = "lowpass";
    this.filterNode.frequency.value = targetSampleRate / 2 - 1000; // ~7kHz for 16kHz output
    this.filterNode.Q.value = 0.7; // Moderate resonance

    // Create script processor (buffer size 4096)
    // Note: ScriptProcessorNode is deprecated but AudioWorklet requires more setup
    this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processorNode.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);

      // Resample if needed using synchronous cubic interpolation (better quality than linear)
      const resampled =
        sourceSampleRate !== targetSampleRate
          ? resampleAudioSync(inputData, sourceSampleRate, targetSampleRate)
          : inputData;

      // Encode to PCM16 and send via callback
      const pcm = encodeAudioToPCM16(resampled);
      onAudioChunk(pcm);
    };

    // Connect the nodes: source -> filter -> processor -> gain (muted) -> destination
    // We need to connect to destination for ScriptProcessorNode to work,
    // but we use a gain node set to 0 to prevent feedback
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 0; // Mute the passthrough audio

    this.sourceNode.connect(this.filterNode);
    this.filterNode.connect(this.processorNode);
    this.processorNode.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
  }

  /**
   * Stop capturing audio
   */
  stopCapture(): void {
    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode = null;
    }

    if (this.filterNode) {
      this.filterNode.disconnect();
      this.filterNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {
        // Ignore close errors
      });
      this.audioContext = null;
    }
  }

  /**
   * Queue audio chunk for playback
   * @param pcmData - Base64-encoded PCM data from Google
   */
  queueAudio(pcmData: string): void {
    if (!pcmData || pcmData.length === 0) {
      return;
    }

    try {
      const float32 = decodePCM16ToFloat32(pcmData);
      if (float32.length > 0) {
        this.playbackQueue.push(float32);

        // Auto-start playback if not already playing
        if (!this.isPlayingAudio) {
          this.startPlayback();
        }
      }
    } catch (error) {
      console.error("Failed to decode audio data:", error);
    }
  }

  /**
   * Start playing queued audio
   * @param sampleRate - Sample rate of incoming audio (default 24000 for Google)
   */
  startPlayback(sampleRate = 24000): void {
    if (this.isPlayingAudio) {
      return;
    }

    if (!this.audioContext) {
      this.audioContext = new globalThis.AudioContext();
    }

    // Create gain node for smooth volume control
    if (!this.playbackGainNode) {
      this.playbackGainNode = this.audioContext.createGain();
      this.playbackGainNode.gain.value = 1.0;
      this.playbackGainNode.connect(this.audioContext.destination);
    }

    this.isPlayingAudio = true;
    this.nextPlaybackTime = this.audioContext.currentTime;
    this.scheduledBuffersCount = 0;

    this.playNextChunk(sampleRate);
  }

  /**
   * Merge multiple small chunks into larger buffer to reduce discontinuities
   */
  private mergeChunks(maxChunks = 5): Float32Array | null {
    if (this.playbackQueue.length === 0) {
      return null;
    }

    // Collect chunks to merge (up to maxChunks or all available)
    const chunksToMerge: Float32Array[] = [];
    let totalLength = 0;

    for (let i = 0; i < Math.min(maxChunks, this.playbackQueue.length); i++) {
      const chunk = this.playbackQueue[i];
      if (chunk && chunk.length > 0) {
        chunksToMerge.push(chunk);
        totalLength += chunk.length;
      }
    }

    if (chunksToMerge.length === 0) {
      return null;
    }

    // Remove the chunks we're merging from the queue
    this.playbackQueue.splice(0, chunksToMerge.length);

    // Merge into a single buffer
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunksToMerge) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    return merged;
  }

  /**
   * Play next chunk from the queue with smooth transitions
   */
  private playNextChunk(sampleRate: number): void {
    if (!this.isPlayingAudio || !this.audioContext || !this.playbackGainNode) {
      return;
    }

    const now = this.audioContext.currentTime;

    // Keep scheduling chunks while we have data and haven't scheduled too far ahead
    while (this.playbackQueue.length > 0 && this.scheduledBuffersCount < 3) {
      // Merge multiple small chunks into one larger buffer to reduce clicks
      const mergedChunk = this.mergeChunks(5);
      if (!mergedChunk || mergedChunk.length === 0) {
        continue;
      }

      // Create audio buffer
      const audioBuffer = this.audioContext.createBuffer(
        1, // mono
        mergedChunk.length,
        sampleRate,
      );

      // Copy data to buffer
      audioBuffer.copyToChannel(mergedChunk as Float32Array<ArrayBuffer>, 0);

      // Create source node
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;

      // Connect through gain node for smooth volume control
      source.connect(this.playbackGainNode);

      // Calculate start time - ensure continuous playback
      const startTime = Math.max(now, this.nextPlaybackTime);

      try {
        source.start(startTime);
        this.scheduledBuffersCount++;

        // Update next playback time to prevent gaps
        this.nextPlaybackTime = startTime + audioBuffer.duration;

        // Decrement counter when buffer finishes
        source.onended = () => {
          this.scheduledBuffersCount--;
        };
      } catch (error) {
        console.error("Failed to schedule audio buffer:", error);
      }
    }

    // Continue checking for more chunks
    if (this.playbackQueue.length > 0 || this.scheduledBuffersCount > 0) {
      // Check again after a short delay
      setTimeout(() => this.playNextChunk(sampleRate), 10);
    }
  }

  /**
   * Stop playback
   */
  stopPlayback(): void {
    this.isPlayingAudio = false;
    this.playbackQueue = [];
    this.scheduledBuffersCount = 0;

    if (this.playbackGainNode) {
      this.playbackGainNode.disconnect();
      this.playbackGainNode = null;
    }

    if (this.playbackSourceNode) {
      try {
        this.playbackSourceNode.stop();
      } catch {
        // Ignore errors if already stopped
      }
      this.playbackSourceNode = null;
    }
  }

  /**
   * Clean up all resources
   */
  destroy(): void {
    this.stopCapture();
    this.stopPlayback();
    this.playbackQueue = [];
  }
}
