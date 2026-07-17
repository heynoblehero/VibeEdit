/*
 * Project card thumbnail from the LIVE composition preview.
 *
 * The render pipeline only makes a thumbnail after a full export (a frame of
 * the MP4). Most projects are built + previewed but never exported, so their
 * cards had no image. This captures a frame of the current composition — the
 * same thing the editor preview shows — so every card reflects the latest work
 * without needing a render.
 *
 * IMPORTANT: capture lives in `snapshot/capture.ts`, which pulls
 * @hyperframes/core + @hyperframes/engine whose package exports point at TS
 * SOURCE — webpack can't bundle it and `next start` can't require it. So, like
 * the agent's `runSnapshot`, we must NOT import capture.ts here; we spawn `bun`
 * on the same thin wrapper script (scripts/capture-frames.ts) that owns the
 * heavy import and prints project-relative frame paths as JSON.
 */

import { existsSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { projectDir, projectThumbPath } from "@/lib/storage/fs";

// One capture per project at a time — the wrapper wipes the snapshots dir and
// drives a shared browser, so overlapping runs would fight each other.
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

    const { spawn } = await import("node:child_process");
    const capture = await new Promise<{ code: number; out: string; err: string }>((resolveP) => {
      // cwd is /app/apps/web at runtime (Dockerfile CMD), so scripts/ resolves
      // relative to it and `bun` comes from PATH.
      const child = spawn("bun", ["scripts/capture-frames.ts", dir, JSON.stringify([1])], {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      });
      let out = "";
      let err = "";
      const timer = setTimeout(() => child.kill("SIGTERM"), 60_000);
      child.stdout?.on("data", (chunk: Buffer) => {
        out += chunk.toString();
        if (out.length > 200_000) out = out.slice(-200_000);
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        err += chunk.toString();
        if (err.length > 4000) err = err.slice(-4000);
      });
      child.on("error", () => {
        clearTimeout(timer);
        resolveP({ code: 1, out, err: err || "bun spawn failed" });
      });
      child.on("exit", (code) => {
        clearTimeout(timer);
        resolveP({ code: code ?? 1, out, err });
      });
    });

    if (capture.code !== 0) {
      console.error("[thumb] capture failed:", capture.err.slice(-400));
      return false;
    }
    const paths = JSON.parse(capture.out.trim() || "[]") as string[];
    const rel = paths[0];
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
