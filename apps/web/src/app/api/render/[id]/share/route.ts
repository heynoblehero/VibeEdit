import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { renderJobs } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";

// Per-render public share toggle. The owner enables sharing → we mint a
// random unguessable slug → anyone with the link can view the MP4 at /share/<slug>.
// Disable → the slug is cleared and existing links 404.
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
  if (job.status !== "done") {
    return NextResponse.json({ error: "render not finished" }, { status: 400 });
  }
  let slug = job.publicShareSlug;
  if (!slug) {
    // nanoid(14) collision is astronomically unlikely (~2.7e26 keyspace)
    // but the schema doesn't enforce UNIQUE on publicShareSlug, so retry
    // defensively if we hit a row that already owns the slug.
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
    if (!slug) return new NextResponse("could not mint share slug", { status: 500 });
  }
  db.update(renderJobs).set({ publicShareSlug: slug }).where(eq(renderJobs.id, id)).run();
  return NextResponse.json({ slug, url: `/share/${slug}` });
}

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id } = await context.params;
  db.update(renderJobs)
    .set({ publicShareSlug: null })
    .where(and(eq(renderJobs.id, id), eq(renderJobs.userId, userId)))
    .run();
  return NextResponse.json({ ok: true });
}
