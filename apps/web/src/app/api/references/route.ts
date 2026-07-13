import { NextResponse } from "next/server";
import { requireServerSession } from "@/lib/server-session";
import { deleteReference, listLibrary } from "@/lib/import/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/references — the signed-in user's saved clips/effects.
export async function GET() {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const items = listLibrary(session.user.id).map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    uploader: row.uploader,
    sourceUrl: row.sourceUrl,
    durationSeconds: row.durationSeconds,
    rightsBasis: row.rightsBasis,
    // Thumbs are served via /api/references/[id]/thumb to keep this list light.
    hasThumb: Boolean(row.thumbFile),
    createdAt: row.createdAt,
  }));
  return NextResponse.json({ references: items });
}

// DELETE /api/references?id=... — remove a saved reference (row + files).
export async function DELETE(req: Request) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  const removed = deleteReference(session.user.id, id);
  if (!removed) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
