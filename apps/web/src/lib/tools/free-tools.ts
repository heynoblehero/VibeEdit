/*
 * Shared server helpers for the public "free tools" funnel (no auth required).
 *
 * These tools are a top-of-funnel marketing surface: anonymous users get a small
 * daily quota (by IP), signed-in users get more. Everything runs through our own
 * ffmpeg — no third-party binaries.
 */

import { spawn } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

// ---------------------------------------------------------------------------
// Client IP (behind dokku/nginx) — for anonymous per-IP quota.
// ---------------------------------------------------------------------------
export function clientIpFrom(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

// ---------------------------------------------------------------------------
// In-memory daily quota. Resets at UTC midnight and on redeploy — fine for a
// free marketing tool (not a security control). globalThis-backed so it
// survives module re-eval / HMR.
// ---------------------------------------------------------------------------
type QuotaStore = { day: string; counts: Map<string, number> };

function store(): QuotaStore {
  const g = globalThis as unknown as { __vibeedit_tool_quota?: QuotaStore };
  if (!g.__vibeedit_tool_quota) g.__vibeedit_tool_quota = { day: "", counts: new Map() };
  return g.__vibeedit_tool_quota;
}

// Increment-and-check: returns ok=false (without incrementing) when the key is
// already at its daily limit.
export function checkToolQuota(
  key: string,
  limit: number,
): { ok: boolean; used: number; limit: number; remaining: number } {
  const s = store();
  const today = new Date().toISOString().slice(0, 10);
  if (s.day !== today) {
    s.day = today;
    s.counts.clear();
  }
  const used = s.counts.get(key) ?? 0;
  if (used >= limit) return { ok: false, used, limit, remaining: 0 };
  s.counts.set(key, used + 1);
  return { ok: true, used: used + 1, limit, remaining: limit - (used + 1) };
}

// Read remaining quota without consuming (for the UI to show "N left today").
export function peekToolQuota(key: string, limit: number): { used: number; remaining: number } {
  const s = store();
  const today = new Date().toISOString().slice(0, 10);
  if (s.day !== today) return { used: 0, remaining: limit };
  const used = s.counts.get(key) ?? 0;
  return { used, remaining: Math.max(0, limit - used) };
}

// ---------------------------------------------------------------------------
// ffmpeg / ffprobe
// ---------------------------------------------------------------------------
function run(
  cmd: string,
  args: string[],
  timeoutMs = 120_000,
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args);
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => proc.kill("SIGTERM"), timeoutMs);
    proc.stdout.on("data", (c: Buffer) => (stdout += c.toString()));
    proc.stderr.on("data", (c: Buffer) => {
      stderr += c.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, stdout, stderr });
    });
    proc.on("error", (e) => {
      clearTimeout(timer);
      resolve({ ok: false, stdout: "", stderr: (e as Error).message });
    });
  });
}

export async function probeVideo(
  path: string,
): Promise<{ ok: boolean; duration: number; width: number; height: number }> {
  const res = await run("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "format=duration:stream=width,height",
    "-of",
    "json",
    path,
  ]);
  if (!res.ok) return { ok: false, duration: 0, width: 0, height: 0 };
  try {
    const json = JSON.parse(res.stdout) as {
      format?: { duration?: string };
      streams?: Array<{ width?: number; height?: number }>;
    };
    return {
      ok: true,
      duration: Number(json.format?.duration ?? 0),
      width: json.streams?.[0]?.width ?? 0,
      height: json.streams?.[0]?.height ?? 0,
    };
  } catch {
    return { ok: false, duration: 0, width: 0, height: 0 };
  }
}

export type WatermarkCorner =
  | "bottom-right"
  | "bottom-left"
  | "bottom-center"
  | "top-right"
  | "top-left";

const LIBERATION_FONT = "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf";

// Compute the delogo box (x,y,w,h) for a corner.
//
// delogo reconstructs the box interior by interpolating inward from its border,
// so the box MUST be kept close to the actual watermark — the bigger the box,
// the larger the region that gets smeared/softened.
//
// Calibrated against a real 1080p Veo clip: the "Veo" wordmark is ~112×70px
// inset ~10px from the right / ~24px from the bottom. A box of ~13% of the
// SHORTER side (≈140px on 1080p) fully covers it with a safe margin for
// position variance across clips, while blurring ~40% less area than the old
// 0.17 box (and ~5× less than the original 24%×14% frame-fraction box, which
// smeared a wide strip). Verified: text fully removed, surrounding detail kept.
const WATERMARK_REACH = 0.13; // fraction of the shorter side the watermark spans from a corner
const WATERMARK_MIN = 90;
const WATERMARK_MAX = 280;

