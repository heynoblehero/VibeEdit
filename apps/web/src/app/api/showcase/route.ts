import { NextResponse } from "next/server";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { renderJobs, projects, brandKits, user } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") || 24), 60);
  const platform = url.searchParams.get("platform"); // optional filter

  const whereClause = and(
    eq(renderJobs.showcased, true),
    eq(renderJobs.status, "done"),
    isNotNull(renderJobs.publicShareSlug),
    platform ? eq(projects.platform, platform) : undefined,
  );

  const rows = db
    .select({
      slug: renderJobs.publicShareSlug,
      renderId: renderJobs.id,
      projectId: renderJobs.projectId,
      projectName: projects.name,
      platform: projects.platform,
      aspectRatio: projects.aspectRatio,
      finishedAt: renderJobs.finishedAt,
      channelName: brandKits.channelName,
      userName: user.name,
    })
    .from(renderJobs)
    .leftJoin(projects, eq(renderJobs.projectId, projects.id))
    .leftJoin(brandKits, eq(renderJobs.userId, brandKits.userId))
    .leftJoin(user, eq(renderJobs.userId, user.id))
    .where(whereClause)
    .orderBy(desc(renderJobs.finishedAt))
    .limit(limit)
    .all();

  const entries = rows
    .filter((r) => r.slug)
    .map((r) => ({
      slug: r.slug!,
      projectName: r.projectName,
      platform: r.platform ?? "youtube",
      aspectRatio: r.aspectRatio ?? "16:9",
      channelName: r.channelName || r.userName || null,
      finishedAt: r.finishedAt,
      videoUrl: `/api/share/${r.slug}/video`,
      thumbUrl: `/api/share/${r.slug}/thumb`,
    }));

  return NextResponse.json(
    { entries },
    { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=120" } },
  );
}
