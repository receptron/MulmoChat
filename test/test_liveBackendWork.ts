import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createLiveBackendWork } from "../src/composables/liveBackendWork";

type Sent = Record<string, any>;

describe("createLiveBackendWork", () => {
  let sent: Sent[] = [];
  let open = true;
  let work = createLiveBackendWork(() => true);

  // "<type>" of each event sent, with what distinguishes its item.
  const log = () =>
    sent.map((event) => {
      if (event.type === "response.create") return "create";
      const item = event.item;
      if (item.type === "function_call_output") return `output:${item.call_id}`;
      const text = item.content[0].text;
      const images = item.content.length - 1;
      return `${item.role}:${text}${images ? `+${images}img` : ""}`;
    });

  beforeEach(() => {
    sent = [];
    open = true;
    work = createLiveBackendWork((event) => {
      if (open) sent.push(event);
      return open;
    });
  });

  it("sends a typed message and asks for a response", () => {
    work.userMessage("hello");
    assert.deepEqual(log(), ["user:hello", "create"]);
  });

  it("holds the request until the running response has ended", () => {
    work.responseStarted();
    assert.equal(work.toolCalled("a"), true);
    assert.equal(work.toolOutput("a", "{}"), true);
    work.instruct("explain slide 1");
    // All outputs are in, but the response could still announce a call.
    assert.deepEqual(log(), ["output:a"]);
    work.responseEnded();
    assert.deepEqual(log(), [
      "output:a",
      "developer:explain slide 1",
      "create",
    ]);
  });

  it("waits for every call's output, then asks once with the instructions joined", () => {
    work.responseStarted();
    work.toolCalled("a");
    work.toolCalled("b");
    work.responseEnded();
    work.toolOutput("a", "1");
    work.instruct("first");
    assert.deepEqual(log(), ["output:a"]);
    work.toolOutput("b", "2");
    work.instruct("second");
    assert.deepEqual(log(), [
      "output:a",
      "output:b",
      "developer:first",
      "create",
    ]);
    // The first request hasn't been answered: the second waits for it.
    work.responseStarted();
    work.responseEnded();
    assert.deepEqual(log().slice(4), ["developer:second", "create"]);
  });

  it("sends images after the outputs and before the instructions", () => {
    work.responseStarted();
    work.toolCalled("a");
    work.responseEnded();
    work.toolOutput("a", "1");
    work.showImages(["data:image/png;base64,AAAA"], "[Image returned by f]");
    assert.deepEqual(log(), ["output:a"]);
    work.instruct("look at it");
    assert.deepEqual(log(), [
      "output:a",
      "user:[Image returned by f]+1img",
      "developer:look at it",
      "create",
    ]);
    assert.deepEqual(sent[1].item.content[1], {
      type: "input_image",
      image_url: "data:image/png;base64,AAAA",
    });
  });

  it("asks for a response without instructions when given none", () => {
    work.instruct("");
    assert.deepEqual(log(), ["create"]);
  });

  it("runs a call announced twice once", () => {
    assert.equal(work.toolCalled("a"), true);
    assert.equal(work.toolCalled("a"), false);
  });

  it("does not ask again while its request is unanswered", () => {
    work.instruct("one");
    work.instruct("two");
    assert.deepEqual(log(), ["developer:one", "create"]);
    work.responseStarted();
    work.responseEnded();
    assert.deepEqual(log().slice(2), ["developer:two", "create"]);
  });

  it("asks again after a request refused for a missing output, once that output goes", () => {
    work.instruct("go on");
    const eventId = sent[1].event_id;
    assert.equal(work.rejected("someone_else", "x"), null);
    assert.equal(work.rejected(eventId, "tool_outputs_required"), "early");
    assert.equal(sent.length, 2);
    work.toolCalled("late");
    work.toolOutput("late", "{}");
    assert.deepEqual(log().slice(2), ["output:late", "create"]);
  });

  it("drops a request refused for another reason, and takes the next", () => {
    work.instruct("go on");
    assert.equal(work.rejected(sent[1].event_id, "invalid_request"), "refused");
    work.instruct("again");
    assert.deepEqual(log().slice(2), ["developer:again", "create"]);
  });

  it("leaves nothing pending when the channel is closed", () => {
    open = false;
    work.instruct("lost");
    open = true;
    work.instruct("next");
    assert.deepEqual(log(), ["developer:next", "create"]);
  });

  it("starts clean after a reset", () => {
    work.responseStarted();
    work.toolCalled("a");
    work.instruct("held");
    work.reset();
    assert.equal(work.isRunning(), false);
    assert.equal(work.toolCalled("a"), true);
    work.toolOutput("a", "{}");
    assert.deepEqual(log(), ["output:a"]);
  });
});
