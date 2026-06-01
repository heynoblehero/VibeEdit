import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, snippets } from "@/lib/db/schema";
import { readProjectText } from "@/lib/storage/fs";
import { requireServerSession } from "@/lib/server-session";

const MAX_LABEL = 80;
const MAX_HTML = 200_000;

export async function GET() {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const rows = db
    .select()
    .from(snippets)
    .where(eq(snippets.userId, userId))
    .orderBy(desc(snippets.createdAt))
    .all();
  return NextResponse.json({
    snippets: rows.map((row) => ({
      id: row.id,
      label: row.label,
      sourceProjectId: row.sourceProjectId,
      isPublic: row.isPublic,
      likesCount: row.likesCount,
      createdAt: row.createdAt,
      size: row.html.length,
    })),
  });
}

export async function POST(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const body = (await req.json().catch(() => ({}))) as {
    projectId?: string;
    label?: string;
    description?: string;
    isPublic?: boolean;
  };
  if (!body.projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }
  const owned = db
    .select()
    .from(projects)
    .where(and(eq(projects.id, body.projectId), eq(projects.userId, userId)))
    .get();
  if (!owned) return new NextResponse("not found", { status: 404 });

  let html: string;
  try {
    html = readProjectText(userId, body.projectId, "index.html");
  } catch {
    return NextResponse.json({ error: "no index.html in project yet" }, { status: 400 });
  }
  if (html.length > MAX_HTML) {
    return NextResponse.json(
      { error: `index.html too large to favorite (${html.length}B)` },
      { status: 413 },
    );
  }
  const id = nanoid(10);
  db.insert(snippets)
    .values({
      id,
      userId,
      sourceProjectId: body.projectId,
      label: (body.label || owned.name || "Untitled snippet").slice(0, MAX_LABEL),
      description: body.description?.slice(0, 280) ?? null,
      isPublic: body.isPublic === true,
      platform: owned.platform ?? null,
      aspectRatio: owned.aspectRatio ?? null,
      html,
      createdAt: new Date(),
    })
    .run();
  return NextResponse.json({ id });
}

export async function PATCH(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const body = (await req.json().catch(() => ({}))) as {
    id: string;
    isPublic?: boolean;
    label?: string;
    description?: string;
  };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const updates: Record<string, unknown> = {};
  if (typeof body.isPublic === "boolean") updates.isPublic = body.isPublic;
  if (typeof body.label === "string") updates.label = body.label.slice(0, MAX_LABEL);
  if (typeof body.description === "string") updates.description = body.description.slice(0, 280);
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }
  db.update(snippets)
    .set(updates)
    .where(and(eq(snippets.id, body.id), eq(snippets.userId, userId)))
    .run();
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return new NextResponse("id required", { status: 400 });
  db.delete(snippets)
    .where(and(eq(snippets.id, id), eq(snippets.userId, userId)))
    .run();
  return NextResponse.json({ ok: true });
}
