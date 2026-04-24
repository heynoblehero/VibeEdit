import type { NextRequest } from "next/server";
import type { Scene } from "@/lib/scene-schema";
import { getThumbnail } from "@/lib/server/thumbnail-cache";
import { inlineUrl } from "@/lib/server/inline-assets";

export const runtime = "nodejs";
export const maxDuration = 120;

interface ThumbRequest {
  scene: Scene;
  width: number;
  height: number;
  fps: number;
  characters: Record<string, string>;
  sfx: Record<string, string>;
  orientation: "landscape" | "portrait";
  frame?: number;
  scale?: number;
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as ThumbRequest;
  if (!body?.scene) {
    return Response.json({ error: "scene required" }, { status: 400 });
  }

  const origin = request.nextUrl.origin;
  const characters = Object.fromEntries(
    Object.entries(body.characters ?? {}).map(([k, v]) => [k, inlineUrl(v, origin)]),
  );
  const sfx = Object.fromEntries(
    Object.entries(body.sfx ?? {}).map(([k, v]) => [k, inlineUrl(v, origin)]),
  );
  const sceneWithInlined: Scene = {
    ...body.scene,
    voiceover: body.scene.voiceover
      ? { ...body.scene.voiceover, audioUrl: inlineUrl(body.scene.voiceover.audioUrl, origin) }
      : body.scene.voiceover,
  };

  const { buffer } = await getThumbnail({
    scene: sceneWithInlined,
    width: body.width,
    height: body.height,
    fps: body.fps,
    characters,
    sfx,
    orientation: body.orientation,
    frame: body.frame,
    scale: body.scale,
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=600",
    },
  });
}
