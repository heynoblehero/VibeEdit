/**
 * Small standalone frame grabber for import previews + library thumbnails.
 * capture.ts has a similar helper but it's private and geared to the snapshot
 * engine; this one just needs "grab one JPEG frame from a video file at time T".
 */

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const TIMEOUT_MS = 15_000;

function runFfmpeg(args: string[]): Promise<boolean> {
  return new Promise((resolvePromise) => {
    const proc = spawn(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args]);
    const timer = setTimeout(() => proc.kill("SIGTERM"), TIMEOUT_MS);
    proc.on("error", () => {
      clearTimeout(timer);
      resolvePromise(false);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      resolvePromise(code === 0);
    });
  });
}

/** Write a single JPEG frame from `videoPath` at `atSeconds` to `outPath`. */
export async function extractThumbnail(
  videoPath: string,
  outPath: string,
  atSeconds = 0,
): Promise<boolean> {
  return runFfmpeg([
    "-ss",
    String(Math.max(0, atSeconds)),
    "-i",
    videoPath,
    "-frames:v",
    "1",
    "-vf",
    "scale=480:-2",
    "-q:v",
    "4",
    outPath,
  ]);
}

/** Grab a frame and return it as a `data:image/jpeg;base64,...` URI (or null). */
export async function extractThumbnailDataUri(
  videoPath: string,
  atSeconds = 0,
): Promise<string | null> {
  const dir = mkdtempSync(join(tmpdir(), "vibe-thumb-"));
  const out = join(dir, "thumb.jpg");
  try {
    const ok = await extractThumbnail(videoPath, out, atSeconds);
    if (!ok) return null;
    return `data:image/jpeg;base64,${readFileSync(out).toString("base64")}`;
  } catch {
    return null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
