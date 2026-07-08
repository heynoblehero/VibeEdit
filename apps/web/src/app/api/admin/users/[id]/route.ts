import { NextResponse } from "next/server";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { user, projects, renderJobs, subscriptions, usageEvents, errorLog } from "@/lib/db/schema";
import { requireAdmin, isAdminEmail } from "@/lib/admin";
import { planFor } from "@/lib/billing/plans";
import { cancelPolarSubscription } from "@/lib/billing/polar";
import { deleteUserStorage, userStorageBytes, purgeUserAssets } from "@/lib/storage/fs";
import { getStorageStatus } from "@/lib/storage/quota";

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
      banned: user.banned,
      bannedReason: user.bannedReason,
      bannedAt: user.bannedAt,
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
    user: { ...target, isAdmin: isAdminEmail(target.email) },
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
    storage: (() => {
      const status = getStorageStatus(id);
      return {
        usedBytes: status.usedBytes,
        limitBytes: status.limitBytes,
        fraction: status.fraction,
      };
    })(),
  });
}

// POST /api/admin/users/[id] — admin storage maintenance actions.
// Auth: requireAdmin(). Body: { action: "purge-assets", olderThanDays?: number }.
// Deletes the target user's uploaded assets older than N days (default 30) to
// reclaim disk. Audited. May remove footage a project still references, so the
// UI warns before calling.
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

  const body = (await req.json().catch(() => null)) as {
    action?: string;
    olderThanDays?: number;
  } | null;
  if (body?.action !== "purge-assets") {
    return new NextResponse("unknown action", { status: 400 });
  }

  const olderThanDays =
    typeof body.olderThanDays === "number" && body.olderThanDays >= 0 ? body.olderThanDays : 30;
  const before = userStorageBytes(id);
  const purged = purgeUserAssets(id, olderThanDays * 24 * 60 * 60 * 1000);

  db.insert(errorLog)
    .values({
      id: nanoid(12),
      source: "admin.users.purge-assets",
      message: `${admin.user.email} purged ${purged.deletedCount} assets (>${olderThanDays}d) from ${target.email}`,
      stack: null,
      context: JSON.stringify({
        adminId: admin.user.id,
        targetId: id,
        olderThanDays,
        ...purged,
      }),
      createdAt: new Date(),
    })
    .run();

  return NextResponse.json({
    ok: true,
    ...purged,
    storageBefore: before,
    storageAfter: userStorageBytes(id),
  });
}

// DELETE /api/admin/users/[id] — hard-delete an account.
// Auth: requireAdmin(). Self/admin-protection: cannot delete yourself or another
// admin. Requires an explicit confirm signal in the body (confirm === true OR
// confirmEmail matching the target's email) so a stray request can't wipe a user.
//
// Cascade:
//   1. Cancel any active Polar subscription (best-effort; recorded in audit).
//   2. Delete the user row. The FK graph uses onDelete: "cascade" (DB runs with
//      foreign_keys = ON), so projects/renders/subscriptions/messages/etc. go too.
//   3. Remove the user's on-disk storage tree (projects, personas, brand-kits,
//      thumbs) plus each render's output directory.
// Audited to errorLog.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
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
    return new NextResponse("cannot delete yourself", { status: 400 });
  }
  if (isAdminEmail(target.email)) {
    return new NextResponse("cannot delete another admin", { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    confirm?: boolean;
    confirmEmail?: string;
  } | null;
  const confirmed =
    body?.confirm === true ||
    (typeof body?.confirmEmail === "string" &&
      body.confirmEmail.trim().toLowerCase() === target.email.toLowerCase());
  if (!confirmed) {
    return new NextResponse("confirmation required", { status: 400 });
  }

  // Gather render job ids before the cascade removes them — render outputs on
  // disk are keyed by job id, so we need the list to clean them up.
  const jobIds = db
    .select({ id: renderJobs.id })
    .from(renderJobs)
    .where(eq(renderJobs.userId, id))
    .all()
    .map((r) => r.id);

  // 1. Cancel Polar subscription (best-effort).
  const sub = db
    .select({ polarSubscriptionId: subscriptions.polarSubscriptionId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, id))
    .get();
  const cancel = await cancelPolarSubscription(sub?.polarSubscriptionId);

  // 2. Delete the user row — FK cascade removes all dependent rows.
  db.delete(user).where(eq(user.id, id)).run();

  // 3. Remove on-disk storage.
  deleteUserStorage(id, jobIds);

  const now = new Date();
  db.insert(errorLog)
    .values({
      id: nanoid(12),
      source: "admin.users.delete",
      message: `${admin.user.email} hard-deleted ${target.email}`,
      stack: null,
      context: JSON.stringify({
        adminId: admin.user.id,
        targetId: id,
        targetEmail: target.email,
        renderOutputsRemoved: jobIds.length,
        polarCancel: cancel,
      }),
      createdAt: now,
    })
    .run();

  return NextResponse.json({ ok: true, deleted: id, polarCancel: cancel });
}
