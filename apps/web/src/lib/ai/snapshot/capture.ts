/**
 * In-process composition snapshot capture.
 *
 * Functionally equivalent to `hyperframes snapshot --at <ts>` but runs inside
 * the web server against the warm browser pool (see ./browser-pool.ts) instead
 * of spawning the CLI + a cold Chromium per call. Writes PNG frames to
 * `<projectDir>/snapshots/` and returns their project-relative paths — the
 * same on-disk contract the existing `runSnapshot` downscale logic expects.
 *
 * The video-frame injection block is ported from packages/cli/src/commands/
 * snapshot.ts: Chrome-headless silently drops programmatic `<video>.currentTime`
 * writes during capture, so timed `<video data-start>` clips are rendered by
 * extracting the frame via FFmpeg and injecting it as an <img> overlay — the
 * same primitive the render pipeline uses, so snapshot ≈ render.
 */
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { Page } from "puppeteer-core";
import { acquireBrowser, releaseBrowser } from "./browser-pool.js";

const FFMPEG_EXTRACT_TIMEOUT_MS = 30_000;
const DEFAULT_VIEWPORT = { width: 1920, height: 1080 } as const;
const MAX_VIEWPORT_DIMENSION = 4096;

const MIME_BY_EXT: Record<string, string> = {
  html: "text/html",
  js: "text/javascript",
  css: "text/css",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
};

function mimeFor(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXT[ext] ?? "application/octet-stream";
}

function clampDim(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.min(parsed, MAX_VIEWPORT_DIMENSION);
}

/** Read the composition viewport from the root element's data-width/height. */
function resolveViewport(html: string): { width: number; height: number } {
  const w = clampDim(html.match(/data-width="(\d+)"/)?.[1]);
  const h = clampDim(html.match(/data-height="(\d+)"/)?.[1]);
  return { width: w ?? DEFAULT_VIEWPORT.width, height: h ?? DEFAULT_VIEWPORT.height };
}

interface StaticServer {
  url: string;
  close: () => Promise<void>;
}

