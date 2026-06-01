import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { join } from "node:path";
import { db } from "@/lib/db";
import { renderJobs, projects, publishConnections } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { renderOutputPath } from "@/lib/storage/fs";
import { decryptToken, uploadToYouTube, uploadToTikTok } from "@/lib/publish";

// POST /api/publish — upload a completed render to YouTube or TikTok
export async function POST(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;

  const body = (await req.json().catch(() => ({}))) as {
    renderJobId: string;
    platform: "youtube" | "tiktok";
    title?: string;
    description?: string;
    privacyStatus?: string;
  };

  if (!body.renderJobId || !body.platform) {
    return NextResponse.json({ error: "renderJobId and platform required" }, { status: 400 });
  }

  // Verify the render belongs to this user and is done.
  const job = db
    .select()
    .from(renderJobs)
    .where(and(eq(renderJobs.id, body.renderJobId), eq(renderJobs.userId, userId)))
    .get();
  if (!job) return new NextResponse("not found", { status: 404 });
  if (job.status !== "done" || !job.outputPath) {
    return NextResponse.json({ error: "render not complete" }, { status: 409 });
  }

  // Load the OAuth connection for this platform.
  const connection = db
    .select()
    .from(publishConnections)
    .where(
      and(eq(publishConnections.userId, userId), eq(publishConnections.platform, body.platform)),
    )
    .get();
  if (!connection) {
    return NextResponse.json(
      {
        error: "not_connected",
        message: `Connect your ${body.platform} account at /app/settings/publishing first.`,
      },
      { status: 403 },
    );
  }

  // Decrypt access token.
  let accessToken: string;
  try {
    accessToken = decryptToken(connection.accessTokenEnc);
  } catch {
    return NextResponse.json({ error: "token_decrypt_failed" }, { status: 500 });
  }

  // Fetch project name for default title.
  const project = db
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, job.projectId))
    .get();
  const title = body.title || project?.name || "Untitled Video";
  const videoPath = join(renderOutputPath(job.id), "output.mp4");

  try {
    let url: string;
    if (body.platform === "youtube") {
      url = await uploadToYouTube({
        accessToken,
        videoPath,
        title,
        description: body.description,
        privacyStatus: (body.privacyStatus as "public" | "unlisted" | "private") ?? "private",
      });
    } else {
      url = await uploadToTikTok({
        accessToken,
        videoPath,
        title,
      });
    }
    return NextResponse.json({ ok: true, url });
  } catch (error) {
    const message = (error as Error).message;
    return NextResponse.json({ error: "upload_failed", message }, { status: 502 });
  }
}

// GET /api/publish/connections — list connected platforms
export async function GET() {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;

  const connections = db
    .select({
      id: publishConnections.id,
      platform: publishConnections.platform,
      platformAccountName: publishConnections.platformAccountName,
      createdAt: publishConnections.createdAt,
    })
    .from(publishConnections)
    .where(eq(publishConnections.userId, userId))
    .all();

  return NextResponse.json({ connections });
}
