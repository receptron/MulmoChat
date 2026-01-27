import dotenv from "dotenv";
dotenv.config({ quiet: true });

const BASE_URL = process.env.TEST_SERVER_URL ?? "http://localhost:3001";

async function main(): Promise<void> {
  const prompt =
    process.argv[2] ?? "Summarize the benefits of structured tool calls.";
  const model = process.env.ANTHROPIC_TEST_MODEL ?? "claude-3-5-sonnet-latest";

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY is required to run this test.");
    process.exit(1);
  }

  const response = await fetch(`${BASE_URL}/api/text/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider: "anthropic",
      model,
      messages: [
        { role: "system", content: "You speak in short bullet points." },
        { role: "user", content: prompt },
      ],
      maxTokens: 200,
    }),
  });

  if (!response.ok) {
    console.error(`Request failed: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.error(text);
    process.exit(1);
  }

  const data = (await response.json()) as {
    success: boolean;
    result?: { text: string; model: string };
    error?: string;
  };

  if (!data.success || !data.result) {
    console.error("Test failed:", data.error ?? "Unknown error");
    process.exit(1);
  }

  console.log(`Model: ${data.result.model}`);
  console.log("Response: \n", data.result.text.trim());
}

main().catch((error) => {
  console.error("Unexpected error during Anthropic text test", error);
  process.exit(1);
});
