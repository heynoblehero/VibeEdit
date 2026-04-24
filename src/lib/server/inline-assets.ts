import path from "node:path";
import fs from "node:fs";

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".webm": "video/webm",
  ".mp4": "video/mp4",
};

function publicFileFor(urlPath: string): string | null {
  // Only inline files we own — paths served from /public/**.
  if (!urlPath.startsWith("/")) return null;
  const safe = urlPath.replace(/\.\.+/g, "");
  const abs = path.join(process.cwd(), "public", safe);
  if (!abs.startsWith(path.join(process.cwd(), "public"))) return null;
  if (!fs.existsSync(abs)) return null;
  return abs;
}

const cache = new Map<string, string>();

export function inlineUrl(url: string, origin: string): string {
  if (!url) return url;

  // Strip our own origin — always fall through to the /public lookup below.
  let rel = url;
  if (url.startsWith(origin)) {
    rel = url.slice(origin.length);
  } else if (/^https?:\/\//i.test(url)) {
    return url; // external URL, leave alone
  }

  const filePath = publicFileFor(rel);
  if (!filePath) {
    // Unknown local path — fall back to absolutized URL so Chromium at least
    // tries to fetch it. (Will fail offline.)
    return rel.startsWith("/") ? `${origin}${rel}` : url;
  }

  const cached = cache.get(filePath);
  if (cached) return cached;

  const buf = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
  const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
  cache.set(filePath, dataUrl);
  return dataUrl;
}
