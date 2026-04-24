import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch {
  // dir exists
}

const MAX_BYTES = 200 * 1024 * 1024; // 200 MB

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "file required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: `file too large (${(file.size / 1024 / 1024).toFixed(1)} MB, max 200 MB)` },
      { status: 413 },
    );
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const hash = crypto.createHash("sha1").update(buffer).digest("hex").slice(0, 16);
  const ext = path.extname(file.name).toLowerCase() || ".bin";
  const filename = `${hash}${ext}`;
  const outPath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(outPath)) {
    await fs.promises.writeFile(outPath, buffer);
  }
  return Response.json({
    url: `/uploads/${filename}`,
    name: file.name,
    bytes: buffer.length,
    type: file.type,
  });
}
