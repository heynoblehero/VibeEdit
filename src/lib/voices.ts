// OpenAI TTS preset voices. Kept in one place so every selector matches.
export const OPENAI_VOICES = [
  "alloy",
  "echo",
  "fable",
  "onyx",
  "nova",
  "shimmer",
] as const;
export type OpenAIVoice = (typeof OPENAI_VOICES)[number];

export const DEFAULT_VOICE: OpenAIVoice = "nova";
