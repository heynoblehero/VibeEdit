import {
  mkdirSync,
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  statSync,
  unlinkSync,
  rmSync,
} from "node:fs";
import { resolve, join, dirname, relative, sep } from "node:path";

export const STORAGE_ROOT = process.env.STORAGE_ROOT || resolve(process.cwd(), "storage");

// Per-user brand-kit asset store (logo / watermark / voice sample uploads).
export function brandKitDir(userId: string): string {
  return resolve(STORAGE_ROOT, "brand-kits", userId);
}

// Hard-delete every on-disk artifact owned by a user: their whole project tree,
// personas, brand-kit uploads, thumbnails, and each render's output directory.
// Used by the admin account-removal flow. renderJobIds are passed in because
// render outputs are keyed by job id (renders/<jobId>), not by userId.
export function deleteUserStorage(userId: string, renderJobIds: string[]): void {
  const rm = (p: string) => {
    try {
      rmSync(p, { recursive: true, force: true });
    } catch {
      // Best-effort: a missing or already-removed path must not abort the rest.
    }
  };
  rm(resolve(STORAGE_ROOT, "projects", userId));
  rm(personaDir(userId));
  rm(brandKitDir(userId));
  rm(resolve(STORAGE_ROOT, "thumbs", userId));
  for (const jobId of renderJobIds) rm(renderOutputPath(jobId));
}

export function projectDir(userId: string, projectId: string): string {
  return resolve(STORAGE_ROOT, "projects", userId, projectId);
}

// Root of every project this user owns — the bulk of their storage footprint
// (uploaded + generated + processed assets, compositions, renders-in-project).
export function userProjectsRoot(userId: string): string {
  return resolve(STORAGE_ROOT, "projects", userId);
}

// Total bytes on disk under a directory (recursive). Best-effort: unreadable
// entries are skipped rather than throwing, so a transient permission/race on
// one file never fails a whole usage calculation.
export function directoryBytes(dir: string): number {
  let total = 0;
  const stack: string[] = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;
    let entries: string[] = [];
    try {
      entries = readdirSync(current);
    } catch {
      continue;
    }
    for (const name of entries) {
      const full = join(current, name);
      try {
        const st = statSync(full);
        if (st.isDirectory()) stack.push(full);
        else if (st.isFile()) total += st.size;
      } catch {
        // ignore a single unreadable/removed entry
      }
    }
  }
  return total;
}

// A user's total storage footprint in bytes: their whole projects tree plus
// personas and brand-kit uploads (thumbs/renders are transient/derived).
export function userStorageBytes(userId: string): number {
  return (
    directoryBytes(userProjectsRoot(userId)) +
    directoryBytes(personaDir(userId)) +
    directoryBytes(brandKitDir(userId))
  );
}

export function renderOutputPath(jobId: string): string {
  return resolve(STORAGE_ROOT, "renders", jobId);
}

// Per-user persona store — a creator's locked character(s) live here and are
// reused across every project (the consistency that makes a persona a brand).
// Holds persona.json + base.png + poses/<label>.png.
export function personaDir(userId: string): string {
  return resolve(STORAGE_ROOT, "personas", userId);
}

// One JPEG per project — always overwritten by the latest successful render.
// Stored outside the project file tree so it doesn't show up in listFiles().
export function projectThumbPath(userId: string, projectId: string): string {
  return resolve(STORAGE_ROOT, "thumbs", userId, `${projectId}.jpg`);
}

export function ensureProjectDir(userId: string, projectId: string): string {
  const dir = projectDir(userId, projectId);
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(dir, "assets"), { recursive: true });
  mkdirSync(join(dir, "compositions"), { recursive: true });
  return dir;
}

export function seedFromIsaacHook(userId: string, projectId: string): void {
  const dir = ensureProjectDir(userId, projectId);
  const source = resolve(process.cwd(), "..", "..", "isaac-hook");
  if (existsSync(source)) {
    cpSync(source, dir, {
      recursive: true,
      filter: (src) => !src.includes("node_modules") && !src.includes(".next"),
    });
  }
  // Always make sure base dirs exist after copy
  mkdirSync(join(dir, "assets"), { recursive: true });
  mkdirSync(join(dir, "compositions"), { recursive: true });
}

