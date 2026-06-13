import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, renderJobs } from "@/lib/db/schema";
import { ensureProjectDir, seedFromIsaacHook } from "@/lib/storage/fs";
import { requireServerSession } from "@/lib/server-session";

export async function GET() {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const rows = db
    .select()
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt))
    .all();
  const stats = db
    .select({
      projectId: renderJobs.projectId,
      renderCount: sql<number>`count(${renderJobs.id})`,
      lastFinishedAt: sql<number | null>`max(${renderJobs.finishedAt})`,
    })
    .from(renderJobs)
    .where(and(eq(renderJobs.userId, userId), eq(renderJobs.status, "done")))
    .groupBy(renderJobs.projectId)
    .all();
  const statByProject = new Map<string, { renderCount: number; lastFinishedAt: number | null }>();
  for (const row of stats) {
    statByProject.set(row.projectId, {
      renderCount: Number(row.renderCount || 0),
      lastFinishedAt: row.lastFinishedAt ? Number(row.lastFinishedAt) : null,
    });
  }
  const enriched = rows.map((row) => {
    const stat = statByProject.get(row.id);
    return {
      ...row,
      renderCount: stat?.renderCount ?? 0,
      lastRenderAt:
        stat?.lastFinishedAt != null ? new Date(stat.lastFinishedAt).toISOString() : null,
    };
  });
  return NextResponse.json({ projects: enriched });
}

export async function POST(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    seed?: "isaac" | "empty";
    platform?: string;
    aspectRatio?: string;
  };
  const id = nanoid(10);
  const now = new Date();
  const resolvedName = body.name?.slice(0, 100) || "Untitled Project";

  const VALID_PLATFORMS = ["youtube", "tiktok", "instagram", "linkedin"] as const;
  const VALID_RATIOS = ["16:9", "9:16", "1:1"] as const;
  const platform = VALID_PLATFORMS.includes(body.platform as (typeof VALID_PLATFORMS)[number])
    ? body.platform!
    : "youtube";
  const aspectRatio = VALID_RATIOS.includes(body.aspectRatio as (typeof VALID_RATIOS)[number])
    ? body.aspectRatio!
    : "16:9";

  db.insert(projects)
    .values({
      id,
      userId,
      name: resolvedName,
      platform,
      aspectRatio,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  ensureProjectDir(userId, id);
  if (body.seed === "isaac") {
    seedFromIsaacHook(userId, id);
  }
  return NextResponse.json({ id });
}
