/*
 * Shared server helpers for the public "free tools" funnel (no auth required).
 *
 * These tools are a top-of-funnel marketing surface: anonymous users get a small
 * daily quota (by IP), signed-in users get more. Everything runs through our own
 * ffmpeg — no third-party binaries.
 */

import { spawn } from "node:child_process";

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

// Remove a corner watermark via ffmpeg delogo, optionally stamping a small
// "made with VibeEdit" badge (anonymous outputs). Audio is stream-copied.
// If the badge pass fails (e.g. missing font), retries delogo-only so the badge
// can never break the core tool.
export async function removeWatermark(opts: {
  inputPath: string;
  outputPath: string;
  corner: WatermarkCorner;
  width: number;
  height: number;
  badge: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const box = logoBox(opts.corner, opts.width, opts.height);
  const delogo = `delogo=x=${box.x}:y=${box.y}:w=${box.w}:h=${box.h}`;

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
    // don't add compression mush on top of the delogo patch.
    "-crf",
    "18",
    "-c:a",
    "copy",
    opts.outputPath,
  ];

  if (opts.badge) {
    const badge =
      `drawtext=fontfile=${LIBERATION_FONT}:text='made with VibeEdit':` +
      `x=w-tw-16:y=h-th-16:fontsize=h/30:fontcolor=white@0.9:` +
      `box=1:boxcolor=black@0.45:boxborderw=8`;
    const withBadge = await run("ffmpeg", encode(`${delogo},${badge}`));
    if (withBadge.ok) return { ok: true };
    // Badge failed (font/filter) — fall back to delogo only.
  }

  const res = await run("ffmpeg", encode(delogo));
  return res.ok ? { ok: true } : { ok: false, error: res.stderr.split("\n").slice(-4).join("\n") };
}
