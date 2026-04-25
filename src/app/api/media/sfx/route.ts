import type { NextRequest } from "next/server";
import { generateAudio } from "@/lib/server/audio-providers";

export const runtime = "nodejs";
export const maxDuration = 600;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    prompt?: string;
    modelId?: string;
    durationSec?: number;
  };
  if (!body.prompt?.trim()) {
    return Response.json({ error: "prompt required" }, { status: 400 });
  }
  try {
    const result = await generateAudio("sfx", {
      prompt: body.prompt,
      modelId: body.modelId,
      durationSec: body.durationSec,
    });
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = /not set/.test(message) ? 501 : 502;
    return Response.json({ error: message }, { status });
  }
}
