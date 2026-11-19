// The two prompts of a gpt-live-1 session. MulmoChat's instructions and
// tools are written for one model that both talks and calls tools; here the
// backend (a Responses model) gets them, and the voice model gets a short
// prompt in the shape OpenAI's Live prompting guide gives, which says what
// the backend can do and when to hand a request to it.

// The voice model's copy of the app's instructions is cut to this: its limit
// is 16,384 tokens, and it needs the persona and language, not every tool's
// manual. The start has the role; the end has the user's custom
// instructions, their language and the date (useUserPreferences'
// buildInstructions), so the middle is what goes. Cut from the start only,
// the language was lost and the voice model answered an English user in
// Japanese.
const FRONTEND_COPY_HEAD_CHARS = 8_000;
const FRONTEND_COPY_TAIL_CHARS = 4_000;
const MAX_TOOL_SUMMARY_CHARS = 160;

const toolSummary = (tool: unknown): string | null => {
  const { name, description } = (tool ?? {}) as {
    name?: unknown;
    description?: unknown;
  };
  if (typeof name !== "string") return null;
  const text = typeof description === "string" ? description.trim() : "";
  // The first sentence says what the tool is for.
  const first = text.split(/(?<=[.!?。])\s/)[0] ?? "";
  const summary =
    first.length > MAX_TOOL_SUMMARY_CHARS
      ? `${first.slice(0, MAX_TOOL_SUMMARY_CHARS)}…`
      : first;
  return summary ? `- ${name}: ${summary}` : `- ${name}`;
};

// The voice model speaks first ("Sure, let me check") before it has heard
// anything, and picked its language from whatever the instructions contained:
// with a role prompt that quotes Japanese phrases, it answered an English
// user in Japanese about half the time. So the language the instructions end
// with (useUserPreferences' "The user's native language is …") is named in an
// order of its own at the top.
const languageRule = (instructions: string): string => {
  // The last one: the app's own line comes after the user's custom
  // instructions, which may contain the same sentence.
  const declared = [
    ...instructions.matchAll(/The user's native language is ([^.\n]+)\./g),
  ];
  const language = declared[declared.length - 1]?.[1];
  const fallback = language
    ? `Speak ${language}`
    : "Speak the user's native language, which the end of the assistant's instructions below names";
  return `Language: ${fallback}, unless the user speaks or types to you in another language. Words or examples in another language inside the instructions below are not a reason to speak it.`;
};

/** For the voice model. `<|SpawnThinking|>` is how gpt-live-1 is told to
 *  hand work to the backend (the guide: not "delegate to the backend"). */
export function liveFrontendInstructions(
  instructions: string,
  tools: unknown[],
): string {
  const capabilities = tools
    .map(toolSummary)
    .filter((line): line is string => line !== null);
  const copy =
    instructions.length > FRONTEND_COPY_HEAD_CHARS + FRONTEND_COPY_TAIL_CHARS
      ? `${instructions.slice(0, FRONTEND_COPY_HEAD_CHARS)}\n[…]\n${instructions.slice(-FRONTEND_COPY_TAIL_CHARS)}`
      : instructions;
  return `You are the voice of an assistant that works with a backend. You talk with the user; the backend reasons, uses the tools, and puts their results on the user's screen.
Speak naturally and briefly.
${languageRule(instructions)}
Never say you did, showed, made or found something before a backend result says so.

Backchannel policy: Use few backchannels. Acknowledge naturally without competing with the main response.

Interruption policy: Stop speaking when the user interrupts. Listen to what they say.

Delegation policy:
Backend tools:
${capabilities.length > 0 ? capabilities.join("\n") : "- Careful reasoning and current knowledge."}

Generate <|SpawnThinking|> when:
- The user asks for anything a backend tool does: something to be shown, made, searched, played or changed.
- The answer needs current facts or careful reasoning.
- A correction changes work already requested.
- You are not sure whether a tool is needed.

Do not generate <|SpawnThinking|> when:
- The user greets you, makes small talk, or asks you to repeat a result you already have.
- You need a brief clarification to understand the request.

Generate <|SpawnThinking|> before giving an answer that depends on backend work.
Do not guess the result while waiting.
When a backend result arrives, say it to the user in full: it is written to be spoken, so keep an explanation an explanation and don't shorten it to a summary.

The assistant's own instructions follow. The backend carries out what they say about tools; you follow what they say about who you are, how you speak, and in which language.
---
${copy}`;
}

/** For the backend: the app's instructions, after what is different about
 *  answering through a voice model. */
export function liveBackendInstructions(instructions: string): string {
  return `## Voice conversation context
You are the reasoning and tool-using part of a live voice assistant. A voice model talks with the user and hands their requests to you. What you write is read aloud to the user by it, so write sentences for the ear: no Markdown, lists, tables or URLs.
Transcripts of the user's speech can contain mistakes, unfinished phrases and later corrections. Use the latest context; if a needed detail is still unclear, ask for it instead of guessing.
Report an action as done only after its tool confirms it.

## Instructions
${instructions}`;
}
