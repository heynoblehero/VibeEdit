/*
 * Project card thumbnail from the LIVE composition preview.
 *
 * The render pipeline only makes a thumbnail after a full export (a frame of
 * the MP4). Most projects are built + previewed but never exported, so their
 * cards had no image. This captures a frame of the current composition — the
 * same thing the editor preview shows — using the agent's warm browser pool,
 * so every project card reflects the latest work without needing a render.
 */

import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { captureFrames } from "@/lib/ai/snapshot/capture";
import { projectDir, projectThumbPath } from "@/lib/storage/fs";

// One capture per project at a time — captureFrames drives a shared browser and
// wipes the snapshots dir, so overlapping runs would fight each other.
const inFlight = new Set<string>();

/**
 * Grab a frame (~1s in) of the project's current composition and write it as
 * the card thumbnail (640px JPEG). Returns true when a thumbnail was written.
 * Best-effort: never throws — callers fire-and-forget.
 */
export async function captureProjectThumb(userId: string, projectId: string): Promise<boolean> {
  const key = `${userId}/${projectId}`;
  if (inFlight.has(key)) return false;
  inFlight.add(key);
  try {
    const dir = projectDir(userId, projectId);
    // Nothing to shoot until the composition exists.
    if (!existsSync(join(dir, "index.html"))) return false;

    const rels = await captureFrames(dir, { at: [1] });
    const rel = rels[0];
    if (!rel) return false;
    const framePath = resolve(dir, rel);
    if (!existsSync(framePath)) return false;

    const thumbPath = projectThumbPath(userId, projectId);
    mkdirSync(resolve(thumbPath, ".."), { recursive: true });
    const sharp = (await import("sharp")).default;
    await sharp(framePath)
      .resize({ width: 640, withoutEnlargement: true })
      .jpeg({ quality: 72 })
      .toFile(thumbPath);
    return true;
  } catch (error) {
    console.error("[thumb] preview capture failed", error);
    return false;
  } finally {
    inFlight.delete(key);
  }
}
