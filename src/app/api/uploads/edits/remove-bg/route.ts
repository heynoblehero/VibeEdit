import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { storageDir, publicUrlFor } from "@/lib/server/runtime-storage";
import { applyStoredKeys } from "@/lib/server/runtime-keys";
import { replicatePredict } from "@/lib/server/media-providers/replicate";

export const runtime = "nodejs";
export const maxDuration = 120;

interface BgRemoveRequest {
  sourceUrl: string;
}

const REMBG_SLUG =
  "cjwbw/rembg:fb8af171cfa1616ddcf1242c093f9c46bcada5ad4cf6f2fbe8b81b330ec5c003";

export async function POST(request: NextRequest) {
  applyStoredKeys();
  const body = (await request.json()) as BgRemoveRequest;
  if (!body.sourceUrl) {
    return Response.json({ error: "sourceUrl required" }, { status: 400 });
  }
  if (!process.env.REPLICATE_API_TOKEN) {
    return Response.json(
      { error: "REPLICATE_API_TOKEN required for background removal" },
      { status: 503 },
    );
  }

  // The replicate model needs a publicly fetchable URL. /uploads/ are
  // served by our own origin so we hand it the absolute URL via header
  // origin if available, or fall back to whatever was passed.
  const inputUrl = body.sourceUrl.startsWith("http")
    ? body.sourceUrl
    : `${request.nextUrl.origin}${body.sourceUrl}`;

  let resultUrl: string;
  try {
    const out = await replicatePredict(REMBG_SLUG.split(":")[1], { image: inputUrl });
    resultUrl = Array.isArray(out) ? out[0] : typeof out === "string" ? out : (out as { url?: string }).url ?? "";
    if (!resultUrl) throw new Error("no output URL from replicate");
  } catch (e) {
    return Response.json(
      { error: `rembg failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 502 },
    );
  }

  // Download to persistent storage so it survives container restart.
  const buf = Buffer.from(await (await fetch(resultUrl)).arrayBuffer());
  const hash = crypto.createHash("sha1").update(buf).digest("hex").slice(0, 16);
  const filename = `nobg_${hash}.png`;
  const outPath = path.join(storageDir("uploads"), filename);
  await fs.promises.writeFile(outPath, buf);
  return Response.json({
    url: publicUrlFor("uploads", filename),
    bytes: buf.length,
  });
}
