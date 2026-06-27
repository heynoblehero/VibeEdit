import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { renderJobs } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/admin";
import { enqueue } from "@/lib/render/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Auth: requireAdmin().
//
// Re-runs a render by enqueuing a FRESH job for the same project. The queue
// processes an in-memory pending list (jobs enter via enqueue()/tick()), so
// merely flipping a row's status to "queued" would never re-run — enqueue() is
// the correct entry point and reuses the retry/backoff machinery in queue.ts.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const { id } = await params;
  const job = db
    .select({
      userId: renderJobs.userId,
      projectId: renderJobs.projectId,
      fps: renderJobs.fps,
      quality: renderJobs.quality,
    })
    .from(renderJobs)
    .where(eq(renderJobs.id, id))
    .get();
  if (!job) return new NextResponse("render job not found", { status: 404 });

  const newId = await enqueue({
    userId: job.userId,
    projectId: job.projectId,
    fps: job.fps ?? undefined,
    quality: job.quality ?? undefined,
  });

  return NextResponse.json({ ok: true, jobId: newId });
}
