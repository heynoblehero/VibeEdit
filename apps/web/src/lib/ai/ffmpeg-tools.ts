import { spawn } from "node:child_process";
import { resolve, join, dirname } from "node:path";
import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  unlinkSync,
  statSync,
  readFileSync,
  renameSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

export function resolveProjectPath(projectRootDir: string, relPath: string): string {
  const root = resolve(projectRootDir);
  const target = resolve(projectRootDir, relPath);
  if (!target.startsWith(root + "/") && target !== root) {
    throw new Error(`path escapes project: ${relPath}`);
  }
  return target;
}

function ensureParentDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

function tmpFile(ext: string): string {
  return `${tmpdir()}/vibe_${randomBytes(6).toString("hex")}${ext}`;
}

async function ffmpegRun(
  args: string[],
  timeoutMs = 180_000,
): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolveP) => {
    const proc = spawn("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args]);
    let stderr = "";
    const timer = setTimeout(() => proc.kill("SIGTERM"), timeoutMs);

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolveP({ ok: true });
      } else {
        const tail = stderr
          .split("\n")
          .filter((line) => line.length > 0)
          .slice(-8)
          .join("\n");
        resolveP({ ok: false, error: `FFmpeg exited ${code}:\n${tail}` });
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolveP({ ok: false, error: err.message });
    });
  });
}

async function ffprobeRun(
  args: string[],
): Promise<{ ok: boolean; stdout?: string; error?: string }> {
  return new Promise((resolveP) => {
    const proc = spawn("ffprobe", args);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) resolveP({ ok: true, stdout });
      else resolveP({ ok: false, error: stderr.slice(-500) });
    });

    proc.on("error", (err) => resolveP({ ok: false, error: err.message }));
  });
}

// Like ffmpegRun but always returns stderr (needed for loudnorm pass-1 JSON).
async function ffmpegRunCapture(
  args: string[],
  timeoutMs = 180_000,
): Promise<{ ok: boolean; stderr: string }> {
  return new Promise((resolveP) => {
    const proc = spawn("ffmpeg", ["-y", "-hide_banner", ...args]);
    let stderr = "";
    const timer = setTimeout(() => proc.kill("SIGTERM"), timeoutMs);
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      resolveP({ ok: code === 0, stderr });
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      resolveP({ ok: false, stderr: err.message });
    });
  });
}

// ---------------------------------------------------------------------------
// probe_clip
// ---------------------------------------------------------------------------

export interface ClipInfo {
  durationSeconds: number;
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
  fileSizeBytes: number;
}

export async function probeClip(filePath: string): Promise<ClipInfo> {
  const result = await ffprobeRun([
    "-v",
    "quiet",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    filePath,
  ]);

  if (!result.ok || !result.stdout) throw new Error(result.error || "ffprobe failed");

  type ProbeStream = {
    codec_type: string;
    width?: number;
    height?: number;
    avg_frame_rate?: string;
  };
  type ProbeFormat = { duration?: string };
  const data: { streams: ProbeStream[]; format: ProbeFormat } = JSON.parse(result.stdout);

  const videoStream = data.streams?.find((stream) => stream.codec_type === "video");
  const hasAudio = data.streams?.some((stream) => stream.codec_type === "audio") ?? false;
  const duration = parseFloat(data.format?.duration ?? "0");

  let fps = 0;
  if (videoStream?.avg_frame_rate) {
    const parts = videoStream.avg_frame_rate.split("/");
    const num = parseFloat(parts[0] ?? "0");
    const den = parseFloat(parts[1] ?? "1");
    if (den > 0) fps = Math.round((num / den) * 100) / 100;
  }

  const fileSizeBytes = existsSync(filePath) ? statSync(filePath).size : 0;

  return {
    durationSeconds: duration,
    width: videoStream?.width ?? 0,
    height: videoStream?.height ?? 0,
    fps,
    hasAudio,
    fileSizeBytes,
  };
}

// ---------------------------------------------------------------------------
// buildAtempo — module-level so trim + renderEdl can reuse it
// ---------------------------------------------------------------------------

// atempo only handles 0.5–2.0; chain filters for values outside that range.
function buildAtempo(speed: number): string {
  if (speed >= 0.5 && speed <= 2.0) return `atempo=${speed.toFixed(4)}`;
  if (speed > 2.0) {
    const half = Math.sqrt(speed);
    if (half <= 2.0) return `atempo=${half.toFixed(4)},atempo=${half.toFixed(4)}`;
    return `atempo=2.0,atempo=2.0,atempo=${(speed / 4).toFixed(4)}`;
  }
  // < 0.5
  const half = Math.sqrt(speed);
  return `atempo=${half.toFixed(4)},atempo=${half.toFixed(4)}`;
}

// ---------------------------------------------------------------------------
// snapToBoundary — snap a timestamp to the nearest word boundary
// Hard Rules 6+7: never cut inside a word; pad 50ms before / 80ms after.
// ---------------------------------------------------------------------------

export function snapToBoundary(opts: {
  targetSeconds: number;
  words: TranscriptWord[];
  direction: "before" | "after";
  padSeconds?: number;
}): number {
  const { targetSeconds, words, direction } = opts;
  const pad = opts.padSeconds ?? (direction === "before" ? 0.08 : 0.05);

  if (words.length === 0) return targetSeconds;

  if (direction === "before") {
    // Find the last word whose end falls at or before targetSeconds.
    let best: TranscriptWord | null = null;
    for (const word of words) {
      if (word.end <= targetSeconds) {
        if (!best || word.end > best.end) best = word;
      }
    }
    // Snap to end of that word + pad (cut happens in the silence after the word).
    return best ? best.end + pad : targetSeconds;
  } else {
    // Find the first word whose start falls at or after targetSeconds.
    let best: TranscriptWord | null = null;
    for (const word of words) {
      if (word.start >= targetSeconds) {
        if (!best || word.start < best.start) best = word;
      }
    }
    // Snap to start of that word - pad (cut happens in the silence before the word).
    return best ? Math.max(0, best.start - pad) : targetSeconds;
  }
}

// ---------------------------------------------------------------------------
// trim_clip  (Hard Rule 3: 30ms audio fades at every cut boundary)
// ---------------------------------------------------------------------------

export async function trimClip(opts: {
  inputPath: string;
  outputPath: string;
  startSeconds: number;
  endSeconds?: number;
}): Promise<{ ok: boolean; error?: string }> {
  ensureParentDir(opts.outputPath);

  // Probe once to get duration (needed for fade-out timing) and audio presence.
  const info = await probeClip(opts.inputPath);
  const segDuration = (opts.endSeconds ?? info.durationSeconds) - opts.startSeconds;
  const fadeOutStart = Math.max(0, segDuration - 0.03).toFixed(3);

  // Input-side seek (-ss before -i) is fast and accurate enough for 30ms pads.
  const args = ["-ss", String(opts.startSeconds), "-t", String(segDuration), "-i", opts.inputPath];

  if (info.hasAudio) {
    // 30ms fade-in at start + 30ms fade-out at end — eliminates audible pops.
    args.push("-af", `afade=t=in:st=0:d=0.03,afade=t=out:st=${fadeOutStart}:d=0.03`);
    args.push("-c:a", "aac", "-b:a", "192k");
  } else {
    args.push("-an");
  }

  args.push("-c:v", "libx264", "-preset", "fast", "-crf", "18", opts.outputPath);
  return ffmpegRun(args);
}

// ---------------------------------------------------------------------------
// concat_clips
// ---------------------------------------------------------------------------