function logoBox(
  corner: WatermarkCorner,
  W: number,
  H: number,
): { x: number; y: number; w: number; h: number } {
  const minDim = Math.min(W, H);
  const reach = Math.min(
    WATERMARK_MAX,
    Math.max(WATERMARK_MIN, Math.round(minDim * WATERMARK_REACH)),
  );
  // Keep the box square-ish (covers both the diamond and the short wordmark) but
  // never let it exceed 40% of an axis, so tiny/odd frames stay sane.
  const w = Math.min(reach, Math.round(W * 0.4));
  const h = Math.min(reach, Math.round(H * 0.4));
  const m = 4; // small inset so delogo has a clean 1px+ neighbour border
  const right = Math.max(1, Math.min(W - w - m, W - w - 1));
  const bottom = Math.max(1, Math.min(H - h - m, H - h - 1));
  const centerX = Math.round((W - w) / 2);
  switch (corner) {
    case "bottom-left":
      return { x: m, y: bottom, w, h };
    case "bottom-center":
      return { x: centerX, y: bottom, w, h };
    case "top-right":
      return { x: right, y: m, w, h };
    case "top-left":
      return { x: m, y: m, w, h };
    case "bottom-right":
    default:
      return { x: right, y: bottom, w, h };
  }
}

// Spawn a process and capture stdout as raw BYTES (run() captures text, which
// corrupts binary rawvideo). Used to pull grayscale frames for mask derivation.
function spawnBinary(
  cmd: string,
  args: string[],
  timeoutMs = 60_000,
): Promise<{ ok: boolean; stdout: Buffer }> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args);
    const chunks: Buffer[] = [];
    const timer = setTimeout(() => proc.kill("SIGTERM"), timeoutMs);
    proc.stdout.on("data", (c: Buffer) => chunks.push(c));
    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, stdout: Buffer.concat(chunks) });
    });
    proc.on("error", () => {
      clearTimeout(timer);
      resolve({ ok: false, stdout: Buffer.alloc(0) });
    });
  });
}

// Generous square-ish corner region to search for the watermark (larger than
// the delogo box; the derived mask then isolates only the actual glyph within).
function analysisBox(corner: WatermarkCorner, W: number, H: number) {
  const minDim = Math.min(W, H);
  const s = Math.min(400, Math.max(160, Math.round(minDim * 0.26)));
  const w = Math.min(s, W - 2);
  const h = Math.min(s, H - 2);
  const right = W - w;
  const bottom = H - h;
  const centerX = Math.round((W - w) / 2);
  switch (corner) {
    case "bottom-left":
      return { x: 0, y: bottom, w, h };
    case "bottom-center":
      return { x: centerX, y: bottom, w, h };
    case "top-right":
      return { x: right, y: 0, w, h };
    case "top-left":
      return { x: 0, y: 0, w, h };
    default:
      return { x: right, y: bottom, w, h };
  }
}

/*
 * Derive a PRECISE watermark mask from the video itself and return a full-frame
 * PGM path for ffmpeg's removelogo (which interpolates only the masked pixels —
 * the thin glyph strokes — instead of blurring a whole box like delogo).
 *
 * How: a static semi-transparent watermark contributes a constant floor
 * (alpha*logo) to every frame, while the background varies. So the TEMPORAL
 * MINIMUM over sampled frames stays bright exactly on the watermark strokes and
 * drops to ~0 everywhere the background ever went dark. Threshold that floor to
 * get the glyph, dilate a touch to catch anti-aliased edges, and stamp it into a
 * full-frame mask. Returns ok:false (→ caller falls back to delogo) whenever the
 * signal is ambiguous: too few frames, no bright floor, or suspiciously large
 * coverage (a bright static background, not a watermark).
 */
