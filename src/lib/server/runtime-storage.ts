/**
 * Runtime-storage helpers. Files written here SURVIVE container restarts
 * because they go under VIBEEDIT_DATA_DIR (mounted as a persistent volume
 * on dokku). Without this, every redeploy wiped /public/uploads/ and the
 * agent's "I added your image" claims pointed at dead URLs.
 *
 * Subdirs:
 *   uploads/    — user-uploaded files via /api/assets/upload
 *   voiceovers/ — TTS output + generated music + SFX
 *   ai-images/  — DALL-E / Flux / etc. cached output (if a route opts in)
 *
 * Files served back through dynamic routes:
 *   /uploads/[name]    → src/app/uploads/[name]/route.ts
 *   /voiceovers/[name] → src/app/voiceovers/[name]/route.ts
 */

import path from "node:path";
import fs from "node:fs";

function dataDir(): string {
  return process.env.VIBEEDIT_DATA_DIR || path.join(process.cwd(), "public");
}

export function storageDir(subdir: "uploads" | "voiceovers" | "ai-images" | "music"): string {
  const dir = path.join(dataDir(), subdir);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // exists
  }
  return dir;
}

/**
 * Public URL for a file we've written into a runtime-storage subdir.
 * The Next.js dynamic routes under src/app/<subdir>/[name]/route.ts
 * serve them back from the persistent volume.
 */
export function publicUrlFor(
  subdir: "uploads" | "voiceovers" | "ai-images" | "music",
  filename: string,
): string {
  return `/${subdir}/${filename}`;
}
