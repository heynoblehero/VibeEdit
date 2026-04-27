"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { createId, DEFAULT_BG } from "@/lib/scene-schema";
import { useProjectStore } from "@/store/project-store";

/**
 * Window paste handler — when the clipboard contains an image, upload
 * it and insert as a new scene. Lets users go from screenshot →
 * scene with no intermediate UI.
 */
export function PasteImage() {
  const project = useProjectStore((s) => s.project);
  const addUpload = useProjectStore((s) => s.addUpload);
  const addScene = useProjectStore((s) => s.addScene);
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      ) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      const imageItem = Array.from(items).find((i) =>
        i.type.startsWith("image/"),
      );
      if (!imageItem) return;
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (!file) return;
      const tid = toast.loading("Uploading pasted image…");
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/assets/upload", {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          toast.error("Upload failed", { id: tid });
          return;
        }
        const data = await res.json();
        const upload = {
          id: `up-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: data.name ?? file.name ?? "Pasted image.png",
          url: data.url as string,
          type: data.type ?? file.type ?? "image/png",
          bytes: data.bytes ?? file.size,
          uploadedAt: Date.now(),
        };
        addUpload(upload);
        const portrait = project.height > project.width;
        addScene({
          id: createId(),
          type: "text_only",
          duration: 3,
          background: { ...DEFAULT_BG, imageUrl: upload.url, kenBurns: true },
          emphasisText: "edit me",
          emphasisSize: portrait ? 96 : 72,
          emphasisColor: "#ffffff",
          textY: portrait ? 500 : 380,
          transition: "beat_flash",
        });
        toast.success("Pasted as new scene", { id: tid, duration: 1000 });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Paste failed", {
          id: tid,
        });
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addUpload, addScene, project.height, project.width]);
  return null;
}
