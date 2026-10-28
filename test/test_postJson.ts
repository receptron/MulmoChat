import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { postJson } from "../src/tools/backend/postJson";

interface FetchCall {
  url: string;
  init: RequestInit | undefined;
}

const originalFetch = globalThis.fetch;

const stubFetch = (response: {
  ok: boolean;
  statusText?: string;
  body?: unknown;
}) => {
  const calls: FetchCall[] = [];
  let jsonReads = 0;
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify(response.body ?? null), {
      status: response.ok ? 200 : 502,
      statusText: response.statusText ?? "",
    });
  };
  const readJson = Response.prototype.json;
  Response.prototype.json = function () {
    jsonReads += 1;
    return readJson.call(this);
  };
  return {
    calls,
    jsonReads: () => jsonReads,
    restore: () => {
      Response.prototype.json = readJson;
    },
  };
};

describe("postJson", () => {
  let restoreJson: (() => void) | undefined;
  afterEach(() => {
    globalThis.fetch = originalFetch;
    restoreJson?.();
  });

  it("POSTs the body as JSON and returns the parsed reply", async () => {
    const stub = stubFetch({ ok: true, body: { success: true, n: 1 } });
    restoreJson = stub.restore;
    const reply = await postJson<{ success: boolean; n: number }>("/api/x", {
      a: 1,
      b: [true, null],
    });
    assert.deepEqual(reply, { success: true, n: 1 });
    assert.deepEqual(stub.calls, [
      {
        url: "/api/x",
        init: {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: '{"a":1,"b":[true,null]}',
        },
      },
    ]);
  });

  it("throws with the status text on a failed reply, without reading its body", async () => {
    const stub = stubFetch({
      ok: false,
      statusText: "Bad Gateway",
      body: { error: "x" },
    });
    restoreJson = stub.restore;
    await assert.rejects(postJson("/api/x", {}), {
      message: "Server error: Bad Gateway",
    });
    assert.equal(stub.jsonReads(), 0);
  });

  it("passes a network failure through unchanged", async () => {
    globalThis.fetch = async () => {
      throw new TypeError("fetch failed");
    };
    await assert.rejects(postJson("/api/x", {}), {
      name: "TypeError",
      message: "fetch failed",
    });
  });
});
