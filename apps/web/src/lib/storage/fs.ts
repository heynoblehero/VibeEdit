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
