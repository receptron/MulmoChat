import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { liveSessionParams } from "../server/utils/liveSession";
import {
  DEFAULT_LIVE_VOICE_MODEL_ID,
  LIVE_VOICE_MODELS,
  resolveLiveModels,
} from "../server/utils/liveModels";
import {
  liveBackendInstructions,
  liveFrontendInstructions,
} from "../src/composables/liveInstructions";

const BODY = {
  sdp: "v=0",
  instructions: "talk",
  backendInstructions: "work",
  tools: [],
};

describe("resolveLiveModels", () => {
  it("splits an offered id into the voice model and its backend", () => {
    assert.deepEqual(resolveLiveModels("gpt-live-1/gpt-6.2-sol"), {
      live: "gpt-live-1",
      backend: "gpt-6.2-sol",
    });
  });

  it("falls back to the default for anything not offered", () => {
    const fallback = resolveLiveModels(DEFAULT_LIVE_VOICE_MODEL_ID);
    for (const value of [undefined, 3, "gpt-realtime-2.1", "gpt-live-1/x"]) {
      assert.deepEqual(resolveLiveModels(value), fallback);
    }
    assert.equal(LIVE_VOICE_MODELS[0].id, DEFAULT_LIVE_VOICE_MODEL_ID);
  });

  it("offers the newest voice model first, and the one before it", () => {
    assert.equal(DEFAULT_LIVE_VOICE_MODEL_ID, "gpt-live-1.1/gpt-6-luna");
    assert.deepEqual(resolveLiveModels("gpt-live-1.1/gpt-6.2-astra"), {
      live: "gpt-live-1.1",
      backend: "gpt-6.2-astra",
    });
    // A choice saved before 1.1 existed is kept.
    assert.equal(resolveLiveModels("gpt-live-1/gpt-6-luna").live, "gpt-live-1");
  });
});

describe("liveSessionParams", () => {
  const session = (body: unknown) => {
    const result = liveSessionParams(body);
    assert.ok("params" in result, JSON.stringify(result));
    return result.params;
  };

  it("refuses a request without an offer or either prompt", () => {
    for (const body of [
      null,
      [],
      { ...BODY, sdp: " " },
      { ...BODY, instructions: "" },
      { ...BODY, backendInstructions: 1 },
    ]) {
      assert.ok("error" in liveSessionParams(body), JSON.stringify(body));
    }
  });

  it("gives the voice model its prompt and voice, and the backend the rest", () => {
    assert.deepEqual(
      session({ ...BODY, model: "gpt-live-1/gpt-6.1-terra", voice: "shida" }),
      {
        session: {
          model: "gpt-live-1",
          instructions: "talk",
          audio: { output: { voice: "shida" } },
          client: {
            data_channel: {
              // No session.update: it could replace the backend's tools.
              allowed_client_events: [
                "response.item.create",
                "response.create",
                "session.thinking.append",
                "session.close",
              ],
            },
          },
          // Standby after a minute of silence, until speech.
          idle_timeout_s: 60,
          wake_policy: { type: "speech" },
          delegation: {
            type: "responses",
            responses: { model: "gpt-6.1-terra", instructions: "work" },
          },
        },
        transport: { type: "webrtc", sdp: "v=0" },
      },
    );
  });

  it("uses the defaults for a model or voice it doesn't offer", () => {
    const params = session({ ...BODY, model: "gpt-9", voice: "nobody" });
    assert.equal(params.session.model, "gpt-live-1.1");
    assert.equal(params.session.audio?.output?.voice, "marin");
  });

  it("passes function tools only, rebuilt and not strict", () => {
    const params = session({
      ...BODY,
      tools: [
        {
          type: "function",
          name: "f",
          description: "d",
          parameters: { type: "object", properties: { a: {} } },
          strict: true,
          extra: "dropped",
        },
        { type: "function", name: "g" },
        { type: "web_search" },
        { type: "mcp", server_url: "https://example.com" },
        { type: "function" },
        "junk",
      ],
    });
    const delegation = params.session.delegation;
    assert.ok(delegation && delegation.type === "responses");
    assert.deepEqual(delegation.responses.tools, [
      {
        type: "function",
        name: "f",
        description: "d",
        parameters: { type: "object", properties: { a: {} } },
        strict: false,
      },
      {
        type: "function",
        name: "g",
        parameters: { type: "object", properties: {} },
        strict: false,
      },
    ]);
    assert.equal(delegation.responses.tool_choice, "auto");
    assert.equal(delegation.responses.parallel_tool_calls, true);
  });
});

describe("live instructions", () => {
  it("lists each tool's first sentence for the voice model", () => {
    const text = liveFrontendInstructions("Speak Japanese.", [
      { name: "presentSlide", description: "Show a slide. Then explain it." },
      { name: "bare" },
      { description: "no name" },
    ]);
    assert.match(text, /^- presentSlide: Show a slide\.$/m);
    assert.match(text, /^- bare$/m);
    assert.doesNotMatch(text, /no name/);
    assert.match(text, /Generate <\|SpawnThinking\|> when:/);
    assert.ok(text.endsWith("---\nSpeak Japanese."));
  });

  it("orders the voice model to speak the language the instructions name", () => {
    assert.match(
      liveFrontendInstructions(
        "説明して. The user's native language is English. Today is Monday.",
        [],
      ),
      /^Language: Speak English, unless the user speaks/m,
    );
    assert.match(
      liveFrontendInstructions("No language here.", []),
      /^Language: Speak the user's native language, which/m,
    );
    // The app's line is the last one; custom instructions may hold another.
    assert.match(
      liveFrontendInstructions(
        "Say: The user's native language is Japanese. The user's native language is English. Today is Monday.",
        [],
      ),
      /^Language: Speak English, unless/m,
    );
  });

  it("cuts the middle of a long copy for the voice model, keeping the language at its end", () => {
    const long = `ROLE ${"x".repeat(20_000)} The user's native language is English.`;
    const frontend = liveFrontendInstructions(long, []);
    assert.ok(frontend.length < 15_000);
    assert.match(frontend, /---\nROLE x/);
    assert.ok(frontend.endsWith("The user's native language is English."));
    assert.ok(liveBackendInstructions(long).includes(long));
  });
});
