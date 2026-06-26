import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { writeProjectFile, listAssets } from "@/lib/storage/fs";
import { ensureManifest } from "@/lib/storage/manifests";

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id } = await context.params;
  const row = db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .get();
  if (!row) return new NextResponse("not found", { status: 404 });

  const form = await req.formData();
  const files: string[] = [];
  for (const value of form.values()) {
    if (!(value instanceof File)) continue;
    const safeName = value.name.replace(/[^A-Za-z0-9._-]+/g, "_");
    const buffer = Buffer.from(await value.arrayBuffer());
    writeProjectFile(userId, id, `assets/${safeName}`, buffer);
    files.push(`assets/${safeName}`);
  }
  // Capture cheap facts (ffprobe + stat) into each asset's manifest now; the
  // expensive `understanding` is filled lazily on first reference. Best-effort —
  // a probe failure must not fail the upload.
  await Promise.all(
    files.map((rel) => ensureManifest(userId, id, rel, { source: "upload" }).catch(() => null)),
  );
  return NextResponse.json({ uploaded: files, assets: listAssets(userId, id) });
}
