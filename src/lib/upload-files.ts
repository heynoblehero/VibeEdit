/**
 * Shared file-upload helper. Posts each file to /api/assets/upload,
 * registers it on the project's upload bin, and dispatches the
 * vibeedit:upload-complete CustomEvent so the chat can auto-analyze.
 *
 * Used by:
 *  - UploadsPanel (browsing / library uploads)
 *  - SceneCard drop-target (per-scene uploads → apply as layer)
 */

import type { ProjectUpload } from "./scene-schema";

export interface UploadResult {
  upload: ProjectUpload;
  /** Original File so callers can inspect type / use the bytes locally. */
  file: File;
}

let dispatchTimer: ReturnType<typeof setTimeout> | null = null;
let dispatchBatch: ProjectUpload[] = [];

function scheduleAnalyzeDispatch(uploads: ProjectUpload[]): void {
  for (const u of uploads) dispatchBatch.push(u);
  if (dispatchTimer) clearTimeout(dispatchTimer);
  dispatchTimer = setTimeout(() => {
    const batch = dispatchBatch;
    dispatchBatch = [];
    dispatchTimer = null;
    if (batch.length === 0) return;
    window.dispatchEvent(
      new CustomEvent("vibeedit:upload-complete", { detail: { uploads: batch } }),
    );
  }, 800);
}

export async function uploadFiles(
  files: FileList | File[],
  addUpload: (upload: ProjectUpload) => void,
): Promise<UploadResult[]> {
  const list = Array.from(files);
  const results: UploadResult[] = [];
  await Promise.all(
    list.map(async (file) => {
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch("/api/assets/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) {
          console.error(`upload failed: ${data.error ?? res.status}`);
          return;
        }
        const upload: ProjectUpload = {
          id: `up-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: data.name ?? file.name,
          url: data.url,
          type: data.type ?? file.type,
          bytes: data.bytes ?? file.size,
          uploadedAt: Date.now(),
        };
        addUpload(upload);
        results.push({ upload, file });
      } catch (err) {
        console.error("upload failed:", err);
      }
    }),
  );
  if (results.length > 0) {
    scheduleAnalyzeDispatch(results.map((r) => r.upload));
  }
  return results;
}
