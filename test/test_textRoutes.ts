import { after, afterEach, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import express from "express";
import textRouter from "../server/routes/textLLM";
import { MAX_MESSAGE_IMAGES } from "../server/llm/images";
import type {
  ProviderAvailability,
  TextLLMProviderId,
} from "../server/llm/types";

const IMAGE = "data:image/png;base64,iVBORw0KGgo=";
const CREDENTIAL_KEYS: readonly string[] = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "XAI_API_KEY",
];
const UPSTREAM_REPLY = {
  choices: [{ message: { role: "assistant", content: "ok" } }],
};

const originalFetch = globalThis.fetch;
const originalCredentials = CREDENTIAL_KEYS.map((key) => process.env[key]);
let server: Server;
let baseUrl = "";
let upstreamBodies: unknown[] = [];
let upstreamCalls: {
  url: string;
  method?: string;
  authorization: string | null;
}[] = [];
let upstreamReply: () => Promise<Response> = async () =>
  new Response(JSON.stringify(UPSTREAM_REPLY));

const restoreCredentials = () =>
  CREDENTIAL_KEYS.forEach((key, index) => {
    const value = originalCredentials[index];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });

before(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api", textRouter);
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error(`unexpected server address: ${address}`);
  }
  baseUrl = `http://127.0.0.1:${address.port}/api`;
});
after(() => {
  server.close();
});

beforeEach(() => {
  CREDENTIAL_KEYS.forEach((key) => delete process.env[key]);
  process.env.OPENAI_API_KEY = "k";
  upstreamBodies = [];
  upstreamCalls = [];
  upstreamReply = async () => new Response(JSON.stringify(UPSTREAM_REPLY));
  globalThis.fetch = async (input, init) => {
    if (String(input).startsWith(baseUrl)) return originalFetch(input, init);
    upstreamBodies.push(JSON.parse(String(init?.body)));
    upstreamCalls.push({
      url: String(input),
      method: init?.method,
      authorization: new Headers(init?.headers).get("authorization"),
    });
    return upstreamReply();
  };
});
afterEach(() => {
  globalThis.fetch = originalFetch;
  restoreCredentials();
});

