import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user, errorLog } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/admin";
import {
  IMPERSONATION_COOKIE,
  IMPERSONATION_TTL_MS,
  mintImpersonationToken,
} from "@/lib/admin-impersonation";
import { nanoid } from "nanoid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Auth: requireAdmin() — gates on the REAL session's admin email, so a
// non-admin can never start impersonation. Begins impersonating `targetUserId`.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const body = (await req.json().catch(() => null)) as { targetUserId?: string } | null;
  const targetUserId = body?.targetUserId;
  if (!targetUserId) return new NextResponse("targetUserId required", { status: 400 });

  const target = db
    .select({ id: user.id, email: user.email, name: user.name })
    .from(user)
    .where(eq(user.id, targetUserId))
    .get();
  if (!target) return new NextResponse("user not found", { status: 404 });

  const token = mintImpersonationToken(admin.user.id, target.id);

  // Audit trail — recorded in the error log so it shows up in the ops console.
  db.insert(errorLog)
    .values({
      id: nanoid(12),
      source: "admin.impersonate",
      message: `${admin.user.email} started impersonating ${target.email}`,
      stack: null,
      context: JSON.stringify({ adminId: admin.user.id, targetId: target.id }),
      createdAt: new Date(),
    })
    .run();

  const res = NextResponse.json({ ok: true, target });
  res.cookies.set(IMPERSONATION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(IMPERSONATION_TTL_MS / 1000),
  });
  return res;
}

// Stop impersonating. Clears the cookie. Safe for anyone to call (it only
// removes the impersonation overlay; the real session is untouched).
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(IMPERSONATION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
