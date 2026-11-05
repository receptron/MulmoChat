import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createLocalAudioTurnDetector } from "../src/utils/localAudioTurnDetector";
import { encodeAudioToPCM16 } from "../src/utils/audioCodec";

// 100 ms chunks at the local model's 16 kHz input rate.
const silence = encodeAudioToPCM16(new Float32Array(1600));
const speech = encodeAudioToPCM16(new Float32Array(1600).fill(0.1));

describe("local audio turn detection", () => {
  it("gates idle silence, retains a lead-in, and ends after a pause", () => {
    const detector = createLocalAudioTurnDetector(16000);
    for (let i = 0; i < 100; i++) {
      assert.deepEqual(detector.push(silence), {
        chunks: [],
        started: false,
        ended: false,
      });
    }
    assert.equal(detector.isSpeaking(), false);
    const start = detector.push(speech);
    assert.equal(detector.isSpeaking(), true);
    assert.equal(start.started, true);
    assert.deepEqual(start.chunks, [silence, silence, speech]);
    for (let i = 0; i < 6; i++) {
      assert.deepEqual(detector.push(silence), {
        chunks: [silence],
        started: false,
        ended: false,
      });
    }
    assert.deepEqual(detector.push(silence), {
      chunks: [silence],
      started: false,
      ended: true,
    });
    assert.equal(detector.isSpeaking(), false);
    assert.deepEqual(detector.push(silence).chunks, []);
    assert.equal(detector.push(speech).started, true);
  });

  it("drops an unfinished turn and its lead-in when reset", () => {
    const detector = createLocalAudioTurnDetector(16000);
    detector.push(speech);
    detector.reset();
    assert.equal(detector.isSpeaking(), false);
    assert.deepEqual(detector.push(silence).chunks, []);
    assert.equal(detector.push(speech).started, true);
  });

  it("bounds uninterrupted speech to 30 seconds", () => {
    const detector = createLocalAudioTurnDetector(16000);
    for (let i = 0; i < 299; i++) {
      assert.equal(detector.push(speech).ended, false);
    }
    assert.equal(detector.push(speech).ended, true);
    assert.equal(detector.push(speech).started, true);
  });
});