export async function concatClips(opts: {
  inputPaths: string[];
  outputPath: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (opts.inputPaths.length === 0) return { ok: false, error: "No input clips provided" };
  ensureParentDir(opts.outputPath);

  if (opts.inputPaths.length === 1) {
    return ffmpegRun([
      "-i",
      opts.inputPaths[0],
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "18",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      opts.outputPath,
    ]);
  }

  const inputArgs: string[] = [];
  const vInputs: string[] = [];
  const aInputs: string[] = [];

  for (let index = 0; index < opts.inputPaths.length; index++) {
    inputArgs.push("-i", opts.inputPaths[index]);
    vInputs.push(`[${index}:v:0]`);
    aInputs.push(`[${index}:a:0]`);
  }

  const count = opts.inputPaths.length;
  const filterComplex = `${vInputs.join("")}${aInputs.join("")}concat=n=${count}:v=1:a=1[v][a]`;

  const result = await ffmpegRun([
    ...inputArgs,
    "-filter_complex",
    filterComplex,
    "-map",
    "[v]",
    "-map",
    "[a]",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "18",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    opts.outputPath,
  ]);

  // Fallback: video-only concat (clips may not all have audio)
  if (!result.ok) {
    const filterComplex2 = `${vInputs.join("")}concat=n=${count}:v=1:a=0[v]`;
    return ffmpegRun([
      ...inputArgs,
      "-filter_complex",
      filterComplex2,
      "-map",
      "[v]",
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "18",
      opts.outputPath,
    ]);
  }

  return result;
}

// ---------------------------------------------------------------------------
// grade_clip
// ---------------------------------------------------------------------------

export async function gradeClip(opts: {
  inputPath: string;
  outputPath: string;
  brightness?: number; // -1.0 to 1.0, default 0
  contrast?: number; // 0.0 to 2.0, default 1.0
  saturation?: number; // 0.0 to 3.0, default 1.0
  gamma?: number; // 0.1 to 10.0, default 1.0
  temperature?: "warm" | "cool" | "neutral";
}): Promise<{ ok: boolean; error?: string }> {
  ensureParentDir(opts.outputPath);

  const brightness = opts.brightness ?? 0;
  const contrast = opts.contrast ?? 1.0;
  const saturation = opts.saturation ?? 1.0;
  const gamma = opts.gamma ?? 1.0;

  let vf = `eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}:gamma=${gamma}`;

  if (opts.temperature === "warm") {
    vf += ",colorbalance=rs=0.05:gs=0.02:bs=-0.05:rm=0.03:gm=0.01:bm=-0.03";
  } else if (opts.temperature === "cool") {
    vf += ",colorbalance=rs=-0.05:gs=-0.01:bs=0.05:rm=-0.03:gm=0:bm=0.03";
  }

  return ffmpegRun([
    "-i",
    opts.inputPath,
    "-vf",
    vf,
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "18",
    "-c:a",
    "copy",
    opts.outputPath,
  ]);
}

// ---------------------------------------------------------------------------
// chroma_key
// ---------------------------------------------------------------------------

export async function chromaKey(opts: {
  inputPath: string;
  outputPath: string;
  color?: string; // hex without # e.g. "00FF00", or "green"/"blue". Default "00FF00"
  similarity?: number; // 0.01 to 1.0, default 0.3
  blend?: number; // 0.0 to 1.0, default 0.05
}): Promise<{ ok: boolean; error?: string }> {
  ensureParentDir(opts.outputPath);

  const rawColor = opts.color ?? "00FF00";
  const color = rawColor.startsWith("#") ? rawColor.slice(1) : rawColor;
  const similarity = opts.similarity ?? 0.3;
  const blend = opts.blend ?? 0.05;

  return ffmpegRun([
    "-i",
    opts.inputPath,
    "-vf",
    `chromakey=0x${color}:${similarity}:${blend}`,
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "18",
    "-c:a",
    "copy",
    opts.outputPath,
  ]);
}

// ---------------------------------------------------------------------------
// speed_clip
// ---------------------------------------------------------------------------

export async function speedClip(opts: {
  inputPath: string;
  outputPath: string;
  factor: number; // 0.25 to 4.0
}): Promise<{ ok: boolean; error?: string }> {
  ensureParentDir(opts.outputPath);

  const factor = Math.max(0.25, Math.min(4.0, opts.factor));
  const ptsFactor = (1 / factor).toFixed(6);
  const atempo = buildAtempo(factor);

  return ffmpegRun([
    "-i",
    opts.inputPath,
    "-filter_complex",
    `[0:v]setpts=${ptsFactor}*PTS[v];[0:a]${atempo}[a]`,
    "-map",
    "[v]",
    "-map",
    "[a]",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "18",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    opts.outputPath,
  ]);
}

// ---------------------------------------------------------------------------
// overlay_clip
// ---------------------------------------------------------------------------

export async function overlayClip(opts: {
  basePath: string;
  overlayPath: string;
  outputPath: string;
  x?: number | "center"; // pixel offset or "center", default 0
  y?: number | "center";
  width?: number; // scale overlay to this width (proportional height)
  startSeconds?: number; // when overlay appears (default 0 = always visible)
  durationSeconds?: number; // how long overlay is visible
}): Promise<{ ok: boolean; error?: string }> {
  ensureParentDir(opts.outputPath);

  const xExpr = opts.x === "center" ? "(W-w)/2" : String(opts.x ?? 0);
  const yExpr = opts.y === "center" ? "(H-h)/2" : String(opts.y ?? 0);

  // Hard Rule 4: shift overlay PTS so frame 0 of the overlay clip appears at
  // startSeconds in the output. Without this the overlay shows the wrong frames
  // (mid-clip instead of the beginning) during its window.
  const startAt = opts.startSeconds ?? 0;
  const endAt = startAt + (opts.durationSeconds ?? 99999);
  const ptsShift = `setpts=PTS-STARTPTS+(${startAt}/TB)`;

  let overlayChain = `[1:v]${ptsShift}`;
  if (opts.width) overlayChain += `,scale=${opts.width}:-1`;
  overlayChain += "[ov]";

  const enableExpr = `:enable='between(t,${startAt},${endAt})'`;
  const filterComplex = `${overlayChain};[0:v][ov]overlay=${xExpr}:${yExpr}${enableExpr}[v]`;

  return ffmpegRun([
    "-i",
    opts.basePath,
    "-i",
    opts.overlayPath,
    "-filter_complex",
    filterComplex,
    "-map",
    "[v]",
    "-map",
    "0:a?",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "18",
    "-c:a",
    "copy",
    opts.outputPath,
  ]);
}

// ---------------------------------------------------------------------------
// add_transition
// ---------------------------------------------------------------------------

export type XfadeType =
  | "fade"
  | "fadeblack"
  | "fadewhite"
  | "wipeleft"
  | "wiperight"
  | "wipeup"
  | "wipedown"
  | "slideleft"
  | "slideright"
  | "slideup"
  | "slidedown"
  | "circlecrop"
  | "circleopen"
  | "circleclose"
  | "dissolve"
  | "smoothleft"
  | "smoothright"
  | "smoothup"
  | "smoothdown"
  | "radial"
  | "zoomin"
  | "pixelize"
  | "hlwind"
  | "diagtl"
  | "diagbr";

// Every xfade type this module accepts — used to validate EDL transitions.
export const XFADE_TYPES: readonly XfadeType[] = [
  "fade",
  "fadeblack",
  "fadewhite",
  "wipeleft",
  "wiperight",
  "wipeup",
  "wipedown",
  "slideleft",
  "slideright",
  "slideup",
  "slidedown",
  "circlecrop",
  "circleopen",
  "circleclose",
  "dissolve",
  "smoothleft",
  "smoothright",
  "smoothup",
  "smoothdown",
  "radial",
  "zoomin",
  "pixelize",
  "hlwind",
  "diagtl",
  "diagbr",
];

export async function addTransition(opts: {
  clip1Path: string;
  clip2Path: string;
  outputPath: string;
  type?: XfadeType;
  durationSeconds?: number;
  clip1DurationSeconds: number; // caller must probe clip1 first
}): Promise<{ ok: boolean; error?: string }> {
  ensureParentDir(opts.outputPath);

  const transitionDuration = opts.durationSeconds ?? 0.5;
  const offset = Math.max(0, opts.clip1DurationSeconds - transitionDuration);
  const type = opts.type ?? "fade";

  // Try with audio crossfade first; if that fails (no audio), do video-only
  const result = await ffmpegRun([
    "-i",
    opts.clip1Path,
    "-i",
    opts.clip2Path,
    "-filter_complex",
    `xfade=transition=${type}:duration=${transitionDuration}:offset=${offset}[v];acrossfade=d=${transitionDuration}[a]`,
    "-map",
    "[v]",
    "-map",
    "[a]",
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "18",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    opts.outputPath,
  ]);

  if (!result.ok) {
    // Fallback: video-only xfade (clips without audio)
    return ffmpegRun([
      "-i",
      opts.clip1Path,
      "-i",
      opts.clip2Path,
      "-filter_complex",
      `xfade=transition=${type}:duration=${transitionDuration}:offset=${offset}[v]`,
      "-map",
      "[v]",
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "18",
      opts.outputPath,
    ]);
  }

  return result;
}

// ---------------------------------------------------------------------------
// mix_audio
// ---------------------------------------------------------------------------

export async function mixAudio(opts: {
  inputs: Array<{
    path: string;
    volume?: number; // 0.0 to 2.0, default 1.0
    startSeconds?: number; // offset in output timeline, default 0
  }>;
  outputPath: string;
  totalDurationSeconds?: number;
}): Promise<{ ok: boolean; error?: string }> {
  if (opts.inputs.length === 0) return { ok: false, error: "No inputs" };
  ensureParentDir(opts.outputPath);

  const inputArgs: string[] = [];
  const filterParts: string[] = [];
  const labels: string[] = [];

  for (let index = 0; index < opts.inputs.length; index++) {
    const input = opts.inputs[index];
    inputArgs.push("-i", input.path);

    const volume = input.volume ?? 1.0;
    const delayMs = Math.round((input.startSeconds ?? 0) * 1000);
    const label = `a${index}`;

    filterParts.push(`[${index}:a]volume=${volume},adelay=${delayMs}|${delayMs}[${label}]`);
    labels.push(`[${label}]`);
  }

  const filterComplex = `${filterParts.join(";")};${labels.join("")}amix=inputs=${opts.inputs.length}:duration=longest:normalize=0[out]`;

  const args = [
    ...inputArgs,
    "-filter_complex",
    filterComplex,
    "-map",
    "[out]",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
  ];

  if (opts.totalDurationSeconds) args.push("-t", String(opts.totalDurationSeconds));
  args.push(opts.outputPath);

  return ffmpegRun(args);
}

// ---------------------------------------------------------------------------
// trim_audio
// ---------------------------------------------------------------------------

export async function trimAudio(opts: {
  inputPath: string;
  outputPath: string;
  startSeconds: number;
  endSeconds?: number;
}): Promise<{ ok: boolean; error?: string }> {
  ensureParentDir(opts.outputPath);
  const info = await probeClip(opts.inputPath);
  const segDuration = (opts.endSeconds ?? info.durationSeconds) - opts.startSeconds;
  const fadeOutStart = Math.max(0, segDuration - 0.03).toFixed(3);
  return ffmpegRun([
    "-ss",
    String(opts.startSeconds),
    "-t",
    String(segDuration),
    "-i",
    opts.inputPath,
    "-vn",
    "-af",
    `afade=t=in:st=0:d=0.03,afade=t=out:st=${fadeOutStart}:d=0.03`,
    "-c:a",
    "libmp3lame",
    "-q:a",
    "2",
    opts.outputPath,
  ]);
}

// ---------------------------------------------------------------------------
// extract_audio
// ---------------------------------------------------------------------------

export async function extractAudio(opts: {
  inputPath: string;
  outputPath: string; // should end in .mp3 or .wav
}): Promise<{ ok: boolean; error?: string }> {
  ensureParentDir(opts.outputPath);
  return ffmpegRun(["-i", opts.inputPath, "-vn", "-c:a", "mp3", "-q:a", "2", opts.outputPath]);
}

// Replace a video's audio track with a new audio file (keeps the video stream
// untouched via stream copy). Used to fold cleaned/isolated audio back into a
// clip after processing it out-of-band.
export async function replaceAudioTrack(opts: {
  videoPath: string;
  audioPath: string;
  outputPath: string;
}): Promise<{ ok: boolean; error?: string }> {
  ensureParentDir(opts.outputPath);
  return ffmpegRun([
    "-i",
    opts.videoPath,
    "-i",
    opts.audioPath,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-shortest",
    opts.outputPath,
  ]);
}

// ---------------------------------------------------------------------------
// burn_captions
// ---------------------------------------------------------------------------

export interface CaptionCue {
  text: string;
  start: number;
  end: number;
  style?: CaptionStyle; // per-cue override of the EDL-level captionStyle
}

// ---------------------------------------------------------------------------
// Caption styling presets (ASS / libass — already in the pipeline, zero new
// deps). Replaces the single hard-coded Arial SRT look. Fonts are limited to
// those guaranteed in the container (Liberation / DejaVu via fonts-liberation);
// the "pop" that makes social captions feel produced comes from size, outline,
// and per-cue scale animation, not an exotic typeface.
// ---------------------------------------------------------------------------

export type CaptionStyle = "clean" | "bold" | "karaoke" | "minimal" | "documentary";

interface CaptionPreset {
  font: string;
  fontScale: number; // fraction of video height → font size in px
  primaryRgb: string; // fill colour, RRGGBB
  outlineRgb: string; // outline colour, RRGGBB
  outlineWidth: number;
  shadow: number;
  bold: 0 | 1;
  italic: 0 | 1;
  alignment: number; // ASS numpad alignment (1=bottom-left … 5=center … 9=top-right)
  marginVScale: number; // fraction of video height → vertical margin
  uppercase: boolean;
  pop: boolean; // scale-in bounce per cue (word-pop look)
}

const CAPTION_PRESETS: Record<CaptionStyle, CaptionPreset> = {
  // Improved default: bold white, clean readable outline, bottom-center.
  clean: {
    font: "Liberation Sans",
    fontScale: 0.05,
    primaryRgb: "FFFFFF",
    outlineRgb: "000000",
    outlineWidth: 2.5,
    shadow: 0,
    bold: 1,
    italic: 0,
    alignment: 2,
    marginVScale: 0.06,
    uppercase: false,
    pop: false,
  },
  // Big, punchy, uppercase, thick outline, animated — the "Hormozi" look.
  // Best with one word per cue (build_captions_from_words chunkSize 1).
  bold: {
    font: "Liberation Sans",
    fontScale: 0.075,
    primaryRgb: "FFFFFF",
    outlineRgb: "000000",
    outlineWidth: 4,
    shadow: 1,
    bold: 1,
    italic: 0,
    alignment: 2,
    marginVScale: 0.1,
    uppercase: true,
    pop: true,
  },
  // Centered yellow word-pop for high-energy social hooks.
  karaoke: {
    font: "Liberation Sans",
    fontScale: 0.072,
    primaryRgb: "FFDD00",
    outlineRgb: "000000",
    outlineWidth: 4,
    shadow: 1,
    bold: 1,
    italic: 0,
    alignment: 5,
    marginVScale: 0,
    uppercase: true,
    pop: true,
  },
  // Small, unobtrusive, bottom-center.
  minimal: {
    font: "Liberation Sans",
    fontScale: 0.038,
    primaryRgb: "FFFFFF",
    outlineRgb: "000000",
    outlineWidth: 1.5,
    shadow: 0,
    bold: 0,
    italic: 0,
    alignment: 2,
    marginVScale: 0.05,
    uppercase: false,
    pop: false,
  },
  // Serif lower-third, bottom-left — documentary / interview feel.
  documentary: {
    font: "Liberation Serif",
    fontScale: 0.042,
    primaryRgb: "FFFFFF",
    outlineRgb: "000000",
    outlineWidth: 2,
    shadow: 1,
    bold: 0,
    italic: 0,
    alignment: 1,
    marginVScale: 0.06,
    uppercase: false,
    pop: false,
  },
};

// ASS colours are &HAABBGGRR (alpha inverted: 00 = opaque). Convert RRGGBB.
function rgbToAss(rgb: string, alpha = 0): string {
  const clean = rgb.replace(/^#/, "").padStart(6, "0");
  const rr = clean.slice(0, 2);
  const gg = clean.slice(2, 4);
  const bb = clean.slice(4, 6);
  const aa = alpha.toString(16).padStart(2, "0").toUpperCase();
  return `&H${aa}${bb}${gg}${rr}`;
}

function secondsToAssTimestamp(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const hours = Math.floor(clamped / 3600);
  const minutes = Math.floor((clamped % 3600) / 60);
  const secs = Math.floor(clamped % 60);
  const centis = Math.round((clamped % 1) * 100);
  // centis can round to 100 → roll over.
  const cc = centis === 100 ? 0 : centis;
  const carry = centis === 100 ? 1 : 0;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs + carry).padStart(2, "0")}.${String(cc).padStart(2, "0")}`;
}

function assStyleLine(name: string, preset: CaptionPreset, videoHeight: number): string {
  const fontSize = Math.max(12, Math.round(preset.fontScale * videoHeight));
  const marginV = Math.round(preset.marginVScale * videoHeight);
  const primary = rgbToAss(preset.primaryRgb);
  const outline = rgbToAss(preset.outlineRgb);
  const back = rgbToAss("000000", 128);
  // Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour,
  // OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX,
  // ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL,
  // MarginR, MarginV, Encoding
  return `Style: ${name},${preset.font},${fontSize},${primary},${primary},${outline},${back},${preset.bold},${preset.italic},0,0,100,100,0,0,1,${preset.outlineWidth},${preset.shadow},${preset.alignment},40,40,${marginV},1`;
}

// Escape user text for an ASS Dialogue line.
function escapeAssText(text: string): string {
  return text.replace(/[{}]/g, "").replace(/\r?\n/g, "\\N").trim();
}

export function buildAssContent(
  cues: CaptionCue[],
  opts: { videoWidth: number; videoHeight: number; defaultStyle?: CaptionStyle },
): string {
  const { videoWidth, videoHeight } = opts;
  const defaultStyle: CaptionStyle = opts.defaultStyle ?? "clean";

  // Only emit the styles actually used.
  const usedStyles = new Set<CaptionStyle>([defaultStyle]);
  for (const cue of cues) if (cue.style) usedStyles.add(cue.style);

  const styleLines = [...usedStyles].map((name) =>
    assStyleLine(name, CAPTION_PRESETS[name], videoHeight),
  );

  const events = cues.map((cue) => {
    const styleName = cue.style ?? defaultStyle;
    const preset = CAPTION_PRESETS[styleName];
    const text = preset.uppercase ? cue.text.toUpperCase() : cue.text;
    // Scale-in bounce for "pop" presets: quick overshoot then settle.
    const pop = preset.pop
      ? "{\\fad(50,0)\\t(0,120,\\fscx112\\fscy112)\\t(120,200,\\fscx100\\fscy100)}"
      : "{\\fad(40,0)}";
    return `Dialogue: 0,${secondsToAssTimestamp(cue.start)},${secondsToAssTimestamp(cue.end)},${styleName},,0,0,0,,${pop}${escapeAssText(text)}`;
  });

  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    "WrapStyle: 2",
    "ScaledBorderAndShadow: yes",
    `PlayResX: ${videoWidth}`,
    `PlayResY: ${videoHeight}`,
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    ...styleLines,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ...events,
    "",
  ].join("\n");
}

function secondsToSrtTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
}

function buildSrtContent(cues: CaptionCue[]): string {
  return cues
    .map(
      (cue, index) =>
        `${index + 1}\n${secondsToSrtTimestamp(cue.start)} --> ${secondsToSrtTimestamp(cue.end)}\n${cue.text}`,
    )
    .join("\n\n");
}

export async function burnCaptions(opts: {
  inputPath: string;
  outputPath: string;
  cues: CaptionCue[];
  fontSize?: number; // default 24
  position?: "bottom" | "center" | "top"; // default "bottom"
  fontColor?: string; // hex without #, default "FFFFFF"
}): Promise<{ ok: boolean; error?: string }> {
  ensureParentDir(opts.outputPath);

  const srtPath = tmpFile(".srt");
  writeFileSync(srtPath, buildSrtContent(opts.cues), "utf8");

  const fontSize = opts.fontSize ?? 24;
  const fontColor = `&H${(opts.fontColor ?? "FFFFFF").toUpperCase()}`;
  // ASS alignment: 2=bottom-center, 8=middle-center, 6=top-center
  const alignment = opts.position === "top" ? 6 : opts.position === "center" ? 8 : 2;
  const style = `FontName=Arial,FontSize=${fontSize},PrimaryColour=${fontColor},OutlineColour=&H000000,BorderStyle=3,Outline=2,Alignment=${alignment}`;

  // Escape the path for the subtitles filter
  const escapedSrt = srtPath.replace(/\\/g, "/").replace(/:/g, "\\:");

  const result = await ffmpegRun([
    "-i",
    opts.inputPath,
    "-vf",
    `subtitles=${escapedSrt}:force_style='${style}'`,
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "18",
    "-c:a",
    "copy",
    opts.outputPath,
  ]);

  try {
    unlinkSync(srtPath);
  } catch {
    // ignore cleanup errors
  }

  return result;
}

// ---------------------------------------------------------------------------
// transcribe_clip  (ElevenLabs Scribe STT — BYOK)
// ---------------------------------------------------------------------------

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
}

export async function transcribeClip(opts: {
  filePath: string;
  apiKey: string;
  language?: string; // ISO 639-1 e.g. "en"
  cacheDir?: string; // if set, cache result at <cacheDir>/<stem>.json (Hard Rule 9)
}): Promise<{
  ok: boolean;
  transcript?: string;
  words?: TranscriptWord[];
  error?: string;
}> {
  // Hard Rule 9: return cached transcript if available (never re-transcribe).
  const cacheStem =
    opts.filePath
      .replace(/\\/g, "/")
      .split("/")
      .pop()
      ?.replace(/\.[^.]+$/, "") ?? "clip";
  const cachePath = opts.cacheDir ? join(opts.cacheDir, `${cacheStem}.json`) : null;
  if (cachePath && existsSync(cachePath)) {
    try {
      type Cached = { transcript: string; words: TranscriptWord[] };
      const cached = JSON.parse(readFileSync(cachePath, "utf8")) as Cached;
      if (cached.transcript && cached.words) {
        return { ok: true, transcript: cached.transcript, words: cached.words };
      }
    } catch {
      // Corrupt cache — fall through to API call
    }
  }

  // Downmix to mono 16kHz MP3 to reduce upload size
  const audioTmp = tmpFile(".mp3");
  const extractResult = await ffmpegRun([
    "-i",
    opts.filePath,
    "-vn",
    "-c:a",
    "mp3",
    "-q:a",
    "5",
    "-ar",
    "16000",
    "-ac",
    "1",
    audioTmp,
  ]);

  if (!extractResult.ok) {
    return { ok: false, error: `Audio extraction failed: ${extractResult.error}` };
  }

  try {
    const audioBuffer = readFileSync(audioTmp);
    const blob = new Blob([audioBuffer], { type: "audio/mpeg" });

    // ElevenLabs Scribe STT (BYOK — same ElevenLabs key used for TTS). Returns
    // word-level timestamps we map to our TranscriptWord shape.
    const formData = new FormData();
    formData.append("file", blob, "audio.mp3");
    formData.append("model_id", "scribe_v1");
    if (opts.language) formData.append("language_code", opts.language);

    const response = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": opts.apiKey },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        ok: false,
        error: `ElevenLabs STT ${response.status}: ${text.slice(0, 400)}`,
      };
    }

    type ScribeWord = { text: string; start: number; end: number; type?: string };
    type ScribeResponse = { text: string; words?: ScribeWord[] };
    const data = (await response.json()) as ScribeResponse;

    const words: TranscriptWord[] = (data.words ?? [])
      .filter((w) => (w.type ?? "word") === "word")
      .map((word) => ({
        word: word.text,
        start: word.start,
        end: word.end,
      }));

    // Persist to cache so future calls skip the API.
    if (cachePath) {
      try {
        ensureParentDir(cachePath);
        writeFileSync(cachePath, JSON.stringify({ transcript: data.text, words }), "utf8");
      } catch {
        // Cache write failure is non-fatal
      }
    }

    return { ok: true, transcript: data.text, words };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  } finally {
    try {
      unlinkSync(audioTmp);
    } catch {
      // ignore cleanup errors
    }
  }
}

// ---------------------------------------------------------------------------
// autoGradeFilter — per-clip signalstats analysis → subtle eq correction
// Samples the first 10s at reduced resolution, measures luma + saturation,
// and applies video-use decision rules capped at ±8% (target: clean, not graded).
// Returns an ffmpeg eq=... filter string, or "" if the clip is already balanced.
// ---------------------------------------------------------------------------

export async function autoGradeFilter(filePath: string): Promise<string> {
  const statsTmp = tmpFile(".txt");

  // Sample every 15th frame at 320px wide — fast enough for a 10s window.
  const result = await ffmpegRun([
    "-ss",
    "0",
    "-t",
    "10",
    "-i",
    filePath,
    "-vf",
    `select='not(mod(n,15))',scale=320:-1,signalstats,metadata=print:file=${statsTmp}`,
    "-an",
    "-f",
    "null",
    "/dev/null",
  ]);

  if (!result.ok || !existsSync(statsTmp)) return "";

  let statsContent: string;
  try {
    statsContent = readFileSync(statsTmp, "utf8");
  } finally {
    try {
      unlinkSync(statsTmp);
    } catch {
      /* ignore */
    }
  }

  const yAvgValues: number[] = [];
  const satAvgValues: number[] = [];
  const yHighValues: number[] = [];
  const yLowValues: number[] = [];

  for (const line of statsContent.split("\n")) {
    const yAvg = line.match(/lavfi\.signalstats\.YAVG=(\S+)/);
    if (yAvg) yAvgValues.push(parseFloat(yAvg[1] ?? "0"));
    const satAvg = line.match(/lavfi\.signalstats\.SATAVG=(\S+)/);
    if (satAvg) satAvgValues.push(parseFloat(satAvg[1] ?? "0"));
    const yHigh = line.match(/lavfi\.signalstats\.YHIGH=(\S+)/);
    if (yHigh) yHighValues.push(parseFloat(yHigh[1] ?? "0"));
    const yLow = line.match(/lavfi\.signalstats\.YLOW=(\S+)/);
    if (yLow) yLowValues.push(parseFloat(yLow[1] ?? "0"));
  }

  if (yAvgValues.length === 0) return "";

  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;

  // Normalize 8-bit values (0-255) to 0-1 range.
  const yMean = avg(yAvgValues) / 255;
  const satMean = satAvgValues.length > 0 ? avg(satAvgValues) / 255 : 0.25;
  const yHigh = yHighValues.length > 0 ? avg(yHighValues) / 255 : 0.9;
  const yLow = yLowValues.length > 0 ? avg(yLowValues) / 255 : 0.1;
  const yRange = Math.max(0.1, yHigh - yLow);

  // Decision rules — all capped at ±8% so corrections stay subtle.
  // Target values from video-use: y_range ≈ 0.72, y_mean ≈ 0.48, sat ≈ 0.25.
  let contrast = 1.0;
  let gamma = 1.0;
  let saturation = 1.0;

  if (yRange < 0.65) contrast = Math.min(1.08, 1.0 + (0.65 - yRange) * 0.2);
  if (yMean < 0.42) gamma = Math.max(0.92, 1.0 - (0.42 - yMean) * 0.25);
  if (satMean < 0.18) saturation = Math.min(1.08, 1.0 + (0.18 - satMean) * 0.5);

  // Skip if all adjustments are negligible.
  if (
    Math.abs(contrast - 1) < 0.01 &&
    Math.abs(gamma - 1) < 0.01 &&
    Math.abs(saturation - 1) < 0.01
  ) {
    return "";
  }

  return `eq=contrast=${contrast.toFixed(3)}:gamma=${gamma.toFixed(3)}:saturation=${saturation.toFixed(3)}`;
}

// ---------------------------------------------------------------------------
// EDL — Edit Decision List
// render_edl executes the full pipeline in one call:
//   per-segment extract (grade + 30ms fades, one encode) →
//   lossless concat →
//   overlays with PTS shift →
//   captions LAST (Hard Rule 1)
// ---------------------------------------------------------------------------

export type FilmLook = "teal-orange" | "film-warm" | "moody-cool" | "bw-contrast" | "vibrant";

export interface EdlGrade {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  gamma?: number;
  temperature?: "warm" | "cool" | "neutral";
  look?: FilmLook; // named cinematic look, applied before manual tweaks
}

// Named film looks as ffmpeg filter chains (curves/colorbalance/eq) — richer
// than a flat eq, and no external .cube files to ship, so they render
// identically everywhere. Each is a self-contained vf sub-chain.
const FILM_LOOKS: Record<FilmLook, string> = {
  // Teal shadows, orange highlights — the blockbuster grade.
  "teal-orange":
    "curves=b='0/0.12 0.5/0.46 1/0.86':r='0/0 0.5/0.56 1/1',eq=saturation=1.12:contrast=1.06",
  // Warm, lifted blacks, gently desaturated — nostalgic film stock.
  "film-warm":
    "colorbalance=rs=0.06:rm=0.04:bs=-0.06:bh=-0.04,curves=all='0/0.04 1/0.97',eq=saturation=0.95",
  // Cool cast, crushed blacks, muted — moody / thriller.
  "moody-cool":
    "colorbalance=rs=-0.05:bs=0.08:bh=0.04,curves=all='0/0 0.5/0.45 1/0.95',eq=saturation=0.82:contrast=1.08",
  // High-contrast black & white.
  "bw-contrast": "hue=s=0,curves=all='0/0 0.25/0.14 0.75/0.86 1/1'",
  // Punchy, saturated, crisp — product / hype.
  vibrant: "eq=saturation=1.3:contrast=1.1,unsharp=3:3:0.4",
};

// Build a time-driven crop that animates a zoom (and optional pan) across the
// segment — a punch-in or Ken Burns push. Returns "" when there's no move.
// The crop window shrinks (zoom > 1) around a drifting centre; a later scale
// back to the canvas turns that into a smooth zoom. `t` is seconds into the clip.
export function buildTransformFilter(transform: EdlTransform, durationSeconds: number): string {
  const startScale = Math.max(1, transform.startScale ?? 1);
  const endScale = Math.max(1, transform.endScale ?? startScale);
  const panX = transform.panX ?? 0;
  const panY = transform.panY ?? 0;
  if (startScale === 1 && endScale === 1 && panX === 0 && panY === 0) return "";

  const duration = Math.max(0.05, durationSeconds).toFixed(3);
  // Linear progress 0→1 across the clip, clamped (escape the comma for ffmpeg).
  const progress = `min(t/${duration}\\,1)`;
  const zoom = `(${startScale}+(${(endScale - startScale).toFixed(4)})*${progress})`;
  const cropW = `iw/${zoom}`;
  const cropH = `ih/${zoom}`;
  // Centre by default; drift by pan fraction of the available margin over the clip.
  const cropX = `(iw-iw/${zoom})*(0.5+${(panX / 2).toFixed(4)}*${progress})`;
  const cropY = `(ih-ih/${zoom})*(0.5+${(panY / 2).toFixed(4)}*${progress})`;
  return `crop=w=${cropW}:h=${cropH}:x=${cropX}:y=${cropY}`;
}

// Build the video-filter chain for a grade object (look + manual tweaks).
// Returns "" when nothing to apply.
export function buildGradeFilter(grade: EdlGrade): string {
  const parts: string[] = [];
  if (grade.look && FILM_LOOKS[grade.look]) parts.push(FILM_LOOKS[grade.look]);

  const hasManualEq =
    grade.brightness !== undefined ||
    grade.contrast !== undefined ||
    grade.saturation !== undefined ||
    grade.gamma !== undefined;
  if (hasManualEq) {
    const { brightness = 0, contrast = 1, saturation = 1, gamma = 1 } = grade;
    parts.push(
      `eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}:gamma=${gamma}`,
    );
  }
  if (grade.temperature === "warm") parts.push("colorbalance=rs=0.05:gs=0.02:bs=-0.05");
  else if (grade.temperature === "cool") parts.push("colorbalance=rs=-0.05:gs=-0.01:bs=0.05");

  return parts.join(",");
}

// "auto" → run autoGradeFilter per-segment (recommended default for footage).
// "none" → skip grading entirely.
// EdlGrade object → manual parameters.
export type EdlGradeSpec = EdlGrade | "auto" | "none";

// Background replacement for a segment — greenscreen (chroma key) the source and
// composite it over a new image/video background. The signature footage effect,
// made a first-class EDL treatment so "put me on a beach" is one conversational,
// undoable edit (talk → EDL → render → undo). Powers the persona use-case.
export interface EdlBackground {
  replaceWith: string; // relative asset path to the new background (image or video)
  chromaKey?: boolean; // true = key out a solid color first (greenscreen). Default true.
  color?: string; // key color hex, e.g. "00FF00" (green) or "0000FF" (blue). Default green.
  similarity?: number; // chroma similarity 0.01–1.0. Default 0.30.
  blend?: number; // chroma edge blend 0.0–1.0. Default 0.10.
}

// Keyframed camera move over a segment — the "edited" punch-in / Ken Burns push
// that used to be impossible on real footage in this FFmpeg pipeline. A smooth
// zoom (and optional pan) animated across the segment via a time-driven crop.
export interface EdlTransform {
  startScale?: number; // zoom at segment start. Default 1.0 (no zoom).
  endScale?: number; // zoom at segment end. Default = startScale (static hold).
  panX?: number; // horizontal drift over the segment, -1..1 (fraction of margin).
  panY?: number; // vertical drift over the segment, -1..1.
}

export interface EdlSegment {
  id?: string; // stable handle so chat can address a specific cut ("drop s3")
  source: string; // relative asset path
  start: number; // start time in source (seconds)
  end: number; // end time in source (seconds)
  beat?: string; // label e.g. "HOOK", "PROBLEM", "CTA"
  grade?: EdlGradeSpec;
  transform?: EdlTransform; // punch-in / Ken Burns push
  speed?: number; // default 1.0
  background?: EdlBackground; // replace the segment's background (greenscreen composite)
  // Cross-fade from this segment into the next one instead of a hard cut. The
  // two segments overlap by `duration`, shortening the output timeline — the
  // caption/offset math accounts for this automatically.
  transitionAfter?: { type: XfadeType; duration: number };
}

// Background music bed mixed under the whole edit. When duck is true (default),
// the music is side-chain compressed by the voice track so it drops ~10dB while
// anyone is talking and swells back in the gaps — the standard "music under
// narration" polish that otherwise takes manual keyframing.
export interface EdlMusic {
  file: string; // relative asset path to the music track
  gainDb?: number; // music level before ducking, dB. Default -12.
  duck?: boolean; // side-chain duck under voice. Default true.
}

export interface EdlOverlay {
  file: string; // relative asset path to animation/clip
  startInOutput: number; // when overlay appears in output timeline (seconds)
  duration: number; // how long overlay is visible (seconds)
  x?: number | "center";
  y?: number | "center";
  width?: number; // scale overlay to this pixel width
}

export interface EditDecisionList {
  version: 1;
  segments: EdlSegment[];
  overlays?: EdlOverlay[];
  captions?: CaptionCue[]; // applied LAST — Hard Rule 1
  captionStyle?: CaptionStyle; // default look for all captions (per-cue .style overrides)
  music?: EdlMusic; // background music bed, ducked under voice by default
  outputPath: string; // relative output path
  loudnorm?: boolean; // 2-pass -14 LUFS normalization on final output
  // "draft" → 480p / ultrafast / crf 28 for fast review cycles.
  // "final" (default) → 1080p / fast / crf 18. Render draft to check the cut,
  // then render once at final quality.
  quality?: "draft" | "final";
}

// ---------------------------------------------------------------------------
// computeSegmentOffsets / buildCaptionsFromWords
// Hard Rule 5: captions must use output-timeline timestamps, not source times.
// Call buildCaptionsFromWords after transcription to get correctly-timed cues.
// ---------------------------------------------------------------------------

export function computeSegmentOffsets(segments: EdlSegment[]): number[] {
  const offsets: number[] = [];
  let cumulative = 0;
  for (const seg of segments) {
    offsets.push(cumulative);
    cumulative += (seg.end - seg.start) / (seg.speed ?? 1);
    // A cross-fade after this segment overlaps it with the next by `duration`,
    // pulling every later segment (and its captions) earlier in the output.
    cumulative -= seg.transitionAfter?.duration ?? 0;
  }
  return offsets;
}

export function buildCaptionsFromWords(
  words: TranscriptWord[],
  segments: EdlSegment[],
  chunkSize = 2,
): CaptionCue[] {
  const offsets = computeSegmentOffsets(segments);
  const mapped: Array<{ text: string; outStart: number; outEnd: number }> = [];

  for (const word of words) {
    for (let segIdx = 0; segIdx < segments.length; segIdx++) {
      const seg = segments[segIdx];
      // Word must fall inside this segment's source window.
      if (word.start >= seg.start && word.end <= seg.end) {
        const speed = seg.speed ?? 1;
        const outStart = (word.start - seg.start) / speed + (offsets[segIdx] ?? 0);
        const outEnd = (word.end - seg.start) / speed + (offsets[segIdx] ?? 0);
        mapped.push({ text: word.word, outStart, outEnd });
        break;
      }
    }
    // Words outside all segments were cut — silently dropped.
  }

  const cues: CaptionCue[] = [];
  for (let index = 0; index < mapped.length; index += chunkSize) {
    const chunk = mapped.slice(index, index + chunkSize);
    const first = chunk[0];
    const last = chunk[chunk.length - 1];
    if (!first || !last) continue;
    cues.push({
      text: chunk.map((word) => word.text.trim().toUpperCase()).join(" "),
      start: first.outStart,
      end: last.outEnd,
    });
  }

  return cues;
}

// ---------------------------------------------------------------------------
// validateEdl — deterministic quality/correctness gate, run BEFORE render_edl.
// Turns the editing quality bar (short varied scenes, narrative arc, clean
// cuts, captions in range) from prompt prose into a programmatic check, so the
// plan→render→review loop becomes plan→lint→render. Pure + unit-testable.
// ---------------------------------------------------------------------------

export interface EdlValidationIssue {
  level: "error" | "warn";
  code: string;
  message: string;
}

export function validateEdl(
  edl: Pick<EditDecisionList, "segments" | "captions">,
  opts?: { words?: TranscriptWord[]; beats?: number[] },
): { ok: boolean; issues: EdlValidationIssue[] } {
  const issues: EdlValidationIssue[] = [];
  const segments = edl.segments ?? [];

  if (segments.length === 0) {
    issues.push({ level: "error", code: "no_segments", message: "EDL has no segments." });
    return { ok: false, issues };
  }

  // Per-segment window sanity + output durations.
  const durations: number[] = [];
  for (let index = 0; index < segments.length; index++) {
    const segment = segments[index];
    const duration = (segment.end - segment.start) / (segment.speed ?? 1);
    durations.push(duration);
    if (segment.end <= segment.start) {
      issues.push({
        level: "error",
        code: "bad_window",
        message: `Segment ${index} (${segment.source}) has end ≤ start (${segment.start}–${segment.end}s).`,
      });
    } else if (duration < 0.5) {
      issues.push({
        level: "warn",
        code: "too_short",
        message: `Segment ${index} is ${duration.toFixed(2)}s — under 0.5s reads as a glitch. Merge or extend.`,
      });
    }
  }

  // Pacing bar: 1.5–3.5s scenes ideal; long static shots kill momentum. Warn
  // (not error) since talking-head continuity legitimately runs longer.
  const longScenes = durations.filter((duration) => duration > 6).length;
  if (longScenes > 0) {
    issues.push({
      level: "warn",
      code: "long_scenes",
      message: `${longScenes} scene(s) exceed 6s. Cut them down, add b-roll, or a punch-in to keep pace.`,
    });
  }

  // Quality bar: 6+ varied scenes for a real narrative arc.
  if (segments.length < 6) {
    issues.push({
      level: "warn",
      code: "few_scenes",
      message: `Only ${segments.length} scenes. Target 6+ varied scenes for a narrative arc.`,
    });
  }

  // Accidental exact-duplicate cuts (same source + window reused verbatim).
  const seen = new Set<string>();
  for (let index = 0; index < segments.length; index++) {
    const key = `${segments[index].source}|${segments[index].start}|${segments[index].end}`;
    if (seen.has(key)) {
      issues.push({
        level: "warn",
        code: "duplicate_segment",
        message: `Segment ${index} duplicates an earlier identical cut (${segments[index].source} ${segments[index].start}–${segments[index].end}s). Intentional? Otherwise drop it.`,
      });
    }
    seen.add(key);
  }

  // Grade variety: a flat edit where every scene shares one grade looks amateur.
  const gradeKeys = new Set(segments.map((segment) => JSON.stringify(segment.grade ?? null)));
  if (segments.length >= 6 && gradeKeys.size <= 1) {
    issues.push({
      level: "warn",
      code: "flat_grade",
      message: `All ${segments.length} scenes share one grade. Vary grades (or use grade:'auto') so cuts feel intentional.`,
    });
  }

  // Narrative arc: beat labels (HOOK … CTA) present.
  const beats = segments.map((segment) => segment.beat ?? "").filter(Boolean);
  if (segments.length >= 4 && beats.length === 0) {
    issues.push({
      level: "warn",
      code: "no_beats",
      message:
        "No beat labels. Tag scenes (HOOK, PROBLEM, PROOF, CTA…) so the edit has a narrative arc.",
    });
  }

  // Captions must sit inside the output timeline. Cross-fades overlap adjacent
  // segments, so the real output is shorter than the sum of segment durations.
  const transitionOverlap = segments.reduce(
    (sum, segment) => sum + (segment.transitionAfter?.duration ?? 0),
    0,
  );
  const totalOutput =
    durations.reduce((sum, duration) => sum + Math.max(0, duration), 0) - transitionOverlap;
  const captions = edl.captions ?? [];
  for (let index = 0; index < captions.length; index++) {
    const cue = captions[index];
    if (cue.start < 0 || cue.end <= cue.start) {
      issues.push({
        level: "error",
        code: "bad_caption",
        message: `Caption ${index} ("${cue.text.slice(0, 24)}…") has an invalid window (${cue.start}–${cue.end}s).`,
      });
    } else if (cue.end > totalOutput + 0.5) {
      issues.push({
        level: "warn",
        code: "caption_past_end",
        message: `Caption ${index} ends at ${cue.end.toFixed(2)}s but the video is only ${totalOutput.toFixed(2)}s — rebuild with build_captions_from_words.`,
      });
    }
  }

  // Mid-word cuts (best-effort, only when a transcript is supplied). A boundary
  // that lands inside a spoken word sounds abrupt — snap it to a word gap.
  const words = opts?.words;
  if (words && words.length > 0) {
    const straddles = (boundary: number): TranscriptWord | undefined =>
      words.find((word) => word.start < boundary - 0.06 && word.end > boundary + 0.06);
    for (let index = 0; index < segments.length; index++) {
      const startWord = straddles(segments[index].start);
      if (startWord) {
        issues.push({
          level: "warn",
          code: "mid_word_cut",
          message: `Segment ${index} starts at ${segments[index].start}s, inside the word "${startWord.word}". Snap with snap_to_boundary.`,
        });
      }
      const endWord = straddles(segments[index].end);
      if (endWord) {
        issues.push({
          level: "warn",
          code: "mid_word_cut",
          message: `Segment ${index} ends at ${segments[index].end}s, inside the word "${endWord.word}". Snap with snap_to_boundary.`,
        });
      }
    }
  }

  // Beat sync (best-effort, only with a beat grid from detect_beats). When music
  // drives the edit, cuts that land off the beat feel loose. Flag output-timeline
  // cut points that miss every beat by more than ~120ms.
  const beatGrid = opts?.beats;
  if (beatGrid && beatGrid.length >= 4) {
    const offsets = computeSegmentOffsets(segments);
    let offCount = 0;
    // Skip the first cut (t=0) and check each interior segment start.
    for (let index = 1; index < offsets.length; index++) {
      const cut = offsets[index];
      const nearest = beatGrid.reduce(
        (best, beat) => Math.min(best, Math.abs(beat - cut)),
        Number.POSITIVE_INFINITY,
      );
      if (nearest > 0.12) offCount++;
    }
    if (offCount > 0) {
      issues.push({
        level: "warn",
        code: "off_beat_cuts",
        message: `${offCount} cut(s) don't land on a musical beat. With music, align cut points to detect_beats times for a tighter edit.`,
      });
    }
  }

  const ok = !issues.some((issue) => issue.level === "error");
  return { ok, issues };
}