const generate = async (body: unknown) => {
  const response = await originalFetch(`${baseUrl}/text/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() };
};

const request = (extra: Record<string, unknown> = {}) => ({
  provider: "openai",
  model: "gpt-4o",
  messages: [{ role: "user", content: "q" }],
  ...extra,
});

const assertRejected = async (body: unknown, status: number, error: string) => {
  const { status: actualStatus, json } = await generate(body);
  assert.equal(actualStatus, status);
  assert.equal(json.success, false);
  assert.equal(json.error, error);
  assert.equal(upstreamBodies.length, 0);
};

const PROVIDER_IDS: TextLLMProviderId[] = [
  "openai",
  "anthropic",
  "google",
  "grok",
  "ollama",
];

const isProviderAvailability = (
  value: unknown,
): value is ProviderAvailability =>
  typeof value === "object" &&
  value !== null &&
  "provider" in value &&
  PROVIDER_IDS.some((id) => id === value.provider) &&
  "hasCredentials" in value &&
  typeof value.hasCredentials === "boolean";

const listProviders = async (): Promise<ProviderAvailability[]> => {
  const response = await originalFetch(`${baseUrl}/text/providers`);
  const json = await response.json();
  assert.equal(response.status, 200);
  assert.equal(json.success, true);
  const providers: unknown[] = json.providers;
  assert.ok(providers.every(isProviderAvailability));
  return providers.filter(isProviderAvailability);
};

const credentialsByProvider = async () =>
  (await listProviders()).map((entry) => [
    entry.provider,
    entry.hasCredentials,
  ]);

describe("GET /api/text/providers", () => {
  it("lists every provider in menu order, with credentials from the environment", async () => {
    process.env.XAI_API_KEY = "x";
    assert.deepEqual(await credentialsByProvider(), [
      ["openai", true],
      ["anthropic", false],
      ["google", false],
      ["grok", true],
      ["ollama", true],
    ]);
    process.env.ANTHROPIC_API_KEY = "a";
    process.env.GEMINI_API_KEY = "g";
    delete process.env.OPENAI_API_KEY;
    delete process.env.XAI_API_KEY;
    assert.deepEqual(await credentialsByProvider(), [
      ["openai", false],
      ["anthropic", true],
      ["google", true],
      ["grok", false],
      ["ollama", true],
    ]);
  });

  it("gives each provider a default model, listed first", async () => {
    (await listProviders()).forEach((entry) => {
      assert.equal(typeof entry.defaultModel, "string");
      assert.equal(entry.models?.[0], entry.defaultModel);
    });
  });
});

describe("POST /api/text/generate", () => {
  it("returns the provider's result", async () => {
    const { status, json } = await generate(request());
    assert.equal(status, 200);
    assert.deepEqual(json, {
      success: true,
      result: {
        provider: "openai",
        model: "gpt-4o",
        text: "ok",
        rawResponse: UPSTREAM_REPLY,
      },
    });
    assert.deepEqual(upstreamCalls, [
      {
        url: "https://api.openai.com/v1/chat/completions",
        method: "POST",
        authorization: "Bearer k",
      },
    ]);
  });

  it("passes the messages on, keeping tool fields only on their own roles", async () => {
    const toolCalls = [{ id: "c1", name: "f", arguments: "{}" }];
    await generate(
      request({
        messages: [
          { role: "system", content: "s", tool_call_id: "x" },
          {
            role: "user",
            content: "q",
            images: [IMAGE],
            tool_calls: toolCalls,
          },
          { role: "assistant", content: "", tool_calls: toolCalls },
          { role: "tool", content: "r", tool_call_id: "c1", tool_calls: [] },
          { role: "tool", content: "r2", tool_call_id: 7 },
        ],
      }),
    );
    assert.deepEqual(upstreamBodies, [
      {
        model: "gpt-4o",
        messages: [
          { role: "system", content: "s" },
          {
            role: "user",
            content: [
              { type: "text", text: "q" },
              { type: "image_url", image_url: { url: IMAGE } },
            ],
          },
          {
            role: "assistant",
            content: "",
            tool_calls: [
              {
                id: "c1",
                type: "function",
                function: { name: "f", arguments: "{}" },
              },
            ],
          },
          { role: "tool", content: "r", tool_call_id: "c1" },
          { role: "tool", content: "r2" },
        ],
      },
    ]);
  });

  it("passes sampling values only when they are numbers, and tools only when there are some", async () => {
    const tool = {
      type: "function",
      name: "f",
      description: "d",
      parameters: {},
    };
    await generate(
      request({ maxTokens: 9, temperature: "0.5", topP: 0, tools: [] }),
    );
    await generate(
      request({ maxTokens: "9", temperature: 0, topP: null, tools: [tool] }),
    );
    assert.deepEqual(upstreamBodies, [
      {
        model: "gpt-4o",
        messages: [{ role: "user", content: "q" }],
        max_tokens: 9,
        top_p: 0,
      },
      {
        model: "gpt-4o",
        messages: [{ role: "user", content: "q" }],
        temperature: 0,
        tools: [
          {
            type: "function",
            function: { name: "f", description: "d", parameters: {} },
          },
        ],
        parallel_tool_calls: true,
      },
    ]);
  });

  it("rejects an unknown provider or a missing model", async () => {
    await assertRejected(
      request({ provider: "acme" }),
      400,
      "Unsupported provider",
    );
    await assertRejected(
      request({ provider: undefined }),
      400,
      "Unsupported provider",
    );
    await assertRejected(
      request({ model: undefined }),
      400,
      "Model is required",
    );
    await assertRejected(request({ model: " " }), 400, "Model is required");
    await assertRejected(request({ model: 1 }), 400, "Model is required");
  });

  it("rejects malformed messages", async () => {
    const cases: [unknown, string][] = [
      [undefined, "messages must be an array"],
      ["q", "messages must be an array"],
      [[], "At least one message is required"],
      [[null], "Each message must be an object"],
      [["q"], "Each message must be an object"],
      [[{ role: "user" }], "Each message must include string role and content"],
      [
        [{ role: 1, content: "q" }],
        "Each message must include string role and content",
      ],
      [[{ role: "bot", content: "q" }], "Unsupported message role: bot"],
      [
        [{ role: "user", content: " " }],
        "Message content must be a non-empty string",
      ],
      // only an assistant's tool_calls excuse empty content
      [
        [{ role: "user", content: " ", tool_calls: [] }],
        "Message content must be a non-empty string",
      ],
      [
        [{ role: "system", content: "s" }],
        "At least one non-system message is required",
      ],
    ];
    for (const [messages, error] of cases) {
      await assertRejected(request({ messages }), 400, error);
    }
  });

  it("rejects images that are not image data URLs on a user message", async () => {
    const error = `images must be up to ${MAX_MESSAGE_IMAGES} image data URLs on a user message`;
    const tooMany = Array.from({ length: MAX_MESSAGE_IMAGES + 1 }, () => IMAGE);
    const cases: unknown[] = [
      [{ role: "user", content: "q", images: tooMany }],
      [{ role: "user", content: "q", images: IMAGE }],
      [{ role: "user", content: "q", images: {} }],
      [{ role: "user", content: "q", images: ["https://x/a.png"] }],
      [{ role: "user", content: "q", images: ["data:text/plain;base64,AA=="] }],
      [{ role: "user", content: "q", images: [1] }],
      [{ role: "assistant", content: "a", images: [IMAGE] }],
    ];
    for (const messages of cases) {
      await assertRejected(request({ messages }), 400, error);
    }
    const atLimit = Array.from({ length: MAX_MESSAGE_IMAGES }, () => IMAGE);
    const { status } = await generate(
      request({ messages: [{ role: "user", content: "q", images: atLimit }] }),
    );
    assert.equal(status, 200);
    assert.deepEqual(upstreamBodies, [
      {
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "q" },
              ...atLimit.map((url) => ({
                type: "image_url",
                image_url: { url },
              })),
            ],
          },
        ],
      },
    ]);
  });

  it("answers with the provider's status when the provider refuses", async () => {
    upstreamReply = async () =>
      new Response("slow down", { status: 429, statusText: "Too Many" });
    const { status, json } = await generate(request());
    assert.equal(status, 429);
    assert.deepEqual(json, {
      success: false,
      error: "OpenAI API error: 429 Too Many - slow down",
    });
  });

  it("answers 500 with the reason when the provider's key is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    await assertRejected(
      request(),
      500,
      "OPENAI_API_KEY environment variable not set",
    );
  });

  it("answers 500 with the details for any other failure", async () => {
    upstreamReply = async () => {
      throw new TypeError("network down");
    };
    const { status, json } = await generate(request());
    assert.equal(status, 500);
    assert.deepEqual(json, {
      success: false,
      error: "Failed to generate text",
      details: "network down",
    });
  });

  it("answers 500 with an unknown reason when the failure is not an Error", async () => {
    upstreamReply = async () => {
      throw "network down";
    };
    const { status, json } = await generate(request());
    assert.equal(status, 500);
    assert.deepEqual(json, {
      success: false,
      error: "Failed to generate text",
      details: "Unknown error",
    });
  });
});
