import JSZip from "jszip";
import type { MediaType } from "@/types/assets";

export interface ZipExtractedFile {
  name: string;
  file: File;
  type: MediaType | "lut" | "lottie" | "unknown";
  path: string;
}

const MEDIA_EXTENSIONS: Record<string, MediaType> = {
  // Video
  ".mp4": "video", ".mov": "video", ".webm": "video", ".avi": "video", ".mkv": "video",
  // Image
  ".png": "image", ".jpg": "image", ".jpeg": "image", ".gif": "image",
  ".webp": "image", ".svg": "image", ".bmp": "image", ".avif": "image",
  // Audio
  ".mp3": "audio", ".wav": "audio", ".ogg": "audio", ".aac": "audio",
  ".flac": "audio", ".m4a": "audio",
};

const SPECIAL_EXTENSIONS: Record<string, "lut" | "lottie"> = {
  ".cube": "lut",
  ".3dl": "lut",
};

function getFileType(filename: string): MediaType | "lut" | "lottie" | "unknown" {
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0] || "";
  if (MEDIA_EXTENSIONS[ext]) return MEDIA_EXTENSIONS[ext];
  if (SPECIAL_EXTENSIONS[ext]) return SPECIAL_EXTENSIONS[ext];
  // Check for Lottie JSON
  if (ext === ".json") return "lottie";
  return "unknown";
}

function getMimeType(filename: string): string {
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0] || "";
  const mimeMap: Record<string, string> = {
    ".mp4": "video/mp4", ".mov": "video/quicktime", ".webm": "video/webm",
    ".avi": "video/x-msvideo", ".mkv": "video/x-matroska",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
    ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
    ".bmp": "image/bmp", ".avif": "image/avif",
    ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
    ".aac": "audio/aac", ".flac": "audio/flac", ".m4a": "audio/mp4",
    ".cube": "text/plain", ".3dl": "text/plain", ".json": "application/json",
  };
  return mimeMap[ext] || "application/octet-stream";
}

export async function extractZipAssets(
  zipFile: File,
  onProgress?: (info: { extracted: number; total: number; currentFile: string }) => void
): Promise<ZipExtractedFile[]> {
  const zip = await JSZip.loadAsync(zipFile);
  const results: ZipExtractedFile[] = [];

  const entries = Object.entries(zip.files).filter(([_, entry]) => !entry.dir);
  let extracted = 0;

  for (const [path, entry] of entries) {
    // Skip hidden/system files
    const filename = path.split("/").pop() || "";
    if (filename.startsWith(".") || filename.startsWith("__MACOSX")) continue;

    const fileType = getFileType(filename);
    if (fileType === "unknown") continue; // Skip unsupported files

    onProgress?.({ extracted, total: entries.length, currentFile: filename });

    const blob = await entry.async("blob");
    const mime = getMimeType(filename);
    const file = new File([blob], filename, { type: mime });

    results.push({ name: filename, file, type: fileType, path });
    extracted++;
  }

  return results;
}
