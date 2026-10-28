import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  postProviderJson,
  toChatCompletionMessages,
  toChatCompletionResult,
  toChatCompletionSampling,
  toFunctionTools,
} from "../server/llm/providers/chatCompletions";
import { TextGenerationError, type TextMessage } from "../server/llm/types";

const IMAGE = "data:image/png;base64,iVBORw0KGgo=";

describe("toChatCompletionMessages", () => {
  it("passes role and content through", () => {
    assert.deepEqual(
      toChatCompletionMessages([
        { role: "system", content: "s" },
        { role: "user", content: "" },
      ]),
      [
        { role: "system", content: "s" },
        { role: "user", content: "" },
      ],
    );
  });

  it("adds tool_call_id only to a tool message that has a non-empty one", () => {
    const messages: TextMessage[] = [
      { role: "tool", content: "r", tool_call_id: "call_1" },
      { role: "tool", content: "r", tool_call_id: "" },
      { role: "user", content: "u", tool_call_id: "call_2" },
    ];
    assert.deepEqual(toChatCompletionMessages(messages), [
      { role: "tool", content: "r", tool_call_id: "call_1" },
      { role: "tool", content: "r" },
      { role: "user", content: "u" },
    ]);
  });

  it("turns images into image_url parts after the text, and ignores an empty list", () => {
    assert.deepEqual(
      toChatCompletionMessages([
        { role: "user", content: "look", images: [IMAGE, IMAGE] },
        { role: "user", content: "none", images: [] },
      ]),
      [
        {
          role: "user",
          content: [
            { type: "text", text: "look" },
            { type: "image_url", image_url: { url: IMAGE } },
            { type: "image_url", image_url: { url: IMAGE } },
          ],
        },
        { role: "user", content: "none" },
      ],
    );
  });

  it("adds tool_calls only to an assistant message, in the API's shape", () => {
    const toolCalls = [
      { id: "c1", name: "f", arguments: '{"x":1}', thoughtSignature: "s" },
    ];
    assert.deepEqual(
      toChatCompletionMessages([
        { role: "assistant", content: "", tool_calls: toolCalls },
        { role: "user", content: "", tool_calls: toolCalls },
      ]),
      [
        {
          role: "assistant",
          content: "",
          tool_calls: [
            {
              id: "c1",
              type: "function",
              function: { name: "f", arguments: '{"x":1}' },
            },
          ],
        },
        { role: "user", content: "" },
      ],
    );
  });
});

describe("toChatCompletionSampling", () => {
  it("keeps zero values and drops unset ones, in max_tokens/temperature/top_p order", () => {
    const sampling = toChatCompletionSampling({
      model: "m",
      messages: [],
      conversationMessages: [],
      maxTokens: 0,
      topP: 0,
    });
    assert.equal(JSON.stringify(sampling), '{"max_tokens":0,"top_p":0}');
    assert.equal(
      JSON.stringify(
        toChatCompletionSampling({
          model: "m",
          messages: [],
          conversationMessages: [],
          topP: 1,
          temperature: 0.5,
          maxTokens: 9,
        }),
      ),
      '{"max_tokens":9,"temperature":0.5,"top_p":1}',
    );
  });
});

describe("toFunctionTools", () => {
  it("wraps each tool in a function entry", () => {
    assert.deepEqual(
      toFunctionTools([
        { type: "function", name: "f", description: "d", parameters: { a: 1 } },
      ]),
      [
        {
          type: "function",
          function: { name: "f", description: "d", parameters: { a: 1 } },
        },
      ],
    );
  });
});

describe("toChatCompletionResult", () => {
  it("reads text, tool calls and usage from the first choice", () => {
    const data = {
      choices: [
        {
          message: {
            role: "assistant",
            content: "hi",
            tool_calls: [
              {
                id: "t1",
                type: "function" as const,
                function: { name: "f", arguments: "{}" },
              },
            ],
          },
        },
      ],
      usage: { prompt_tokens: 3 },
    };
    assert.deepEqual(toChatCompletionResult(data, "grok", "grok-4"), {
      provider: "grok",
      model: "grok-4",
      text: "hi",
      toolCalls: [{ id: "t1", name: "f", arguments: "{}" }],
      usage: { promptTokens: 3, completionTokens: 0, totalTokens: 0 },
      rawResponse: data,
    });
  });

  it("leaves out empty tool calls and missing usage, and defaults text to empty", () => {
    const data = {
      choices: [{ message: { role: "assistant", tool_calls: [] } }],
    };
    assert.deepEqual(toChatCompletionResult(data, "openai", "m"), {
      provider: "openai",
      model: "m",
      text: "",
      rawResponse: data,
    });
    assert.equal(
      toChatCompletionResult({ choices: [] }, "openai", "m").text,
      "",
    );
  });
});

describe("postProviderJson", () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const stub = (response: Response) => {
    const calls: { url: string; init?: RequestInit }[] = [];
    globalThis.fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return response;
    };
    return calls;
  };

  it("sends a bearer key when given one, and none otherwise", async () => {
    const withKey = stub(new Response('{"a":1}'));
    assert.deepEqual(
      await postProviderJson(
        "https://x/v1",
        { b: 2 },
        { apiLabel: "X", apiKey: "k" },
      ),
      { a: 1 },
    );
    assert.deepEqual(withKey, [
      {
        url: "https://x/v1",
        init: {
          method: "POST",
          headers: {
            Authorization: "Bearer k",
            "Content-Type": "application/json",
          },
          body: '{"b":2}',
        },
      },
    ]);

    const withoutKey = stub(new Response("{}"));
    await postProviderJson("http://local/api/chat", {}, { apiLabel: "Ollama" });
    assert.deepEqual(withoutKey[0].init?.headers, {
      "Content-Type": "application/json",
    });
  });

  it("throws a TextGenerationError carrying the provider label, status and body", async () => {
    stub(
      new Response("quota", { status: 429, statusText: "Too Many Requests" }),
    );
    await assert.rejects(
      postProviderJson("https://x", {}, { apiLabel: "xAI", apiKey: "k" }),
      (error: unknown) => {
        assert.ok(error instanceof TextGenerationError);
        assert.equal(
          error.message,
          "xAI API error: 429 Too Many Requests - quota",
        );
        assert.equal(error.statusCode, 429);
        return true;
      },
    );
  });
});
