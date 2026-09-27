// The tools that show a sequence the host keeps going
// (src/composables/useSequence.ts), and where each result leaves it.
import type { ToolResult } from "gui-chat-protocol/vue";
import type { SequenceStep } from "./sequence";
import { slideSequenceStep } from "./presentSlide";
import { storyboardSequenceStep } from "./storyboard";
import {
  DEFINE_STORYBOARD,
  PRESENT_PANEL,
  PRESENT_SLIDE,
} from "../../server/plugins/sequenceTools";

const SEQUENCES: Readonly<
  Record<
    string,
    (args: Record<string, unknown>, result: ToolResult) => SequenceStep | null
  >
> = {
  [PRESENT_SLIDE]: slideSequenceStep,
  [DEFINE_STORYBOARD]: (_, result) =>
    storyboardSequenceStep(DEFINE_STORYBOARD, result),
  [PRESENT_PANEL]: (_, result) => storyboardSequenceStep(PRESENT_PANEL, result),
};

export const isSequenceTool = (name: string): boolean =>
  Object.prototype.hasOwnProperty.call(SEQUENCES, name);

/** Where the sequence is after this result: null when the tool's arguments
 *  were wrong or its picture wasn't made. */
export const sequenceStepOf = (
  name: string,
  args: Record<string, unknown>,
  result: ToolResult,
): SequenceStep | null =>
  isSequenceTool(name) ? SEQUENCES[name](args, result) : null;
