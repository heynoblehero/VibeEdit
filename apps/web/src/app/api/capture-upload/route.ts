import { NextResponse } from "next/server";
import { createWriteStream, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { resolveExtensionToken } from "@/lib/import/extension-auth";
import type { DownloadResult } from "@/lib/import/fetch-video";
import { ingestDownloadedVideo } from "@/lib/import/ingest";
import { saveDownloadToLibrary } from "@/lib/import/library";
import { resolveRightsBasis, RightsError, type ImportAction } from "@/lib/import/rights";
import { extractThumbnailDataUri } from "@/lib/import/thumbnail";
import { MAX_UPLOAD_BYTES } from "@/lib/storage/upload-validator";

export const runtime = "nodejs";
export const maxDuration = 300;

// The browser extension records the clip client-side (user's own tab/session, so
// no YouTube bot-check) and POSTs the recorded file here. Token-authed like
// /api/capture; multipart, so it must stay OUT of the Edge middleware matcher
// (Edge in front of multipart breaks request.formData()).

const ACTIONS: ImportAction[] = ["save", "reuse", "recreate"];

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

  const declaredLength = Number(req.headers.get("content-length") || 0);
  if (declaredLength > MAX_UPLOAD_BYTES) return json({ error: "too_large" }, 413);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "bad_form" }, 400);
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return json({ error: "missing_file" }, 400);
  if (file.size > MAX_UPLOAD_BYTES) return json({ error: "too_large" }, 413);

  const action = ACTIONS.includes(form.get("action") as ImportAction)
    ? (form.get("action") as ImportAction)
    : "save";
  const attested = form.get("attested") === "true";
  const projectId =
    typeof form.get("projectId") === "string" ? (form.get("projectId") as string) : "";
  const sourceUrl =
    typeof form.get("sourceUrl") === "string" ? (form.get("sourceUrl") as string) : "";
  const title =
    (typeof form.get("title") === "string" && (form.get("title") as string).trim()) ||
    "YouTube capture";

  // Recorded footage is the user's own screen recording of someone's video, so
  // reuse/save still needs a rights basis; recreate is always fine.
  let rightsBasis;
  try {
    rightsBasis = resolveRightsBasis({ action, attested, license: null });
  } catch (error) {
    if (error instanceof RightsError)
      return json({ error: "rights_required", message: error.message }, 403);
    throw error;
  }

  // Stream the recorded file to a temp dir, then reuse the shared ingest tail.
  const dir = mkdtempSync(join(tmpdir(), "vibe-rec-"));
  const ext = file.name.toLowerCase().endsWith(".mp4") ? ".mp4" : ".webm";
  const filePath = join(dir, `capture${ext}`);
  const webStream = file.stream() as unknown as NodeWebReadableStream<Uint8Array>;
  await pipeline(Readable.fromWeb(webStream), createWriteStream(filePath));

  const previewDataUri = await extractThumbnailDataUri(filePath, 0).catch(() => null);
  const download: DownloadResult = {
    filePath,
    bytes: file.size,
    metadata: {
      title,
      durationSec: 0,
      uploader: "",
      license: null,
      hasCaptions: false,
      extractor: "browser-recording",
      thumbnailUrl: null,
    },
  };

  try {
    if (projectId) {
      const owns = db
        .select({ id: projects.id })
        .from(projects)
        .where(and(eq(projects.id, projectId), eq(projects.userId, userId)))
        .get();
      if (!owns) {
        rmSync(dir, { recursive: true, force: true });
        return json({ error: "project_not_found" }, 404);
      }
      // No start/end — the recording is already the chosen window.
      const ingest = await ingestDownloadedVideo(userId, projectId, download, {
        sourceUrl,
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

    const libraryId = await saveDownloadToLibrary(userId, download, { sourceUrl, rightsBasis });
    return json({
      target: "library",
      libraryId,
      rightsBasis,
      title,
      previewDataUri,
      editorPath: "/app/references",
    });
  } catch (error) {
    return json(
      { error: "ingest_failed", message: error instanceof Error ? error.message : "unknown" },
      500,
    );
  }
}
