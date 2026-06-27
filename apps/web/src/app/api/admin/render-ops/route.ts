import { NextResponse } from "next/server";
import { and, desc, eq, gte, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { renderJobs, user, projects } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Auth: requireAdmin(). Render ops — recent failures with stored error +
// status counts. Read-only; does not touch the render queue.
export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const url = new URL(req.url);
  const status = url.searchParams.get("status"); // "failed" by default below
  const last7d = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  const counts = db
    .select({ status: renderJobs.status, count: sql<number>`count(*)` })
    .from(renderJobs)
    .where(gte(renderJobs.createdAt, last7d))
    .groupBy(renderJobs.status)
    .all();

  const filter =
    status && status !== "all" ? eq(renderJobs.status, status) : ne(renderJobs.status, "done");

  const jobs = db
    .select({
      id: renderJobs.id,
      userId: renderJobs.userId,
      userEmail: user.email,
      projectId: renderJobs.projectId,
      projectName: projects.name,
      status: renderJobs.status,
      progress: renderJobs.progress,
      quality: renderJobs.quality,
      error: renderJobs.error,
      createdAt: renderJobs.createdAt,
      finishedAt: renderJobs.finishedAt,
    })
    .from(renderJobs)
    .leftJoin(user, eq(renderJobs.userId, user.id))
    .leftJoin(projects, eq(renderJobs.projectId, projects.id))
    .where(and(filter, gte(renderJobs.createdAt, last7d)))
    .orderBy(desc(renderJobs.createdAt))
    .limit(50)
    .all();

  return NextResponse.json({
    counts: Object.fromEntries(counts.map((row) => [row.status, Number(row.count)])),
    jobs,
  });
}
