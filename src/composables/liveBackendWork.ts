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
  /** The voice model is on standby: it would not say an answer, now or
   *  when it wakes, so nothing is asked for until then. */
  let paused = false;

  const flush = () => {
    if (paused || !wanted || running || requested) return;
    if (waitingCalls.size > 0) return;
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

    /** False when no call waits for it: a tool that finished after its
     *  session was stopped must not be answered into the next one. */
    toolOutput(callId: string, output: string): boolean {
      if (!waitingCalls.has(callId)) return false;
      const sent = send({
        type: "response.item.create",
        item: { type: "function_call_output", call_id: callId, output },
      });
      waitingCalls.delete(callId);
      // In a task of its own, after the caller's: the host sends a result's
      // images and instructions right after its output, some of them past
      // an await, and a request already held (a plugin's waiting message)
      // would otherwise go without them, and they would make a second
      // response.
      setTimeout(flush, 0);
      return sent;
    },

    /** Images for the backend (it sees them; the voice model doesn't). They
     *  go with the next request to go on, after the tool outputs. False when
     *  the message would be over `maxBytes`, what the channel can carry. */
    showImages(images: string[], caption: string, maxBytes: number): boolean {
      const event = message("user", [
        { type: "input_text", text: caption },
        ...images.map((url) => ({ type: "input_image", image_url: url })),
      ]);
      const bytes = new TextEncoder().encode(JSON.stringify(event)).length;
      if (bytes > maxBytes) return false;
      heldItems.push(event);
      return true;
    },

    /** Something the user typed: the backend answers it. `before` goes in
     *  front of it (what the voice model is told about the message). */
    userMessage(text: string, before?: LiveClientEvent) {
      if (before) heldItems.push(before);
      heldItems.push(message("user", [{ type: "input_text", text }]));
      wanted = true;
      flush();
    },

    /** Ask the backend to go on, following `instructions`. */
    instruct(instructions: string) {
      // Not twice: a request held through a standby is asked for again and
      // again by what waits for it (a slideshow's keeper).
      if (instructions && !heldInstructions.includes(instructions)) {
        heldInstructions.push(instructions);
      }
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

    /** The voice model went on standby, or woke. */
    setPaused(value: boolean) {
      paused = value;
      flush();
    },

    isPaused: () => paused,

    reset() {
      waitingCalls.clear();
      seenCalls.clear();
      heldItems = [];
      heldInstructions = [];
      wanted = false;
      running = false;
      requested = null;
      paused = false;
    },
  };
}
