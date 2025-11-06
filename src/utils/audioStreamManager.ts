/* eslint-env browser */

import {
  encodeAudioToPCM16,
  decodePCM16ToFloat32,
  resampleAudio,
} from "./audioCodec";

/**
 * Manages audio capture from microphone and playback for Google Live API
 */
export class AudioStreamManager {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private playbackQueue: Float32Array[] = [];
  private isPlayingAudio = false;
  private playbackSourceNode: AudioBufferSourceNode | null = null;
  private nextPlaybackTime = 0;

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

    // Create script processor (buffer size 4096)
    // Note: ScriptProcessorNode is deprecated but AudioWorklet requires more setup
    this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.processorNode.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);

      // Resample if needed
      const resampled =
        sourceSampleRate !== targetSampleRate
          ? resampleAudio(inputData, sourceSampleRate, targetSampleRate)
          : inputData;

      // Encode to PCM16 and send via callback
      const pcm = encodeAudioToPCM16(resampled);
      onAudioChunk(pcm);
    };

    // Connect the nodes
    // We need to connect to destination for ScriptProcessorNode to work,
    // but we use a gain node set to 0 to prevent feedback
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 0; // Mute the passthrough audio

    this.sourceNode.connect(this.processorNode);
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

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = null;
    }
  }

  /**
   * Queue audio chunk for playback
   * @param pcmData - Base64-encoded PCM data from Google
   */
  queueAudio(pcmData: string): void {
    const float32 = decodePCM16ToFloat32(pcmData);
    this.playbackQueue.push(float32);
    console.log(`Queued audio: ${float32.length} samples, queue size: ${this.playbackQueue.length}, playing: ${this.isPlayingAudio}`);

    // Auto-start playback if not already playing
    if (!this.isPlayingAudio) {
      console.log("Starting audio playback");
      this.startPlayback();
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

    this.isPlayingAudio = true;
    this.nextPlaybackTime = this.audioContext.currentTime;

    this.playNextChunk(sampleRate);
  }

  /**
   * Play next chunk from the queue
   */
  private playNextChunk(sampleRate: number): void {
    if (!this.isPlayingAudio || !this.audioContext) {
      return;
    }

    if (this.playbackQueue.length === 0) {
      // No more audio in queue, check again in 100ms
      setTimeout(() => this.playNextChunk(sampleRate), 100);
      return;
    }

    const chunk = this.playbackQueue.shift();
    if (!chunk) {
      return;
    }

    // Create audio buffer
    const audioBuffer = this.audioContext.createBuffer(
      1, // mono
      chunk.length,
      sampleRate,
    );

    // Copy data to buffer
    audioBuffer.copyToChannel(chunk, 0);

    // Create source node
    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.audioContext.destination);

    // Schedule playback
    const now = this.audioContext.currentTime;
    const startTime = Math.max(now, this.nextPlaybackTime);
    source.start(startTime);

    // Update next playback time
    this.nextPlaybackTime = startTime + audioBuffer.duration;

    // Play next chunk when this one is scheduled to finish
    source.onended = () => {
      this.playNextChunk(sampleRate);
    };

    this.playbackSourceNode = source;
  }

  /**
   * Stop playback
   */
  stopPlayback(): void {
    this.isPlayingAudio = false;
    this.playbackQueue = [];

    if (this.playbackSourceNode) {
      try {
        this.playbackSourceNode.stop();
      } catch (e) {
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
