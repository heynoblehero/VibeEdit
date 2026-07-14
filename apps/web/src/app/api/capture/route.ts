import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { resolveExtensionToken } from "@/lib/import/extension-auth";
import { resolveAndDownload, ImportError } from "@/lib/import/fetch-video";
import { ingestDownloadedVideo } from "@/lib/import/ingest";
import { saveDownloadToLibrary } from "@/lib/import/library";
import { resolveRightsBasis, RightsError, type ImportAction } from "@/lib/import/rights";
import { extractThumbnailDataUri } from "@/lib/import/thumbnail";

export const runtime = "nodejs";
export const maxDuration = 300;

const ACTIONS: ImportAction[] = ["save", "reuse", "recreate"];

// The extension is a different origin (chrome-extension://…). It authenticates
// with a per-user token header, not cookies, so wildcard CORS is safe here.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-vibe-token",
  "Access-Control-Max-Age": "86400",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  const userId = resolveExtensionToken(req.headers.get("x-vibe-token"));
  if (!userId) return json({ error: "unauthorized" }, 401);

  let body: {
    url?: unknown;
    startSeconds?: unknown;
    endSeconds?: unknown;
    projectId?: unknown;
    action?: unknown;
    attested?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) return json({ error: "missing_url" }, 400);
  const action = ACTIONS.includes(body.action as ImportAction)
    ? (body.action as ImportAction)
    : "save";
  const startSeconds = typeof body.startSeconds === "number" ? body.startSeconds : undefined;
  const endSeconds = typeof body.endSeconds === "number" ? body.endSeconds : undefined;
  const attested = body.attested === true;
  const projectId = typeof body.projectId === "string" ? body.projectId : "";

  try {
    const download = await resolveAndDownload(url);
    const rightsBasis = resolveRightsBasis({
      action,
      attested,
      license: download.metadata.license,
    });

    // Grab a preview frame BEFORE ingest (which deletes the temp download).
    // Sampled near the chosen in-point so the overlay shows what was captured.
    const previewDataUri = await extractThumbnailDataUri(
      download.filePath,
      Math.max(0, startSeconds ?? 0),
    ).catch(() => null);
    const title = download.metadata.title;

    // With a valid, owned projectId → land it in that project. Otherwise the
    // clip goes to the user's reference library.
    if (projectId) {
      const owns = db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
        .get();
      if (!owns) return json({ error: "project_not_found" }, 404);
      const ingest = await ingestDownloadedVideo(userId, projectId, download, {
        sourceUrl: url,
        startSeconds,
        endSeconds,
        rightsBasis,
      });
      return json({
        target: "project",
        projectId,
        asset: ingest.assetPath,
        rightsBasis,
        title,
        previewDataUri,
        editorPath: `/app/projects/${projectId}/edit`,
      });
    }

    const libraryId = await saveDownloadToLibrary(userId, download, {
      sourceUrl: url,
      startSeconds,
      endSeconds,
      rightsBasis,
    });
    return json({
      target: "library",
      libraryId,
      rightsBasis,
      title,
      previewDataUri,
      editorPath: "/app/references",
    });
  } catch (error) {
    if (error instanceof RightsError)
      return json({ error: "rights_required", message: error.message }, 403);
    if (error instanceof ImportError)
      return json({ error: "import_failed", message: error.message }, error.status);
    return json(
      { error: "import_failed", message: error instanceof Error ? error.message : "unknown" },
      500,
    );
  }
}
