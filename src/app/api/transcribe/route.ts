import path from "node:path";
import fs from "node:fs";
import type { NextRequest } from "next/server";
import type { CaptionWord } from "@/lib/scene-schema";
import { applyStoredKeys } from "@/lib/server/runtime-keys";

export const runtime = "nodejs";
export const maxDuration = 120;

interface TranscribeRequest {
  audioUrl: string;
}

interface WhisperWord {
  word: string;
  start: number;
  end: number;
}

export async function POST(request: NextRequest) {
  applyStoredKeys();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY not set on server" },
      { status: 503 },
    );
  }

  const body = (await request.json()) as TranscribeRequest;
  if (!body.audioUrl) {
    return Response.json({ error: "audioUrl required" }, { status: 400 });
  }

  // Resolve local voiceover path — we only transcribe files we own.
  if (!body.audioUrl.startsWith("/voiceovers/")) {
    return Response.json({ error: "unsupported audioUrl" }, { status: 400 });
  }
  const filePath = path.join(
    process.cwd(),
    "public",
    "voiceovers",
    path.basename(body.audioUrl),
  );
  if (!fs.existsSync(filePath)) {
    return Response.json({ error: "audio file not found" }, { status: 404 });
  }

  const fileBuffer = await fs.promises.readFile(filePath);
  const file = new File([fileBuffer], path.basename(filePath), {
    type: "audio/mpeg",
  });

  const form = new FormData();
  form.append("file", file);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "word");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    return Response.json(
      { error: `Whisper error ${res.status}: ${errText.slice(0, 300)}` },
      { status: 502 },
    );
  }
  const data = (await res.json()) as { words?: WhisperWord[]; duration?: number };
  const words: CaptionWord[] = (data.words ?? []).map((w) => ({
    word: w.word,
    startMs: Math.round(w.start * 1000),
    endMs: Math.round(w.end * 1000),
  }));

  return Response.json({
    captions: words,
    audioDurationSec: data.duration,
  });
}
