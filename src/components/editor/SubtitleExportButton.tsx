"use client";

import { Subtitles } from "lucide-react";
import { toast } from "sonner";
import { projectToSRT } from "@/lib/srt-export";
import { useProjectStore } from "@/store/project-store";

/**
 * Exports the project's voiceover captions as a single SRT file —
 * upload-ready for YouTube / TikTok / Reels caption tracks. Disabled
 * if there's no voiceover text anywhere in the project.
 */
export function SubtitleExportButton() {
  const project = useProjectStore((s) => s.project);
  const hasAny = project.scenes.some((s) => s.voiceover?.text);
  return (
    <button
      onClick={() => {
        const srt = projectToSRT(project);
        if (srt.trim().length === 0) {
          toast.error("No voiceover text to export");
          return;
        }
        const blob = new Blob([srt], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${project.name.replace(/[^a-z0-9_-]+/gi, "_")}.srt`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Subtitles exported");
      }}
      disabled={!hasAny}
      title={
        hasAny
          ? "Export voiceover captions as SRT (YouTube / TikTok caption track)"
          : "No voiceover text in this project"
      }
      className="flex items-center gap-2 px-2 py-1.5 rounded text-xs text-neutral-300 hover:bg-neutral-800 disabled:opacity-30"
    >
      <Subtitles className="h-3.5 w-3.5" />
      <span>Export SRT</span>
    </button>
  );
}
