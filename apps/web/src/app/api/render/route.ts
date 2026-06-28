import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";
import { projects, renderJobs } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { projectDir } from "@/lib/storage/fs";
import { enqueue } from "@/lib/render/queue";
import {
  canRenderMinutes,
  canUseCloudRender,
  capQualityForPlan,
  trySpendRenderCredit,
  reserveUsage,
  refundUsage,
  getUserPlan,
} from "@/lib/billing/usage";
import { upgradePaywall } from "@/lib/billing/paywall";
import { captureEvent, FUNNEL } from "@/lib/observability/posthog";
import { captureException } from "@/lib/observability/sentry";

export async function POST(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  // Email-verified gate: unverified accounts can build/preview in the editor
  // but cannot kick off a render. Resending a verification link is one click
  // away in /app/settings/account.
  if (!session.user.emailVerified) {
    return NextResponse.json(
      {
        error: "email_not_verified",
        message:
          "Verify your email before rendering. We sent a link to your inbox at signup — request a new one at /app/settings/account.",
      },
      { status: 403 },
    );
  }
  const body = (await req.json()) as {
    projectId: string;
    fps?: number;
    quality?: "draft" | "standard" | "high";
  };
  const owned = db
    .select()
    .from(projects)
    .where(and(eq(projects.id, body.projectId), eq(projects.userId, userId)))
    .get();
  if (!owned) return new NextResponse("not found", { status: 404 });
  // No composition yet — the CLI render would otherwise fail with a raw
  // "No index.html file found" error. Return a clear, actionable message
  // instead, and don't consume any billing gates.
  if (!existsSync(join(projectDir(userId, body.projectId), "index.html"))) {
    return NextResponse.json(
      {
        error: "no_composition",
        message: "Nothing to render yet — ask the agent in chat to build the video first.",
      },
      { status: 400 },
    );
  }
  // Atomic reserve: count + insert the render usage event in one transaction so
  // two parallel render requests can't both slip past the monthly cap (a free
  // overage = real money). If the plan limit is exhausted we fall back to
  // pay-per-render credits, also spent atomically.
  const plan = getUserPlan(userId);
  let reservedRenderUnit = true; // false => paid via a credit, not a usage unit
  if (plan.renderLimit !== -1) {
    const reservation = reserveUsage(userId, "render", plan.renderLimit, { jobId: "pending" });
    if (!reservation.ok) {
      // Plan exhausted — try a credit before paywalling.
      if (!trySpendRenderCredit(userId)) {
        return NextResponse.json(
          upgradePaywall("render_limit_reached", {
            used: reservation.used,
            limit: reservation.limit,
          }),
          { status: 402 },
        );
      }
      reservedRenderUnit = false; // credit covered it; don't double-count
    }
  } else {
    // Unlimited plan — still record the event for accurate dashboards.
    reserveUsage(userId, "render", -1, { jobId: "pending" });
  }
  const minuteGate = canRenderMinutes(userId);
  if (!minuteGate.ok) {
    if (reservedRenderUnit) refundUsage(userId, "render", 1, { reason: "render_minutes_gate" });
    return NextResponse.json(
      upgradePaywall("render_minutes_exhausted", {
        used: minuteGate.used,
        limit: minuteGate.limit,
      }),
      { status: 402 },
    );
  }
  const cloudGate = canUseCloudRender(userId);
  if (!cloudGate.ok) {
    if (reservedRenderUnit) refundUsage(userId, "render", 1, { reason: "cloud_render_gate" });
    return NextResponse.json(
      upgradePaywall("cloud_render_exhausted", {
        used: cloudGate.used,
        limit: cloudGate.limit,
      }),
      { status: 402 },
    );
  }
  // Cap quality to what the user's plan supports. Free → draft (480p), creator → standard (1080p), studio → high (4k).
  const requestedQuality = (body.quality || "standard") as "draft" | "standard" | "high";
  const effectiveQuality = capQualityForPlan(userId, requestedQuality);
  let id: string;
  try {
    id = await enqueue({
      userId,
      projectId: body.projectId,
      fps: body.fps,
      quality: effectiveQuality,
    });
  } catch (error) {
    // Reservation already consumed a render unit; give it back since the job
    // never enqueued, so a transient failure doesn't burn the user's quota.
    if (reservedRenderUnit) refundUsage(userId, "render", 1, { reason: "enqueue_failed" });
    captureException(error, {
      source: "api.render.enqueue",
      userId,
      projectId: body.projectId,
    });
    throw error;
  }
  // Funnel: render kicked off. NOTE FOR RENDER AGENT: render_succeeded /
  // render_failed are owned by the queue/worker — emit them from there with
  // captureEvent(FUNNEL.* , userId, { jobId }) once a job finishes.
  captureEvent(FUNNEL.renderStarted, userId, {
    jobId: id,
    projectId: body.projectId,
    quality: effectiveQuality,
  });
  return NextResponse.json({ id });
}

export async function GET(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const url = new URL(req.url);
  const projectId = url.searchParams.get("projectId");
  const whereClause = projectId
    ? and(eq(renderJobs.userId, userId), eq(renderJobs.projectId, projectId))
    : eq(renderJobs.userId, userId);
  const rows = db
    .select({
      id: renderJobs.id,
      projectId: renderJobs.projectId,
      status: renderJobs.status,
      progress: renderJobs.progress,
      outputPath: renderJobs.outputPath,
      error: renderJobs.error,
      fps: renderJobs.fps,
      quality: renderJobs.quality,
      createdAt: renderJobs.createdAt,
      startedAt: renderJobs.startedAt,
      finishedAt: renderJobs.finishedAt,
      publicShareSlug: renderJobs.publicShareSlug,
      showcased: renderJobs.showcased,
      projectName: projects.name,
    })
    .from(renderJobs)
    .leftJoin(projects, eq(renderJobs.projectId, projects.id))
    .where(whereClause)
    .orderBy(desc(renderJobs.createdAt))
    .limit(50)
    .all();
  return NextResponse.json({ jobs: rows });
}
