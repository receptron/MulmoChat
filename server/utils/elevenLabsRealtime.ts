// ElevenLabs Realtime's models and audio. Browser-safe: the settings screen
// lists the models and the browser captures at the rate, and the server mints
// a secret for one of these models at that rate (both are fixed in the
// secret, not chosen in the WebSocket URL).

/** PCM16 both ways; the microphone is captured at it. */
export const ELEVENLABS_SAMPLE_RATE = 24000;

export interface ElevenLabsVoiceModelOption {
  id: string;
  label: string;
  description?: string;
}

// Max first: MulmoChat is tool-heavy, and ElevenLabs measures Max at 87% on
// tool use to Mini's 60%.
export const ELEVENLABS_VOICE_MODELS: ElevenLabsVoiceModelOption[] = [
  {
    id: "eleven_realtime_v1_max",
    label: "Eleven Realtime v1 Max",
    description: "Reasons before replying; for multi-step tool use",
  },
  {
    id: "eleven_realtime_v1_mini",
    label: "Eleven Realtime v1 Mini",
    description: "Lower latency and cost; weaker at tool use",
  },
];

export const DEFAULT_ELEVENLABS_VOICE_MODEL_ID = ELEVENLABS_VOICE_MODELS[0].id;

/** The model to mint for: `value` when it is one of ours, else the default. */
export const resolveElevenLabsModel = (value: unknown): string =>
  ELEVENLABS_VOICE_MODELS.some((m) => m.id === value)
    ? (value as string)
    : DEFAULT_ELEVENLABS_VOICE_MODEL_ID;
