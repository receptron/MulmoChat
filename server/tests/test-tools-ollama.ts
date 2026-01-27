import dotenv from "dotenv";
dotenv.config({ quiet: true });

const BASE_URL = process.env.TEST_SERVER_URL ?? "http://localhost:3001";

interface ToolCall {
  id: string;
  name: string;
  arguments: string;
}

interface GenerateResponse {
  success: boolean;
  result?: {
    text: string;
    model: string;
    toolCalls?: ToolCall[];
    usage?: Record<string, number>;
  };
  error?: string;
}

function stripCodeFence(content: string): string {
  const trimmed = content.trim();
  if (!trimmed.startsWith("```") || trimmed.lastIndexOf("```") === 0) {
    return trimmed;
  }

  const firstFence = trimmed.indexOf("\n");
  if (firstFence === -1) {
    return trimmed;
  }

  const withoutFence = trimmed.slice(firstFence + 1);
  const closingIndex = withoutFence.lastIndexOf("```");
  if (closingIndex === -1) {
    return trimmed;
  }

  return withoutFence.slice(0, closingIndex).trim();
}

function normalizeToolCalls(result: GenerateResponse["result"]): ToolCall[] {
  if (!result) {
    return [];
  }

  if (result.toolCalls && result.toolCalls.length > 0) {
    return result.toolCalls;
  }

  const text = result.text?.trim();
  if (!text) {
    return [];
  }

  const candidate = stripCodeFence(text);

  try {
    const parsed = JSON.parse(candidate);
    const asArray = Array.isArray(parsed) ? parsed : [parsed];

    const calls: ToolCall[] = [];
    asArray.forEach((item, index) => {
      if (!item || typeof item !== "object") {
        return;
      }
      const name = (item as { name?: unknown }).name;
      const args = (item as { arguments?: unknown }).arguments;

      if (typeof name !== "string" || !name) {
        return;
      }

      const serializedArgs =
        typeof args === "string" ? args : JSON.stringify(args ?? {});

      calls.push({
        id: `fallback_call_${index}`,
        name,
        arguments: serializedArgs,
      });
    });

    return calls;
  } catch {
    return [];
  }
}

const weatherTool = {
  type: "function",
  name: "get_weather",
  description: "Get the current weather for a location",
  parameters: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "The city and state, e.g. San Francisco, CA",
      },
      unit: {
        type: "string",
        enum: ["celsius", "fahrenheit"],
        description: "The temperature unit to use",
      },
    },
    required: ["location"],
  },
};

// Mock tool execution
function executeWeather(args: { location: string; unit?: string }): string {
  return JSON.stringify({
    location: args.location,
    temperature: 72,
    unit: args.unit || "fahrenheit",
    condition: "sunny",
  });
}

async function main(): Promise<void> {
  const model = process.env.OLLAMA_TEST_MODEL ?? "gpt-oss:20b";

  console.log("=== Ollama Function Calling Test ===\n");
  console.log(`Model: ${model}`);
  console.log(
    `Base URL: ${process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434"}\n`,
  );

  console.log("NOTE: Function calling support varies by Ollama model.");
  console.log(
    "      Newer models like llama3.1+ or qwen2.5+ typically support it.\n",
  );

  // Step 1: Send initial request with tools
  console.log("Step 1: Asking model to call weather tool...");
  const initialResponse = await fetch(`${BASE_URL}/api/text/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider: "ollama",
      model,
      messages: [
        {
          role: "user",
          content: "What's the weather in San Francisco in celsius?",
        },
      ],
      tools: [weatherTool],
      maxTokens: 300,
    }),
  });

  if (!initialResponse.ok) {
    console.error(
      `Request failed: ${initialResponse.status} ${initialResponse.statusText}`,
    );
    const text = await initialResponse.text();
    console.error(text);
    console.log(
      "\nTIP: Make sure Ollama is running and the model supports function calling.",
    );
    process.exit(1);
  }

  const initialData = (await initialResponse.json()) as GenerateResponse;

  if (!initialData.success || !initialData.result) {
    console.error("Test failed:", initialData.error ?? "Unknown error");
    process.exit(1);
  }

  console.log(`Text response: "${initialData.result.text}"`);

  const toolCalls = normalizeToolCalls(initialData.result);

  if (toolCalls.length === 0) {
    console.error("ERROR: Expected tool calls but none were returned.");
    console.log("Full response:", JSON.stringify(initialData, null, 2));
    process.exit(1);
  }

  const expectedTools = new Set(["get_weather"]);
  for (const call of toolCalls) {
    expectedTools.delete(call.name);
  }

  if (expectedTools.size > 0) {
    console.error(
      "ERROR: Missing expected tool calls:",
      Array.from(expectedTools).join(", "),
    );
    console.log("Full response:", JSON.stringify(initialData, null, 2));
    process.exit(1);
  }

  console.log(`\nTool calls received: ${toolCalls.length}`);
  for (const toolCall of toolCalls) {
    console.log(`  - ${toolCall.name}(${toolCall.arguments})`);
  }

  // Step 2: Execute tools and send results back
  console.log("\nStep 2: Executing tools and sending results...");
  const messages = [
    {
      role: "user" as const,
      content: "What's the weather in San Francisco in celsius?",
    },
    {
      role: "assistant" as const,
      content: initialData.result.text || "",
      tool_calls: toolCalls,
    },
  ];

  // Execute each tool call and add tool messages
  for (const toolCall of toolCalls) {
    const args = JSON.parse(toolCall.arguments);
    let result: string;

    if (toolCall.name === "get_weather") {
      result = executeWeather(args);
      console.log(`  Executed get_weather: ${result}`);
    } else {
      result = JSON.stringify({ error: "Unknown tool" });
    }

    messages.push({
      role: "tool" as const,
      content: result,
      tool_call_id: toolCall.id,
    });
  }

  // Send follow-up request with tool results
  console.log("\nStep 3: Sending tool results for final response...");
  const followUpResponse = await fetch(`${BASE_URL}/api/text/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider: "ollama",
      model,
      messages,
      maxTokens: 300,
    }),
  });

  if (!followUpResponse.ok) {
    console.error(
      `Follow-up request failed: ${followUpResponse.status} ${followUpResponse.statusText}`,
    );
    const text = await followUpResponse.text();
    console.error(text);
    process.exit(1);
  }

  const followUpData = (await followUpResponse.json()) as GenerateResponse;

  if (!followUpData.success || !followUpData.result) {
    console.error("Follow-up failed:", followUpData.error ?? "Unknown error");
    process.exit(1);
  }

  console.log(`\nFinal response:\n${followUpData.result.text}`);

  console.log("\n✓ Ollama function calling test completed successfully!");
}

main().catch((error) => {
  console.error("Unexpected error during Ollama tools test", error);
  process.exit(1);
});