// 2-pass loudness normalization (-14 LUFS / -1 dBTP / LRA 11).
// Pass 1 measures via loudnorm JSON output; pass 2 applies with linear=true.
// Falls back to single-pass if stderr parse fails.
async function applyLoudnorm(
  inputPath: string,
  outputPath: string,
): Promise<{ ok: boolean; error?: string }> {
  const pass1 = await ffmpegRunCapture([
    "-i",
    inputPath,
    "-af",
    "loudnorm=I=-14:TP=-1:LRA=11:print_format=json",
    "-f",
    "null",
    "/dev/null",
  ]);

  const jsonMatch = pass1.stderr.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
  if (!jsonMatch) {
    // Single-pass fallback
    return ffmpegRun([
      "-i",
      inputPath,
      "-af",
      "loudnorm=I=-14:TP=-1:LRA=11",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      outputPath,
    ]);
  }

  type LoudnormStats = {
    input_i: string;
    input_tp: string;
    input_lra: string;
    input_thresh: string;
    target_offset: string;
  };
  const stats = JSON.parse(jsonMatch[0]) as LoudnormStats;

  return ffmpegRun([
    "-i",
    inputPath,
    "-af",
    [
      `loudnorm=I=-14:TP=-1:LRA=11`,
      `measured_I=${stats.input_i}:measured_TP=${stats.input_tp}`,
      `measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}`,
      `offset=${stats.target_offset}:linear=true`,
    ].join(":"),
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    outputPath,
  ]);
}

