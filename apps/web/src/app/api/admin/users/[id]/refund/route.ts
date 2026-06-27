import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { user, subscriptions, errorLog } from "@/lib/db/schema";
import { requireAdmin, isAdminEmail } from "@/lib/admin";
import { refundLatestOrder } from "@/lib/billing/polar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/admin/users/[id]/refund — refund the user's most recent Polar order.
// Auth: requireAdmin(). Self/admin-protection: cannot refund yourself or another
// admin. Real refund via the Polar SDK refunds API (see refundLatestOrder).
// Audited to errorLog regardless of outcome.
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
    return new NextResponse("cannot refund yourself", { status: 400 });
  }
  if (isAdminEmail(target.email)) {
    return new NextResponse("cannot refund another admin", { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    reason?: string;
    comment?: string;
  } | null;

  const sub = db
    .select({ polarCustomerId: subscriptions.polarCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, id))
    .get();

  const result = await refundLatestOrder(sub?.polarCustomerId, {
    reason: body?.reason,
    comment: body?.comment ?? `Admin refund by ${admin.user.email}`,
  });

  const now = new Date();
  db.insert(errorLog)
    .values({
      id: nanoid(12),
      source: "admin.users.refund",
      message: result.ok
        ? `${admin.user.email} refunded ${target.email} (${result.amount} cents, order ${result.orderId})`
        : `${admin.user.email} refund attempt for ${target.email} did not complete: ${
            result.skipped ?? result.error ?? "unknown"
          }`,
      stack: null,
      context: JSON.stringify({ adminId: admin.user.id, targetId: id, result }),
      createdAt: now,
    })
    .run();

  if (!result.ok) {
    return NextResponse.json(
      { ...result, reason: result.skipped ?? result.error ?? "refund failed" },
      { status: result.error ? 502 : 409 },
    );
  }

  return NextResponse.json(result);
}
