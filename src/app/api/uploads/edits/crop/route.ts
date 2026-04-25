import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { storageDir, publicUrlFor } from "@/lib/server/runtime-storage";

export const runtime = "nodejs";
export const maxDuration = 60;

interface CropRequest {
  /**
   * Source URL or path. If a /uploads/<filename> URL we read from disk;
   * otherwise we fetch.
   */
  sourceUrl: string;
  /** "9:16" | "16:9" | "1:1" — target aspect ratio. */
  ratio: "9:16" | "16:9" | "1:1";
  /**
   * Crop strategy: "smart" uses sharp's attention-based crop (good for
   * portraits + objects), "center" is plain centered crop.
   */
  strategy?: "smart" | "center";
}

function ratioToDims(r: CropRequest["ratio"]): { w: number; h: number } {
  if (r === "9:16") return { w: 1080, h: 1920 };
  if (r === "16:9") return { w: 1920, h: 1080 };
  return { w: 1080, h: 1080 };
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as CropRequest;
  if (!body.sourceUrl) {
    return Response.json({ error: "sourceUrl required" }, { status: 400 });
  }
  const dims = ratioToDims(body.ratio);
  const strategy = body.strategy ?? "smart";

  // Load source bytes.
  let sourceBuf: Buffer;
  if (body.sourceUrl.startsWith("/uploads/")) {
    const filename = body.sourceUrl.slice("/uploads/".length);
    const p = path.join(storageDir("uploads"), filename);
    if (!fs.existsSync(p)) {
      return Response.json({ error: "source file not found" }, { status: 404 });
    }
    sourceBuf = await fs.promises.readFile(p);
  } else {
    try {
      const res = await fetch(body.sourceUrl);
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      sourceBuf = Buffer.from(await res.arrayBuffer());
    } catch (e) {
      return Response.json(
        { error: `couldn't fetch source: ${e instanceof Error ? e.message : String(e)}` },
        { status: 502 },
      );
    }
  }

  let outBuf: Buffer;
  try {
    const sharp = (await import("sharp")).default;
    const pipeline = sharp(sourceBuf).resize(dims.w, dims.h, {
      fit: "cover",
      position: strategy === "smart" ? sharp.strategy.attention : "center",
    });
    outBuf = await pipeline.jpeg({ quality: 92 }).toBuffer();
  } catch (e) {
    return Response.json(
      { error: `sharp failed: ${e instanceof Error ? e.message : String(e)}` },
      { status: 500 },
    );
  }

  const hash = crypto.createHash("sha1").update(outBuf).digest("hex").slice(0, 16);
  const filename = `crop_${body.ratio.replace(":", "x")}_${hash}.jpg`;
  const outPath = path.join(storageDir("uploads"), filename);
  await fs.promises.writeFile(outPath, outBuf);
  return Response.json({
    url: publicUrlFor("uploads", filename),
    bytes: outBuf.length,
    width: dims.w,
    height: dims.h,
    strategy,
  });
}
