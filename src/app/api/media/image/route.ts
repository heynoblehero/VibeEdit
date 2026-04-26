import type { NextRequest } from "next/server";
import { generateImage } from "@/lib/server/media-providers";

export const runtime = "nodejs";
export const maxDuration = 600;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    prompt?: string;
    modelId?: string;
    aspectRatio?: "16:9" | "9:16" | "1:1" | "4:3";
    inputImageUrl?: string;
    shotType?: "wide" | "medium" | "closeup" | "ecu" | "ots" | "insert";
    subjectReferenceUrl?: string;
    subjectKind?: "person" | "product" | "other";
  };
  if (!body.prompt?.trim()) {
    return Response.json({ error: "prompt required" }, { status: 400 });
  }
  try {
    const result = await generateImage({
      prompt: body.prompt,
      modelId: body.modelId,
      aspectRatio: body.aspectRatio,
      inputImageUrl: body.inputImageUrl,
      shotType: body.shotType,
      subjectReferenceUrl: body.subjectReferenceUrl,
      subjectKind: body.subjectKind,
    });
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = /not set/.test(message) ? 501 : 502;
    return Response.json({ error: message }, { status });
  }
}
