import dotenv from "dotenv";
dotenv.config({ quiet: true });

const BASE_URL = process.env.TEST_SERVER_URL ?? "http://localhost:3001";

async function main(): Promise<void> {
  const prompt =
    process.argv[2] ?? "Describe how to set up a local LLM with Ollama.";
  const model = process.env.OLLAMA_TEST_MODEL ?? "gpt-oss:20b";

  const response = await fetch(`${BASE_URL}/api/text/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider: "ollama",
      model,
      messages: [
        { role: "system", content: "Keep the answer under 120 words." },
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
  console.error("Unexpected error during Ollama text test", error);
  process.exit(1);
});
