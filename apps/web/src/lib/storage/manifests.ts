/**
 * Per-asset JSON manifest layer — the "video → text" bridge that makes
 * "edit by talking" work. Every asset gets a sidecar at
 * `assets/.manifests/<basename>.json` (dot-prefixed dir → hidden from
 * listFiles). Two layers:
 *   - facts:         cheap, captured on upload (ffprobe + stat). Always present.
 *   - understanding: expensive, AI-generated once and cached. Re-run only when
 *                    the file's contentHash changes.
 * The `name` is the chat handle the user (and AI) points at — it replaces
 * selecting a clip with a mouse. See docs/vibe-edit-asset-model.md.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { projectDir, writeProjectFile, listAssets } from "./fs";
import { probeClip } from "../ai/ffmpeg-tools";
import type { TranscriptWord } from "../ai/ffmpeg-tools";

export type AssetKind = "video" | "image" | "audio" | "other";

export interface ManifestFacts {
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  hasAlpha: boolean;
  bytes: number;
}

export interface ManifestCut {
  start: number;
  end: number;
  label: string;
}

export interface ManifestUnderstanding {
  summary?: string;
  analyzedAt?: string;
  // video / audio-with-speech
  transcript?: TranscriptWord[];
  transcriptText?: string;
  cuts?: ManifestCut[];
  keepSegments?: Array<{ start: number; end: number }>;
  pacing?: string;
  keyMoments?: Array<{ t: number; note: string }>;
  // image
  caption?: string;
  tags?: string[];
  dominantColors?: string[];
  suggestedUse?: string;
  // audio
  audioType?: "music" | "sfx" | "speech";
  mood?: string;
  bpm?: number;
}

export interface AssetUsage {
  projectId: string;
  edit: string;
  at: string;
}

// Where an imported asset came from + the legal basis under which the user may
// use it. Present only when `source === "import"`. `rightsBasis` gates whether
// the actual footage may be re-hosted in a render (see lib/import/rights.ts).
export interface AssetProvenance {
  sourceUrl: string;
  sourceTitle?: string;
  uploader?: string;
  rightsBasis: "reference-only" | "owner-attested" | "cc";
  importedAt: string;
}

export interface AssetManifest {
  version: 1;
  path: string; // canonical project-relative path, e.g. "assets/beach-intro.mp4"
  name: string; // chat handle (user-given or AI-suggested)
  aliases: string[]; // AI-maintained fuzzy handles
  source: "upload" | "ai" | "import";
  kind: AssetKind;
  addedAt: string;
  contentHash: string; // invalidates `understanding` when the file changes
  facts: ManifestFacts;
  understanding?: ManifestUnderstanding;
  usage?: AssetUsage[];
  provenance?: AssetProvenance; // set for source === "import"
}

const MANIFEST_DIR = "assets/.manifests";
const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"]);
const VIDEO_EXT = new Set(["mp4", "webm", "mov", "mkv", "avi", "m4v"]);
const AUDIO_EXT = new Set(["mp3", "wav", "ogg", "m4a", "aac", "flac"]);

export function assetKind(relPath: string): AssetKind {
  const ext = relPath.split(".").pop()?.toLowerCase() || "";
  if (VIDEO_EXT.has(ext)) return "video";
  if (IMAGE_EXT.has(ext)) return "image";
  if (AUDIO_EXT.has(ext)) return "audio";
  return "other";
}

// Manifest path for an asset: assets/.manifests/<basename>.json
export function manifestRelPath(assetRelPath: string): string {
  return `${MANIFEST_DIR}/${basename(assetRelPath)}.json`;
}

// Turn "assets/My Clip 01.mp4" → "my-clip-01" (a clean, speakable chat handle).
export function suggestName(assetRelPath: string): string {
  const stem = basename(assetRelPath).replace(/\.[^.]+$/, "");
  const slug = stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "asset";
}

function abs(userId: string, projectId: string, relPath: string): string {
  return join(projectDir(userId, projectId), relPath);
}

function hashFile(absPath: string): string {
  return "sha256:" + createHash("sha256").update(readFileSync(absPath)).digest("hex").slice(0, 32);
}

export function readManifest(
  userId: string,
  projectId: string,
  assetRelPath: string,
): AssetManifest | null {
  const file = abs(userId, projectId, manifestRelPath(assetRelPath));
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as AssetManifest;
  } catch {
    return null;
  }
}

export function writeManifest(userId: string, projectId: string, manifest: AssetManifest): void {
  writeProjectFile(
    userId,
    projectId,
    manifestRelPath(manifest.path),
    JSON.stringify(manifest, null, 2),
  );
}

// Cheap, always-available facts. probeClip works for video/audio; for images it
// still yields width/height (duration 0). Never throws — missing facts default 0.
async function buildFacts(absPath: string, kind: AssetKind): Promise<ManifestFacts> {
  const bytes = existsSync(absPath) ? statSync(absPath).size : 0;
  const empty: ManifestFacts = {
    durationSeconds: 0,
    width: 0,
    height: 0,
    fps: 0,
    hasAudio: false,
    hasAlpha: false,
    bytes,
  };
  if (kind === "other") return empty;
  try {
    const info = await probeClip(absPath);
    return {
      durationSeconds: info.durationSeconds,
      width: info.width,
      height: info.height,
      fps: info.fps,
      hasAudio: info.hasAudio,
      hasAlpha: false,
      bytes,
    };
  } catch {
    return empty;
  }
}

/**
 * Create the manifest for an asset if it's missing, or refresh facts when the
 * file changed (contentHash mismatch → understanding is dropped so it re-runs).
 * Idempotent — safe to call on every upload and lazily before analysis.
 */
