import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { getStorageStatus } from "@/lib/storage/quota";
import { directoryBytes, projectDir } from "@/lib/storage/fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/storage — the signed-in user's storage usage vs quota, plus a
// per-project size breakdown so they can see where space is used and delete to
// free it. Powers the account settings storage panel.
export async function GET() {
  const session = await requireServerSession().catch(() => null);
  if (!session || session instanceof Response) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const status = getStorageStatus(userId);

  const rows = db
    .select({ id: projects.id, name: projects.name, updatedAt: projects.updatedAt })
    .from(projects)
    .where(eq(projects.userId, userId))
    .orderBy(desc(projects.updatedAt))
    .all();

  const breakdown = rows
    .map((row) => ({
      id: row.id,
      name: row.name,
      updatedAt: row.updatedAt,
      bytes: directoryBytes(projectDir(userId, row.id)),
    }))
    .sort((a, b) => b.bytes - a.bytes);

  return NextResponse.json({ ...status, projects: breakdown });
}