/** Serve the bundled HTML at `/` and the project's files (assets, etc.) by path. */
async function serveProject(projectDir: string, html: string): Promise<StaticServer> {
  const server = createServer((req, res) => {
    const url = req.url ?? "/";
    if (url === "/" || url === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html);
      return;
    }
    const filePath = resolve(projectDir, decodeURIComponent(url).replace(/^\//, ""));
    const rel = relative(projectDir, filePath);
    if (rel.startsWith("..") || isAbsolute(rel)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (existsSync(filePath)) {
      res.writeHead(200, { "Content-Type": mimeFor(filePath) });
      res.end(readFileSync(filePath));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const port = await new Promise<number>((resolvePort, rejectPort) => {
    server.on("error", rejectPort);
    server.listen(0, () => {
      const addr = server.address();
      const resolved = typeof addr === "object" && addr ? addr.port : 0;
      if (!resolved) rejectPort(new Error("Failed to bind snapshot HTTP server"));
      else resolvePort(resolved);
    });
  });

  return {
    url: `http://127.0.0.1:${port}/`,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

/** Extract a single frame from a video via FFmpeg (fast keyframe seek). */
async function extractVideoFrameToBuffer(
  videoPath: string,
  timeSeconds: number,
  useVp9AlphaDecoder = false,
): Promise<Buffer | null> {
  const tmp = mkdtempSync(join(tmpdir(), "hf-snapshot-frame-"));
  const outPath = join(tmp, "frame.png");
  try {
    const result = await new Promise<{ code: number | null; timedOut: boolean }>((resolveP) => {
      const args = ["-hide_banner", "-loglevel", "error"];
      if (useVp9AlphaDecoder) args.push("-c:v", "libvpx-vp9");
      args.push(
        "-ss",
        String(Math.max(0, timeSeconds)),
        "-i",
        videoPath,
        "-frames:v",
        "1",
        "-q:v",
        "2",
        "-y",
        outPath,
      );
      const ff = spawn("ffmpeg", args);
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        ff.kill("SIGTERM");
      }, FFMPEG_EXTRACT_TIMEOUT_MS);
      ff.on("close", (code) => {
        clearTimeout(timer);
        resolveP({ code, timedOut });
      });
      ff.on("error", () => {
        clearTimeout(timer);
        resolveP({ code: null, timedOut });
      });
    });
    if (result.code !== 0 || result.timedOut || !existsSync(outPath)) return null;
    return readFileSync(outPath);
  } finally {
    try {
      rmSync(tmp, { recursive: true, force: true });
    } catch {
      /* best-effort */
    }
  }
}

type InjectFn = (
  page: unknown,
  updates: Array<{ videoId: string; dataUri: string }>,
) => Promise<void>;
type SyncVisibilityFn = (page: unknown, activeVideoIds: string[]) => Promise<void>;
type ExtractMetaFn = (filePath: string) => Promise<{ videoCodec: string; hasAlpha: boolean }>;

export interface CaptureOptions {
  /** Explicit timestamps in seconds. */
  at: number[];
  /** Ms to wait for the runtime to initialize (default 5000). */
  timeout?: number;
}

/**
 * Capture frames at the given timestamps using the warm browser.
 * Returns project-relative paths (e.g. "snapshots/frame-00-at-0.5s.png").
 */
export async function captureFrames(projectDir: string, opts: CaptureOptions): Promise<string[]> {
  const { bundleToSingleHtml } = await import("@hyperframes/core/compiler");
  const html = await bundleToSingleHtml(projectDir);
  const server = await serveProject(projectDir, html);

  // Best-effort engine import for timed-<video> frame injection.
  let injectVideoFramesBatch: InjectFn | null = null;
  let syncVideoFrameVisibility: SyncVisibilityFn | null = null;
  let extractMediaMetadata: ExtractMetaFn | null = null;
  try {
    const engine = (await import("@hyperframes/engine")) as unknown as {
      injectVideoFramesBatch: InjectFn;
      syncVideoFrameVisibility: SyncVisibilityFn;
      extractMediaMetadata: ExtractMetaFn;
    };
    injectVideoFramesBatch = engine.injectVideoFramesBatch;
    syncVideoFrameVisibility = engine.syncVideoFrameVisibility;
    extractMediaMetadata = engine.extractMediaMetadata;
  } catch {
    // Engine unavailable — compositions without timed <video> are unaffected.
  }

  let leased = false;
  let page: Page | null = null;
  try {
    const browser = await acquireBrowser();
    leased = true;
    page = await browser.newPage();
    await page.setViewport(resolveViewport(html));
    await page.goto(server.url, { waitUntil: "domcontentloaded", timeout: 10_000 });

    const timeoutMs = opts.timeout ?? 5000;
    await page
      .waitForFunction(() => !!(window as any).__timelines || !!(window as any).__playerReady, {
        timeout: timeoutMs,
      })
      .catch(() => {});
    await page
      .waitForFunction(
        () => {
          const tls = (window as any).__timelines;
          if (!tls) return false;
          const keys = Object.keys(tls);
          return keys.length >= 2 || keys.some((k) => k !== "main");
        },
        { timeout: timeoutMs },
      )
      .catch(() => {});
    // Settle media, fonts, and animations.
    await new Promise((r) => setTimeout(r, 1500));

    const duration = await page.evaluate(() => {
      const win = window as any;
      const pd = win.__player?.duration;
      if (pd != null) return typeof pd === "function" ? pd() : pd;
      const root = document.querySelector("[data-composition-id][data-duration]");
      if (root) return parseFloat(root.getAttribute("data-duration") ?? "0");
      const tls = win.__timelines;
      if (tls) {
        for (const key in tls) {
          const d = tls[key]?.duration;
          if (d != null) return typeof d === "function" ? d() : d;
        }
      }
      return 0;
    });

    const positions = opts.at;
    const snapshotDir = join(projectDir, "snapshots");
    rmSync(snapshotDir, { recursive: true, force: true });
    mkdirSync(snapshotDir, { recursive: true });

    const alphaCache = new Map<string, Promise<boolean>>();
    const shouldUseVp9Alpha = (filePath: string): Promise<boolean> => {
      if (!extractMediaMetadata) return Promise.resolve(false);
      const cached = alphaCache.get(filePath);
      if (cached) return cached;
      const pending = extractMediaMetadata(filePath)
        .then((m) => m.hasAlpha && m.videoCodec === "vp9")
        .catch(() => false);
      alphaCache.set(filePath, pending);
      return pending;
    };

    const savedPaths: string[] = [];
    for (let i = 0; i < positions.length; i++) {
      const time = positions[i]!;

      await page.evaluate((t: number) => {
        const win = window as any;
        if (win.__player?.seek) {
          win.__player.seek(t);
        } else {
          const tls = win.__timelines;
          if (tls) {
            for (const key in tls) {
              if (tls[key]?.seek) {
                tls[key].pause();
                tls[key].seek(t);
              }
            }
          }
        }
      }, time);

      await page.evaluate(
        () =>
          new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
      );
      await new Promise((r) => setTimeout(r, 200));

      // Inject real frames over any active timed <video>.
      if (injectVideoFramesBatch && syncVideoFrameVisibility) {
        const active = await page.evaluate((t: number) => {
          return Array.from(document.querySelectorAll("video[data-start]"))
            .map((el) => {
              const v = el as HTMLVideoElement;
              const start = parseFloat(v.dataset.start ?? "0") || 0;
              const rawRate = v.defaultPlaybackRate;
              const playbackRate =
                Number.isFinite(rawRate) && rawRate > 0 ? Math.max(0.1, Math.min(5, rawRate)) : 1;
              const mediaStart =
                parseFloat(v.dataset.playbackStart ?? v.dataset.mediaStart ?? "0") || 0;
              const rawDuration = parseFloat(v.dataset.duration ?? "");
              const srcDur = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 0;
              const duration =
                Number.isFinite(rawDuration) && rawDuration > 0
                  ? rawDuration
                  : srcDur > 0
                    ? Math.max(0, (srcDur - mediaStart) / playbackRate)
                    : Number.POSITIVE_INFINITY;
              let relTime = (t - start) * playbackRate + mediaStart;
              if (v.loop && srcDur > mediaStart && relTime >= srcDur) {
                relTime = mediaStart + ((relTime - mediaStart) % (srcDur - mediaStart));
              }
              const activeNow = t >= start && t < start + duration && relTime >= 0 && !!v.id;
              return { id: v.id, src: v.currentSrc || v.src, relTime, active: activeNow };
            })
            .filter((entry) => entry.active && entry.src);
        }, time);

        const updates: Array<{ videoId: string; dataUri: string }> = [];
        for (const v of active) {
          let filePath: string | null = null;
          try {
            const url = new URL(v.src);
            const decodedPath = decodeURIComponent(url.pathname).replace(/^\//, "");
            const candidate = resolve(projectDir, decodedPath);
            const rel = relative(projectDir, candidate);
            if (!rel.startsWith("..") && !isAbsolute(rel) && existsSync(candidate)) {
              filePath = candidate;
            }
          } catch {
            /* unresolvable src — skip */
          }
          if (!filePath) continue;
          const png = await extractVideoFrameToBuffer(
            filePath,
            Math.max(0, v.relTime),
            await shouldUseVp9Alpha(filePath),
          );
          if (!png) continue;
          updates.push({
            videoId: v.id,
            dataUri: `data:image/png;base64,${png.toString("base64")}`,
          });
        }

        try {
          if (updates.length > 0) await injectVideoFramesBatch(page, updates);
          await syncVideoFrameVisibility(
            page,
            active.map((a) => a.id),
          );
        } catch {
          // Fall through to a plain screenshot — no worse than no injection.
        }
      }

      const timeLabel = `${time.toFixed(1)}s`;
      const filename = `frame-${String(i).padStart(2, "0")}-at-${timeLabel}.png`;
      await page.screenshot({ path: join(snapshotDir, filename), type: "png" });
      savedPaths.push(`snapshots/${filename}`);
    }

    void duration; // kept for parity with CLI; explicit `at` always drives positions
    return savedPaths;
  } finally {
    if (page) await page.close().catch(() => {});
    if (leased) releaseBrowser();
    await server.close();
  }
}

/** True when a snapshots/ dir holds at least one PNG. */
export function snapshotsExist(projectDir: string): boolean {
  const dir = join(projectDir, "snapshots");
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((f) => f.toLowerCase().endsWith(".png"));
}
