/**
 * Server-side validation for user-uploaded project assets.
 *
 * Uploads land in a per-project `assets/` tree and are later served back (and
 * referenced from composition HTML / the player). Without server-side checks the
 * upload route accepted ANY `File` — including HTML, SVG-with-script, or
 * arbitrary executables — which is both an XSS vector (if ever served as active
 * content) and a storage-abuse vector. This module is the single source of truth
 * for what an uploaded asset is allowed to be.
 *
 * Policy: allow only the image / video / audio / font media types the app
 * actually uses, validated by BOTH the declared MIME type AND the filename
 * extension (they must agree), with a per-file size cap. Anything else is
 * rejected with a clear message that the route turns into a 4xx.
 */

// Allowlist: extension → the set of MIME types we accept for that extension.
// Keep this in sync with the serve-side `SAFE_SERVE_MIME` map in fs.ts. Notably
// this EXCLUDES html/htm/js/css/json/svg/txt — composition source files are
// created by the app/agent, never uploaded by the user, so user uploads are
// restricted to inert media only.
const ALLOWED: Record<string, string[]> = {
  // images
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  gif: ["image/gif"],
  webp: ["image/webp"],
  // video
  mp4: ["video/mp4"],
  webm: ["video/webm"],
  mov: ["video/quicktime"],
  // audio
  mp3: ["audio/mpeg", "audio/mp3"],
  wav: ["audio/wav", "audio/x-wav", "audio/wave"],
  ogg: ["audio/ogg", "video/ogg", "application/ogg"],
  m4a: ["audio/mp4", "audio/x-m4a", "audio/aac"],
  aac: ["audio/aac"],
  // fonts
  woff: ["font/woff", "application/font-woff"],
  woff2: ["font/woff2"],
  ttf: ["font/ttf", "font/sfnt", "application/x-font-ttf", "application/font-sfnt"],
  otf: ["font/otf", "font/sfnt", "application/x-font-otf"],
};

/**
 * Largest single uploaded asset we accept (bytes). Tunable at runtime via the
 * `MAX_UPLOAD_MB` env var (megabytes) so the cap can be raised without a
 * redeploy — set it with `dokku config:set vibeedit MAX_UPLOAD_MB=2048`.
 * Default 2 GB covers long-form / 4K source video.
 *
 * NOTE: the upload route streams file parts to disk, but `req.formData()` still
 * buffers the whole request in memory before we see it, so the SAFE ceiling is
 * bounded by container RAM (roughly: keep the largest expected upload under
 * ~half of the container's memory). Two other layers must agree with this
 * number or large uploads 413 at the edge:
 *   1. nginx `client_max_body_size` on the Dokku host (see docs/CLAUDE notes).
 *   2. this cap (MAX_UPLOAD_MB).
 */
function resolveMaxUploadBytes(): number {
  const mb = Number(process.env.MAX_UPLOAD_MB);
  if (Number.isFinite(mb) && mb > 0) return Math.floor(mb) * 1024 * 1024;
  return 2 * 1024 * 1024 * 1024; // 2 GB default
}

export const MAX_UPLOAD_BYTES = resolveMaxUploadBytes();

export interface UploadValidationOk {
  ok: true;
}
export interface UploadValidationError {
  ok: false;
  /** HTTP status the caller should return (always a 4xx). */
  status: number;
  /** Human-readable reason, safe to return in the response body. */
  message: string;
}
export type UploadValidationResult = UploadValidationOk | UploadValidationError;

function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/**
 * Validate one uploaded File against the media allowlist + size cap.
 *
 * The check is conservative: the extension must be allow-listed AND the declared
 * `File.type` (browser-supplied Content-Type) must be one of the MIME types we
 * accept for that extension. An empty/unknown declared type is tolerated as long
 * as the extension is on the list (some browsers omit it for fonts/m4a), but a
 * declared type that contradicts the extension is rejected.
 */
export function validateUploadFile(file: File): UploadValidationResult {
  if (file.size === 0) {
    return { ok: false, status: 400, message: `empty file "${file.name}"` };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      status: 413,
      message: `file "${file.name}" exceeds the ${Math.round(
        MAX_UPLOAD_BYTES / (1024 * 1024),
      )}MB upload limit`,
    };
  }
  const ext = extOf(file.name);
  const allowedMimes = ALLOWED[ext];
  if (!allowedMimes) {
    return {
      ok: false,
      status: 415,
      message: `file type ".${ext || "(none)"}" is not an accepted media type`,
    };
  }
  const declared = (file.type || "").toLowerCase().split(";")[0].trim();
  if (declared && !allowedMimes.includes(declared)) {
    return {
      ok: false,
      status: 415,
      message: `declared content-type "${declared}" does not match extension ".${ext}"`,
    };
  }
  return { ok: true };
}
