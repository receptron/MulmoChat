// OpenAI's Live API (gpt-live-1): the voice model that talks, and the
// Responses model it delegates reasoning and tool calls to. Browser-safe: the
// settings screen lists the pairs, and the server starts a session only for
// one of them.

export interface LiveVoiceModelOption {
  /** `<live model>/<backend model>`, the value kept in the preferences. */
  id: string;
  label: string;
  description?: string;
}

// The newest first: it is the default. 1.1 hears and pronounces languages
// better than 1 at the same price; 1 stays for comparison.
const LIVE_MODELS: Array<{ model: string; name: string }> = [
  { model: "gpt-live-1.1", name: "GPT-Live 1.1" },
  { model: "gpt-live-1", name: "GPT-Live 1" },
];

// The backend decides how well tools are used and how long the user waits.
// Luna first: OpenAI's guide starts with it, and it called a tool about a
// second after being asked where Terra and Sol took 2 to 5 and Astra about 10
// (one run each against the API, 2026-11-19).
const BACKENDS: Array<{ model: string; name: string; description: string }> = [
  {
    model: "gpt-6-luna",
    name: "GPT-6 Luna",
    description: "Fastest backend; OpenAI's recommended starting point",
  },
  {
    model: "gpt-6.1-terra",
    name: "GPT-6.1 Terra",
    description: "A stronger backend that is still quick",
  },
  {
    model: "gpt-6.2-sol",
    name: "GPT-6.2 Sol",
    description: "Newest Sol backend, for harder multi-step tool use",
  },
  {
    model: "gpt-6.2-astra",
    name: "GPT-6.2 Astra",
    description: "Most capable backend; replies take noticeably longer",
  },
];

export const LIVE_VOICE_MODELS: LiveVoiceModelOption[] = LIVE_MODELS.flatMap(
  (live) =>
    BACKENDS.map(({ model, name, description }) => ({
      id: `${live.model}/${model}`,
      label: `${live.name} + ${name}`,
      description,
    })),
);

export const DEFAULT_LIVE_VOICE_MODEL_ID = LIVE_VOICE_MODELS[0].id;

/** The pair to start a session with: `value` when it is one of ours, else
 *  the default. */
export const resolveLiveModels = (
  value: unknown,
): { live: string; backend: string } => {
  const id = LIVE_VOICE_MODELS.some((m) => m.id === value)
    ? (value as string)
    : DEFAULT_LIVE_VOICE_MODEL_ID;
  const [live, backend] = id.split("/");
  return { live, backend };
};
