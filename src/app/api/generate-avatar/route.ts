import type { NextRequest } from "next/server";
import { getAvatarProvider } from "@/lib/server/avatar-providers";

export const runtime = "nodejs";
export const maxDuration = 600;

interface GenerateAvatarRequest {
  imageUrl: string;
  audioUrl: string;
  prompt?: string;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as GenerateAvatarRequest;
  if (!body.imageUrl || !body.audioUrl) {
    return Response.json(
      { error: "imageUrl and audioUrl are both required" },
      { status: 400 },
    );
  }

  const provider = getAvatarProvider();
  try {
    const result = await provider.generate(body);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // 501 when no provider is wired (misconfiguration vs external failure).
    const status = /not configured|AVATAR_PROVIDER/.test(message) ? 501 : 502;
    return Response.json({ error: message, provider: provider.id }, { status });
  }
}
