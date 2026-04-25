// Serves files written under VIBEEDIT_DATA_DIR/uploads/. Required so
// uploaded files survive container restarts on dokku — public/uploads
// gets wiped on every redeploy, /data does not.

import path from "node:path";
import fs from "node:fs";
import { storageDir } from "@/lib/server/runtime-storage";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".pdf": "application/pdf",
  ".json": "application/json",
};

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ name: string }> },
) {
  const { name } = await ctx.params;
  // Block traversal / hidden files.
  if (name.includes("/") || name.includes("..") || name.startsWith(".")) {
    return new Response("not found", { status: 404 });
  }
  const filePath = path.join(storageDir("uploads"), name);
  if (!fs.existsSync(filePath)) {
    return new Response("not found", { status: 404 });
  }
  const buf = await fs.promises.readFile(filePath);
  const ext = path.extname(name).toLowerCase();
  return new Response(buf, {
    headers: {
      "Content-Type": MIME[ext] ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Length": String(buf.length),
    },
  });
}
