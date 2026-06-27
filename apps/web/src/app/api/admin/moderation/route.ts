import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { snippets, renderJobs, user, errorLog } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Auth: requireAdmin(). Lists public marketplace snippets + showcased renders
// for moderation. GET returns both lists; POST toggles visibility.
export async function GET() {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const publicSnippets = db
    .select({
      id: snippets.id,
      label: snippets.label,
      description: snippets.description,
      isPublic: snippets.isPublic,
      likesCount: snippets.likesCount,
      platform: snippets.platform,
      userEmail: user.email,
      createdAt: snippets.createdAt,
    })
    .from(snippets)
    .leftJoin(user, eq(snippets.userId, user.id))
    .where(eq(snippets.isPublic, true))
    .orderBy(desc(snippets.createdAt))
    .limit(100)
    .all();

  const showcased = db
    .select({
      id: renderJobs.id,
      showcased: renderJobs.showcased,
      publicShareSlug: renderJobs.publicShareSlug,
      quality: renderJobs.quality,
      userEmail: user.email,
      createdAt: renderJobs.createdAt,
    })
    .from(renderJobs)
    .leftJoin(user, eq(renderJobs.userId, user.id))
    .where(eq(renderJobs.showcased, true))
    .orderBy(desc(renderJobs.createdAt))
    .limit(100)
    .all();

  return NextResponse.json({ snippets: publicSnippets, showcased });
}

// Toggle visibility. type: "snippet" -> isPublic; type: "showcase" -> showcased.
export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (admin instanceof Response) return admin;

  const body = (await req.json().catch(() => null)) as {
    type?: "snippet" | "showcase";
    id?: string;
    visible?: boolean;
  } | null;
  if (!body?.id || !body.type || typeof body.visible !== "boolean") {
    return new NextResponse("type, id, visible required", { status: 400 });
  }

  if (body.type === "snippet") {
    const row = db.select({ id: snippets.id }).from(snippets).where(eq(snippets.id, body.id)).get();
    if (!row) return new NextResponse("snippet not found", { status: 404 });
    db.update(snippets).set({ isPublic: body.visible }).where(eq(snippets.id, body.id)).run();
  } else {
    const row = db
      .select({ id: renderJobs.id })
      .from(renderJobs)
      .where(eq(renderJobs.id, body.id))
      .get();
    if (!row) return new NextResponse("render not found", { status: 404 });
    db.update(renderJobs).set({ showcased: body.visible }).where(eq(renderJobs.id, body.id)).run();
  }

  db.insert(errorLog)
    .values({
      id: nanoid(12),
      source: "admin.moderation",
      message: `${admin.user.email} set ${body.type} ${body.id} visible=${body.visible}`,
      stack: null,
      context: JSON.stringify({ adminId: admin.user.id, ...body }),
      createdAt: new Date(),
    })
    .run();

  return NextResponse.json({ ok: true });
}
