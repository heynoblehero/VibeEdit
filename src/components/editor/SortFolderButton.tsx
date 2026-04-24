"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { InputSlot } from "@/lib/workflows/types";

interface UploadedFile {
  url: string;
  name: string;
  prompt?: string;
}

interface Props {
  slots: InputSlot[];
  values: Record<string, unknown>;
  onBulkUpdate: (patch: Record<string, unknown>) => void;
}

/**
 * "Sort my folder" button that takes unsorted uploaded files and routes them
 * to the right file-folder slot based on Claude multimodal classification.
 * When there's only one file-folder slot, this just uploads and validates
 * accept types. With multiple, the AI does the magic.
 */
export function SortFolderButton({ slots, values, onBulkUpdate }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const folderSlots = slots.filter(
    (s) => s.type === "file-folder" || s.type === "image-pack",
  );
  if (folderSlots.length === 0) return null;

  const handleDump = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    setBusy(true);
    const toastId = toast.loading(`Uploading ${list.length} files...`);
    try {
      // 1. Upload each file to the right storage (images → data URL, video/audio → /api/assets/upload).
      const uploaded: Array<{ id: string; file: UploadedFile; isImage: boolean; dataUrl?: string }> = [];
      for (let i = 0; i < list.length; i++) {
        const f = list[i];
        toast.loading(`Uploading ${i + 1}/${list.length}...`, { id: toastId });
        const isImage = f.type.startsWith("image/");
        if (isImage && f.size < 2 * 1024 * 1024) {
          const dataUrl: string = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result));
            r.onerror = () => reject(r.error);
            r.readAsDataURL(f);
          });
          uploaded.push({
            id: `u${i}`,
            file: { url: dataUrl, name: f.name, prompt: f.name },
            isImage: true,
            dataUrl,
          });
        } else {
          const form = new FormData();
          form.append("file", f);
          const res = await fetch("/api/assets/upload", { method: "POST", body: form });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? `upload failed (${res.status})`);
          uploaded.push({
            id: `u${i}`,
            file: { url: data.url, name: f.name, prompt: f.name },
            isImage: false,
          });
        }
      }

      // 2. Route.
      const patch: Record<string, UploadedFile[]> = {};
      for (const slot of folderSlots) {
        const existing = (values[slot.id] as UploadedFile[] | undefined) ?? [];
        patch[slot.id] = [...existing];
      }

      // If only one folder slot, just dump everything there.
      if (folderSlots.length === 1) {
        patch[folderSlots[0].id].push(...uploaded.map((u) => u.file));
      } else {
        // Multiple slots: use Claude to classify. Images supply dataUrls for
        // multimodal; non-images get classified by name alone.
        toast.loading(`Classifying ${uploaded.length} files...`, { id: toastId });
        const categories = folderSlots.map((s) => ({
          id: s.id,
          description:
            `${s.label}. ${s.description ?? ""}`.trim() +
            (s.accepts?.length ? ` Accepts: ${s.accepts.join(", ")}.` : ""),
        }));
        try {
          const res = await fetch("/api/classify-assets", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assets: uploaded.map((u) => ({
                id: u.id,
                name: u.file.name,
                dataUrl: u.isImage ? u.dataUrl : undefined,
              })),
              categories,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? `classify failed (${res.status})`);
          const byAsset = new Map<string, string>();
          for (const c of data.classifications as Array<{ assetId: string; categoryId: string }>) {
            byAsset.set(c.assetId, c.categoryId);
          }
          for (const u of uploaded) {
            const target = byAsset.get(u.id);
            if (target && patch[target]) {
              patch[target].push(u.file);
            } else {
              // Fallback: first folder slot that accepts this file type.
              const fallback = folderSlots.find((s) => {
                const accepts = s.accepts ?? [];
                if (accepts.length === 0) return true;
                return accepts.some((a) =>
                  u.isImage ? a.startsWith("image/") || a === "*" : true,
                );
              });
              if (fallback) patch[fallback.id].push(u.file);
            }
          }
        } catch (e) {
          // AI classify failed — fall back to "everything in first slot".
          console.error("classify failed, falling back:", e);
          patch[folderSlots[0].id].push(...uploaded.map((u) => u.file));
          toast.warning("AI classify unavailable — dumped everything into first slot", {
            description: e instanceof Error ? e.message : String(e),
          });
        }
      }

      onBulkUpdate(patch);
      toast.success(`Sorted ${list.length} files`, { id: toastId });
    } catch (e) {
      toast.error("Sort failed", {
        id: toastId,
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        title="Drop an unsorted folder — AI routes files into the right slots"
        className="flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded border border-dashed border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white transition-colors disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
        Sort messy folder
      </button>
      <input
        ref={fileRef}
        type="file"
        multiple
        className="hidden"
        onChange={async (e) => {
          try {
            await handleDump(e.target.files);
          } catch {
            // handled in handleDump
          }
          e.target.value = "";
        }}
      />
    </>
  );
}
