import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateWithGrok } from "../server/llm/providers/grok";
import { generateWithOpenAI } from "../server/llm/providers/openai";
import type {
  ProviderGenerateParams,
  ToolDefinition,
} from "../server/llm/types";

const TOOL: ToolDefinition = {
  type: "function",
  name: "f",
  description: "d",
  parameters: {},
};
const MESSAGES = [{ role: "user" as const, content: "q" }];
const SENT_MESSAGES = [{ role: "user", content: "q" }];
const SENT_TOOLS = [
  {
    type: "function",
    function: { name: "f", description: "d", parameters: {} },
  },
];
const REPLY = '{"choices":[{"message":{"role":"assistant","content":"ok"}}]}';

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };
let sentBodies: string[] = [];

beforeEach(() => {
  process.env.XAI_API_KEY = "x";
  process.env.OPENAI_API_KEY = "o";
  sentBodies = [];
  globalThis.fetch = async (_input, init) => {
    sentBodies.push(String(init?.body));
    return new Response(REPLY);
  };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  process.env = { ...originalEnv };
});

const params = (
  model: string,
  extra: Partial<ProviderGenerateParams> = {},
): ProviderGenerateParams => ({
  model,
  messages: MESSAGES,
  conversationMessages: [],
  ...extra,
});

const sentBody = async (
  generate: (p: ProviderGenerateParams) => Promise<unknown>,
  p: ProviderGenerateParams,
) => {
  await generate(p);
  assert.equal(sentBodies.length, 1);
  return sentBodies[0];
};

describe("generateWithGrok request body", () => {
  it("sends model, messages and sampling, and no tool fields without tools", async () => {
    for (const tools of [undefined, []]) {
      sentBodies = [];
      assert.equal(
        await sentBody(
          generateWithGrok,
          params("grok-4", { tools, maxTokens: 9, temperature: 0, topP: 0 }),
        ),
        JSON.stringify({
          model: "grok-4",
          messages: SENT_MESSAGES,
          max_tokens: 9,
          temperature: 0,
          top_p: 0,
        }),
      );
    }
  });

  it("adds tools, then parallel_tool_calls, when there are tools", async () => {
    assert.equal(
      await sentBody(generateWithGrok, params("grok-4", { tools: [TOOL] })),
      JSON.stringify({
        model: "grok-4",
        messages: SENT_MESSAGES,
        tools: SENT_TOOLS,
        parallel_tool_calls: true,
      }),
    );
  });
});

describe("generateWithOpenAI request body", () => {
  const withTools = (model: string) =>
    sentBody(generateWithOpenAI, params(model, { tools: [TOOL] }));

  it("sends parallel_tool_calls with tools, except to o-series models", async () => {
    assert.equal(
      await withTools("gpt-4o"),
      JSON.stringify({
        model: "gpt-4o",
        messages: SENT_MESSAGES,
        tools: SENT_TOOLS,
        parallel_tool_calls: true,
      }),
    );
    sentBodies = [];
    assert.equal(
      await withTools("o3"),
      JSON.stringify({
        model: "o3",
        messages: SENT_MESSAGES,
        tools: SENT_TOOLS,
      }),
    );
  });

  it("turns reasoning off only for gpt-5.6/gpt-6 models that get tools", async () => {
    assert.equal(
      await withTools("gpt-5.6-mini"),
      JSON.stringify({
        model: "gpt-5.6-mini",
        messages: SENT_MESSAGES,
        tools: SENT_TOOLS,
        parallel_tool_calls: true,
        reasoning_effort: "none",
      }),
    );
    sentBodies = [];
    assert.equal(
      await withTools("gpt-6-mini"),
      JSON.stringify({
        model: "gpt-6-mini",
        messages: SENT_MESSAGES,
        tools: SENT_TOOLS,
        parallel_tool_calls: true,
        reasoning_effort: "none",
      }),
    );
    sentBodies = [];
    assert.equal(
      await sentBody(generateWithOpenAI, params("gpt-5.6-mini", { tools: [] })),
      JSON.stringify({ model: "gpt-5.6-mini", messages: SENT_MESSAGES }),
    );
  });
});