export function listFiles(userId: string, projectId: string): string[] {
  const dir = projectDir(userId, projectId);
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  const walk = (cur: string) => {
    for (const entry of readdirSync(cur, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const full = join(cur, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        results.push(relative(dir, full).split(sep).join("/"));
      }
    }
  };
  walk(dir);
  return results.sort();
}

function safeJoin(base: string, rel: string): string {
  const target = resolve(base, rel);
  const baseResolved = resolve(base);
  if (!target.startsWith(baseResolved + sep) && target !== baseResolved) {
    throw new Error(`path escapes project: ${rel}`);
  }
  return target;
}

export function readProjectFile(
  userId: string,
  projectId: string,
  relPath: string,
): { content: Buffer; mime: string } {
  const dir = projectDir(userId, projectId);
  const full = safeJoin(dir, relPath);
  if (!existsSync(full)) throw new Error(`not found: ${relPath}`);
  if (statSync(full).isDirectory()) throw new Error(`is a directory: ${relPath}`);
  return { content: readFileSync(full), mime: detectMime(relPath) };
}

export function readProjectText(userId: string, projectId: string, relPath: string): string {
  return readProjectFile(userId, projectId, relPath).content.toString("utf8");
}

export function writeProjectFile(
  userId: string,
  projectId: string,
  relPath: string,
  content: string | Buffer,
): void {
  const dir = projectDir(userId, projectId);
  const full = safeJoin(dir, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

/**
 * Resolve the sandboxed absolute path for a project asset and ensure its parent
 * directory exists — for callers that want to STREAM content to disk (large
 * uploads) instead of buffering a whole Buffer via writeProjectFile. Applies the
 * same `safeJoin` traversal guard, so the returned path is always inside the
 * project dir.
 */
export function projectFileWriteTarget(userId: string, projectId: string, relPath: string): string {
  const dir = projectDir(userId, projectId);
  const full = safeJoin(dir, relPath);
  mkdirSync(dirname(full), { recursive: true });
  return full;
}

export function deleteProjectFile(userId: string, projectId: string, relPath: string): void {
  const dir = projectDir(userId, projectId);
  const full = safeJoin(dir, relPath);
  if (existsSync(full)) unlinkSync(full);
}

export function listAssets(userId: string, projectId: string): string[] {
  return listFiles(userId, projectId).filter((p) => p.startsWith("assets/"));
}

export type AssetSource = "upload" | "ai";

// Per-project provenance manifest. Lives at the project root (not under assets/,
// so it never shows up as an asset itself) and is copied by branch/duplicate
// since those cpSync the whole project dir. Only AI-created assets are recorded;
// anything absent defaults to "upload".
const ASSET_META_FILE = ".assetmeta.json";

export function readAssetMeta(userId: string, projectId: string): Record<string, AssetSource> {
  const full = join(projectDir(userId, projectId), ASSET_META_FILE);
  if (!existsSync(full)) return {};
  try {
    const parsed = JSON.parse(readFileSync(full, "utf8"));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, AssetSource>) : {};
  } catch {
    return {};
  }
}

export function markAiAssets(userId: string, projectId: string, paths: string[]): void {
  if (paths.length === 0) return;
  const meta = readAssetMeta(userId, projectId);
  let changed = false;
  for (const path of paths) {
    if (meta[path] !== "ai") {
      meta[path] = "ai";
      changed = true;
    }
  }
  if (!changed) return;
  const full = join(projectDir(userId, projectId), ASSET_META_FILE);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, JSON.stringify(meta, null, 2));
}

// Source of a single asset: recorded "ai", else AI-only output dirs, else upload.
export function assetSource(meta: Record<string, AssetSource>, path: string): AssetSource {
  if (meta[path]) return meta[path];
  if (path.startsWith("assets/processed/") || path.startsWith("assets/variants/")) return "ai";
  return "upload";
}

const MIMES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  json: "application/json",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  txt: "text/plain; charset=utf-8",
};

function detectMime(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  return MIMES[ext] || "application/octet-stream";
}

// ---------------------------------------------------------------------------
// Safe serving of project files over the public file API.
//
// The file API serves two very different kinds of file from the same tree:
//
//   1. Composition source the app/agent authored (index.html, compositions/*,
//      and the css/js/json the player needs). These are first-party and must be
//      served inline with their real content-type so the player runs.
//
//   2. Raw assets under `assets/` — these may be USER-UPLOADED. Even though the
//      upload route now allow-lists media types, the serve side defends in depth:
//      an uploaded asset must NEVER be served as active content. We map its
//      content-type from a safe media allowlist (so e.g. a file that slipped
//      through can't be served as text/html or image/svg+xml with scripting),
//      and we attach `Content-Disposition: attachment` + a sandbox CSP for
//      anything that isn't inert playable media.
// ---------------------------------------------------------------------------

// Inert media types that are safe to serve inline (browsers won't execute these
// as a document with active scripting). Used for assets/ files. SVG is
// deliberately absent — SVG can carry inline <script>, so it is never served
// inline for user content.
const SAFE_SERVE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  ogg: "audio/ogg",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
};

export interface ServePlan {
  /** Content-Type header to send. */
  contentType: string;
  /**
   * When true, send `Content-Disposition: attachment` so the browser downloads
   * rather than renders the bytes, plus `Content-Security-Policy: sandbox`. Set
   * for any asset whose type is not a known-inert inline media type.
   */
  attachment: boolean;
}

/**
 * Decide how a project file at `relPath` should be served. The route uses this
 * to set Content-Type / Content-Disposition / CSP safely.
 *
 * - Composition source (index.html and other non-`assets/` files): served inline
 *   with its detected content-type (unchanged behaviour — first-party content).
 * - Files under `assets/`: content-type forced from the inert-media allowlist;
 *   recognised inline media served inline, everything else served as a sandboxed
 *   attachment with `application/octet-stream`.
 */
export function serveContentType(relPath: string): ServePlan {
  const isAsset = relPath === "assets" || relPath.startsWith("assets/");
  if (!isAsset) {
    // First-party composition source — keep existing inline behaviour.
    return { contentType: detectMime(relPath), attachment: false };
  }
  const ext = relPath.split(".").pop()?.toLowerCase() || "";
  const safe = SAFE_SERVE_MIME[ext];
  if (safe) {
    // Inert, playable media — safe to serve inline so playback/preview works.
    return { contentType: safe, attachment: false };
  }
  // Unknown / potentially-active type (html, svg, js, …): never serve inline.
  return { contentType: "application/octet-stream", attachment: true };
}
