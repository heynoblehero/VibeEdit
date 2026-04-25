// /api/setup — probe every provider key and return a status report so the
// chat /setup command can tell the user exactly what to configure on
// dokku (or in .env.local).

import { applyStoredKeys } from "@/lib/server/runtime-keys";

export const runtime = "nodejs";

interface ProviderCheck {
  name: string;
  ok: boolean;
  envVar?: string;
  note: string;
}

export async function GET() {
  applyStoredKeys();
  const checks: ProviderCheck[] = [];

  // Anthropic / claude (always required for the agent itself).
  checks.push({
    name: "Claude (agent)",
    ok: !!process.env.ANTHROPIC_API_KEY,
    envVar: "ANTHROPIC_API_KEY",
    note: process.env.ANTHROPIC_BASE_URL
      ? `Routed via proxy: ${process.env.ANTHROPIC_BASE_URL}`
      : "Direct Anthropic API",
  });

  // Image: any of these works.
  const hasImg = !!(
    process.env.OPENAI_API_KEY || process.env.REPLICATE_API_TOKEN
  );
  checks.push({
    name: "Image generation",
    ok: true, // pollinations is the always-on free fallback
    envVar: hasImg ? undefined : "OPENAI_API_KEY or REPLICATE_API_TOKEN (fallback: free Pollinations)",
    note: process.env.OPENAI_API_KEY
      ? "gpt-image-1 (OpenAI) — premium edits, photoreal"
      : process.env.REPLICATE_API_TOKEN
        ? "Flux 1.1 Pro Ultra (Replicate) — top quality"
        : "Free pollinations.ai fallback — set OPENAI_API_KEY or REPLICATE_API_TOKEN to upgrade",
  });

  // Video: only Replicate today.
  checks.push({
    name: "Video generation",
    ok: !!process.env.REPLICATE_API_TOKEN,
    envVar: "REPLICATE_API_TOKEN",
    note: process.env.REPLICATE_API_TOKEN
      ? "Seedance, Kling, Veo 3, LTX all available"
      : "Set REPLICATE_API_TOKEN to enable text-to-video",
  });

  // Voice: OpenAI TTS or ElevenLabs.
  const hasVoice = !!(
    process.env.OPENAI_API_KEY || process.env.ELEVENLABS_API_KEY
  );
  checks.push({
    name: "Voiceover (TTS)",
    ok: hasVoice,
    envVar: hasVoice ? undefined : "OPENAI_API_KEY or ELEVENLABS_API_KEY",
    note: process.env.OPENAI_API_KEY
      ? "OpenAI gpt-4o-mini-tts (6 voices)"
      : process.env.ELEVENLABS_API_KEY
        ? "ElevenLabs only — set OPENAI_API_KEY for cheap fallback"
        : "No TTS — narrateScene will fail",
  });

  // Music + SFX
  checks.push({
    name: "Music generation",
    ok: !!process.env.REPLICATE_API_TOKEN,
    envVar: "REPLICATE_API_TOKEN",
    note: process.env.REPLICATE_API_TOKEN
      ? "MusicGen + Stable Audio"
      : "Set REPLICATE_API_TOKEN",
  });
  checks.push({
    name: "Sound effects",
    ok: !!(process.env.ELEVENLABS_API_KEY || process.env.REPLICATE_API_TOKEN),
    envVar: "ELEVENLABS_API_KEY or REPLICATE_API_TOKEN",
    note: process.env.ELEVENLABS_API_KEY
      ? "ElevenLabs SFX (best)"
      : process.env.REPLICATE_API_TOKEN
        ? "AudioGen on Replicate"
        : "Neither set — generateSfxForScene fails",
  });

  // Web search
  const sp = process.env.SEARCH_PROVIDER;
  checks.push({
    name: "Web search",
    ok: !!(sp && sp !== "none"),
    envVar: "SEARCH_PROVIDER + TAVILY_API_KEY (or SERPER_API_KEY)",
    note: sp && sp !== "none"
      ? `${sp} configured`
      : "webSearch tool will 501 — agent can't fetch references",
  });

  // Avatar
  checks.push({
    name: "Talking-head avatars",
    ok: !!process.env.AVATAR_PROVIDER && process.env.AVATAR_PROVIDER !== "none",
    envVar: "AVATAR_PROVIDER + FAL_API_KEY",
    note: process.env.AVATAR_PROVIDER
      ? `${process.env.AVATAR_PROVIDER}`
      : "No avatar provider — generateAvatarForScene fails",
  });

  return Response.json({ checks });
}
