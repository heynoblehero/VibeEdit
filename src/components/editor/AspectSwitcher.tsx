"use client";

import { Smartphone, Monitor } from "lucide-react";
import { getOrientation } from "@/lib/scene-schema";
import { useProjectStore } from "@/store/project-store";

/**
 * Header chip that flips the project between landscape (1920×1080)
 * and portrait (1080×1920) in one click. Two icon buttons; the active
 * orientation is highlighted. Reuses the existing setOrientation
 * action so it's recorded in undo history.
 */
export function AspectSwitcher() {
  const project = useProjectStore((s) => s.project);
  const setOrientation = useProjectStore((s) => s.setOrientation);
  const orientation = getOrientation(project);
  const aspect =
    project.width > project.height
      ? `${Math.round((project.width / project.height) * 9)}:9`
      : `9:${Math.round((project.height / project.width) * 9)}`;
  return (
    <div
      className="hidden md:flex items-center rounded border border-neutral-800 bg-neutral-900/60 overflow-hidden"
      title={`Aspect: ${aspect} (${project.width}×${project.height})`}
    >
      <button
        type="button"
        onClick={() => setOrientation("landscape")}
        className={`px-1.5 py-1 transition-colors ${
          orientation === "landscape"
            ? "bg-emerald-500/20 text-emerald-300"
            : "text-neutral-500 hover:text-white"
        }`}
        title="Landscape · 16:9"
        aria-label="Switch to landscape"
      >
        <Monitor className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setOrientation("portrait")}
        className={`px-1.5 py-1 transition-colors ${
          orientation === "portrait"
            ? "bg-emerald-500/20 text-emerald-300"
            : "text-neutral-500 hover:text-white"
        }`}
        title="Portrait · 9:16"
        aria-label="Switch to portrait"
      >
        <Smartphone className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
