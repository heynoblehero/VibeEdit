import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { user, errorLog } from "@/lib/db/schema";
import { requireAdmin, isAdminEmail } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/users/[id]/ban — suspend an account.
// Auth: requireAdmin(). Self/admin-protection: an admin may not ban themselves
// or another admin email. Enforcement is at the session level — see
// getServerSession(), which rejects any banned user on their next request.
// Audited to errorLog.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const { id } = await params;

  const target = db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.id, id))
    .get();
  if (!target) return new NextResponse("user not found", { status: 404 });

  if (target.id === admin.user.id) {
    return new NextResponse("cannot ban yourself", { status: 400 });
  }
  if (isAdminEmail(target.email)) {
    return new NextResponse("cannot ban another admin", { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { reason?: string } | null;
  const reason = (body?.reason || "").toString().slice(0, 500) || null;
  const now = new Date();

  db.update(user)
    .set({ banned: true, bannedReason: reason, bannedAt: now, updatedAt: now })
    .where(eq(user.id, id))
    .run();

  db.insert(errorLog)
    .values({
      id: nanoid(12),
      source: "admin.users.ban",
      message: `${admin.user.email} banned ${target.email}`,
      stack: null,
      context: JSON.stringify({ adminId: admin.user.id, targetId: id, reason }),
      createdAt: now,
    })
    .run();

  return NextResponse.json({ ok: true, banned: true, reason });
}

// DELETE /api/admin/users/[id]/ban — lift a suspension.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;
  const { id } = await params;

  const target = db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.id, id))
    .get();
  if (!target) return new NextResponse("user not found", { status: 404 });

  const now = new Date();
  db.update(user)
    .set({ banned: false, bannedReason: null, bannedAt: null, updatedAt: now })
    .where(eq(user.id, id))
    .run();

  db.insert(errorLog)
    .values({
      id: nanoid(12),
      source: "admin.users.unban",
      message: `${admin.user.email} unbanned ${target.email}`,
      stack: null,
      context: JSON.stringify({ adminId: admin.user.id, targetId: id }),
      createdAt: now,
    })
    .run();

  return NextResponse.json({ ok: true, banned: false });
}
