import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { renderJobs } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";

// Enable showcase — auto-creates a publicShareSlug if the render doesn't have one.
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id } = await context.params;

  const job = db
    .select()
    .from(renderJobs)
    .where(and(eq(renderJobs.id, id), eq(renderJobs.userId, userId)))
    .get();
  if (!job) return new NextResponse("not found", { status: 404 });
  if (job.status !== "done") return new NextResponse("render not finished", { status: 400 });

  // Auto-create share slug if needed.
  let slug = job.publicShareSlug;
  if (!slug) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const candidate = nanoid(14);
      const taken = db
        .select({ id: renderJobs.id })
        .from(renderJobs)
        .where(eq(renderJobs.publicShareSlug, candidate))
        .get();
      if (!taken) {
        slug = candidate;
        break;
      }
    }
    if (!slug) return new NextResponse("could not mint slug", { status: 500 });
  }

  db.update(renderJobs)
    .set({ showcased: true, publicShareSlug: slug })
    .where(eq(renderJobs.id, id))
    .run();

  return NextResponse.json({ showcased: true, slug });
}

// Remove from showcase (keeps the share link active).
export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id } = await context.params;

  db.update(renderJobs)
    .set({ showcased: false })
    .where(and(eq(renderJobs.id, id), eq(renderJobs.userId, userId)))
    .run();

  return NextResponse.json({ showcased: false });
}
