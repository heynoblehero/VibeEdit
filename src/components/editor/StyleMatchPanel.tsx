"use client";

import { Loader2, Sparkles, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { StylePack } from "@/lib/scene-schema";
import { useProjectStore } from "@/store/project-store";

async function extractFramesFromVideo(
  file: File,
  count = 8,
): Promise<string[]> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "metadata";
    video.muted = true;
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("could not load video"));
    });
    const duration = video.duration;
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error("bad video duration");
    }
    const targetW = 640;
    const ratio = video.videoWidth > 0 ? video.videoHeight / video.videoWidth : 9 / 16;
    const targetH = Math.round(targetW * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas context");

    const frames: string[] = [];
    for (let i = 0; i < count; i++) {
      const t = ((i + 0.5) / count) * duration;
      await new Promise<void>((resolve, reject) => {
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          resolve();
        };
        video.addEventListener("seeked", onSeeked);
        video.currentTime = t;
        setTimeout(() => reject(new Error("seek timeout")), 8000);
      });
      ctx.drawImage(video, 0, 0, targetW, targetH);
      frames.push(canvas.toDataURL("image/jpeg", 0.75));
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function StyleMatchPanel() {
  const setStylePack = useProjectStore((s) => s.setStylePack);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [lastPack, setLastPack] = useState<StylePack | null>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    const toastId = toast.loading("Extracting frames from reference...");
    try {
      const frames = await extractFramesFromVideo(f, 8);
      toast.loading("Analyzing style...", { id: toastId });
      const res = await fetch("/api/style-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames, note: f.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `style failed (${res.status})`);
      const pack = data.style as StylePack;
      setStylePack(pack);
      setLastPack(pack);
      toast.success("Style applied", {
        id: toastId,
        description: `${pack.accentColors?.length ?? 0} accent colors · caption restyled`,
      });
    } catch (err) {
      toast.error("Style extract failed", {
        id: toastId,
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-4 border-b border-neutral-800">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-fuchsia-400" />
        <span className="text-sm font-semibold text-white">Match a style</span>
      </div>
      <p className="text-[10px] text-neutral-600 leading-tight">
        Upload a reference video. AI extracts colors, caption style, transitions, then applies them to the whole project.
      </p>
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="flex items-center justify-center gap-2 bg-fuchsia-600 hover:bg-fuchsia-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        Upload reference video
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={handleFile}
      />
      {lastPack && (
        <div className="flex flex-col gap-1.5 mt-1">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">
            Extracted palette
          </span>
          <div className="flex flex-wrap gap-1">
            {(lastPack.accentColors ?? []).map((c) => (
              <div
                key={c}
                title={c}
                className="h-5 w-5 rounded border border-neutral-800"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
