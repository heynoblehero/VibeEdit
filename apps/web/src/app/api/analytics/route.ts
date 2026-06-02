import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { videoAnalytics, publishConnections, renderJobs } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";

export async function GET() {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const rows = db
    .select()
    .from(videoAnalytics)
    .where(eq(videoAnalytics.userId, session.user.id))
    .orderBy(desc(videoAnalytics.fetchedAt))
    .limit(50)
    .all();
  return NextResponse.json({ analytics: rows });
}

// POST /api/analytics — manually trigger a refresh for a specific render job.
// The full OAuth + YouTube Data API v3 / TikTok API integration requires
// registered OAuth app credentials (see PUBLISH_TOKEN_SECRET env setup).
// For now: stub that returns a placeholder + records the fetch attempt.
export async function POST(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const body = (await req.json()) as { renderJobId: string; platform: "youtube" | "tiktok" };
  if (!body.renderJobId || !body.platform) {
    return new NextResponse("invalid", { status: 400 });
  }
  const job = db
    .select({ id: renderJobs.id, userId: renderJobs.userId })
    .from(renderJobs)
    .where(eq(renderJobs.id, body.renderJobId))
    .get();
  if (!job || job.userId !== session.user.id) {
    return new NextResponse("not found", { status: 404 });
  }
  const connection = db
    .select()
    .from(publishConnections)
    .where(eq(publishConnections.userId, session.user.id))
    .all()
    .find((c) => c.platform === body.platform);
  if (!connection) {
    return NextResponse.json(
      {
        error: "not_connected",
        message: `No ${body.platform} account connected. Connect at /app/settings/publishing.`,
      },
      { status: 402 },
    );
  }
  // TODO: Use connection.accessTokenEnc (decrypt with PUBLISH_TOKEN_SECRET) to call
  // YouTube Data API v3 (statistics endpoint) or TikTok Research API.
  // For now record a stub entry so the UI has something to display.
  const now = new Date();
  const id = nanoid(12);
  db.insert(videoAnalytics)
    .values({
      id,
      renderJobId: body.renderJobId,
      userId: session.user.id,
      platform: body.platform,
      views: 0,
      likes: 0,
      comments: 0,
      watchTimeSeconds: 0,
      ctr: null,
      avgViewDurationSeconds: null,
      fetchedAt: now,
    })
    .onConflictDoNothing()
    .run();
  return NextResponse.json({
    ok: true,
    message: "Analytics refresh queued. Full YouTube/TikTok API integration requires OAuth setup.",
    fetchedAt: now,
  });
}
