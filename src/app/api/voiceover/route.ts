import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

interface VoiceoverRequest {
  text: string;
  voice?: string;
  speed?: number;
  /**
   * If set, use ElevenLabs TTS with this cloned voice id instead of OpenAI.
   */
  elevenLabsVoiceId?: string;
}

const VOICEOVER_DIR = path.join(process.cwd(), "public", "voiceovers");
try {
  fs.mkdirSync(VOICEOVER_DIR, { recursive: true });
} catch {
  // dir exists
}

function keyFor(text: string, voice: string, speed: number): string {
  return crypto
    .createHash("sha1")
    .update(`${voice}:${speed}:${text}`)
    .digest("hex")
    .slice(0, 20);
}

// Rough duration estimate when the provider doesn't return one. Based on
// average English narration pace (~2.7 words/sec at speed=1).
function estimateDurationSec(text: string, speed: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  const base = words / 2.7;
  return Math.max(0.8, base / Math.max(0.25, speed));
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as VoiceoverRequest;
  if (!body.text?.trim()) {
    return Response.json({ error: "text required" }, { status: 400 });
  }

  // Route to ElevenLabs if caller supplied a cloned voice id.
  if (body.elevenLabsVoiceId) {
    const elevenKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenKey) {
      return Response.json(
        { error: "ELEVENLABS_API_KEY required for cloned voices" },
        { status: 503 },
      );
    }
    const voice = body.elevenLabsVoiceId;
    const key = keyFor(body.text, `eleven:${voice}`, 1);
    const filename = `${key}.mp3`;
    const audioUrl = `/voiceovers/${filename}`;
    const outPath = path.join(VOICEOVER_DIR, filename);
    if (fs.existsSync(outPath)) {
      return Response.json({
        audioUrl,
        audioDurationSec: estimateDurationSec(body.text, 1),
        cached: true,
        provider: "elevenlabs" as const,
        voice,
      });
    }
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": elevenKey,
          accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: body.text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.5, similarity_boost: 0.8 },
        }),
      },
    );
    if (!res.ok) {
      const err = await res.text();
      return Response.json(
        { error: `ElevenLabs TTS error ${res.status}: ${err.slice(0, 300)}` },
        { status: 502 },
      );
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    await fs.promises.writeFile(outPath, buffer);
    return Response.json({
      audioUrl,
      audioDurationSec: estimateDurationSec(body.text, 1),
      bytes: buffer.length,
      provider: "elevenlabs" as const,
      voice,
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY not set on server. Add it to .env.local for voiceover." },
      { status: 503 },
    );
  }

  const voice = body.voice ?? "nova";
  const speed = body.speed ?? 1.05;
  const key = keyFor(body.text, voice, speed);
  const filename = `${key}.mp3`;
  const audioUrl = `/voiceovers/${filename}`;
  const outPath = path.join(VOICEOVER_DIR, filename);

  let durationSec: number;
  if (fs.existsSync(outPath)) {
    const stat = await fs.promises.stat(outPath);
    durationSec = estimateDurationSec(body.text, speed);
    return Response.json({
      audioUrl,
      audioDurationSec: durationSec,
      cached: true,
      bytes: stat.size,
    });
  }

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice,
      input: body.text,
      response_format: "mp3",
      speed,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return Response.json(
      { error: `TTS error ${res.status}: ${errText.slice(0, 300)}` },
      { status: 502 },
    );
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(outPath, buffer);
  durationSec = estimateDurationSec(body.text, speed);

  return Response.json({
    audioUrl,
    audioDurationSec: durationSec,
    bytes: buffer.length,
    provider: "openai" as const,
    voice,
  });
}
