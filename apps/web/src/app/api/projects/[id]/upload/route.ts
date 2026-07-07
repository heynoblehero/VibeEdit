import { NextResponse } from "next/server";
import { createWriteStream } from "node:fs";
import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { projectFileWriteTarget, listAssets } from "@/lib/storage/fs";
import { ensureManifest } from "@/lib/storage/manifests";
import { validateUploadFile, MAX_UPLOAD_BYTES } from "@/lib/storage/upload-validator";

export const runtime = "nodejs";
// Large source uploads take a while to stream in; give them headroom over the
// default so a multi-hundred-MB 4K clip isn't cut off mid-transfer.
export const maxDuration = 300;

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id } = await context.params;
  const row = db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .get();
  if (!row) return new NextResponse("not found", { status: 404 });

  // Cheap guard: reject an obviously-oversized request from its Content-Length
  // BEFORE buffering the body. `req.formData()` holds the whole request in
  // memory, so this caps peak RAM (and is a coarse DoS guard). Single-file
  // uploads are the norm; batches must also fit under the per-file cap.
  const declaredLength = Number(req.headers.get("content-length") || 0);
  if (declaredLength > MAX_UPLOAD_BYTES) {
    return new NextResponse(
      `upload exceeds the ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB limit`,
      { status: 413 },
    );
  }

  const form = await req.formData();
  // Validate every uploaded file against the media allowlist + size cap BEFORE
  // writing anything. Reject the whole request on the first bad file so we never
  // persist a partially-validated batch (and never write disallowed content).
  const incoming: File[] = [];
  for (const value of form.values()) {
    if (!(value instanceof File)) continue;
    const verdict = validateUploadFile(value);
    if (!verdict.ok) {
      return new NextResponse(verdict.message, { status: verdict.status });
    }
    incoming.push(value);
  }
  if (incoming.length === 0) {
    return new NextResponse("no files in upload", { status: 400 });
  }

  const files: string[] = [];
  for (const value of incoming) {
    const safeName = value.name.replace(/[^A-Za-z0-9._-]+/g, "_");
    const rel = `assets/${safeName}`;
    // Stream the file part straight to disk instead of Buffer.from(arrayBuffer),
    // which would make a second full-size copy of the file in RAM on top of the
    // one formData() already holds. pipeline() handles backpressure + cleanup.
    const target = projectFileWriteTarget(userId, id, rel);
    // value.stream() is a DOM ReadableStream; Readable.fromWeb wants the Node
    // stream/web type. They're the same at runtime — cast to bridge the types.
    const webStream = value.stream() as unknown as NodeWebReadableStream<Uint8Array>;
    await pipeline(Readable.fromWeb(webStream), createWriteStream(target));
    files.push(rel);
  }
  // Capture cheap facts (ffprobe + stat) into each asset's manifest now; the
  // expensive `understanding` is filled lazily on first reference. Best-effort —
  // a probe failure must not fail the upload.
  await Promise.all(
    files.map((rel) => ensureManifest(userId, id, rel, { source: "upload" }).catch(() => null)),
  );
  return NextResponse.json({ uploaded: files, assets: listAssets(userId, id) });
}