async function deriveWatermarkMask(
  inputPath: string,
  corner: WatermarkCorner,
  W: number,
  H: number,
): Promise<{ ok: boolean; maskPath?: string }> {
  const box = analysisBox(corner, W, H);
  const frame = box.w * box.h;
  const res = await spawnBinary("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    inputPath,
    "-vf",
    `crop=${box.w}:${box.h}:${box.x}:${box.y},fps=2,format=gray`,
    "-f",
    "rawvideo",
    "-",
  ]);
  const n = Math.floor(res.stdout.length / frame);
  if (!res.ok || n < 8) return { ok: false }; // need enough frames to separate bg

  const floor = new Uint8Array(frame).fill(255);
  for (let f = 0; f < n; f++) {
    const off = f * frame;
    for (let i = 0; i < frame; i++) {
      const v = res.stdout[off + i];
      if (v < floor[i]) floor[i] = v;
    }
  }
  let maxFloor = 0;
  for (let i = 0; i < frame; i++) if (floor[i] > maxFloor) maxFloor = floor[i];
  if (maxFloor < 40) return { ok: false }; // no clearly bright static overlay

  const threshold = Math.max(30, Math.round(0.35 * maxFloor));
  const mask = new Uint8Array(frame);
  let count = 0;
  for (let i = 0; i < frame; i++) {
    if (floor[i] >= threshold) {
      mask[i] = 1;
      count++;
    }
  }
  const coverage = count / frame;
  if (count === 0 || coverage > 0.35) return { ok: false }; // empty or not a watermark

  // Dilate ~2px (two 5x5 passes) so anti-aliased stroke edges are covered.
  const dilate = (src: Uint8Array): Uint8Array => {
    const dst = new Uint8Array(frame);
    for (let y = 0; y < box.h; y++) {
      for (let x = 0; x < box.w; x++) {
        let on = 0;
        for (let dy = -2; dy <= 2 && !on; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const yy = y + dy;
            const xx = x + dx;
            if (yy < 0 || yy >= box.h || xx < 0 || xx >= box.w) continue;
            if (src[yy * box.w + xx]) {
              on = 1;
              break;
            }
          }
        }
        dst[y * box.w + x] = on;
      }
    }
    return dst;
  };
  const dilated = dilate(dilate(mask));

  // Stamp into a full-frame P5 (binary) PGM: 0 everywhere, 255 on the glyph.
  const full = new Uint8Array(W * H);
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      if (dilated[y * box.w + x]) full[(box.y + y) * W + (box.x + x)] = 255;
    }
  }
  const header = Buffer.from(`P5\n${W} ${H}\n255\n`, "ascii");
  const maskPath = join(tmpdir(), `vibe_wm_mask_${randomBytes(6).toString("hex")}.pgm`);
  writeFileSync(maskPath, Buffer.concat([header, Buffer.from(full)]));
  return { ok: true, maskPath };
}

// Remove a corner watermark, optionally stamping a small "made with VibeEdit"
// badge (anonymous outputs). Audio is stream-copied.
//
// Preferred path: derive a precise glyph mask from the video and interpolate
// just the watermark strokes with `removelogo` (crisp, no box-blur). Falls back
// to `delogo` on a fitted box whenever the mask can't be derived confidently.
// If the badge pass fails (e.g. missing font), retries without the badge so the
// badge can never break the core tool.
export async function removeWatermark(opts: {
  inputPath: string;
  outputPath: string;
  corner: WatermarkCorner;
  width: number;
  height: number;
  badge: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const encode = (vf: string) => [
    "-y",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    opts.inputPath,
    "-vf",
    vf,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    // Quality-sensitive tool — keep the re-encode near-visually-lossless so we
    // don't add compression mush on top of the removal patch.
    "-crf",
    "18",
    "-c:a",
    "copy",
    opts.outputPath,
  ];

  const badge =
    `drawtext=fontfile=${LIBERATION_FONT}:text='made with VibeEdit':` +
    `x=w-tw-16:y=h-th-16:fontsize=h/30:fontcolor=white@0.9:` +
    `box=1:boxcolor=black@0.45:boxborderw=8`;

  // Run a filter chain, trying with the badge first (anonymous tier) then
  // without, so a font/filter hiccup can never break the core removal.
  const runFilter = async (filter: string): Promise<boolean> => {
    if (opts.badge && (await run("ffmpeg", encode(`${filter},${badge}`))).ok) return true;
    return (await run("ffmpeg", encode(filter))).ok;
  };

  // 1) Preferred: precise glyph mask + removelogo (crisp, interpolates only the
  //    watermark strokes).
  const derived = await deriveWatermarkMask(opts.inputPath, opts.corner, opts.width, opts.height);
  if (derived.ok && derived.maskPath) {
    const ok = await runFilter(`removelogo=filename=${derived.maskPath}`);
    try {
      if (existsSync(derived.maskPath)) unlinkSync(derived.maskPath);
    } catch {
      /* ignore */
    }
    if (ok) return { ok: true };
    // removelogo failed → fall through to delogo.
  }

  // 2) Fallback: delogo on a fitted corner box.
  const box = logoBox(opts.corner, opts.width, opts.height);
  const delogo = `delogo=x=${box.x}:y=${box.y}:w=${box.w}:h=${box.h}`;
  if (await runFilter(delogo)) return { ok: true };
  return { ok: false, error: "watermark removal failed — try a different clip" };
}
