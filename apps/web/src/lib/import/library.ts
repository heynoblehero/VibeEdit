/**
 * Personal reference library — server-side operations.
 *
 * A "reference" is a saved clip (or effect) a user keeps for later, independent
 * of any single project. The media file lives under referenceDir(userId); the
 * `references` table row is the index + provenance. Clips can be pushed back
 * into any project's assets/ via addReferenceToProject.
 */

import { copyFileSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { and, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import { references, type Reference } from "@/lib/db/schema";
import { projectDir, referenceDir, listAssets } from "@/lib/storage/fs";
import { projectFileWriteTarget } from "@/lib/storage/fs";
import { ensureManifest } from "@/lib/storage/manifests";
import { checkUploadAllowed } from "@/lib/storage/quota";
import { userStorageBytes } from "@/lib/storage/fs";
import { trimClip } from "@/lib/ai/ffmpeg-tools";
import type { RightsBasis } from "./rights";
import type { DownloadResult } from "./fetch-video";
import { extractThumbnail } from "./thumbnail";

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "clip"
  );
}

interface StoreMeta {
  title: string;
  uploader?: string;
  sourceUrl?: string;
  durationSeconds?: number;
  rightsBasis: RightsBasis;
}

// Copy an on-disk video file into the library, generate a thumbnail, index it.
// Enforces the storage quota (library counts toward the user's footprint).
async function storeFileAsReference(
  userId: string,
  srcAbs: string,
  meta: StoreMeta,
): Promise<string> {
  if (!existsSync(srcAbs)) throw new Error("source file missing");
  const bytes = statSync(srcAbs).size;
  const quota = checkUploadAllowed(userId, bytes, userStorageBytes(userId));
  if (!quota.ok) throw new Error(quota.message ?? "Storage quota exceeded.");

  const dir = referenceDir(userId);
  mkdirSync(dir, { recursive: true });
  const id = nanoid(12);
  const ext = extname(srcAbs) || ".mp4";
  const clipFile = `${slug(meta.title)}-${id}${ext}`;
  const thumbFile = `${slug(meta.title)}-${id}.jpg`;
  copyFileSync(srcAbs, join(dir, clipFile));
  const thumbOk = await extractThumbnail(srcAbs, join(dir, thumbFile), 0).catch(() => false);

  db.insert(references)
    .values({
      id,
      userId,
      kind: "clip",
      sourceUrl: meta.sourceUrl ?? null,
      title: meta.title || "Untitled",
      uploader: meta.uploader ?? null,
      thumbFile: thumbOk ? thumbFile : null,
      clipFile,
      durationSeconds: meta.durationSeconds ?? null,
      rightsBasis: meta.rightsBasis,
      notes: null,
      createdAt: new Date(),
    })
    .run();
  return id;
}

export interface SaveClipInput {
  projectId: string;
  assetPath: string; // project-relative, e.g. "assets/foo.mp4"
  sourceUrl?: string;
  title: string;
  uploader?: string;
  durationSeconds?: number;
  rightsBasis: RightsBasis;
}

/**
 * Copy an existing project asset into the user's reference library. Returns the
 * new reference id.
 */
export async function saveClipToLibrary(userId: string, input: SaveClipInput): Promise<string> {
  const srcAbs = join(projectDir(userId, input.projectId), input.assetPath);
  return storeFileAsReference(userId, srcAbs, {
    title: input.title,
    uploader: input.uploader,
    sourceUrl: input.sourceUrl,
    durationSeconds: input.durationSeconds,
    rightsBasis: input.rightsBasis,
  });
}

/**
 * Save a freshly downloaded video (from fetch-video) straight into the library —
 * used by the extension capture path when no target project is given. Trims to
 * the selected window first if requested, then cleans up the temp download.
 */
export async function saveDownloadToLibrary(
  userId: string,
  download: DownloadResult,
  opts: { sourceUrl: string; startSeconds?: number; endSeconds?: number; rightsBasis: RightsBasis },
): Promise<string> {
  const tempDir = dirname(download.filePath);
  try {
    let srcAbs = download.filePath;
    const wantsTrim =
      typeof opts.startSeconds === "number" &&
      (opts.startSeconds > 0 || typeof opts.endSeconds === "number");
    if (wantsTrim) {
      const trimmed = join(tempDir, `trimmed${extname(download.filePath) || ".mp4"}`);
      const trim = await trimClip({
        inputPath: download.filePath,
        outputPath: trimmed,
        startSeconds: Math.max(0, opts.startSeconds ?? 0),
        endSeconds: opts.endSeconds,
      });
      if (!trim.ok || !existsSync(trimmed)) {
        throw new Error(`Couldn't trim the clip: ${trim.error ?? "unknown error"}`);
      }
      srcAbs = trimmed;
    }
    return await storeFileAsReference(userId, srcAbs, {
      title: download.metadata.title,
      uploader: download.metadata.uploader,
      sourceUrl: opts.sourceUrl,
      durationSeconds: download.metadata.durationSec,
      rightsBasis: opts.rightsBasis,
    });
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

export function listLibrary(userId: string): Reference[] {
  return db
    .select()
    .from(references)
    .where(eq(references.userId, userId))
    .orderBy(desc(references.createdAt))
    .all();
}

export function getReference(userId: string, id: string): Reference | undefined {
  return db
    .select()
    .from(references)
    .where(and(eq(references.id, id), eq(references.userId, userId)))
    .get();
}

export function deleteReference(userId: string, id: string): boolean {
  const row = getReference(userId, id);
  if (!row) return false;
  const dir = referenceDir(userId);
  for (const file of [row.clipFile, row.thumbFile]) {
    if (file) rmSync(join(dir, file), { force: true });
  }
  db.delete(references)
    .where(and(eq(references.id, id), eq(references.userId, userId)))
    .run();
  return true;
}

/**
 * Copy a library clip into a project's assets/ so it can be edited/rendered.
 * Enforces the storage quota. Returns the new project-relative asset path.
 */
export async function addReferenceToProject(
  userId: string,
  id: string,
  projectId: string,
): Promise<string> {
  const row = getReference(userId, id);
  if (!row || !row.clipFile) throw new Error("reference not found");
  const srcAbs = join(referenceDir(userId), row.clipFile);
  if (!existsSync(srcAbs)) throw new Error("reference file missing");

  const bytes = statSync(srcAbs).size;
  const quota = checkUploadAllowed(userId, bytes, userStorageBytes(userId));
  if (!quota.ok) throw new Error(quota.message);

  const existing = new Set(
    listAssets(userId, projectId).map((rel) => rel.replace(/^assets\//, "")),
  );
  const ext = extname(row.clipFile) || ".mp4";
  const base = slug(row.title);
  let name = `${base}${ext}`;
  let n = 2;
  while (existing.has(name)) {
    name = `${base}-${n}${ext}`;
    n += 1;
  }
  const assetPath = `assets/${name}`;
  copyFileSync(srcAbs, projectFileWriteTarget(userId, projectId, assetPath));
  await ensureManifest(userId, projectId, assetPath, {
    source: "import",
    provenance: {
      sourceUrl: row.sourceUrl ?? "",
      sourceTitle: row.title,
      uploader: row.uploader ?? undefined,
      rightsBasis: row.rightsBasis as RightsBasis,
      importedAt: new Date().toISOString(),
    },
  }).catch(() => null);

  return assetPath;
}
