// The order of what a gpt-live-1 session's backend (a Responses model) is
// sent: tool results, images, messages, and the response.create that makes
// it go on. Kept apart from the WebRTC session so the rules are testable.
//
// The rules, from OpenAI's delegation guide and the API's own errors:
// - a response.create is refused (tool_outputs_required) until every
//   function call of the backend's last response has its output;
// - an accepted one must not be sent again;
// - items alone don't make the backend go on.
// So a request to go on is held until no response runs (only then are all
// of its calls known) and no call waits for its output, and then sent once,
// with everything held in front of it.

type LiveClientEvent = Record<string, unknown>;

const CONTINUE_ID_PREFIX = "mulmochat_continue_";

/** Errors that mean "not yet": an output was still missing. */
const OUTPUTS_REQUIRED = new Set([
  "tool_outputs_required",
  "function_call_outputs_required",
]);

const message = (role: "user" | "developer", content: unknown[]) => ({
  type: "response.item.create",
  item: { type: "message", role, content },
});

export function createLiveBackendWork(
  send: (event: LiveClientEvent) => boolean,
) {
  /** Calls the backend made whose outputs it doesn't have yet. */
  const waitingCalls = new Set<string>();
  /** Every call seen, so one announced twice runs once. */
  const seenCalls = new Set<string>();
  /** Sent in front of the next response.create. */
  let heldItems: LiveClientEvent[] = [];
  let heldInstructions: string[] = [];
  let wanted = false;
  let running = false;
  /** The event_id of our response.create that no response has answered. */
  let requested: string | null = null;
  let requestCount = 0;

  const flush = () => {
    if (!wanted || running || requested || waitingCalls.size > 0) return;
    const items = heldItems;
    const instructions = heldInstructions;
    heldItems = [];
    heldInstructions = [];
    wanted = false;
    items.forEach(send);
    if (instructions.length > 0) {
      send(
        message("developer", [
          { type: "input_text", text: instructions.join("\n\n") },
        ]),
      );
    }
    requestCount += 1;
    const eventId = `${CONTINUE_ID_PREFIX}${requestCount}`;
    // A closed channel (a tool finishing after Stop) leaves nothing pending.
    if (send({ type: "response.create", event_id: eventId })) {
      requested = eventId;
    }
  };

  return {
    /** A function call of the backend. False when it was seen before. */
    toolCalled(callId: string): boolean {
      if (seenCalls.has(callId)) return false;
      seenCalls.add(callId);
      waitingCalls.add(callId);
      return true;
    },

    toolOutput(callId: string, output: string): boolean {
      const sent = send({
        type: "response.item.create",
        item: { type: "function_call_output", call_id: callId, output },
      });
      waitingCalls.delete(callId);
      flush();
      return sent;
    },

    /** Images for the backend (it sees them; the voice model doesn't). They
     *  go with the next request to go on, after the tool outputs. */
    showImages(images: string[], caption: string) {
      heldItems.push(
        message("user", [
          { type: "input_text", text: caption },
          ...images.map((url) => ({ type: "input_image", image_url: url })),
        ]),
      );
    },

    /** Something the user typed: the backend answers it. */
    userMessage(text: string) {
      heldItems.push(message("user", [{ type: "input_text", text }]));
      wanted = true;
      flush();
    },

    /** Ask the backend to go on, following `instructions`. */
    instruct(instructions: string) {
      if (instructions) heldInstructions.push(instructions);
      wanted = true;
      flush();
    },

    responseStarted() {
      running = true;
      requested = null;
    },

    responseEnded() {
      running = false;
      flush();
    },

    /** An error event naming one of our commands. Null when it wasn't our
     *  response.create. "early" when an output was still missing: it is asked
     *  again when the next output goes, and is no error to show. */
    rejected(
      clientEventId: unknown,
      code: unknown,
    ): "early" | "refused" | null {
      if (!requested || clientEventId !== requested) return null;
      requested = null;
      if (typeof code === "string" && OUTPUTS_REQUIRED.has(code)) {
        wanted = true;
        return "early";
      }
      return "refused";
    },

    isRunning: () => running,

    reset() {
      waitingCalls.clear();
      seenCalls.clear();
      heldItems = [];
      heldInstructions = [];
      wanted = false;
      running = false;
      requested = null;
    },
  };
}
