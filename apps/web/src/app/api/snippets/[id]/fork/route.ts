import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, snippets } from "@/lib/db/schema";
import { ensureProjectDir, writeProjectFile } from "@/lib/storage/fs";
import { requireServerSession } from "@/lib/server-session";

export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id } = await context.params;

  const snippet = db
    .select()
    .from(snippets)
    .where(and(eq(snippets.id, id), eq(snippets.userId, userId)))
    .get();
  if (!snippet) return new NextResponse("not found", { status: 404 });

  const newId = nanoid(10);
  const now = new Date();
  db.insert(projects)
    .values({
      id: newId,
      userId,
      name: `${snippet.label} (from snippet)`,
      createdAt: now,
      updatedAt: now,
    })
    .run();
  ensureProjectDir(userId, newId);
  writeProjectFile(userId, newId, "index.html", snippet.html);

  return NextResponse.json({ id: newId });
}
