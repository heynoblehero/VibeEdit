import path from "node:path";
import fs from "node:fs";
import type { NextRequest } from "next/server";
import { callClaude } from "@/lib/server/claude-bridge";
import { applyStoredKeys } from "@/lib/server/runtime-keys";

export const runtime = "nodejs";
export const maxDuration = 600;

interface DetectRequest {
  audioUrl: string;
  count?: number;
  lengthSec?: number;
}

interface WhisperSegment {
  start: number;
  end: number;
  text: string;
}

const SYSTEM_PROMPT = `You are a podcast producer finding the most viral clips from a transcript. For each viral moment, emit:
- startSec / endSec: the exact seconds to trim. Keep clips 20-60s long unless the caller specified otherwise.
- title: a Shorts-ready hook headline (6-10 words, punchy, stops the scroll).
- reason: one short phrase explaining why this is viral.

Pick moments with:
- A clear standalone thought (self-contained, needs no setup).
- High emotional density — surprise, contrarian takes, confessions, specific numbers.
- A natural beat at start + end (don't cut mid-word).

Return candidates ranked by viral potential — best first. Emit via the emit_moments tool.`;

export async function POST(request: NextRequest) {
  applyStoredKeys();
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return Response.json(
      { error: "OPENAI_API_KEY required for Whisper transcription" },
      { status: 503 },
    );
  }

  const body = (await request.json()) as DetectRequest;
  if (!body.audioUrl) {
    return Response.json({ error: "audioUrl required" }, { status: 400 });
  }

  // 1. Load the audio file (we only transcribe ones we host locally).
  const filePath = body.audioUrl.startsWith("/uploads/")
    ? path.join(process.cwd(), "public", "uploads", path.basename(body.audioUrl))
    : body.audioUrl.startsWith("/voiceovers/")
      ? path.join(process.cwd(), "public", "voiceovers", path.basename(body.audioUrl))
      : null;
  if (!filePath || !fs.existsSync(filePath)) {
    return Response.json({ error: "audio file not found" }, { status: 404 });
  }

  // 2. Transcribe with Whisper (segment granularity — we want timestamps).
  const audioBuffer = await fs.promises.readFile(filePath);
  const file = new File([audioBuffer], path.basename(filePath), { type: "audio/mpeg" });
  const form = new FormData();
  form.append("file", file);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");

  const tx = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${openaiKey}` },
    body: form,
  });
  if (!tx.ok) {
    const err = await tx.text();
    return Response.json(
      { error: `Whisper error ${tx.status}: ${err.slice(0, 300)}` },
      { status: 502 },
    );
  }
  const txData = (await tx.json()) as { segments?: WhisperSegment[]; duration?: number };
  const segments = txData.segments ?? [];
  if (segments.length === 0) {
    return Response.json({ error: "empty transcript" }, { status: 502 });
  }

  // 3. Feed transcript to Claude to pick viral moments.
  const count = Math.max(1, Math.min(10, body.count ?? 5));
  const segmentText = segments
    .map((s) => `[${s.start.toFixed(1)}-${s.end.toFixed(1)}] ${s.text.trim()}`)
    .join("\n");

  let antData;
  try {
    antData = await callClaude(
      {
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        system: [
          { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
        ],
        tools: [
          {
            name: "emit_moments",
            description: "Emit a ranked list of viral clip candidates.",
            input_schema: {
              type: "object",
              properties: {
                moments: {
                  type: "array",
                  minItems: 1,
                  items: {
                    type: "object",
                    properties: {
                      startSec: { type: "number" },
                      endSec: { type: "number" },
                      title: { type: "string" },
                      reason: { type: "string" },
                    },
                    required: ["startSec", "endSec", "title"],
                  },
                },
              },
              required: ["moments"],
            },
          },
        ],
        tool_choice: { type: "tool", name: "emit_moments" },
        messages: [
          {
            role: "user",
            content: `Find the top ${count} viral moments. Transcript segments:\n${segmentText}`,
          },
        ],
      },
      "podcast/detect-moments",
    );
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
  const toolUse = antData.content?.find((c) => c.type === "tool_use");
  const moments = toolUse?.input?.moments;
  if (!Array.isArray(moments)) {
    return Response.json({ error: "No moments returned" }, { status: 502 });
  }
  return Response.json({ moments });
}
