import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { storageDir, publicUrlFor } from "@/lib/server/runtime-storage";

export const runtime = "nodejs";
export const maxDuration = 120;

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
  const outPath = path.join(storageDir("uploads"), filename);
  if (!fs.existsSync(outPath)) {
    await fs.promises.writeFile(outPath, buffer);
  }
  return Response.json({
    url: publicUrlFor("uploads", filename),
    name: file.name,
    bytes: buffer.length,
    type: file.type,
  });
}