export async function ensureManifest(
  userId: string,
  projectId: string,
  assetRelPath: string,
  opts?: { source?: "upload" | "ai" | "import"; provenance?: AssetProvenance },
): Promise<AssetManifest> {
  const absPath = abs(userId, projectId, assetRelPath);
  const hash = existsSync(absPath) ? hashFile(absPath) : "";
  const existing = readManifest(userId, projectId, assetRelPath);
  if (existing && existing.contentHash === hash) return existing;

  const kind = assetKind(assetRelPath);
  const facts = await buildFacts(absPath, kind);
  const manifest: AssetManifest = {
    version: 1,
    path: assetRelPath,
    name: existing?.name ?? suggestName(assetRelPath),
    aliases: existing?.aliases ?? [],
    source: opts?.source ?? existing?.source ?? "upload",
    kind,
    addedAt: existing?.addedAt ?? new Date().toISOString(),
    contentHash: hash,
    facts,
    // Drop stale understanding when the file changed; keep it otherwise.
    understanding: existing && existing.contentHash === hash ? existing.understanding : undefined,
    usage: existing?.usage,
    // Provenance is set once at import time; never overwrite it with undefined
    // on a later refresh.
    provenance: opts?.provenance ?? existing?.provenance,
  };
  writeManifest(userId, projectId, manifest);
  return manifest;
}

// Persist AI-generated understanding (transcript/cuts/caption/…) onto a manifest,
// stamping analyzedAt. Creates the manifest first if needed.
export async function setUnderstanding(
  userId: string,
  projectId: string,
  assetRelPath: string,
  understanding: ManifestUnderstanding,
): Promise<AssetManifest> {
  const manifest = await ensureManifest(userId, projectId, assetRelPath);
  manifest.understanding = {
    ...manifest.understanding,
    ...understanding,
    analyzedAt: new Date().toISOString(),
  };
  writeManifest(userId, projectId, manifest);
  return manifest;
}

function fmtDuration(s: number): string {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m ? `${m}m${sec.toString().padStart(2, "0")}s` : `${sec}s`;
}

// One compact line per asset for the always-in-context summary.
// e.g. "beach-intro · video · 42s · phone-shot beach walk, talking to camera"
export function summaryLine(m: AssetManifest): string {
  const summary = m.understanding?.summary || m.understanding?.caption || "(not analyzed yet)";
  const dur = m.kind === "image" ? "" : ` · ${fmtDuration(m.facts.durationSeconds)}`;
  return `${m.name} · ${m.kind}${dur} · ${summary}`;
}

// Cheap (sync, no probe) one-line summary per project asset — injected into
// every chat turn so the AI always knows what exists and what to call it.
// Falls back to the raw path for assets without a manifest yet.
export function assetSummaryLines(userId: string, projectId: string): string[] {
  return listAssets(userId, projectId).map((rel) => {
    const m = readManifest(userId, projectId, rel);
    return m ? summaryLine(m) : rel;
  });
}
