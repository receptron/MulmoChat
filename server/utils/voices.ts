// The voices each voice API speaks with. Browser-safe: the settings screen
// lists them, and the server checks the OpenAI and ElevenLabs ones it is sent.

export type VoiceProvider = "openai" | "google" | "xai" | "elevenlabs";

export interface VoiceOption {
  id: string;
  label: string;
}

const option = (id: string, style?: string): VoiceOption => {
  const name = id.charAt(0).toUpperCase() + id.slice(1);
  return { id, label: style ? `${name} (${style})` : name };
};

export const VOICES: Record<VoiceProvider, readonly VoiceOption[]> = {
  // The values OpenAI's client_secrets accepts for gpt-realtime-2.1 (it
  // rejects anything else with the list); marin and cedar are realtime-only.
  openai: [
    "alloy",
    "ash",
    "ballad",
    "cedar",
    "coral",
    "echo",
    "marin",
    "sage",
    "shimmer",
    "verse",
  ].map((id) => option(id)),
  // Gemini Live's prebuilt voices, with the style Google gives each. The API
  // accepts an unknown name without an error, so this list is the only check.
  google: [
    ["Zephyr", "Bright"],
    ["Puck", "Upbeat"],
    ["Charon", "Informative"],
    ["Kore", "Firm"],
    ["Fenrir", "Excitable"],
    ["Leda", "Youthful"],
    ["Orus", "Firm"],
    ["Aoede", "Breezy"],
    ["Callirrhoe", "Easy-going"],
    ["Autonoe", "Bright"],
    ["Enceladus", "Breathy"],
    ["Iapetus", "Clear"],
    ["Umbriel", "Easy-going"],
    ["Algieba", "Smooth"],
    ["Despina", "Smooth"],
    ["Erinome", "Clear"],
    ["Algenib", "Gravelly"],
    ["Rasalgethi", "Informative"],
    ["Laomedeia", "Upbeat"],
    ["Achernar", "Soft"],
    ["Alnilam", "Firm"],
    ["Schedar", "Even"],
    ["Gacrux", "Mature"],
    ["Pulcherrima", "Forward"],
    ["Achird", "Friendly"],
    ["Zubenelgenubi", "Casual"],
    ["Vindemiatrix", "Gentle"],
    ["Sadachbia", "Lively"],
    ["Sadaltager", "Knowledgeable"],
    ["Sulafat", "Warm"],
  ].map(([id, style]) => option(id, style)),
  // xAI's built-in voices. Like Gemini, the API takes an unknown name silently.
  xai: [
    ["ara", "Warm"],
    ["eve", "Energetic"],
    ["leo", "Authoritative"],
    ["rex", "Confident"],
    ["sal", "Smooth"],
  ].map(([id, style]) => option(id, style)),
  // The names ElevenLabs Realtime's client_secrets accepts (it rejects any
  // other with this list). It also takes OpenAI's names and a workspace's
  // voice IDs, which are not offered here.
  elevenlabs: [
    "brian",
    "chris",
    "george",
    "jessica",
    "liam",
    "lily",
    "matilda",
    "michael",
    "sarah",
    "will",
  ].map((id) => option(id)),
};

// shimmer and eve are the voices MulmoChat used before the choice existed;
// Puck is what Google documents as Gemini Live's default, used when none was
// sent; brian is the one ElevenLabs' Realtime guide uses.
export const DEFAULT_VOICES: Record<VoiceProvider, string> = {
  openai: "shimmer",
  google: "Puck",
  xai: "eve",
  elevenlabs: "brian",
};

/** The voice to use: `value` when the provider offers it, else its default. */
export const resolveVoice = (
  provider: VoiceProvider,
  value: unknown,
): string =>
  VOICES[provider].some((v) => v.id === value)
    ? (value as string)
    : DEFAULT_VOICES[provider];
