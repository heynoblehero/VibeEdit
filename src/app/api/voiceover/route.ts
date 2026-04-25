import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { applyStoredKeys } from "@/lib/server/runtime-keys";

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

// Persistent on dokku — see src/lib/server/runtime-storage.ts. Falls back
// to public/voiceovers in dev so static serving still works locally.
const VOICEOVER_DIR = path.join(
  process.env.VIBEEDIT_DATA_DIR || path.join(process.cwd(), "public"),
  "voiceovers",
);
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
  applyStoredKeys();
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
  // 1.0 default — 1.05 made narrators sound rushed for storytelling.
  const speed = body.speed ?? 1.0;
  // Inject SSML-style breath pauses by replacing punctuation with em-dashes
  // and ellipses that gpt-4o-mini-tts respects as micro-pauses. Commas keep
  // 0.15s, periods → ~0.4s, semicolons → 0.3s. Don't double-process if
  // the caller already has em-dashes.
  const polishedText = body.text
    .replace(/,(?!\s*\u2014)/g, ", ")
    .replace(/\.(?!\s*\u2014)(?=\s|$)/g, ". ")
    .replace(/;(?!\s*\u2014)/g, "; ")
    .replace(/\s{2,}/g, " ")
    .trim();
  const key = keyFor(polishedText, voice, speed);
  const filename = `${key}.mp3`;
  const audioUrl = `/voiceovers/${filename}`;
  const outPath = path.join(VOICEOVER_DIR, filename);

  let durationSec: number;
  if (fs.existsSync(outPath)) {
    const stat = await fs.promises.stat(outPath);
    durationSec = estimateDurationSec(polishedText, speed);
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
      input: polishedText,
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
  // Write the raw output, then run ffmpeg silenceremove to trim
  // leading/trailing dead air the TTS sometimes pads. Quiet failures —
  // we always have the untrimmed file as a fallback.
  await fs.promises.writeFile(outPath, buffer);
  try {
    const { spawn } = await import("node:child_process");
    const trimmedPath = outPath.replace(/\.mp3$/, ".trim.mp3");
    await new Promise<void>((resolve, reject) => {
      const p = spawn("ffmpeg", [
        "-y", "-i", outPath,
        "-af",
        // Trim ≥0.2s of <-50dB silence at the start AND end.
        "silenceremove=start_periods=1:start_duration=0.2:start_threshold=-50dB:detection=peak,areverse,silenceremove=start_periods=1:start_duration=0.2:start_threshold=-50dB:detection=peak,areverse",
        "-codec:a", "libmp3lame", "-q:a", "3",
        trimmedPath,
      ]);
      p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}`))));
      p.on("error", reject);
    });
    // Swap files: trimmed becomes the canonical version.
    await fs.promises.rename(trimmedPath, outPath);
  } catch {
    // ffmpeg unavailable or trim failed — keep the raw file.
  }

  // Re-read duration: prefer ffprobe if available (accurate), else estimate.
  durationSec = estimateDurationSec(polishedText, speed);
  try {
    const { spawn } = await import("node:child_process");
    const probed = await new Promise<number>((resolve) => {
      const p = spawn("ffprobe", [
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        outPath,
      ]);
      let out = "";
      p.stdout.on("data", (c) => (out += c.toString()));
      p.on("close", () => resolve(parseFloat(out.trim()) || 0));
    });
    if (probed > 0) durationSec = probed;
  } catch {
    // estimate is fine
  }

  const finalStat = await fs.promises.stat(outPath);
  return Response.json({
    audioUrl,
    audioDurationSec: durationSec,
    bytes: finalStat.size,
    provider: "openai" as const,
    voice,
  });
}
