import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { renderJobs } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Auth: requireAdmin().
//
// PLACEHOLDER — re-queues a failed render by flipping its status back to
// "queued" and clearing the error. This is intentionally minimal: actual
// re-enqueue semantics live in lib/render/queue.ts, which another agent owns.
// TODO(queue): this endpoint needs queue wiring — resetting status here assumes
// the worker re-picks status='queued' jobs. If the queue requires a fresh job
// row or a priority recompute, do that in queue.ts and call it from here.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const { id } = await params;
  const job = db
    .select({ id: renderJobs.id, status: renderJobs.status })
    .from(renderJobs)
    .where(eq(renderJobs.id, id))
    .get();
  if (!job) return new NextResponse("render job not found", { status: 404 });

  db.update(renderJobs)
    .set({ status: "queued", progress: 0, error: null, startedAt: null, finishedAt: null })
    .where(eq(renderJobs.id, id))
    .run();

  return NextResponse.json({
    ok: true,
    note: "Status reset to queued. Verify lib/render/queue.ts re-picks it (queue wiring pending).",
  });
}
