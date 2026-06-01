import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { readProjectText, writeProjectFile } from "@/lib/storage/fs";

async function ensureOwned(userId: string, projectId: string) {
  const row = db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
    .get();
  return !!row;
}

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id } = await context.params;
  if (!(await ensureOwned(userId, id))) return new NextResponse("not found", { status: 404 });
  const u = new URL(req.url);
  const path = u.searchParams.get("path");
  if (!path) return new NextResponse("path required", { status: 400 });
  try {
    const content = readProjectText(userId, id, path);
    return NextResponse.json({ path, content });
  } catch (error) {
    return new NextResponse((error as Error).message, { status: 404 });
  }
}

export async function PUT(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id } = await context.params;
  if (!(await ensureOwned(userId, id))) return new NextResponse("not found", { status: 404 });
  const { path, content } = (await req.json()) as { path: string; content: string };
  if (!path) return new NextResponse("path required", { status: 400 });
  writeProjectFile(userId, id, path, content);
  return NextResponse.json({ ok: true });
}
