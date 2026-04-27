"use client";

import { Clock, Film, FolderUp, Layers } from "lucide-react";
import { totalDurationFrames } from "@/lib/scene-schema";
import { useProjectStore } from "@/store/project-store";

/**
 * Header micro-display: scene count + total duration. Updates live as
 * the user trims / adds scenes. Hidden on narrow screens to keep the
 * header readable.
 */
export function ProjectStats() {
  const project = useProjectStore((s) => s.project);
  const visibleScenes = project.scenes.filter((s) => !s.muted);
  const totalFrames = totalDurationFrames(visibleScenes, project.fps);
  const sec = totalFrames / project.fps;
  const mm = Math.floor(sec / 60);
  const ss = Math.floor(sec - mm * 60);
  const fmt = mm > 0 ? `${mm}:${ss.toString().padStart(2, "0")}` : `${sec.toFixed(1)}s`;
  if (project.scenes.length === 0) return null;
  const muted = project.scenes.length - visibleScenes.length;
  return (
    <div
      className="hidden md:flex items-center gap-2 px-2 py-1 rounded bg-neutral-900/60 border border-neutral-800 text-[10px] text-neutral-400 font-mono"
      title={
        muted > 0
          ? `${project.scenes.length} scenes (${muted} muted, skipped on render) · ${fmt}`
          : `${project.scenes.length} scenes · ${fmt} total`
      }
    >
      <span className="flex items-center gap-1">
        <Film className="h-3 w-3" />
        {visibleScenes.length}
        {muted > 0 && <span className="text-neutral-600">/{project.scenes.length}</span>}
      </span>
      <span className="flex items-center gap-1">
        <Clock className="h-3 w-3" />
        {fmt}
      </span>
      {project.tracks && project.tracks.length > 1 && (
        <span
          className="flex items-center gap-1 text-cyan-400"
          title={`${project.tracks.length} tracks`}
        >
          <Layers className="h-3 w-3" />
          {project.tracks.length}
        </span>
      )}
      {(project.uploads?.length ?? 0) > 0 && (
        <span
          className="flex items-center gap-1 text-neutral-500"
          title={`${project.uploads!.length} upload${project.uploads!.length === 1 ? "" : "s"} in this project`}
        >
          <FolderUp className="h-3 w-3" />
          {project.uploads!.length}
        </span>
      )}
    </div>
  );
}
