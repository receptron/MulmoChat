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

// Define the openCanvas tool - matches the actual tool definition
const openCanvasTool = {
  type: "function",
  name: "openCanvas",
  description:
    "Open a drawing canvas for the user to create drawings, sketches, or diagrams.",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
};

async function main(): Promise<void> {
  const model = process.env.GEMINI_TEST_MODEL ?? "gemini-2.5-flash";

  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is required to run this test.");
    process.exit(1);
  }

  console.log("=== Google Gemini OpenCanvas Debug Test ===\n");
  console.log(`Model: ${model}\n`);

  const requestBody = {
    provider: "google",
    model,
    messages: [
      {
        role: "user",
        content: "open canvas",
      },
    ],
    tools: [openCanvasTool],
    maxTokens: 300,
  };

  console.log("Request being sent:");
  console.log(JSON.stringify(requestBody, null, 2));
  console.log("\n" + "=".repeat(60) + "\n");

  const response = await fetch(`${BASE_URL}/api/text/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    console.error(`Request failed: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.error(text);
    process.exit(1);
  }

  const data = (await response.json()) as GenerateResponse;

  if (!data.success || !data.result) {
    console.error("Test failed:", data.error ?? "Unknown error");
    process.exit(1);
  }

  console.log("Response received:");
  console.log(JSON.stringify(data, null, 2));
  console.log("\n" + "=".repeat(60) + "\n");

  console.log(`Model response text: "${data.result.text}"`);
  console.log(`\nTool calls: ${data.result.toolCalls?.length ?? 0}`);

  if (data.result.toolCalls && data.result.toolCalls.length > 0) {
    console.log("\n✓ SUCCESS: Tool calls received!");
    for (const toolCall of data.result.toolCalls) {
      console.log(`  - ${toolCall.name}(${toolCall.arguments})`);
    }
  } else {
    console.log("\n⚠️  No tool calls received");
  }
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
