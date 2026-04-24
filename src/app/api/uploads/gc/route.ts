import path from "node:path";
import fs from "node:fs";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

interface GcRequest {
  inUse: string[];
}

const DIR = path.join(process.cwd(), "public", "uploads");

export async function POST(request: NextRequest) {
  if (!fs.existsSync(DIR)) {
    return Response.json({ deleted: 0, kept: 0, bytesFreed: 0 });
  }
  const body = (await request.json()) as GcRequest;
  const keep = new Set(
    (body.inUse ?? [])
      .map((u) => path.basename(u))
      .filter((f) => f.length > 0),
  );
  const entries = await fs.promises.readdir(DIR);
  let deleted = 0;
  let kept = 0;
  let bytesFreed = 0;
  for (const f of entries) {
    if (keep.has(f)) {
      kept++;
      continue;
    }
    const abs = path.join(DIR, f);
    try {
      const stat = await fs.promises.stat(abs);
      await fs.promises.unlink(abs);
      bytesFreed += stat.size;
      deleted++;
    } catch {
      // ignore
    }
  }
  return Response.json({ deleted, kept, bytesFreed });
}
