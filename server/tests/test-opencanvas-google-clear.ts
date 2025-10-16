import "dotenv/config";

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

// Define the openCanvas tool
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

  console.log("=== Google Gemini OpenCanvas Test (Clear Prompt) ===\n");
  console.log(`Model: ${model}\n`);

  // Use a clearer prompt that doesn't conflict with "OpenCanvas" the desktop app
  console.log('Step 1: Sending message "call the openCanvas function"...');
  const response = await fetch(`${BASE_URL}/api/text/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider: "google",
      model,
      messages: [
        {
          role: "user",
          content: "call the openCanvas function",
        },
      ],
      tools: [openCanvasTool],
      maxTokens: 300,
    }),
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

  console.log(`\nModel response text: "${data.result.text}"`);

  if (!data.result.toolCalls || data.result.toolCalls.length === 0) {
    console.error(
      "\n❌ TEST FAILED: Expected openCanvas tool call but got none!",
    );
    console.log("Full response:", JSON.stringify(data, null, 2));
    process.exit(1);
  }

  console.log(`\n✓ Tool calls received: ${data.result.toolCalls.length}`);

  const openCanvasCall = data.result.toolCalls.find(
    (call) => call.name === "openCanvas",
  );

  if (!openCanvasCall) {
    console.error(
      '\n❌ TEST FAILED: Expected tool call to "openCanvas" but got:',
    );
    for (const toolCall of data.result.toolCalls) {
      console.log(`  - ${toolCall.name}(${toolCall.arguments})`);
    }
    process.exit(1);
  }

  console.log("\n✓ Verified: LLM called openCanvas tool");
  console.log(`  Tool Call ID: ${openCanvasCall.id}`);
  console.log(`  Arguments: ${openCanvasCall.arguments || "(no arguments)"}`);

  if (data.result.usage) {
    console.log("\nToken usage:", data.result.usage);
  }

  console.log(
    "\n✅ TEST PASSED: Google Gemini correctly generated openCanvas tool call!",
  );
}

main().catch((error) => {
  console.error("Unexpected error during Google Gemini openCanvas test", error);
  process.exit(1);
});
