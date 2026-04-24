import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const MUSIC_DIR = path.join(process.cwd(), "public", "music");
try {
  fs.mkdirSync(MUSIC_DIR, { recursive: true });
} catch {
  // dir exists
}

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB cap

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: `file too large (${(file.size / 1024 / 1024).toFixed(1)} MB, max 20 MB)` },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = crypto.createHash("sha1").update(buffer).digest("hex").slice(0, 16);
  const ext = path.extname(file.name).toLowerCase() || ".mp3";
  const safeExt = [".mp3", ".wav", ".m4a", ".ogg"].includes(ext) ? ext : ".mp3";
  const filename = `${hash}${safeExt}`;
  const outPath = path.join(MUSIC_DIR, filename);
  await fs.promises.writeFile(outPath, buffer);

  return Response.json({
    url: `/music/${filename}`,
    name: file.name,
    bytes: buffer.length,
  });
}
