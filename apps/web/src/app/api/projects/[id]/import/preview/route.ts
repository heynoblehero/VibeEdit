import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { resolveMetadata, ImportError, IMPORT_MAX_DURATION_SEC } from "@/lib/import/fetch-video";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/projects/[id]/import/preview?url=... — resolve title/duration/thumb
// for the import modal WITHOUT downloading the media.
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await requireServerSession().catch((r) => r);
  if (session instanceof Response) return session;
  const userId = session.user.id;
  const { id } = await context.params;

  const owns = db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, userId)))
    .get();
  if (!owns) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const url = new URL(req.url).searchParams.get("url")?.trim() || "";
  if (!url) return NextResponse.json({ error: "missing_url" }, { status: 400 });

  try {
    const meta = await resolveMetadata(url);
    return NextResponse.json({
      title: meta.title,
      durationSec: meta.durationSec,
      uploader: meta.uploader,
      license: meta.license,
      hasCaptions: meta.hasCaptions,
      thumbnailUrl: meta.thumbnailUrl,
      // Surfaced so the modal can warn before a doomed download.
      overDurationLimit: meta.durationSec > IMPORT_MAX_DURATION_SEC,
      maxDurationSec: IMPORT_MAX_DURATION_SEC,
    });
  } catch (error) {
    if (error instanceof ImportError) {
      return NextResponse.json(
        { error: "preview_failed", message: error.message },
        {
          status: error.status,
        },
      );
    }
    return NextResponse.json(
      { error: "preview_failed", message: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}
