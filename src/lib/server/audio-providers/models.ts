/**
 * Catalog for AI-generated music and SFX. Same shape as media + voice
 * catalogs. Music goes on project.music; SFX can be attached to a scene's
 * background or used as a stinger.
 */

export type AudioKind = "music" | "sfx";
export type AudioProvider = "replicate" | "elevenlabs";

export interface AudioModel {
  id: string;
  kind: AudioKind;
  provider: AudioProvider;
  /** Replicate slug or ElevenLabs endpoint identifier. */
  slug?: string;
  name: string;
  description: string;
  tags: string[];
  estimatedCostUsd: number;
  /** Max clip length the model is happy with. */
  maxDurationSec: number;
}

export const AUDIO_MODELS: AudioModel[] = [
  // ----- MUSIC -----
  {
    id: "musicgen",
    kind: "music",
    provider: "replicate",
    slug: "meta/musicgen",
    name: "MusicGen (Meta)",
    description:
      "Default music generator. Prompt-driven, decent quality, cheap. Use when the user wants a backing track described in words ('upbeat lo-fi for a coding montage').",
    tags: ["default", "value", "instrumental"],
    estimatedCostUsd: 0.07,
    maxDurationSec: 30,
  },
  {
    id: "musicgen-melody",
    kind: "music",
    provider: "replicate",
    slug: "meta/musicgen:7be0f12c54a8d033a0fbd14418c9af98962da9a86f5ff7811f9b3423a1f0b7d7",
    name: "MusicGen Melody",
    description:
      "MusicGen melody-conditioned variant. Pass an existing melody/audio file to extend or stylize. Use when the user has a hummed reference or wants continuity with a prior track.",
    tags: ["melody", "i2m"],
    estimatedCostUsd: 0.1,
    maxDurationSec: 30,
  },
  {
    id: "stable-audio",
    kind: "music",
    provider: "replicate",
    slug: "stackadoc/stable-audio-open-1.0",
    name: "Stable Audio Open",
    description:
      "Stability AI's open music + sound model. Higher quality than MusicGen for cinematic / atmospheric content. Slightly pricier.",
    tags: ["cinematic", "atmospheric", "premium"],
    estimatedCostUsd: 0.15,
    maxDurationSec: 47,
  },

  // ----- SFX -----
  {
    id: "elevenlabs-sfx",
    kind: "sfx",
    provider: "elevenlabs",
    name: "ElevenLabs Sound Effects",
    description:
      "Default sound-effect generator. Prompt-driven 1-22s clips ('whoosh transition', 'thunder rolling', 'crowd cheering'). Best in class for short SFX.",
    tags: ["default", "premium"],
    estimatedCostUsd: 0.05,
    maxDurationSec: 22,
  },
  {
    id: "audiogen",
    kind: "sfx",
    provider: "replicate",
    slug: "sepal/audiogen",
    name: "AudioGen (Meta)",
    description:
      "Open-weights SFX. Cheaper than ElevenLabs but less crisp. Use for bulk filler or when ElevenLabs API key isn't set.",
    tags: ["cheap", "open"],
    estimatedCostUsd: 0.05,
    maxDurationSec: 10,
  },
];

export function getAudioModel(id: string): AudioModel | undefined {
  return AUDIO_MODELS.find((m) => m.id === id);
}

export function defaultAudioModelId(kind: AudioKind): string {
  return kind === "music" ? "musicgen" : "elevenlabs-sfx";
}

export function audioCatalogSystemBlock(): string {
  const lines = [
    "Available music + SFX models (pass modelId to generateMusicForProject / generateSfxForScene; omit for default):",
  ];
  for (const m of AUDIO_MODELS) {
    lines.push(
      `- ${m.id} [${m.kind}] · ~$${m.estimatedCostUsd}/gen · max ${m.maxDurationSec}s · ${m.tags.join(", ")} — ${m.description}`,
    );
  }
  return lines.join("\n");
}
