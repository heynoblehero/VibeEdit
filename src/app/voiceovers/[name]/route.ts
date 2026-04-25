// Serves files written under VIBEEDIT_DATA_DIR/voiceovers/. Same
// persistence story as /uploads — without this, every redeploy nukes
// the user's generated audio.

import path from "node:path";
import fs from "node:fs";
import { storageDir } from "@/lib/server/runtime-storage";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
};

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ name: string }> },
) {
  const { name } = await ctx.params;
  if (name.includes("/") || name.includes("..") || name.startsWith(".")) {
    return new Response("not found", { status: 404 });
  }
  const filePath = path.join(storageDir("voiceovers"), name);
  if (!fs.existsSync(filePath)) {
    return new Response("not found", { status: 404 });
  }
  const buf = await fs.promises.readFile(filePath);
  const ext = path.extname(name).toLowerCase();
  return new Response(buf, {
    headers: {
      "Content-Type": MIME[ext] ?? "audio/mpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(buf.length),
    },
  });
}
