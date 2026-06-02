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
  | "circlecrop"
  | "dissolve";

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

// ---------------------------------------------------------------------------
// burn_captions
// ---------------------------------------------------------------------------

export interface CaptionCue {
  text: string;
  start: number;
  end: number;
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
// transcribe_clip  (OpenAI Whisper — BYOK)
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

    const formData = new FormData();
    formData.append("file", blob, "audio.mp3");
    formData.append("model", "whisper-1");
    formData.append("response_format", "verbose_json");
    formData.append("timestamp_granularities[]", "word");
    if (opts.language) formData.append("language", opts.language);

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${opts.apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        ok: false,
        error: `Whisper API ${response.status}: ${text.slice(0, 400)}`,
      };
    }

    type WhisperWord = { word: string; start: number; end: number };
    type WhisperResponse = { text: string; words?: WhisperWord[] };
    const data = (await response.json()) as WhisperResponse;

    const words: TranscriptWord[] = (data.words ?? []).map((word) => ({
      word: word.word,
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

export interface EdlGrade {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  gamma?: number;
  temperature?: "warm" | "cool" | "neutral";
}

// "auto" → run autoGradeFilter per-segment (recommended default for footage).
// "none" → skip grading entirely.
// EdlGrade object → manual parameters.
export type EdlGradeSpec = EdlGrade | "auto" | "none";

export interface EdlSegment {
  source: string; // relative asset path
  start: number; // start time in source (seconds)
  end: number; // end time in source (seconds)
  beat?: string; // label e.g. "HOOK", "PROBLEM", "CTA"
  grade?: EdlGradeSpec;
  speed?: number; // default 1.0
  // J/L cut support: audio bleeds across hard video cuts for natural pacing.
  // audioLeadSeconds: next segment's audio starts this many seconds early.
  // audioTrailSeconds: this segment's audio continues into the next segment.
  audioLeadSeconds?: number;
  audioTrailSeconds?: number;
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
  outputPath: string; // relative output path
  loudnorm?: boolean; // 2-pass -14 LUFS normalization on final output
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

export async function renderEdl(opts: {
  edl: EditDecisionList;
  projectRootDir: string;
}): Promise<{ ok: boolean; error?: string }> {
  const { edl, projectRootDir: dir } = opts;
  const outputPath = resolveProjectPath(dir, edl.outputPath);
  ensureParentDir(outputPath);

  const tmpDir = join(tmpdir(), `vibe_edl_${randomBytes(6).toString("hex")}`);
  mkdirSync(tmpDir, { recursive: true });

  try {
    // ----------------------------------------------------------------
    // Step 1: Per-segment extract with grade + 30ms audio fades
    // ----------------------------------------------------------------
    const segmentPaths: string[] = [];

    for (let index = 0; index < edl.segments.length; index++) {
      const segment = edl.segments[index];
      const sourcePath = resolveProjectPath(dir, segment.source);
      const segPath = join(tmpDir, `seg_${index}.mp4`);
      segmentPaths.push(segPath);

      const info = await probeClip(sourcePath);
      const segDuration = segment.end - segment.start;
      const fadeOutStart = Math.max(0, segDuration - 0.03).toFixed(3);

      // Build video filter chain
      const vfParts: string[] = [];
      if (segment.grade === "auto") {
        const autoFilter = await autoGradeFilter(sourcePath);
        if (autoFilter) vfParts.push(autoFilter);
      } else if (segment.grade && segment.grade !== "none") {
        const { brightness = 0, contrast = 1, saturation = 1, gamma = 1 } = segment.grade;
        vfParts.push(
          `eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}:gamma=${gamma}`,
        );
        if (segment.grade.temperature === "warm") {
          vfParts.push("colorbalance=rs=0.05:gs=0.02:bs=-0.05");
        } else if (segment.grade.temperature === "cool") {
          vfParts.push("colorbalance=rs=-0.05:gs=-0.01:bs=0.05");
        }
      }
      if (segment.speed && segment.speed !== 1) {
        vfParts.push(`setpts=${(1 / segment.speed).toFixed(6)}*PTS`);
      }

      const args = ["-ss", String(segment.start), "-t", String(segDuration), "-i", sourcePath];

      if (vfParts.length > 0) args.push("-vf", vfParts.join(","));

      if (info.hasAudio) {
        let audioFilter = `afade=t=in:st=0:d=0.03,afade=t=out:st=${fadeOutStart}:d=0.03`;
        if (segment.speed && segment.speed !== 1) {
          audioFilter += `,${buildAtempo(segment.speed)}`;
        }
        args.push("-af", audioFilter, "-c:a", "aac", "-b:a", "192k");
      } else {
        args.push("-an");
      }

      args.push("-c:v", "libx264", "-preset", "fast", "-crf", "18", segPath);

      const segResult = await ffmpegRun(args);
      if (!segResult.ok) {
        return {
          ok: false,
          error: `Segment ${index} (${segment.source} ${segment.start}–${segment.end}s): ${segResult.error}`,
        };
      }
    }

    // ----------------------------------------------------------------
    // Step 2: Lossless concat via concat demuxer
    // ----------------------------------------------------------------
    const concatListPath = join(tmpDir, "concat.txt");
    writeFileSync(concatListPath, segmentPaths.map((p) => `file '${p}'`).join("\n"));

    let currentPath = join(tmpDir, "concat.mp4");

    if (segmentPaths.length === 1) {
      // Single segment: just use it directly
      currentPath = segmentPaths[0];
    } else {
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
        "fast",
        "-crf",
        "18",
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
      const srtPath = join(tmpDir, "master.srt");
      writeFileSync(srtPath, buildSrtContent(edl.captions), "utf8");

      const escapedSrt = srtPath.replace(/\\/g, "/").replace(/:/g, "\\:");
      const style =
        "FontName=Arial,FontSize=24,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,BorderStyle=3,Outline=2,Alignment=2";

      const captionResult = await ffmpegRun([
        "-i",
        currentPath,
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
        outputPath,
      ]);
      if (!captionResult.ok) return captionResult;
    } else {
      // No captions: copy current to final output path
      const copyResult = await ffmpegRun(["-i", currentPath, "-c", "copy", outputPath]);
      if (!copyResult.ok) return copyResult;
    }

    // ----------------------------------------------------------------
    // Step 5: Loudness normalization (-14 LUFS social standard)
    // Runs 2-pass on the final file and overwrites it in place.
    // ----------------------------------------------------------------
    if (edl.loudnorm) {
      const normalizedPath = join(tmpDir, "normalized.mp4");
      const normResult = await applyLoudnorm(outputPath, normalizedPath);
      if (!normResult.ok) return normResult;
      // Overwrite final output with the normalized version.
      const replaceResult = await ffmpegRun(["-i", normalizedPath, "-c", "copy", outputPath]);
      if (!replaceResult.ok) return replaceResult;
    }

    return { ok: true };
  } finally {
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

  const frames: string[] = [];
  for (const ts of timestamps) {
    // Use JPEG at 360px wide — roughly 30–60 KB vs 300–600 KB for a PNG at 640px.
    // The agent needs to see composition/content, not pixel-level detail.
    const tmpJpg = tmpFile(".jpg");
    const result = await ffmpegRun([
      "-ss",
      String(ts),
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

  return frames.length > 0 ? { frames } : { frames: [], error: "no frames extracted" };
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
