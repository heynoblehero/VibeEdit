import {
  mkdirSync,
  cpSync,
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  statSync,
  unlinkSync,
} from "node:fs";
import { resolve, join, dirname, relative, sep } from "node:path";

const STORAGE_ROOT = process.env.STORAGE_ROOT || resolve(process.cwd(), "storage");

export function projectDir(userId: string, projectId: string): string {
  return resolve(STORAGE_ROOT, "projects", userId, projectId);
}

export function renderOutputPath(jobId: string): string {
  return resolve(STORAGE_ROOT, "renders", jobId);
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
