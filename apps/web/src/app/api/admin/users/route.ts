import { NextResponse } from "next/server";
import { and, desc, eq, gte, like, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { user, projects, renderJobs, subscriptions, usageEvents } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Auth: requireAdmin() — real-session admin gate. Returns a searchable,
// paginated users table with plan + project/render/usage counts.
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
  const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const where = q
    ? or(like(sql`lower(${user.email})`, `%${q}%`), like(sql`lower(${user.name})`, `%${q}%`))
    : undefined;

  const rows = db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(where)
    .orderBy(desc(user.createdAt))
    .limit(limit)
    .offset(offset)
    .all();

  const total =
    db
      .select({ count: sql<number>`count(*)` })
      .from(user)
      .where(where)
      .get()?.count ?? 0;

  const enriched = rows.map((row) => {
    const projectCount =
      db
        .select({ count: sql<number>`count(*)` })
        .from(projects)
        .where(eq(projects.userId, row.id))
        .get()?.count ?? 0;

    const renderCount =
      db
        .select({ count: sql<number>`count(*)` })
        .from(renderJobs)
        .where(eq(renderJobs.userId, row.id))
        .get()?.count ?? 0;

    const failedRenders =
      db
        .select({ count: sql<number>`count(*)` })
        .from(renderJobs)
        .where(and(eq(renderJobs.userId, row.id), eq(renderJobs.status, "failed")))
        .get()?.count ?? 0;

    const sub = db
      .select({ plan: subscriptions.plan, status: subscriptions.status })
      .from(subscriptions)
      .where(eq(subscriptions.userId, row.id))
      .get();

    const chatTurnsThisMonth =
      db
        .select({ amount: sql<number>`coalesce(sum(amount),0)` })
        .from(usageEvents)
        .where(
          and(
            eq(usageEvents.userId, row.id),
            eq(usageEvents.kind, "chat_turn"),
            gte(usageEvents.createdAt, monthStart),
          ),
        )
        .get()?.amount ?? 0;

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      emailVerified: row.emailVerified,
      createdAt: row.createdAt,
      plan: sub?.plan ?? "free",
      subStatus: sub?.status ?? null,
      projectCount,
      renderCount,
      failedRenders,
      chatTurnsThisMonth: Number(chatTurnsThisMonth || 0),
    };
  });

  return NextResponse.json({ users: enriched, total, limit, offset });
}
