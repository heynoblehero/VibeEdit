import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { requireServerSession } from "@/lib/server-session";
import { db } from "@/lib/db";
import { scheduledPublishes } from "@/lib/db/schema";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id } = await params;

  const row = db
    .select({ id: scheduledPublishes.id, status: scheduledPublishes.status })
    .from(scheduledPublishes)
    .where(and(eq(scheduledPublishes.id, id), eq(scheduledPublishes.userId, userId)))
    .get();

  if (!row) return new NextResponse("not found", { status: 404 });
  if (row.status !== "pending") {
    return new NextResponse("can only cancel pending schedules", { status: 409 });
  }

  db.update(scheduledPublishes)
    .set({ status: "cancelled" })
    .where(eq(scheduledPublishes.id, id))
    .run();

  return new NextResponse(null, { status: 204 });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id } = await params;

  const row = db
    .select()
    .from(scheduledPublishes)
    .where(and(eq(scheduledPublishes.id, id), eq(scheduledPublishes.userId, userId)))
    .get();

  if (!row) return new NextResponse("not found", { status: 404 });
  if (row.status !== "pending") {
    return new NextResponse("can only edit pending schedules", { status: 409 });
  }

  const body = (await req.json()) as {
    title?: string;
    description?: string;
    scheduledAt?: string | number;
    renderJobId?: string;
  };

  const patch: Partial<typeof row> = {};
  if (typeof body.title === "string") patch.title = body.title || null;
  if (typeof body.description === "string") patch.description = body.description || null;
  if (body.renderJobId) patch.renderJobId = body.renderJobId;
  if (body.scheduledAt) {
    const d = new Date(body.scheduledAt);
    if (!Number.isNaN(d.getTime()) && d > new Date()) patch.scheduledAt = d;
  }

  if (Object.keys(patch).length > 0) {
    db.update(scheduledPublishes).set(patch).where(eq(scheduledPublishes.id, id)).run();
  }

  const updated = db.select().from(scheduledPublishes).where(eq(scheduledPublishes.id, id)).get();
  return NextResponse.json(updated);
}
