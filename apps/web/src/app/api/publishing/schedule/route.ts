import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { eq, and, desc } from "drizzle-orm";
import { requireServerSession } from "@/lib/server-session";
import { db } from "@/lib/db";
import { scheduledPublishes, projects, renderJobs } from "@/lib/db/schema";

export async function GET() {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;

  const rows = db
    .select({
      id: scheduledPublishes.id,
      projectId: scheduledPublishes.projectId,
      projectName: projects.name,
      renderJobId: scheduledPublishes.renderJobId,
      platform: scheduledPublishes.platform,
      title: scheduledPublishes.title,
      description: scheduledPublishes.description,
      scheduledAt: scheduledPublishes.scheduledAt,
      status: scheduledPublishes.status,
      publishedAt: scheduledPublishes.publishedAt,
      error: scheduledPublishes.error,
      createdAt: scheduledPublishes.createdAt,
    })
    .from(scheduledPublishes)
    .leftJoin(projects, eq(scheduledPublishes.projectId, projects.id))
    .where(eq(scheduledPublishes.userId, userId))
    .orderBy(desc(scheduledPublishes.scheduledAt))
    .all();

  return NextResponse.json({ schedules: rows });
}

export async function POST(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;

  const body = (await req.json()) as {
    projectId?: string;
    renderJobId?: string;
    platform?: string;
    title?: string;
    description?: string;
    scheduledAt?: string | number;
  };

  if (!body.projectId || !body.platform || !body.scheduledAt) {
    return new NextResponse("projectId, platform, and scheduledAt are required", { status: 400 });
  }

  const validPlatforms = ["youtube", "tiktok", "instagram"];
  if (!validPlatforms.includes(body.platform)) {
    return new NextResponse("invalid platform", { status: 400 });
  }

  // Verify project belongs to this user.
  const project = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, body.projectId), eq(projects.userId, userId)))
    .get();
  if (!project) return new NextResponse("not found", { status: 404 });

  // IDOR guard: if a render is linked, it must belong to this user — otherwise a
  // user could schedule another user's private render to their own social account.
  if (body.renderJobId) {
    const job = db
      .select({ id: renderJobs.id })
      .from(renderJobs)
      .where(and(eq(renderJobs.id, body.renderJobId), eq(renderJobs.userId, userId)))
      .get();
    if (!job) return new NextResponse("render job not found", { status: 404 });
  }

  const scheduledAt = new Date(
    typeof body.scheduledAt === "number" ? body.scheduledAt : body.scheduledAt,
  );
  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
    return new NextResponse("scheduledAt must be a future date", { status: 400 });
  }

  const id = nanoid(12);
  db.insert(scheduledPublishes)
    .values({
      id,
      userId,
      projectId: body.projectId,
      renderJobId: body.renderJobId ?? null,
      platform: body.platform,
      title: body.title ?? null,
      description: body.description ?? null,
      scheduledAt,
      status: "pending",
      createdAt: new Date(),
    })
    .run();

  const row = db.select().from(scheduledPublishes).where(eq(scheduledPublishes.id, id)).get();
  return NextResponse.json(row, { status: 201 });
}
