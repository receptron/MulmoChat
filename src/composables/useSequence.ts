// Keeps a sequence going: a spoken slideshow (presentSlide) or a storyboard
// (defineStoryboard, then presentPanel). The model shows the steps one at a
// time and is told, with each, to talk about it and call the next one in the
// same reply. It sometimes ends the reply without doing that, so when a reply
// is over, nothing is playing or running and steps are left, the host asks it
// once to go on. From MulmoGlass (src/composables/useSequence.ts).
//
// A step that waits for the user (a how-to step they are doing, a story
// choice) is not asked about: the model goes on when the user says so.
//
// Asked once per step: a model that still doesn't go on has a reason (it is
// answering something else), and asking again would loop. The user speaking
// (or sending a message) ends the tracking: they may have said "stop", and if
// they said "go on", the next step starts it again. Speech can be noticed late
// (Gemini's transcript of it arrives seconds after), so the request itself
// also defers to the user.
import type { ToolResult } from "gui-chat-protocol/vue";
import {
  continueInstructions,
  noteUserSpoke,
  stepAfterUserSpokeInstructions,
  type SequenceStep,
} from "../tools/sequence";
import { isSequenceTool, sequenceStepOf } from "../tools/sequences";

interface UseSequenceOptions {
  /** No reply running, no audio playing, no tool running, user silent. */
  isIdle: () => boolean;
  /** Required instructions: the text transport takes a turn for them. */
  sendInstructions: (
    instructions: string,
    required: boolean,
  ) => boolean | Promise<boolean>;
}

// After a reply ends, how long to wait for the model to go on by itself.
const GRACE_MS = 2000;

export function useSequence(options: UseSequenceOptions) {
  let progress: { step: SequenceStep; asked: boolean } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  // When tracking last stopped. A step whose call started before that (the
  // user interrupted while its picture was being made) doesn't start it again.
  let stoppedAt = -Infinity;

  const cancelCheck = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  const stop = () => {
    progress = null;
    stoppedAt = performance.now();
    cancelCheck();
  };

  /** Every tool result; only the sequence tools' matter. Returns instructions
   *  that replace the result's, for a step asked for before the user spoke:
   *  its own say to go on, which Gemini and Grok did right after saying they
   *  had stopped. */
  const observeToolResult = (
    name: string,
    args: Record<string, unknown>,
    result: ToolResult,
    startedAt: number,
  ): string | undefined => {
    // A held or repeated step (see ../tools/sequence.ts) changes nothing.
    if (!isSequenceTool(name) || result.cancelled) return undefined;
    // null for a step that failed (no key, a refused prompt): it would fail
    // again, and it keeps its failure's instructions.
    const step = sequenceStepOf(name, args, result);
    if (startedAt <= stoppedAt) {
      return step ? stepAfterUserSpokeInstructions(step) : undefined;
    }
    if (!step || step.step >= step.total) {
      stop();
      return undefined;
    }
    // A check set before this step arrived would ask for the step its own
    // instructions are about to ask for.
    cancelCheck();
    progress = step.waitsForUser ? null : { step, asked: false };
    return undefined;
  };

  /** The model's reply or its audio ended: check whether it went on. */
  const replyEnded = () => {
    if (!progress || progress.asked) return;
    cancelCheck();
    timer = setTimeout(() => {
      timer = null;
      if (!progress || progress.asked || !options.isIdle()) return;
      progress.asked = true;
      console.info(`[sequence] asking to ${progress.step.nextCall}`);
      void options.sendInstructions(continueInstructions(progress.step), true);
    }, GRACE_MS);
  };

  /** The user started speaking or sent a message: they may have said "stop",
   *  or "next" to a step that waits for them. */
  const userSpoke = () => {
    noteUserSpoke();
    stop();
  };

  return { observeToolResult, replyEnded, stop, userSpoke };
}
