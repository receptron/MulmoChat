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

// Define the weather tool
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

// Define the calculator tool
const calculatorTool = {
  type: "function",
  name: "calculate",
  description: "Perform a mathematical calculation",
  parameters: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["add", "subtract", "multiply", "divide"],
        description: "The operation to perform",
      },
      a: {
        type: "number",
        description: "First number",
      },
      b: {
        type: "number",
        description: "Second number",
      },
    },
    required: ["operation", "a", "b"],
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

function executeCalculator(args: {
  operation: string;
  a: number;
  b: number;
}): string {
  let result: number;
  switch (args.operation) {
    case "add":
      result = args.a + args.b;
      break;
    case "subtract":
      result = args.a - args.b;
      break;
    case "multiply":
      result = args.a * args.b;
      break;
    case "divide":
      result = args.a / args.b;
      break;
    default:
      return JSON.stringify({ error: "Unknown operation" });
  }
  return JSON.stringify({ result });
}

async function main(): Promise<void> {
  const model = process.env.OPENAI_TEST_MODEL ?? "gpt-4o-mini";

  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is required to run this test.");
    process.exit(1);
  }

  console.log("=== OpenAI Function Calling Test ===\n");
  console.log(`Model: ${model}\n`);

  // Step 1: Send initial request with tools
  console.log("Step 1: Asking model to call weather and calculator tools...");
  const initialResponse = await fetch(`${BASE_URL}/api/text/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider: "openai",
      model,
      messages: [
        {
          role: "user",
          content:
            "What's the weather in San Francisco in celsius? Also calculate 42 * 17.",
        },
      ],
      tools: [weatherTool, calculatorTool],
      maxTokens: 300,
    }),
  });

  if (!initialResponse.ok) {
    console.error(
      `Request failed: ${initialResponse.status} ${initialResponse.statusText}`,
    );
    const text = await initialResponse.text();
    console.error(text);
    process.exit(1);
  }

  const initialData = (await initialResponse.json()) as GenerateResponse;

  if (!initialData.success || !initialData.result) {
    console.error("Test failed:", initialData.error ?? "Unknown error");
    process.exit(1);
  }

  console.log(`Text response: "${initialData.result.text}"`);

  if (
    !initialData.result.toolCalls ||
    initialData.result.toolCalls.length === 0
  ) {
    console.error("ERROR: Expected tool calls but got none!");
    console.log("Full response:", JSON.stringify(initialData, null, 2));
    process.exit(1);
  }

  console.log(`\nTool calls received: ${initialData.result.toolCalls.length}`);
  for (const toolCall of initialData.result.toolCalls) {
    console.log(`  - ${toolCall.name}(${toolCall.arguments})`);
  }

  // Step 2: Execute tools and send results back
  console.log("\nStep 2: Executing tools and sending results...");
  const messages = [
    {
      role: "user" as const,
      content:
        "What's the weather in San Francisco in celsius? Also calculate 42 * 17.",
    },
    {
      role: "assistant" as const,
      content: initialData.result.text || "",
      tool_calls: initialData.result.toolCalls,
    },
  ];

  // Execute each tool call and add tool messages
  for (const toolCall of initialData.result.toolCalls) {
    const args = JSON.parse(toolCall.arguments);
    let result: string;

    if (toolCall.name === "get_weather") {
      result = executeWeather(args);
      console.log(`  Executed get_weather: ${result}`);
    } else if (toolCall.name === "calculate") {
      result = executeCalculator(args);
      console.log(`  Executed calculate: ${result}`);
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
      provider: "openai",
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

  if (followUpData.result.usage) {
    console.log("\nToken usage:", followUpData.result.usage);
  }

  console.log("\n✓ OpenAI function calling test completed successfully!");
}

main().catch((error) => {
  console.error("Unexpected error during OpenAI tools test", error);
  process.exit(1);
});
