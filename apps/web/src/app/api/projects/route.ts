import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, renderJobs } from "@/lib/db/schema";
import { ensureProjectDir, seedFromIsaacHook } from "@/lib/storage/fs";
import { requireServerSession } from "@/lib/server-session";
import { captureEvent, FUNNEL } from "@/lib/observability/posthog";
import { generateProjectName } from "@/lib/projects/name";

// A preset or custom "W:H" ratio, each side 16–4096px; else the 16:9 default.
function normalizeAspectRatio(input?: string): string {
  if (!input) return "16:9";
  const match = /^(\d{1,4}):(\d{1,4})$/.exec(input.trim());
  if (!match) return "16:9";
  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width < 16 || width > 4096 || height < 16 || height > 4096) return "16:9";
  return `${width}:${height}`;
}

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
    description?: string;
    seed?: "isaac" | "empty";
    platform?: string;
    aspectRatio?: string;
  };
  const id = nanoid(10);
  const now = new Date();
  // Prefer an explicit name; otherwise auto-generate a good one from the
  // description (falls back to a friendly random name) so nothing is "Untitled".
  const typedName = body.name?.trim();
  const resolvedName = typedName
    ? typedName.slice(0, 100)
    : await generateProjectName(body.description);

  const VALID_PLATFORMS = ["youtube", "tiktok", "instagram", "linkedin"] as const;
  const platform = VALID_PLATFORMS.includes(body.platform as (typeof VALID_PLATFORMS)[number])
    ? body.platform!
    : "youtube";
  // Accept a preset ratio OR a custom "W:H" (each side 16–4096px); the preview
  // and agent size proportionally off the ratio. Anything else → 16:9.
  const aspectRatio = normalizeAspectRatio(body.aspectRatio);

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
  captureEvent(FUNNEL.projectCreated, userId, {
    projectId: id,
    platform,
    aspectRatio,
    source: "new",
  });
  return NextResponse.json({ id });
}
