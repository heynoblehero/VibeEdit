import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { getEffect } from "@/lib/effects/catalog";
import { effectsDir } from "@/lib/storage/fs";

export const runtime = "nodejs";

// Serves first-party Effects Store assets (shared, public, immutable): the
// normalized effect file or its animated preview. Keyed by the catalog presetId
// so we never take an arbitrary path from the client.

const CONTENT_TYPE: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(
  _req: Request,
  context: { params: Promise<{ presetId: string; kind: string }> },
) {
  const { presetId, kind } = await context.params;
  const entry = getEffect(presetId);
  if (!entry) return new NextResponse("not found", { status: 404 });
  if (kind !== "file" && kind !== "preview") return new NextResponse("bad kind", { status: 400 });

  const ext = kind === "file" ? entry.ext : entry.previewExt;
  const path =
    kind === "file"
      ? join(effectsDir(), `${entry.presetId}.${ext}`)
      : join(effectsDir(), "previews", `${entry.presetId}.${ext}`);
  if (!existsSync(path)) return new NextResponse("asset missing", { status: 404 });

  const bytes = readFileSync(path);
  // Copy into a fresh ArrayBuffer so the BodyInit type is a plain ArrayBuffer.
  const body = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new NextResponse(body as ArrayBuffer, {
    headers: {
      "content-type": CONTENT_TYPE[ext] ?? "application/octet-stream",
      "content-length": String(bytes.byteLength),
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
