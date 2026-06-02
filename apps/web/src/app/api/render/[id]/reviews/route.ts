import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { renderJobs, renderReviews } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const { id } = await ctx.params;
  // Verify the render job belongs to this user or a workspace they're in.
  const job = db
    .select({ id: renderJobs.id })
    .from(renderJobs)
    .where(and(eq(renderJobs.id, id), eq(renderJobs.userId, session.user.id)))
    .get();
  if (!job) return new NextResponse("not found", { status: 404 });
  const rows = db
    .select()
    .from(renderReviews)
    .where(eq(renderReviews.renderJobId, id))
    .orderBy(asc(renderReviews.timestampSeconds))
    .all();
  return NextResponse.json({ reviews: rows });
}

export async function POST(req: Request, ctx: RouteCtx) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const { id } = await ctx.params;
  const job = db
    .select({ id: renderJobs.id })
    .from(renderJobs)
    .where(and(eq(renderJobs.id, id), eq(renderJobs.userId, session.user.id)))
    .get();
  if (!job) return new NextResponse("not found", { status: 404 });
  const body = (await req.json()) as { timestampSeconds?: number; text?: string };
  if (typeof body.timestampSeconds !== "number" || !body.text?.trim()) {
    return new NextResponse("invalid", { status: 400 });
  }
  const now = new Date();
  const reviewId = nanoid(12);
  db.insert(renderReviews)
    .values({
      id: reviewId,
      renderJobId: id,
      userId: session.user.id,
      timestampSeconds: body.timestampSeconds,
      text: body.text.trim(),
      resolved: false,
      createdAt: now,
    })
    .run();
  const row = db.select().from(renderReviews).where(eq(renderReviews.id, reviewId)).get();
  return NextResponse.json({ review: row }, { status: 201 });
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const { id: renderJobId } = await ctx.params;
  const body = (await req.json()) as { reviewId: string; resolved: boolean };
  if (!body.reviewId) return new NextResponse("invalid", { status: 400 });
  const review = db
    .select()
    .from(renderReviews)
    .where(and(eq(renderReviews.id, body.reviewId), eq(renderReviews.renderJobId, renderJobId)))
    .get();
  if (!review) return new NextResponse("not found", { status: 404 });
  // Only the reviewer or render owner can resolve.
  if (review.userId !== session.user.id) {
    const job = db
      .select({ userId: renderJobs.userId })
      .from(renderJobs)
      .where(eq(renderJobs.id, renderJobId))
      .get();
    if (job?.userId !== session.user.id) return new NextResponse("forbidden", { status: 403 });
  }
  db.update(renderReviews)
    .set({ resolved: body.resolved })
    .where(eq(renderReviews.id, body.reviewId))
    .run();
  return NextResponse.json({ ok: true });
}
