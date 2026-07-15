/**
 * URL → video-file resolver, backed by yt-dlp.
 *
 * The in-app "Import from URL" flow and the browser-extension capture endpoint
 * both funnel through here. `download_asset` (lib/ai/tools.ts) can only fetch
 * direct media-file URLs and deliberately refuses page URLs like a YouTube watch
 * page; this module fills that gap by delegating page→stream resolution to
 * yt-dlp, then hands the downloaded file back to the normal ingest tail
 * (projectFileWriteTarget + ensureManifest).
 *
 * SSRF note: yt-dlp itself resolves and fetches the page/stream, so the
 * SSRF-guarded safeFetch used elsewhere doesn't apply. We restrict inputs to
 * public http(s) URLs and cap duration + file size, and rely on yt-dlp for the
 * rest. Do not point this at internal hosts.
 */

import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MAX_UPLOAD_BYTES } from "@/lib/storage/upload-validator";

const YT_DLP = process.env.YT_DLP_PATH || "yt-dlp";

// Hard ceiling on source length, tunable via env. Long videos blow up download
// time, transcription cost, and storage — the picker only needs a short region.
export const IMPORT_MAX_DURATION_SEC = Number(process.env.IMPORT_MAX_DURATION_SEC || 900);

const META_TIMEOUT_MS = 30_000;
const DOWNLOAD_TIMEOUT_MS = 240_000;

export class ImportError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ImportError";
    this.status = status;
  }
}

export interface VideoMetadata {
  title: string;
  durationSec: number;
  uploader: string;
  license: string | null;
  hasCaptions: boolean;
  extractor: string;
  thumbnailUrl: string | null;
}

function runYtDlp(
  args: string[],
  timeoutMs: number,
): Promise<{ code: number | null; stdout: string; stderr: string; timedOut: boolean }> {
  return new Promise((resolvePromise) => {
    const proc = spawn(YT_DLP, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    proc.stdout.on("data", (chunk: Buffer) => {
      // Metadata JSON can be large; downloads print little to stdout.
      if (stdout.length < 8_000_000) stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk: Buffer) => {
      if (stderr.length < 20_000) stderr += chunk.toString();
    });
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
    }, timeoutMs);
    proc.on("error", (error) => {
      clearTimeout(timer);
      resolvePromise({ code: null, stdout, stderr: stderr || error.message, timedOut });
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      resolvePromise({ code, stdout, stderr, timedOut });
    });
  });
}

// Shared yt-dlp args applied to every invocation. YouTube blocks automated
// downloads from datacenter IPs ("Sign in to confirm you're not a bot"); the
// operator can supply cookies (from a logged-in account) and/or a residential
// proxy via env to get past it. These are the two reliable server-side fixes.
function commonYtDlpArgs(): string[] {
  const args: string[] = ["--no-warnings", "--no-playlist", "--retries", "3"];
  const cookiesFile = process.env.YTDLP_COOKIES_FILE;
  if (cookiesFile) args.push("--cookies", cookiesFile);
  const proxy = process.env.YTDLP_PROXY;
  if (proxy) args.push("--proxy", proxy);
  // Optional override, e.g. "tv,web_safari,android". Left unset by default so we
  // use yt-dlp's own current best-guess client order.
  const clients = process.env.YTDLP_PLAYER_CLIENTS;
  if (clients) args.push("--extractor-args", `youtube:player_client=${clients}`);
  return args;
}

// Turn yt-dlp stderr into a specific, honest user message + HTTP status instead
// of a vague catch-all. The bot-check in particular needs its own message so the
// operator knows to configure cookies/proxy rather than thinking the link is bad.
function classifyYtDlpError(stderr: string): ImportError {
  const s = stderr || "";
  if (/Sign in to confirm you.?re not a bot|confirm you're not a bot/i.test(s)) {
    return new ImportError(
      "YouTube is blocking automated downloads from our servers. This needs a cookies " +
        "file or a proxy configured on the server (YTDLP_COOKIES_FILE / YTDLP_PROXY).",
      502,
    );
  }
  if (/Private video|This video is private/i.test(s)) {
    return new ImportError("That video is private.", 422);
  }
  if (/members-only|join this channel/i.test(s)) {
    return new ImportError("That video is members-only.", 422);
  }
  if (/age|inappropriate|Sign in to confirm your age/i.test(s)) {
    return new ImportError("That video is age-restricted and can't be imported.", 422);
  }
  if (/is not available|unavailable|has been removed|no longer available|deleted/i.test(s)) {
    return new ImportError("That video is unavailable or has been removed.", 422);
  }
  if (/Unsupported URL|Unable to extract|is not a valid URL/i.test(s)) {
    return new ImportError("That link isn't a supported video URL.", 422);
  }
  if (/geo|not available in your country|region/i.test(s)) {
    return new ImportError("That video is region-locked.", 422);
  }
  return new ImportError(
    "Couldn't read that link — it may be private, region-locked, or unsupported.",
    422,
  );
}

function assertPublicHttpUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ImportError("That doesn't look like a valid URL.", 400);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ImportError("Only http(s) links are supported.", 400);
  }
}

/**
 * Resolve metadata for a URL WITHOUT downloading the media. Used by the preview
 * endpoint so the modal can show title/duration before committing a full pull.
 */
export async function resolveMetadata(url: string): Promise<VideoMetadata> {
  assertPublicHttpUrl(url);
  const result = await runYtDlp(
    ["--dump-json", "--skip-download", ...commonYtDlpArgs(), url],
    META_TIMEOUT_MS,
  );
  if (result.timedOut) throw new ImportError("Timed out reading that link.", 504);
  if (result.code !== 0 || !result.stdout.trim()) {
    throw classifyYtDlpError(result.stderr);
  }
  let data: Record<string, unknown>;
  try {
    // --no-playlist still emits one JSON object per line for some extractors;
    // take the first line.
    data = JSON.parse(result.stdout.trim().split("\n")[0]) as Record<string, unknown>;
  } catch {
    throw new ImportError("Couldn't parse metadata for that link.", 422);
  }
  const subtitles = (data.subtitles ?? {}) as Record<string, unknown>;
  const autoCaptions = (data.automatic_captions ?? {}) as Record<string, unknown>;
  return {
    title: typeof data.title === "string" ? data.title : "Untitled",
    durationSec: typeof data.duration === "number" ? data.duration : 0,
    uploader:
      typeof data.uploader === "string"
        ? data.uploader
        : typeof data.channel === "string"
          ? data.channel
          : "",
    license: typeof data.license === "string" ? data.license : null,
    hasCaptions: Object.keys(subtitles).length > 0 || Object.keys(autoCaptions).length > 0,
    extractor: typeof data.extractor === "string" ? data.extractor : "",
    thumbnailUrl: typeof data.thumbnail === "string" ? data.thumbnail : null,
  };
}

export interface DownloadResult {
  filePath: string;
  bytes: number;
  metadata: VideoMetadata;
}

/**
 * Download the media for a URL into a fresh temp directory and return the path.
 * The caller is responsible for moving the file into project storage and
 * cleaning up the temp directory. Enforces the duration + size caps.
 */
export async function resolveAndDownload(
  url: string,
  opts: { maxDurationSec?: number; maxBytes?: number } = {},
): Promise<DownloadResult> {
  assertPublicHttpUrl(url);
  const maxDurationSec = opts.maxDurationSec ?? IMPORT_MAX_DURATION_SEC;
  const maxBytes = opts.maxBytes ?? MAX_UPLOAD_BYTES;

  // Check duration up front so we never start a huge download.
  const metadata = await resolveMetadata(url);
  if (metadata.durationSec > maxDurationSec) {
    throw new ImportError(
      `That video is ${Math.round(metadata.durationSec / 60)} min — over the ` +
        `${Math.round(maxDurationSec / 60)} min import limit. Trim it shorter or pick a segment.`,
      413,
    );
  }

  const dir = mkdtempSync(join(tmpdir(), "vibe-import-"));
  const outTemplate = join(dir, "source.%(ext)s");
  const result = await runYtDlp(
    [
      "-f",
      // Prefer a single progressive mp4; fall back to best available.
      "best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best",
      "--max-filesize",
      String(maxBytes),
      ...commonYtDlpArgs(),
      "-o",
      outTemplate,
      url,
    ],
    DOWNLOAD_TIMEOUT_MS,
  );
  if (result.timedOut) throw new ImportError("Download timed out.", 504);
  if (result.code !== 0) {
    // yt-dlp exits non-zero when --max-filesize aborts the download too.
    if (/max-filesize|larger than/i.test(result.stderr)) {
      throw new ImportError("That video is larger than your upload limit.", 413);
    }
    throw classifyYtDlpError(result.stderr);
  }

  const files = readdirSync(dir);
  const downloaded = files.find((name) => name.startsWith("source."));
  if (!downloaded) throw new ImportError("Download produced no file.", 422);
  const filePath = join(dir, downloaded);
  const bytes = statSync(filePath).size;
  return { filePath, bytes, metadata };
}
