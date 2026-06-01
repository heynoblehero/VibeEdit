import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { snippets, snippetLikes, user } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";

const PAGE_SIZE = 24;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const platform = url.searchParams.get("platform") || undefined;
  const cursor = Number(url.searchParams.get("cursor") || "0");

  const where = and(
    eq(snippets.isPublic, true),
    platform ? eq(snippets.platform, platform) : undefined,
  );

  const rows = db
    .select({
      id: snippets.id,
      label: snippets.label,
      description: snippets.description,
      platform: snippets.platform,
      aspectRatio: snippets.aspectRatio,
      likesCount: snippets.likesCount,
      authorId: snippets.userId,
      createdAt: snippets.createdAt,
    })
    .from(snippets)
    .where(where)
    .orderBy(desc(snippets.likesCount), desc(snippets.createdAt))
    .limit(PAGE_SIZE)
    .offset(cursor)
    .all();

  // Attach author display names
  const authorIds = [...new Set(rows.map((r: (typeof rows)[0]) => r.authorId))];
  const authors: { id: string; name: string }[] = authorIds.length
    ? db
        .select({ id: user.id, name: user.name })
        .from(user)
        .where(sql`${user.id} in ${authorIds}`)
        .all()
    : [];
  const authorMap = new Map(authors.map((a: { id: string; name: string }) => [a.id, a.name]));

  return NextResponse.json({
    templates: rows.map((r: (typeof rows)[0]) => ({
      ...r,
      authorName: authorMap.get(r.authorId) ?? "Anonymous",
    })),
    nextCursor: rows.length === PAGE_SIZE ? cursor + PAGE_SIZE : null,
  });
}

// POST /api/marketplace/like — toggle like on a public snippet
export async function POST(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const body = (await req.json().catch(() => ({}))) as {
    snippetId: string;
    action: "like" | "unlike";
  };
  if (!body.snippetId) return NextResponse.json({ error: "snippetId required" }, { status: 400 });

  const snippet = db
    .select({ id: snippets.id, isPublic: snippets.isPublic })
    .from(snippets)
    .where(eq(snippets.id, body.snippetId))
    .get();
  if (!snippet?.isPublic) return new NextResponse("not found", { status: 404 });

  const existing = db
    .select({ userId: snippetLikes.userId })
    .from(snippetLikes)
    .where(and(eq(snippetLikes.userId, userId), eq(snippetLikes.snippetId, body.snippetId)))
    .get();

  if (body.action === "like" && !existing) {
    db.insert(snippetLikes)
      .values({ userId, snippetId: body.snippetId, createdAt: new Date() })
      .run();
    db.update(snippets)
      .set({ likesCount: sql`${snippets.likesCount} + 1` })
      .where(eq(snippets.id, body.snippetId))
      .run();
  } else if (body.action === "unlike" && existing) {
    db.delete(snippetLikes)
      .where(and(eq(snippetLikes.userId, userId), eq(snippetLikes.snippetId, body.snippetId)))
      .run();
    db.update(snippets)
      .set({ likesCount: sql`max(0, ${snippets.likesCount} - 1)` })
      .where(eq(snippets.id, body.snippetId))
      .run();
  }

  return NextResponse.json({ ok: true });
}