// Cap a frame to fit within maxW×maxH WITHOUT upscaling smaller sources.
// Returns even dimensions (libx264 requires width/height divisible by 2).
// This is what keeps 4K sources from being re-encoded at native resolution —
// the #1 cause of render timeouts (a 4K x264 encode blows past the ffmpeg
// watchdog, which SIGTERMs it → ffmpeg exits 255 → a corrupt partial file).
export function fitWithin(
  w: number,
  h: number,
  maxW = 1920,
  maxH = 1080,
): { w: number; h: number } {
  if (!w || !h) return { w: maxW, h: maxH };
  const scale = Math.min(1, maxW / w, maxH / h);
  const nw = Math.max(2, Math.round((w * scale) / 2) * 2);
  const nh = Math.max(2, Math.round((h * scale) / 2) * 2);
  return { w: nw, h: nh };
}

// Concat-copy a run of format-identical segment files into one file (lossless).
async function concatCopyFiles(
  files: string[],
  outPath: string,
  tmpDir: string,
): Promise<{ ok: boolean; error?: string }> {
  if (files.length === 1) {
    return ffmpegRun(["-i", files[0], "-c", "copy", "-f", "mp4", outPath]);
  }
  const listPath = join(tmpDir, `cc_${randomBytes(4).toString("hex")}.txt`);
  writeFileSync(listPath, files.map((p) => `file '${p}'`).join("\n"));
  return ffmpegRun(["-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outPath]);
}

// Assemble segments where some seams are cross-fades. Runs of hard-cut segments
// are concat-copied into blocks; the blocks are then chained with xfade (video)
// + acrossfade (audio). All segments share the canonical format, which is what
// xfade requires. Cross-fades overlap adjacent blocks by `duration`, so the
// output timeline shortens — matched by computeSegmentOffsets.
async function assembleWithTransitions(opts: {
  segmentPaths: string[];
  transitions: Array<{ type: XfadeType; duration: number } | undefined>;
  tmpDir: string;
  preset: string;
  crf: string;
}): Promise<{ ok: boolean; path?: string; error?: string }> {
  const { segmentPaths, transitions, tmpDir, preset, crf } = opts;

  // Partition into blocks separated by real (duration > 0) transitions.
  const blocks: string[][] = [];
  const between: Array<{ type: XfadeType; duration: number }> = [];
  let current: string[] = [];
  for (let index = 0; index < segmentPaths.length; index++) {
    current.push(segmentPaths[index]);
    const transition = transitions[index];
    const isLast = index === segmentPaths.length - 1;
    if (!isLast && transition && transition.duration > 0) {
      blocks.push(current);
      between.push(transition);
      current = [];
    }
  }
  if (current.length > 0) blocks.push(current);

  // Concat-copy each block into a single file.
  const blockFiles: string[] = [];
  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const blockFile = join(tmpDir, `block_${blockIndex}.mp4`);
    const result = await concatCopyFiles(blocks[blockIndex], blockFile, tmpDir);
    if (!result.ok) return { ok: false, error: result.error };
    blockFiles.push(blockFile);
  }

  if (blockFiles.length === 1) return { ok: true, path: blockFiles[0] };

  // Probe real block durations for xfade offsets.
  const blockDurations: number[] = [];
  for (const blockFile of blockFiles) {
    const info = await probeClip(blockFile);
    blockDurations.push(info.durationSeconds);
  }

  // Clamp each transition to fit inside the shorter adjacent block.
  const clamped = between.map((transition, index) => {
    const maxDuration = Math.max(
      0.1,
      Math.min(blockDurations[index], blockDurations[index + 1]) - 0.05,
    );
    return { type: transition.type, duration: Math.min(transition.duration, maxDuration) };
  });

  // Chain xfade (video, needs an absolute offset) + acrossfade (audio, aligns at
  // the junction automatically). The accumulator timeline runs continuously
  // from 0, so each offset is (accumulated length so far) − transition duration.
  const inputArgs: string[] = [];
  for (const blockFile of blockFiles) inputArgs.push("-i", blockFile);

  const videoParts: string[] = [];
  const audioParts: string[] = [];
  let videoLabel = "[0:v]";
  let audioLabel = "[0:a]";
  let accumulatedLength = blockDurations[0];

  for (let index = 0; index < clamped.length; index++) {
    const transition = clamped[index];
    const isFinal = index === clamped.length - 1;
    const nextVideo = `[${index + 1}:v]`;
    const nextAudio = `[${index + 1}:a]`;
    const videoOut = isFinal ? "[vout]" : `[vx${index}]`;
    const audioOut = isFinal ? "[aout]" : `[ax${index}]`;
    const offset = Math.max(0, accumulatedLength - transition.duration);
    videoParts.push(
      `${videoLabel}${nextVideo}xfade=transition=${transition.type}:duration=${transition.duration.toFixed(3)}:offset=${offset.toFixed(3)}${videoOut}`,
    );
    audioParts.push(
      `${audioLabel}${nextAudio}acrossfade=d=${transition.duration.toFixed(3)}${audioOut}`,
    );
    videoLabel = videoOut;
    audioLabel = audioOut;
    accumulatedLength += blockDurations[index + 1] - transition.duration;
  }

  const outPath = join(tmpDir, "transitioned.mp4");
  const timeout = Math.max(300_000, Math.ceil(accumulatedLength) * 10_000);
  const result = await ffmpegRun(
    [
      ...inputArgs,
      "-filter_complex",
      [...videoParts, ...audioParts].join(";"),
      "-map",
      "[vout]",
      "-map",
      "[aout]",
      "-c:v",
      "libx264",
      "-preset",
      preset,
      "-crf",
      crf,
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-ar",
      "48000",
      "-ac",
      "2",
      "-f",
      "mp4",
      outPath,
    ],
    timeout,
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, path: outPath };
}

export async function renderEdl(opts: {
  edl: EditDecisionList;
  projectRootDir: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { edl, projectRootDir: dir } = opts;
  const outputPath = resolveProjectPath(dir, edl.outputPath);
  ensureParentDir(outputPath);
  // Write the final file to a sibling temp, then atomically rename — so a slow
  // render that gets killed mid-write can never leave a corrupt output in place.
  const outTmp = `${outputPath}.part`;

  const tmpDir = join(tmpdir(), `vibe_edl_${randomBytes(6).toString("hex")}`);
  mkdirSync(tmpDir, { recursive: true });

  try {
    // Draft vs final quality knobs. Draft trades resolution/quality for a fast
    // look at the cut during review; final is the deliverable.
    const isDraft = edl.quality === "draft";
    const preset = isDraft ? "ultrafast" : "fast";
    const crf = isDraft ? "28" : "18";
    const maxW = isDraft ? 854 : 1920;
    const maxH = isDraft ? 480 : 1080;

    // ----------------------------------------------------------------
    // Canonical output format — computed ONCE, applied to EVERY segment.
    // Stream-copy-concatenating h264 segments that differ in resolution, fps,
    // SAR, or audio-stream presence is the classic cause of black frames,
    // frozen seams, and A/V desync at cut boundaries. Conforming every segment
    // to one identical format is the fix. Canvas aspect follows the
    // largest-area source, capped to the quality ceiling; other segments are
    // letterboxed/pillarboxed into it.
    // ----------------------------------------------------------------
    const probes = await Promise.all(
      edl.segments.map((seg) => probeClip(resolveProjectPath(dir, seg.source))),
    );
    let canvasSrc = probes[0];
    for (const probe of probes) {
      if (probe.width * probe.height > canvasSrc.width * canvasSrc.height) canvasSrc = probe;
    }
    const canvas = fitWithin(canvasSrc.width, canvasSrc.height, maxW, maxH);
    const targetW = canvas.w;
    const targetH = canvas.h;
    const targetFps = 30;
    // Appended to every segment's video chain so all outputs are byte-compatible
    // for concat: fit inside the canvas, pad to exact WxH, square pixels,
    // constant fps, 4:2:0.
    const normalizeVf = `scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${targetFps},format=yuv420p`;
    // anullsrc gives silent segments a real audio stream so every segment has
    // matching audio params (concat requires uniform stream presence).
    const silentAudioInput = "anullsrc=channel_layout=stereo:sample_rate=48000";

    // ----------------------------------------------------------------
    // Step 1: Per-segment extract with grade + speed + 30ms audio fades,
    // conformed to the canonical format. Segments are independent, so encode
    // them with bounded concurrency.
    // ----------------------------------------------------------------
    const segmentPaths: string[] = edl.segments.map((_, index) => join(tmpDir, `seg_${index}.mp4`));

    const encodeSegment = async (index: number): Promise<{ ok: boolean; error?: string }> => {
      const segment = edl.segments[index];
      const sourcePath = resolveProjectPath(dir, segment.source);
      const segPath = segmentPaths[index];
      const info = probes[index];
      const segDuration = segment.end - segment.start;
      const fadeOutStart = Math.max(0, segDuration - 0.03).toFixed(3);

      // Video filter chain: grade → speed → normalize (normalize LAST so every
      // segment ends at exactly targetW×targetH / targetFps / yuv420p).
      const vfParts: string[] = [];
      if (segment.grade === "auto") {
        const autoFilter = await autoGradeFilter(sourcePath);
        if (autoFilter) vfParts.push(autoFilter);
      } else if (segment.grade && segment.grade !== "none") {
        const gradeFilter = buildGradeFilter(segment.grade);
        if (gradeFilter) vfParts.push(gradeFilter);
      }
      if (segment.transform) {
        const transformFilter = buildTransformFilter(segment.transform, segDuration);
        if (transformFilter) vfParts.push(transformFilter);
      }
      if (segment.speed && segment.speed !== 1) {
        vfParts.push(`setpts=${(1 / segment.speed).toFixed(6)}*PTS`);
      }

      const audioFadeFilter = (): string => {
        let af = `afade=t=in:st=0:d=0.03,afade=t=out:st=${fadeOutStart}:d=0.03`;
        if (segment.speed && segment.speed !== 1) af += `,${buildAtempo(segment.speed)}`;
        return af;
      };

      let args: string[];
      if (segment.background?.replaceWith) {
        // Background replacement: chroma-key the source (greenscreen) and
        // composite the keyed foreground over a new image/video background.
        const bg = segment.background;
        const bgPath = resolveProjectPath(dir, bg.replaceWith);
        const isBgImage = /\.(png|jpe?g|gif|webp|avif|bmp)$/i.test(bg.replaceWith);
        const useKey = bg.chromaKey ?? true;
        const color = (bg.color ?? "00FF00").replace(/^#/, "");
        const similarity = bg.similarity ?? 0.3;
        const blend = bg.blend ?? 0.1;

        // Foreground: grade/speed (vfParts) → chroma key → fit to canvas.
        const fgFilters = [...vfParts];
        if (useKey) fgFilters.push(`chromakey=0x${color}:${similarity}:${blend}`);
        fgFilters.push(`scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease`);
        // Background: cover the frame (scale up + center-crop), square pixels.
        const bgChain = `[1:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH},setsar=1[bg]`;
        // overlay shortest=1 bounds output to the foreground length (handles speed
        // changes + looped image backgrounds without a duration mismatch). The
        // trailing normalize makes this segment concat-compatible.
        let filterComplex = `[0:v]${fgFilters.join(",")}[fg];${bgChain};[bg][fg]overlay=(W-w)/2:(H-h)/2:shortest=1,setsar=1,fps=${targetFps},format=yuv420p[v]`;

        args = ["-ss", String(segment.start), "-t", String(segDuration), "-i", sourcePath];
        if (isBgImage) args.push("-loop", "1", "-i", bgPath);
        else args.push("-i", bgPath);

        const maps = ["-map", "[v]"];
        if (info.hasAudio) {
          filterComplex += `;[0:a]${audioFadeFilter()}[a]`;
          maps.push("-map", "[a]");
        } else {
          // input 2 = silent stereo track (inputs 0=source, 1=background).
          args.push("-f", "lavfi", "-i", silentAudioInput);
          maps.push("-map", "2:a", "-shortest");
        }
        args.push("-filter_complex", filterComplex, ...maps);
        args.push("-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2");
        args.push("-c:v", "libx264", "-preset", preset, "-crf", crf, segPath);
      } else {
        vfParts.push(normalizeVf);
        args = ["-ss", String(segment.start), "-t", String(segDuration), "-i", sourcePath];
        if (info.hasAudio) {
          args.push("-vf", vfParts.join(","), "-af", audioFadeFilter());
          args.push("-map", "0:v:0", "-map", "0:a:0");
        } else {
          // input 1 = silent stereo track for a source with no audio.
          args.push("-f", "lavfi", "-i", silentAudioInput);
          args.push("-vf", vfParts.join(","));
          args.push("-map", "0:v:0", "-map", "1:a:0", "-shortest");
        }
        args.push("-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2");
        args.push("-c:v", "libx264", "-preset", preset, "-crf", crf, segPath);
      }

      // Scale the watchdog with clip length (~8s of budget per source-second),
      // floored at 3 min, so long legitimate encodes aren't killed mid-write.
      const segTimeout = Math.max(180_000, Math.ceil(segDuration) * 8_000);
      const segResult = await ffmpegRun(args, segTimeout);
      if (!segResult.ok) {
        return {
          ok: false,
          error: `Segment ${index} (${segment.source} ${segment.start}–${segment.end}s): ${segResult.error}`,
        };
      }
      return { ok: true };
    };

    // Bounded concurrency: x264 is already multi-threaded, so cap at 2 to
    // overlap process startup / I/O without oversubscribing the shared box.
    const ENCODE_CONCURRENCY = 2;
    for (let batchStart = 0; batchStart < edl.segments.length; batchStart += ENCODE_CONCURRENCY) {
      const batch: Array<Promise<{ ok: boolean; error?: string }>> = [];
      for (
        let index = batchStart;
        index < Math.min(batchStart + ENCODE_CONCURRENCY, edl.segments.length);
        index++
      ) {
        batch.push(encodeSegment(index));
      }
      const results = await Promise.all(batch);
      const failed = results.find((result) => !result.ok);
      if (failed) return failed;
    }

    // ----------------------------------------------------------------
    // Step 2: Assemble segments — hard-cut concat (fast, lossless) unless any
    // segment declares a transitionAfter, in which case runs of hard cuts are
    // concat-copied into blocks and the blocks are cross-faded together.
    // ----------------------------------------------------------------
    let currentPath: string;
    const transitions = edl.segments.map((seg) => seg.transitionAfter);
    const hasTransitions = transitions.some((t) => t && t.duration > 0);

    if (!hasTransitions) {
      const concatListPath = join(tmpDir, "concat.txt");
      writeFileSync(concatListPath, segmentPaths.map((p) => `file '${p}'`).join("\n"));
      if (segmentPaths.length === 1) {
        currentPath = segmentPaths[0];
      } else {
        currentPath = join(tmpDir, "concat.mp4");
        const concatResult = await ffmpegRun([
          "-f",
          "concat",
          "-safe",
          "0",
          "-i",
          concatListPath,
          "-c",
          "copy",
          currentPath,
        ]);
        if (!concatResult.ok) return concatResult;
      }
    } else {
      const assembled = await assembleWithTransitions({
        segmentPaths,
        transitions,
        tmpDir,
        preset,
        crf,
      });
      if (!assembled.ok || !assembled.path) {
        return { ok: false, error: assembled.error ?? "transition assembly failed" };
      }
      currentPath = assembled.path;
    }

    // ----------------------------------------------------------------
    // Step 3: Overlays with PTS shift (Hard Rule 4)
    // ----------------------------------------------------------------
    if (edl.overlays && edl.overlays.length > 0) {
      const overlaidPath = join(tmpDir, "overlaid.mp4");
      const inputArgs: string[] = ["-i", currentPath];
      const filterParts: string[] = [];
      let prevLabel = "[0:v]";

      for (let index = 0; index < edl.overlays.length; index++) {
        const overlay = edl.overlays[index];
        const overlayPath = resolveProjectPath(dir, overlay.file);
        inputArgs.push("-i", overlayPath);

        const ovIdx = index + 1;
        const xExpr = overlay.x === "center" ? "(W-w)/2" : String(overlay.x ?? 0);
        const yExpr = overlay.y === "center" ? "(H-h)/2" : String(overlay.y ?? 0);
        const endAt = overlay.startInOutput + overlay.duration;

        // PTS shift so overlay frame 0 = startInOutput in output timeline
        let ovChain = `[${ovIdx}:v]setpts=PTS-STARTPTS+(${overlay.startInOutput}/TB)`;
        if (overlay.width) ovChain += `,scale=${overlay.width}:-1`;
        const ovLabel = `[ov${index}]`;
        filterParts.push(`${ovChain}${ovLabel}`);

        const outLabel = `[v${index}]`;
        filterParts.push(
          `${prevLabel}${ovLabel}overlay=${xExpr}:${yExpr}:enable='between(t,${overlay.startInOutput},${endAt})'${outLabel}`,
        );
        prevLabel = outLabel;
      }

      // Rename the last video label to [vout]
      const lastFilter = filterParts[filterParts.length - 1];
      filterParts[filterParts.length - 1] = lastFilter.replace(/\[v\d+\]$/, "[vout]");

      const overlayResult = await ffmpegRun([
        ...inputArgs,
        "-filter_complex",
        filterParts.join(";"),
        "-map",
        "[vout]",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-preset",
        preset,
        "-crf",
        crf,
        "-c:a",
        "copy",
        overlaidPath,
      ]);
      if (!overlayResult.ok) return overlayResult;
      currentPath = overlaidPath;
    }

    // ----------------------------------------------------------------
    // Step 4: Burn captions LAST (Hard Rule 1)
    // ----------------------------------------------------------------
    if (edl.captions && edl.captions.length > 0) {
      // Styled ASS captions (libass) — presets + per-cue word-pop, sized to the
      // canonical canvas so positioning/scale are exact.
      const assPath = join(tmpDir, "master.ass");
      writeFileSync(
        assPath,
        buildAssContent(edl.captions, {
          videoWidth: targetW,
          videoHeight: targetH,
          defaultStyle: edl.captionStyle,
        }),
        "utf8",
      );

      const escapedAss = assPath.replace(/\\/g, "/").replace(/:/g, "\\:");

      const captionResult = await ffmpegRun([
        "-i",
        currentPath,
        "-vf",
        `subtitles=${escapedAss}`,
        "-c:v",
        "libx264",
        "-preset",
        preset,
        "-crf",
        crf,
        "-c:a",
        "copy",
        // Force the container: the atomic temp name ends in ".part", which
        // ffmpeg can't map to a muxer by extension.
        "-f",
        "mp4",
        outTmp,
      ]);
      if (!captionResult.ok) return captionResult;
    } else {
      // No captions: copy current to the temp output path (force mp4 muxer —
      // the ".part" extension is not a recognized container).
      const copyResult = await ffmpegRun(["-i", currentPath, "-c", "copy", "-f", "mp4", outTmp]);
      if (!copyResult.ok) return copyResult;
    }

    // ----------------------------------------------------------------
    // Step 4.5: Background music bed, ducked under voice
    // ----------------------------------------------------------------
    if (edl.music?.file) {
      const musicPath = resolveProjectPath(dir, edl.music.file);
      const gainDb = edl.music.gainDb ?? -12;
      const duck = edl.music.duck ?? true;
      const musicMixed = join(tmpDir, "music_mixed.mp4");

      // [0:a] = the edit's voice/source audio, [1:a] = the looped music bed.
      // Ducking: side-chain compress the music using the voice as the key, then
      // mix the (compressed) music back under the untouched voice. amix
      // duration=first bounds the output to the video length.
      const filter = duck
        ? `[1:a]volume=${gainDb}dB[m];[m][0:a]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=350[md];[0:a][md]amix=inputs=2:duration=first:normalize=0[aout]`
        : `[1:a]volume=${gainDb}dB[m];[0:a][m]amix=inputs=2:duration=first:normalize=0[aout]`;

      const musicResult = await ffmpegRun([
        "-i",
        outTmp,
        "-stream_loop",
        "-1",
        "-i",
        musicPath,
        "-filter_complex",
        filter,
        "-map",
        "0:v",
        "-map",
        "[aout]",
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-f",
        "mp4",
        musicMixed,
      ]);
      if (!musicResult.ok) return musicResult;
      // Replace the temp output with the music-mixed version.
      const replaceMusic = await ffmpegRun(["-i", musicMixed, "-c", "copy", "-f", "mp4", outTmp]);
      if (!replaceMusic.ok) return replaceMusic;
    }

    // ----------------------------------------------------------------
    // Step 5: Loudness normalization (-14 LUFS social standard)
    // Runs 2-pass on the temp file and overwrites it in place.
    // ----------------------------------------------------------------
    if (edl.loudnorm) {
      const normalizedPath = join(tmpDir, "normalized.mp4");
      const normResult = await applyLoudnorm(outTmp, normalizedPath);
      if (!normResult.ok) return normResult;
      // Overwrite the temp output with the normalized version (force mp4 muxer
      // — ".part" is not a recognized container extension).
      const replaceResult = await ffmpegRun([
        "-i",
        normalizedPath,
        "-c",
        "copy",
        "-f",
        "mp4",
        outTmp,
      ]);
      if (!replaceResult.ok) return replaceResult;
    }

    // Atomically publish the finished render (same-filesystem rename), so a
    // consumer never sees a half-written file.
    renameSync(outTmp, outputPath);
    return { ok: true };
  } finally {
    try {
      if (existsSync(outTmp)) rmSync(outTmp, { force: true });
    } catch {
      // ignore — partial temp cleanup
    }
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}

// ---------------------------------------------------------------------------
// extractClipFrames — visual analysis: extract N evenly-spaced frames as PNG
// Returns base64-encoded PNG strings so the agent can inspect footage before
// making editing decisions (give agent eyes).
// ---------------------------------------------------------------------------

// Extract one JPEG (base64) per timestamp. Shared by even-spacing and
// cut-boundary extractors. JPEG at 360px wide keeps each frame ~30–60 KB.
async function framesAtTimestamps(filePath: string, timestamps: number[]): Promise<string[]> {
  const frames: string[] = [];
  for (const ts of timestamps) {
    const tmpJpg = tmpFile(".jpg");
    const result = await ffmpegRun([
      "-ss",
      String(Math.max(0, ts)),
      "-i",
      filePath,
      "-vframes",
      "1",
      "-vf",
      "scale=360:-2",
      "-q:v",
      "6",
      "-f",
      "image2",
      tmpJpg,
    ]);
    if (result.ok && existsSync(tmpJpg)) {
      try {
        frames.push(readFileSync(tmpJpg).toString("base64"));
      } catch {
        // skip this frame on read error
      } finally {
        try {
          unlinkSync(tmpJpg);
        } catch {
          /* ignore */
        }
      }
    }
  }
  return frames;
}

export async function extractClipFrames(
  filePath: string,
  count: number = 3,
): Promise<{ frames: string[]; error?: string }> {
  if (!existsSync(filePath)) return { frames: [], error: `file not found: ${filePath}` };

  const info = await probeClip(filePath).catch(() => null);
  if (!info) return { frames: [], error: "could not probe clip" };

  // Hard-cap at 4 frames regardless of caller request. Each JPEG frame
  // is ~40–80 KB base64; beyond 4 the total payload risks the proxy limit.
  const capped = Math.min(count, 4);
  const step = info.durationSeconds / (capped + 1);
  const timestamps = Array.from({ length: capped }, (_, index) =>
    Number(((index + 1) * step).toFixed(3)),
  );
  const frames = await framesAtTimestamps(filePath, timestamps);
  return frames.length > 0 ? { frames } : { frames: [], error: "no frames extracted" };
}

// Extract frames at explicit timestamps (clamped, de-duped, capped at 4) — used
// to inspect cut boundaries in a rendered EDL, where black frames / jump cuts /
// dropped captions show up the instant after a cut.
export async function extractFramesAt(
  filePath: string,
  timestamps: number[],
): Promise<{ frames: string[]; usedTimestamps: number[]; error?: string }> {
  if (!existsSync(filePath))
    return { frames: [], usedTimestamps: [], error: `file not found: ${filePath}` };
  const info = await probeClip(filePath).catch(() => null);
  if (!info) return { frames: [], usedTimestamps: [], error: "could not probe clip" };
  const max = Math.max(0, info.durationSeconds - 0.05);
  const uniq = [...new Set(timestamps.map((t) => Number(Math.max(0, Math.min(max, t)).toFixed(3))))]
    .sort((a, b) => a - b)
    .slice(0, 4);
  const frames = await framesAtTimestamps(filePath, uniq);
  return frames.length > 0
    ? { frames, usedTimestamps: uniq }
    : { frames: [], usedTimestamps: uniq, error: "no frames extracted" };
}

// ---------------------------------------------------------------------------
// detectFillerWords — identify filler words + long-pause hesitations
// Pure logic over TranscriptWord[]; no FFmpeg needed.
// ---------------------------------------------------------------------------

const FILLER_SET = new Set([
  "um",
  "uh",
  "like",
  "you know",
  "actually",
  "basically",
  "literally",
  "so",
  "right",
  "okay",
  "ok",
  "well",
  "hmm",
  "yeah",
  "yep",
  "kinda",
  "kind of",
  "sort of",
  "i mean",
  "i guess",
]);

export interface FillerWordResult {
  word: string;
  start: number;
  end: number;
  // "filler_word": matched known filler list
  // "long_pause_before": >300ms silence before word (likely hesitation)
  reason: "filler_word" | "long_pause_before";
}

export function detectFillerWords(
  words: TranscriptWord[],
  opts?: { pauseThresholdSeconds?: number },
): FillerWordResult[] {
  const pauseThreshold = opts?.pauseThresholdSeconds ?? 0.3;
  const results: FillerWordResult[] = [];

  for (let index = 0; index < words.length; index++) {
    const current = words[index];
    if (!current) continue;
    const text = current.word
      .toLowerCase()
      .trim()
      .replace(/[.,!?;:]+$/, "");

    if (FILLER_SET.has(text)) {
      results.push({
        word: current.word,
        start: current.start,
        end: current.end,
        reason: "filler_word",
      });
      continue;
    }

    if (index > 0) {
      const previous = words[index - 1];
      if (previous && current.start - previous.end >= pauseThreshold) {
        results.push({
          word: current.word,
          start: current.start,
          end: current.end,
          reason: "long_pause_before",
        });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// applyNoiseReduction — FFmpeg anlmdn filter for background hiss/hum removal
// strength: 0–1 (default 0.5). Higher = more aggressive.
// ---------------------------------------------------------------------------

export async function applyNoiseReduction(opts: {
  inputPath: string;
  outputPath: string;
  strength?: number;
}): Promise<{ ok: boolean; error?: string }> {
  ensureParentDir(opts.outputPath);
  // anlmdn p: smaller value = more aggressive. Map strength 0→1 to p 0.002→0.0001.
  const strength = Math.max(0, Math.min(1, opts.strength ?? 0.5));
  const p = (0.002 - strength * 0.0019).toFixed(6);
  return ffmpegRun([
    "-i",
    opts.inputPath,
    "-af",
    `anlmdn=s=7:p=${p}:r=0.002:m=15`,
    "-c:v",
    "copy",
    opts.outputPath,
  ]);
}

// ---------------------------------------------------------------------------
// analyzePacing — speech rate and pause analysis for cut-density guidance
// ---------------------------------------------------------------------------

export interface BeatDetectionResult {
  beats: number[];
  bpm: number | null;
}

// Detect approximate beat positions in an audio file using per-frame momentary
// loudness (ebur128). Peaks in the loudness curve correlate with transient hits
// (kick drums, snare, heavy chord changes) — good enough for aligning scene
// cuts without a dedicated beat-tracking library.
export async function detectBeats(opts: {
  filePath: string;
  minIntervalSeconds?: number;
  maxBeats?: number;
}): Promise<BeatDetectionResult> {
  const { filePath, minIntervalSeconds = 0.35, maxBeats = 80 } = opts;

  const result = await ffmpegRunCapture(
    ["-i", filePath, "-filter:a", "ebur128=framelog=verbose", "-f", "null", "-"],
    120_000,
  );

  const frames: { t: number; m: number }[] = [];
  for (const line of result.stderr.split("\n")) {
    const match = line.match(/t:\s*([\d.]+).*?M:\s*(-?[\d.]+)/);
    if (match) {
      const t = parseFloat(match[1]);
      const m = parseFloat(match[2]);
      if (!isNaN(t) && !isNaN(m) && isFinite(m)) {
        frames.push({ t, m });
      }
    }
  }

  if (frames.length < 5) return { beats: [], bpm: null };

  const mVals = frames.map((frame) => frame.m);
  const finite = mVals.filter((v) => isFinite(v));
  if (finite.length === 0) return { beats: [], bpm: null };
  const maxM = Math.max(...finite);
  const minM = Math.min(...finite);
  // Only consider frames in the top 40% of the loudness range.
  const threshold = minM + (maxM - minM) * 0.6;
  const window = 3; // ±3 frames at ~0.1s per frame = ±0.3s context

  const beats: number[] = [];
  for (let i = window; i < frames.length - window; i++) {
    const { t, m } = frames[i];
    if (!isFinite(m) || m < threshold) continue;
    let isPeak = true;
    for (let j = i - window; j <= i + window; j++) {
      if (j !== i && isFinite(mVals[j]) && mVals[j] > m) {
        isPeak = false;
        break;
      }
    }
    if (isPeak) {
      if (beats.length === 0 || t - beats[beats.length - 1] >= minIntervalSeconds) {
        beats.push(Math.round(t * 100) / 100);
      }
    }
  }

  let bpm: number | null = null;
  if (beats.length >= 4) {
    const intervals: number[] = [];
    for (let i = 1; i < Math.min(beats.length, 16); i++) {
      intervals.push(beats[i] - beats[i - 1]);
    }
    const avg = intervals.reduce((a, b) => a + b) / intervals.length;
    bpm = Math.round(60 / avg);
  }

  return { beats: beats.slice(0, maxBeats), bpm };
}

export interface PacingReport {
  wordsPerMinute: number;
  avgWordDuration: number;
  pauseCount: number;
  avgPauseDuration: number;
  longPauses: Array<{ start: number; end: number; duration: number }>;
  recommendation: string;
}

export function analyzePacing(words: TranscriptWord[], totalDuration: number): PacingReport {
  if (words.length === 0) {
    return {
      wordsPerMinute: 0,
      avgWordDuration: 0,
      pauseCount: 0,
      avgPauseDuration: 0,
      longPauses: [],
      recommendation: "No transcript data. Transcribe the clip first.",
    };
  }

  const minutes = totalDuration / 60;
  const wordsPerMinute = Math.round(words.length / Math.max(0.01, minutes));
  const avgWordDuration =
    words.reduce((sum, word) => sum + (word.end - word.start), 0) / words.length;

  const pauses: Array<{ start: number; end: number; duration: number }> = [];
  for (let index = 1; index < words.length; index++) {
    const gap = (words[index]?.start ?? 0) - (words[index - 1]?.end ?? 0);
    if (gap >= 0.15) {
      pauses.push({
        start: words[index - 1]?.end ?? 0,
        end: words[index]?.start ?? 0,
        duration: gap,
      });
    }
  }

  const longPauses = pauses.filter((pause) => pause.duration >= 0.5);
  const avgPauseDuration =
    pauses.length > 0 ? pauses.reduce((sum, p) => sum + p.duration, 0) / pauses.length : 0;

  let pace = "Medium-paced";
  if (wordsPerMinute > 170) pace = "Fast-paced";
  else if (wordsPerMinute < 110) pace = "Slow-paced";

  const cutPoints =
    longPauses.length > 0
      ? `${longPauses.length} long pause${longPauses.length === 1 ? "" : "s"} — good cut points at ${longPauses
          .slice(0, 3)
          .map((p) => `${p.start.toFixed(1)}s`)
          .join(", ")}.`
      : "No natural pause points — cuts will fall mid-sentence.";

  return {
    wordsPerMinute,
    avgWordDuration: Number(avgWordDuration.toFixed(3)),
    pauseCount: pauses.length,
    avgPauseDuration: Number(avgPauseDuration.toFixed(3)),
    longPauses,
    recommendation: `${pace} (${wordsPerMinute} WPM). ${cutPoints}`,
  };
}
