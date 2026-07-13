/**
 * Shared ingest tail for imported video: takes a freshly downloaded file (from
 * fetch-video.ts), optionally trims it to a chosen [start,end] window, enforces
 * the storage quota, lands it in a project's assets/ with import provenance, and
 * cleans up the temp download. Both the in-app import route and the extension
 * capture endpoint call this so the two front doors behave identically.
 */

import { copyFileSync, existsSync, rmSync, statSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { trimClip } from "@/lib/ai/ffmpeg-tools";
import { projectFileWriteTarget, listAssets, userStorageBytes } from "@/lib/storage/fs";
import { ensureManifest } from "@/lib/storage/manifests";
import { checkUploadAllowed } from "@/lib/storage/quota";
import { ImportError, type DownloadResult } from "./fetch-video";
import type { RightsBasis } from "./rights";

function slugifyTitle(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "import";
}

// Pick an assets/<name> path that doesn't collide with an existing asset.
function uniqueAssetRel(userId: string, projectId: string, base: string, ext: string): string {
  const existing = new Set(listAssets(userId, projectId).map((rel) => basename(rel)));
  let candidate = `${base}${ext}`;
  let n = 2;
  while (existing.has(candidate)) {
    candidate = `${base}-${n}${ext}`;
    n += 1;
  }
  return `assets/${candidate}`;
}

export interface IngestOptions {
  sourceUrl: string;
  startSeconds?: number;
  endSeconds?: number;
  rightsBasis: RightsBasis;
}

export interface IngestResult {
  assetPath: string; // project-relative, e.g. "assets/cool-clip.mp4"
  bytes: number;
}

/**
 * Move a downloaded video into project storage. Always removes the temp download
 * dir before returning (even on failure).
 */
export async function ingestDownloadedVideo(
  userId: string,
  projectId: string,
  download: DownloadResult,
  opts: IngestOptions,
): Promise<IngestResult> {
  const tempDir = dirname(download.filePath);
  try {
    const ext = extname(download.filePath) || ".mp4";
    const base = slugifyTitle(download.metadata.title);

    // Optional trim to the selected window. Output stays in the temp dir; we
    // measure the trimmed size for the quota check below.
    let sourcePath = download.filePath;
    let sourceBytes = download.bytes;
    const wantsTrim =
      typeof opts.startSeconds === "number" &&
      (opts.startSeconds > 0 || typeof opts.endSeconds === "number");
    if (wantsTrim) {
      const trimmedPath = join(tempDir, `trimmed${ext}`);
      const trim = await trimClip({
        inputPath: download.filePath,
        outputPath: trimmedPath,
        startSeconds: Math.max(0, opts.startSeconds ?? 0),
        endSeconds: opts.endSeconds,
      });
      if (!trim.ok || !existsSync(trimmedPath)) {
        throw new ImportError(`Couldn't trim the clip: ${trim.error ?? "unknown error"}`, 500);
      }
      sourcePath = trimmedPath;
      sourceBytes = statSync(trimmedPath).size;
    }

    // Per-plan + total-storage quota (mirrors the upload route).
    const quota = checkUploadAllowed(userId, sourceBytes, userStorageBytes(userId));
    if (!quota.ok) throw new ImportError(quota.message ?? "Storage quota exceeded.", quota.status);

    const assetPath = uniqueAssetRel(userId, projectId, base, ext);
    const target = projectFileWriteTarget(userId, projectId, assetPath);
    copyFileSync(sourcePath, target);

    await ensureManifest(userId, projectId, assetPath, {
      source: "import",
      provenance: {
        sourceUrl: opts.sourceUrl,
        sourceTitle: download.metadata.title || undefined,
        uploader: download.metadata.uploader || undefined,
        rightsBasis: opts.rightsBasis,
        importedAt: new Date().toISOString(),
      },
    }).catch(() => null);

    return { assetPath, bytes: sourceBytes };
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}
