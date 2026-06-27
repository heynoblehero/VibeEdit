import { NextResponse } from "next/server";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { user, projects, renderJobs, subscriptions, usageEvents } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/admin";
import { planFor } from "@/lib/billing/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Auth: requireAdmin() — real-session admin gate. Full detail view for one
// user: subscription, usage vs plan limits, projects, recent renders (incl.
// failures with stored error).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const { id } = await params;

  const target = db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
      image: user.image,
      createdAt: user.createdAt,
    })
    .from(user)
    .where(eq(user.id, id))
    .get();
  if (!target) return new NextResponse("user not found", { status: 404 });

  const sub = db.select().from(subscriptions).where(eq(subscriptions.userId, id)).get();
  const plan = planFor(sub?.plan);

  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const usageFor = (kind: string) =>
    db
      .select({ amount: sql<number>`coalesce(sum(amount),0)` })
      .from(usageEvents)
      .where(
        and(
          eq(usageEvents.userId, id),
          eq(usageEvents.kind, kind),
          gte(usageEvents.createdAt, monthStart),
        ),
      )
      .get()?.amount ?? 0;

  const rendersUsed = Number(usageFor("render"));
  const chatTurnsUsed = Number(usageFor("chat_turn"));
  const renderMinutesUsed = Number(usageFor("render_minutes"));

  const userProjects = db
    .select({
      id: projects.id,
      name: projects.name,
      platform: projects.platform,
      aspectRatio: projects.aspectRatio,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .where(eq(projects.userId, id))
    .orderBy(desc(projects.updatedAt))
    .limit(50)
    .all();

  const recentRenders = db
    .select({
      id: renderJobs.id,
      projectId: renderJobs.projectId,
      status: renderJobs.status,
      progress: renderJobs.progress,
      quality: renderJobs.quality,
      error: renderJobs.error,
      durationSeconds: renderJobs.durationSeconds,
      createdAt: renderJobs.createdAt,
      finishedAt: renderJobs.finishedAt,
    })
    .from(renderJobs)
    .where(eq(renderJobs.userId, id))
    .orderBy(desc(renderJobs.createdAt))
    .limit(30)
    .all();

  return NextResponse.json({
    user: target,
    subscription: sub
      ? {
          plan: sub.plan,
          status: sub.status,
          trialEndsAt: sub.trialEndsAt,
          currentPeriodEnd: sub.currentPeriodEnd,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
          renderCredits: sub.renderCredits,
          stripeCustomerId: sub.stripeCustomerId,
          polarCustomerId: sub.polarCustomerId,
        }
      : null,
    plan: {
      id: plan.id,
      name: plan.name,
      renderLimit: plan.renderLimit,
      chatTurnLimit: plan.chatTurnLimit,
      renderMinuteLimit: plan.renderMinuteLimit,
    },
    usage: {
      renders: { used: rendersUsed, limit: plan.renderLimit },
      chatTurns: { used: chatTurnsUsed, limit: plan.chatTurnLimit },
      renderMinutes: { used: renderMinutesUsed, limit: plan.renderMinuteLimit },
    },
    projects: userProjects,
    renders: recentRenders,
  });
}
