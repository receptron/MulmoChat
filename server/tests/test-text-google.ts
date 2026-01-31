import dotenv from "dotenv";
dotenv.config({ quiet: true });

const BASE_URL = process.env.TEST_SERVER_URL ?? "http://localhost:3001";

async function main(): Promise<void> {
  const prompt =
    process.argv[2] ?? "List three creative use cases for realtime AI.";
  const model = process.env.GEMINI_TEST_MODEL ?? "gemini-2.5-flash";

  if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is required to run this test.");
    process.exit(1);
  }

  const response = await fetch(`${BASE_URL}/api/text/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      provider: "google",
      model,
      messages: [
        { role: "system", content: "Respond in exactly three numbered items." },
        { role: "user", content: prompt },
      ],
      maxTokens: 400,
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
  console.error("Unexpected error during Google Gemini text test", error);
  process.exit(1);
});
