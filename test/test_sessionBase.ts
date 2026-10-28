import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { useSessionBase } from "../src/composables/sessionBase";

const noop = () => undefined;

describe("useSessionBase", () => {
  it("starts with a copy of the handlers it was given", () => {
    const given = { onTextDelta: noop };
    const { currentHandlers } = useSessionBase(given);
    assert.notEqual(currentHandlers(), given);
    assert.deepEqual(currentHandlers(), { onTextDelta: noop });
    assert.deepEqual(useSessionBase().currentHandlers(), {});
  });

  it("merges a registration over the current handlers, the newer one winning", () => {
    const first = () => "first";
    const second = () => "second";
    const { currentHandlers, registerEventHandlers } = useSessionBase({
      onTextDelta: first,
      onSpeechStarted: noop,
    });
    registerEventHandlers({ onTextDelta: second, onSpeechStopped: noop });
    assert.deepEqual(currentHandlers(), {
      onTextDelta: second,
      onSpeechStarted: noop,
      onSpeechStopped: noop,
    });
  });

  it("replaces the handler object instead of changing the one read before", () => {
    const given = { onTextDelta: noop };
    const { currentHandlers, registerEventHandlers } = useSessionBase(given);
    const before = currentHandlers();
    registerEventHandlers({ onSpeechStopped: noop });
    assert.notEqual(currentHandlers(), before);
    assert.deepEqual(before, { onTextDelta: noop });
    assert.deepEqual(given, { onTextDelta: noop });
  });

  it("keeps an own __proto__ key as data rather than swapping the prototype", () => {
    const { currentHandlers, registerEventHandlers } = useSessionBase();
    registerEventHandlers(JSON.parse('{"__proto__": {"onTextDelta": 1}}'));
    assert.equal(Object.getPrototypeOf(currentHandlers()), Object.prototype);
    assert.equal(currentHandlers().onTextDelta, undefined);
  });

  it("starts inactive, unmuted and with no start response", () => {
    const base = useSessionBase();
    assert.deepEqual(
      [
        base.chatActive.value,
        base.conversationActive.value,
        base.connecting.value,
        base.isMuted.value,
        base.startResponse.value,
      ],
      [false, false, false, false, null],
    );
  });
});
