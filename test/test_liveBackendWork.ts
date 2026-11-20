import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createLiveBackendWork } from "../src/composables/liveBackendWork";

type Sent = Record<string, any>;

const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

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
      "developer:first\n\nsecond",
      "create",
    ]);
    // That request hasn't been answered: the next waits for it.
    work.instruct("third");
    assert.equal(sent.length, 4);
    work.responseStarted();
    work.responseEnded();
    assert.deepEqual(log().slice(4), ["developer:third", "create"]);
  });

  it("sends a held request after what follows an output, not before", async () => {
    // A plugin's waiting message, then its result once the response ended:
    // the host sends output, images and instructions one after the other.
    work.responseStarted();
    work.toolCalled("a");
    work.instruct("Say you're taking a photo.");
    work.responseEnded();
    work.toolOutput("a", "{}");
    work.showImages(["data:image/png;base64,AAAA"], "photo", 65_536);
    // The host awaits before its instructions (useToolResults).
    await Promise.resolve().then(() => undefined);
    work.instruct("Describe the photo.");
    await nextTask();
    assert.deepEqual(log(), [
      "output:a",
      "user:photo+1img",
      "developer:Say you're taking a photo.\n\nDescribe the photo.",
      "create",
    ]);
  });

  it("sends a held request after an output that nothing follows", async () => {
    work.responseStarted();
    work.toolCalled("a");
    work.instruct("wait");
    work.responseEnded();
    work.toolOutput("a", "{}");
    assert.deepEqual(log(), ["output:a"]);
    await nextTask();
    assert.deepEqual(log(), ["output:a", "developer:wait", "create"]);
  });

  it("sends images after the outputs and before the instructions", () => {
    work.responseStarted();
    work.toolCalled("a");
    work.responseEnded();
    work.toolOutput("a", "1");
    work.showImages(
      ["data:image/png;base64,AAAA"],
      "[Image returned by f]",
      65_536,
    );
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

  it("asks again after a request refused for a missing output, once that output goes", async () => {
    work.instruct("go on");
    const eventId = sent[1].event_id;
    assert.equal(work.rejected("someone_else", "x"), null);
    assert.equal(work.rejected(eventId, "tool_outputs_required"), "early");
    assert.equal(sent.length, 2);
    work.toolCalled("late");
    work.toolOutput("late", "{}");
    await nextTask();
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

  it("drops the output of a call it isn't waiting for", () => {
    // A tool that finished after its session stopped, in the next session.
    assert.equal(work.toolOutput("stale", "{}"), false);
    work.toolCalled("a");
    assert.equal(work.toolOutput("a", "{}"), true);
    assert.equal(work.toolOutput("a", "{}"), false);
    assert.deepEqual(log(), ["output:a"]);
  });

  it("refuses images whose message is over the channel's limit, in bytes", () => {
    const image = `data:image/png;base64,${"A".repeat(1000)}`;
    assert.equal(work.showImages([image], "図", 900), false);
    // 40 small images: their JSON wrappers count too.
    const many = Array.from({ length: 40 }, () => "A".repeat(1600));
    assert.equal(work.showImages(many, "c", 65_536), false);
    assert.equal(work.showImages([image], "図", 2000), true);
    work.instruct("");
    assert.deepEqual(log(), ["user:図+1img", "create"]);
  });

  it("asks for nothing while the voice model is on standby, then once", () => {
    work.setPaused(true);
    assert.equal(work.isPaused(), true);
    work.userMessage("typed");
    // What waits for the request asks again; the same words are held once.
    work.instruct("next slide");
    work.instruct("next slide");
    assert.deepEqual(log(), []);
    work.setPaused(false);
    assert.deepEqual(log(), ["user:typed", "developer:next slide", "create"]);
  });

  it("sends what goes in front of a typed message with it", () => {
    work.setPaused(true);
    work.userMessage("typed", { type: "session.thinking.append" });
    assert.equal(sent.length, 0);
    work.setPaused(false);
    assert.deepEqual(
      sent.map((event) => event.type),
      ["session.thinking.append", "response.item.create", "response.create"],
    );
  });

  it("sends a tool's output during a standby, and asks when it wakes", async () => {
    work.responseStarted();
    work.toolCalled("slow");
    work.responseEnded();
    work.setPaused(true);
    work.toolOutput("slow", "{}");
    work.instruct("Tell the user the movie is ready.");
    await nextTask();
    assert.deepEqual(log(), ["output:slow"]);
    work.setPaused(false);
    assert.deepEqual(log().slice(1), [
      "developer:Tell the user the movie is ready.",
      "create",
    ]);
  });

  it("starts clean after a reset", () => {
    work.setPaused(true);
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
