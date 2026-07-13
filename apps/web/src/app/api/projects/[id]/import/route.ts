import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { requireServerSession } from "@/lib/server-session";
import { listAssets } from "@/lib/storage/fs";
import { resolveAndDownload, ImportError } from "@/lib/import/fetch-video";
import { ingestDownloadedVideo } from "@/lib/import/ingest";
import { resolveRightsBasis, RightsError, type ImportAction } from "@/lib/import/rights";
import { saveClipToLibrary } from "@/lib/import/library";

export const runtime = "nodejs";
// Downloading + trimming a source clip can take a while; give it headroom like
// the upload route.
export const maxDuration = 300;

const ACTIONS: ImportAction[] = ["save", "reuse", "recreate"];

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

  let body: {
    url?: unknown;
    startSeconds?: unknown;
    endSeconds?: unknown;
    action?: unknown;
    attested?: unknown;
    saveToLibrary?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  const action = ACTIONS.includes(body.action as ImportAction)
    ? (body.action as ImportAction)
    : "save";
  const startSeconds = typeof body.startSeconds === "number" ? body.startSeconds : undefined;
  const endSeconds = typeof body.endSeconds === "number" ? body.endSeconds : undefined;
  const attested = body.attested === true;
  const saveToLibrary = body.saveToLibrary === true;
  if (!url) return NextResponse.json({ error: "missing_url" }, { status: 400 });

  try {
    // Download first so we know the source license before the final rights call.
    const download = await resolveAndDownload(url);
    const rightsBasis = resolveRightsBasis({
      action,
      attested,
      license: download.metadata.license,
    });

    const ingest = await ingestDownloadedVideo(userId, id, download, {
      sourceUrl: url,
      startSeconds,
      endSeconds,
      rightsBasis,
    });

    // "Both save targets" — optionally also stash a copy in the personal library.
    let libraryId: string | undefined;
    if (saveToLibrary) {
      libraryId = await saveClipToLibrary(userId, {
        projectId: id,
        assetPath: ingest.assetPath,
        sourceUrl: url,
        title: download.metadata.title,
        uploader: download.metadata.uploader,
        durationSeconds: download.metadata.durationSec,
        rightsBasis,
      });
    }

    return NextResponse.json({
      asset: ingest.assetPath,
      rightsBasis,
      action,
      libraryId,
      assets: listAssets(userId, id),
    });
  } catch (error) {
    if (error instanceof RightsError) {
      return NextResponse.json(
        { error: "rights_required", message: error.message },
        { status: 403 },
      );
    }
    if (error instanceof ImportError) {
      return NextResponse.json(
        { error: "import_failed", message: error.message },
        {
          status: error.status,
        },
      );
    }
    return NextResponse.json(
      { error: "import_failed", message: error instanceof Error ? error.message : "unknown" },
      { status: 500 },
    );
  }
}
