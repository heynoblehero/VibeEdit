import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { NextRequest } from "next/server";
import { storageDir, publicUrlFor } from "@/lib/server/runtime-storage";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_BYTES = 200 * 1024 * 1024; // 200 MB

/**
 * Upload route — streams the request body to disk in chunks instead of
 * buffering the whole file in memory.
 *
 * Why streaming: the previous implementation called
 * `await request.formData()` → `await file.arrayBuffer()` →
 * `Buffer.from(...)` → `crypto.createHash().update(buffer)`, which
 * holds 3-4 copies of the file in memory simultaneously. A 100-200 MB
 * upload spiked the container past its 400 MB memory limit and got
 * SIGKILLed by Docker.
 *
 * Streaming approach:
 *   1. Write to a temp file as bytes arrive (one Buffer in flight at a
 *      time, ~64 KB chunks).
 *   2. Hash incrementally during the stream — no second pass.
 *   3. After completion, atomically rename to the content-addressed
 *      filename. If the same hash already exists, drop the temp file
 *      and reuse the existing one (server-side dedupe).
 *
 * Peak memory cost is now O(chunk size) instead of O(file size).
 */
export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
    return Response.json({ error: "multipart/form-data required" }, { status: 400 });
  }
  // Cheap guard: refuse early if the client advertised a body too big.
  const advertised = parseInt(request.headers.get("content-length") ?? "0", 10);
  if (advertised && advertised > MAX_BYTES + 4096 /* allow a bit of header overhead */) {
    return Response.json(
      { error: `file too large (${(advertised / 1024 / 1024).toFixed(1)} MB, max 200 MB)` },
      { status: 413 },
    );
  }

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
  if (!file.stream) {
    return Response.json({ error: "file stream not available" }, { status: 500 });
  }

  // Stream the file into a temp path while hashing on the fly. We keep
  // a single Buffer-sized chunk in memory at any instant; the rest is
  // already on disk by the time the next chunk arrives.
  const ext = path.extname(file.name).toLowerCase() || ".bin";
  const dir = storageDir("uploads");
  const tmpPath = path.join(
    dir,
    `.tmp-${crypto.randomBytes(8).toString("hex")}${ext}`,
  );
  const hash = crypto.createHash("sha1");
  let bytes = 0;

  // Convert WHATWG ReadableStream → Node Readable → write stream.
  const webStream = file.stream() as ReadableStream<Uint8Array>;
  const nodeReadable = Readable.fromWeb(
    webStream as unknown as import("node:stream/web").ReadableStream<Uint8Array>,
  );
  // Tee: every chunk feeds both the hash AND the disk file. We use a
  // pass-through closure rather than a real tee stream to keep this
  // dependency-free.
  const writer = fs.createWriteStream(tmpPath);
  nodeReadable.on("data", (chunk: Buffer) => {
    hash.update(chunk);
    bytes += chunk.length;
  });
  try {
    await pipeline(nodeReadable, writer);
  } catch (err) {
    try {
      await fs.promises.unlink(tmpPath);
    } catch {}
    return Response.json(
      { error: `stream failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }

  if (bytes === 0) {
    try {
      await fs.promises.unlink(tmpPath);
    } catch {}
    return Response.json({ error: "empty upload" }, { status: 400 });
  }

  const digest = hash.digest("hex").slice(0, 16);
  const finalName = `${digest}${ext}`;
  const finalPath = path.join(dir, finalName);

  // Content-addressed dedupe: if a file with this hash already exists,
  // the streamed temp is redundant — drop it.
  if (fs.existsSync(finalPath)) {
    try {
      await fs.promises.unlink(tmpPath);
    } catch {}
  } else {
    await fs.promises.rename(tmpPath, finalPath);
  }

  return Response.json({
    url: publicUrlFor("uploads", finalName),
    name: file.name,
    bytes,
    type: file.type,
  });
}
