import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { subscriptions, user, errorLog } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/admin";
import { PLANS, type PlanId } from "@/lib/billing/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_PLANS: PlanId[] = ["free", "creator", "pro", "studio"];

// Auth: requireAdmin(). Billing overview — active subs by plan, MRR estimate,
// trials, and rows whose status indicates a payment problem.
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const rows = db
    .select({
      plan: subscriptions.plan,
      status: subscriptions.status,
      trialEndsAt: subscriptions.trialEndsAt,
    })
    .from(subscriptions)
    .all();

  const breakdown: Record<string, { total: number; active: number }> = {};
  let mrr = 0;
  let trials = 0;
  let problems = 0;
  for (const row of rows) {
    breakdown[row.plan] ??= { total: 0, active: 0 };
    breakdown[row.plan].total++;
    if (row.status === "active" || row.status === "trialing") {
      breakdown[row.plan].active++;
      const meta = PLANS[row.plan as PlanId];
      if (meta) mrr += meta.priceMonthly;
    }
    if (row.status === "trialing" || row.trialEndsAt) trials++;
    if (row.status === "past_due" || row.status === "unpaid" || row.status === "incomplete") {
      problems++;
    }
  }

  return NextResponse.json({ breakdown, mrr, trials, problems });
}

// Grant/comp a plan to a user (or downgrade). Sets status=active so it counts
// toward MRR and unlocks limits immediately. Audited in errorLog.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const body = (await req.json().catch(() => null)) as {
    userId?: string;
    plan?: string;
    renderCredits?: number;
  } | null;
  const userId = body?.userId;
  const plan = body?.plan as PlanId | undefined;
  if (!userId) return new NextResponse("userId required", { status: 400 });
  if (plan && !VALID_PLANS.includes(plan)) {
    return new NextResponse("invalid plan", { status: 400 });
  }

  const target = db
    .select({ id: user.id, email: user.email })
    .from(user)
    .where(eq(user.id, userId))
    .get();
  if (!target) return new NextResponse("user not found", { status: 404 });

  const now = new Date();
  const existing = db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).get();

  const updates: Record<string, unknown> = { updatedAt: now };
  if (plan) {
    updates.plan = plan;
    updates.status = "active";
  }
  if (typeof body?.renderCredits === "number") {
    updates.renderCredits = Math.max(0, Math.floor(body.renderCredits));
  }

  if (existing) {
    db.update(subscriptions).set(updates).where(eq(subscriptions.userId, userId)).run();
  } else {
    db.insert(subscriptions)
      .values({
        id: nanoid(10),
        userId,
        plan: plan ?? "free",
        status: "active",
        cancelAtPeriodEnd: false,
        renderCredits:
          typeof body?.renderCredits === "number" ? Math.max(0, body.renderCredits) : 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  db.insert(errorLog)
    .values({
      id: nanoid(12),
      source: "admin.billing.grant",
      message: `${admin.user.email} granted ${plan ?? "(credits only)"} to ${target.email}`,
      stack: null,
      context: JSON.stringify({ adminId: admin.user.id, targetId: userId, ...updates }),
      createdAt: now,
    })
    .run();

  const updated = db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).get();
  return NextResponse.json({ ok: true, subscription: updated });
}
