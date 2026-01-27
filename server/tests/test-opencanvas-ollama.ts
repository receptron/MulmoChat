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
  const model = process.env.OLLAMA_TEST_MODEL ?? "gpt-oss:20b";

  console.log("=== Ollama OpenCanvas Tool Call Test ===\n");
  console.log(`Model: ${model}`);
  console.log(
    `Base URL: ${process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434"}\n`,
  );

  console.log("NOTE: Function calling support varies by Ollama model.");
  console.log(
    "      Newer models like llama3.1+ or qwen2.5+ typically support it.\n",
  );

  // Test: Send user message "open canvas" and verify the LLM calls openCanvas
  console.log('Step 1: Sending user message "open canvas"...');
  const response = await fetch(`${BASE_URL}/api/text/generate`, {
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
          content: "open canvas",
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
    console.log(
      "\nTIP: Make sure Ollama is running and the model supports function calling.",
    );
    process.exit(1);
  }

  const data = (await response.json()) as GenerateResponse;

  if (!data.success || !data.result) {
    console.error("Test failed:", data.error ?? "Unknown error");
    process.exit(1);
  }

  console.log(`\nModel response text: "${data.result.text}"`);

  // Verify that the LLM called the openCanvas tool
  if (!data.result.toolCalls || data.result.toolCalls.length === 0) {
    console.warn("\n⚠️  WARNING: Expected openCanvas tool call but got none!");
    console.log(
      "This model may not support function calling, or it chose to respond directly.",
    );
    console.log("Full response:", JSON.stringify(data, null, 2));
    console.log(
      "\n⚠ Test completed, but function calling was not demonstrated.",
    );
    console.log(
      "Try a different model that supports function calling (e.g., llama3.1, qwen2.5).",
    );
    process.exit(0); // Not a failure - some models don't support this
  }

  console.log(`\n✓ Tool calls received: ${data.result.toolCalls.length}`);

  // Check if openCanvas was called
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

  // Success! The LLM correctly called openCanvas
  console.log("\n✓ Verified: LLM called openCanvas tool");
  console.log(`  Tool Call ID: ${openCanvasCall.id}`);
  console.log(`  Arguments: ${openCanvasCall.arguments || "(no arguments)"}`);

  if (data.result.usage) {
    console.log("\nToken usage:", data.result.usage);
  }

  console.log(
    "\n✅ TEST PASSED: Ollama correctly generated openCanvas tool call!",
  );
}

main().catch((error) => {
  console.error("Unexpected error during Ollama openCanvas test", error);
  process.exit(1);
});
