"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import type { Project } from "@/lib/scene-schema";
import { useProjectStore } from "@/store/project-store";

/**
 * Window-level dropzone for `.vibeedit.json` project files. Drop one
 * onto the editor anywhere → new project is created from the JSON
 * and made active. Lets users move work between machines / browsers
 * with no extra UI.
 *
 * Skips drops whose first file isn't .json so it doesn't fight with
 * the Timeline's media-file drop handler.
 */
export function ProjectDropImport() {
  useEffect(() => {
    const isProjectFile = (f: File | undefined) =>
      !!f && (f.name.endsWith(".vibeedit.json") || f.name.endsWith(".json"));

    const onDragOver = (e: DragEvent) => {
      const files = e.dataTransfer?.items;
      if (!files) return;
      // Only intervene when at least one looks like a project file.
      // We can't peek the filename in dragover (Chromium only exposes
      // it on drop), so we leave the visual cue to the existing
      // Timeline dropzone and just keep this listener registered.
    };

    const onDrop = async (e: DragEvent) => {
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;
      const f = files[0];
      if (!isProjectFile(f)) return;
      // Only act on .vibeedit.json — plain .json could be anything.
      if (!f.name.endsWith(".vibeedit.json")) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        const text = await f.text();
        const parsed = JSON.parse(text) as Project;
        if (!parsed?.scenes || !Array.isArray(parsed.scenes)) {
          toast.error("Not a valid VibeEdit project");
          return;
        }
        // Re-id so we never overwrite an existing project.
        const id = `prj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const fresh: Project = { ...parsed, id, name: parsed.name ?? "Imported" };
        useProjectStore.getState().setProject(fresh);
        toast.success(`Imported · ${fresh.name}`, { duration: 1200 });
      } catch (err) {
        toast.error(
          `Import failed: ${err instanceof Error ? err.message : "bad json"}`,
        );
      }
    };

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  return null;
}
