import { NextResponse } from "next/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { renderJobs } from "@/lib/db/schema";
import { authenticateWorker } from "@/lib/worker/auth";
import { renderOutputPath } from "@/lib/storage/fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cap the upload to keep a malicious or buggy worker from filling disk with
// a single 100GB "output.mp4". Long-form 4K renders top out well under 2GB.
const MAX_UPLOAD_BYTES = Number(process.env.MAX_RENDER_UPLOAD_BYTES || 2 * 1024 * 1024 * 1024);

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = authenticateWorker(req);
  if (!auth) return new NextResponse("unauthorized", { status: 401 });
  const { id } = await context.params;

  // Reject before reading the body if Content-Length already exceeds the cap.
  const lengthHeader = req.headers.get("content-length");
  if (lengthHeader && Number(lengthHeader) > MAX_UPLOAD_BYTES)
    return new NextResponse("upload too large", { status: 413 });

  // Verify the job belongs to this worker's user before accepting anything.
  const job = db
    .select()
    .from(renderJobs)
    .where(and(eq(renderJobs.id, id), eq(renderJobs.userId, auth.userId)))
    .get();
  if (!job) return new NextResponse("not found", { status: 404 });

  const url = new URL(req.url);
  const outcome = url.searchParams.get("outcome") || "done";

  if (outcome === "failed") {
    const body = (await req.json().catch(() => ({}))) as { error?: string };
    db.update(renderJobs)
      .set({
        status: "failed",
        error: body.error?.slice(0, 4000) || "unknown",
        finishedAt: new Date(),
      })
      .where(and(eq(renderJobs.id, id), eq(renderJobs.userId, auth.userId)))
      .run();
    return NextResponse.json({ ok: true });
  }

  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length === 0) return new NextResponse("empty body", { status: 400 });
  if (buf.length > MAX_UPLOAD_BYTES) return new NextResponse("upload too large", { status: 413 });
  const outDir = renderOutputPath(id);
  mkdirSync(outDir, { recursive: true });
  const outputPath = join(outDir, "output.mp4");
  writeFileSync(outputPath, buf);

  db.update(renderJobs)
    .set({
      status: "done",
      progress: 1,
      outputPath,
      finishedAt: new Date(),
    })
    .where(and(eq(renderJobs.id, id), eq(renderJobs.userId, auth.userId)))
    .run();
  return NextResponse.json({ ok: true });
}
