/**
 * Voice catalog. Same shape as media-providers/models.ts so the agent and
 * UI can introspect TTS options the same way they handle image/video models.
 *
 * id: stable identifier the agent + UI use.
 * voiceParam: what to send to /api/voiceover (`voice` for OpenAI,
 *   `elevenLabsVoiceId` for ElevenLabs).
 */

export type VoiceProvider = "openai" | "elevenlabs" | "replicate";

export interface VoiceModel {
  id: string;
  provider: VoiceProvider;
  /** What gets sent to the TTS endpoint as the actual voice identifier. */
  voiceParam: string;
  name: string;
  description: string;
  /** Vocal qualities — agent picks based on these tags. */
  tags: string[];
  /** Approximate cost per 1k chars, USD. */
  costPer1kChars: number;
  /** "Speak in this language" hint. */
  language: string;
  /** Public sample URL when available. */
  sampleUrl?: string;
}

export const VOICES: VoiceModel[] = [
  // ----- OpenAI gpt-4o-mini-tts -----
  {
    id: "openai-nova",
    provider: "openai",
    voiceParam: "nova",
    name: "Nova",
    description:
      "Warm, friendly female. Default for upbeat / lifestyle / educational narration.",
    tags: ["female", "warm", "default", "friendly"],
    costPer1kChars: 0.015,
    language: "en",
  },
  {
    id: "openai-onyx",
    provider: "openai",
    voiceParam: "onyx",
    name: "Onyx",
    description: "Deep male voice. Best for serious / authoritative narration.",
    tags: ["male", "deep", "authoritative", "documentary"],
    costPer1kChars: 0.015,
    language: "en",
  },
  {
    id: "openai-shimmer",
    provider: "openai",
    voiceParam: "shimmer",
    name: "Shimmer",
    description: "Bright energetic female. Pop / TikTok / hype content.",
    tags: ["female", "energetic", "tiktok", "young"],
    costPer1kChars: 0.015,
    language: "en",
  },
  {
    id: "openai-echo",
    provider: "openai",
    voiceParam: "echo",
    name: "Echo",
    description: "Neutral male. Tech tutorials / product walkthroughs.",
    tags: ["male", "neutral", "tutorial"],
    costPer1kChars: 0.015,
    language: "en",
  },
  {
    id: "openai-fable",
    provider: "openai",
    voiceParam: "fable",
    name: "Fable",
    description:
      "British male, storyteller cadence. Best for narrative / true-crime / explainers.",
    tags: ["male", "british", "narrative", "storytelling"],
    costPer1kChars: 0.015,
    language: "en",
  },
  {
    id: "openai-alloy",
    provider: "openai",
    voiceParam: "alloy",
    name: "Alloy",
    description: "Gender-neutral. Calm, balanced. Generic narration when unsure.",
    tags: ["neutral", "calm", "balanced"],
    costPer1kChars: 0.015,
    language: "en",
  },

  // ----- ElevenLabs preset voices (must exist in caller's account) -----
  // The voiceParam is the ElevenLabs voice_id. These IDs are public
  // ElevenLabs default voices anyone with an API key can use.
  {
    id: "11labs-rachel",
    provider: "elevenlabs",
    voiceParam: "21m00Tcm4TlvDq8ikWAM",
    name: "Rachel (ElevenLabs)",
    description:
      "Calm, conversational American female. Industry default for premium narration.",
    tags: ["female", "premium", "warm", "narrative"],
    costPer1kChars: 0.18,
    language: "en",
  },
  {
    id: "11labs-adam",
    provider: "elevenlabs",
    voiceParam: "pNInz6obpgDQGcFmaJgB",
    name: "Adam (ElevenLabs)",
    description: "Deep American male. Cinematic trailers, news, documentary.",
    tags: ["male", "deep", "cinematic", "trailer"],
    costPer1kChars: 0.18,
    language: "en",
  },
  {
    id: "11labs-bella",
    provider: "elevenlabs",
    voiceParam: "EXAVITQu4vr4xnSDxMaL",
    name: "Bella (ElevenLabs)",
    description: "Soft young American female. Storytelling, vlogs.",
    tags: ["female", "young", "soft", "storytelling"],
    costPer1kChars: 0.18,
    language: "en",
  },
];

export function getVoice(id: string): VoiceModel | undefined {
  return VOICES.find((v) => v.id === id);
}

export function defaultVoiceId(): string {
  return "openai-nova";
}

export function voiceCatalogSystemBlock(): string {
  const lines = [
    "Available TTS voices (pass voiceId to narrateScene / narrateAllScenes; omit for default 'openai-nova'):",
  ];
  for (const v of VOICES) {
    lines.push(
      `- ${v.id} [${v.provider}] · $${v.costPer1kChars}/1k chars · ${v.tags.join(", ")} — ${v.description}`,
    );
  }
  return lines.join("\n");
}
