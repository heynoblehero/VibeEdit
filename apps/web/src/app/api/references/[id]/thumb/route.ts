import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { requireServerSession } from "@/lib/server-session";
import { getReference } from "@/lib/import/library";
import { referenceDir } from "@/lib/storage/fs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/references/[id]/thumb — the saved clip's JPEG thumbnail.
export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const { id } = await context.params;

  const row = getReference(session.user.id, id);
  if (!row || !row.thumbFile) return new NextResponse("not found", { status: 404 });
  // thumbFile is a server-generated basename; still join under the user's dir.
  const file = join(referenceDir(session.user.id), row.thumbFile);
  if (!existsSync(file)) return new NextResponse("not found", { status: 404 });

  return new NextResponse(new Uint8Array(readFileSync(file)), {
    headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=3600" },
  });
}
