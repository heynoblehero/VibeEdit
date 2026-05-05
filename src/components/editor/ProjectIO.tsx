"use client";

import { Download as DownloadIcon, Trash2, Upload } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";
import type { Project } from "@/lib/scene-schema";
import { useProjectStore } from "@/store/project-store";

const FILE_VERSION = 1;

interface ProjectFile {
  version: number;
  exportedAt: string;
  project: Project;
}

export function ProjectIO() {
  const project = useProjectStore((s) => s.project);
  const projects = useProjectStore((s) => s.projects);
  const setProject = useProjectStore((s) => s.setProject);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleGc = async () => {
    const inUseVoice: string[] = [];
    const inUseImages: string[] = [];
    const inUseUploads: string[] = [];
    const addUploadUrl = (u: string | undefined) => {
      if (u && u.startsWith("/uploads/")) inUseUploads.push(u);
    };
    for (const p of Object.values(projects)) {
      addUploadUrl(p.music?.url);
      for (const s of p.scenes) {
        if (s.voiceover?.audioUrl) inUseVoice.push(s.voiceover.audioUrl);
        if (s.background.imageUrl) inUseImages.push(s.background.imageUrl);
        addUploadUrl(s.background.videoUrl);
        for (const b of s.broll ?? []) addUploadUrl(b.url);
      }
      const wi = p.workflowInputs ?? {};
      for (const val of Object.values(wi)) {
        if (Array.isArray(val)) {
          for (const item of val) {
            if (item && typeof item === "object" && "url" in item) {
              addUploadUrl(String((item as { url: string }).url));
            }
          }
        } else if (val && typeof val === "object" && "url" in val) {
          addUploadUrl(String((val as { url: string }).url));
        }
      }
    }
    try {
      const [imgRes, upRes] = await Promise.all([
        fetch("/api/images/gc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inUse: inUseImages }),
        }),
        fetch("/api/uploads/gc", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inUse: inUseUploads }),
        }),
      ]);
      const imgData = await imgRes.json();
      const upData = await upRes.json();
      const deleted = (imgData.deleted ?? 0) + (upData.deleted ?? 0);
      const bytesFreed =
        (imgData.bytesFreed ?? 0) + (upData.bytesFreed ?? 0);
      toast.success(
        `Cleaned ${deleted} unused files`,
        {
          description: bytesFreed
            ? `Freed ${(bytesFreed / 1024 / 1024).toFixed(1)} MB`
            : undefined,
        },
      );
    } catch (e) {
      toast.error("GC failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const handleExport = () => {
    const payload: ProjectFile = {
      version: FILE_VERSION,
      exportedAt: new Date().toISOString(),
      project,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = (project.name || "vibeedit").replace(/[^\w-]+/g, "_");
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
    a.download = `${safeName}_${stamp}.vibeedit.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Project exported");
  };

  const handleImportClick = () => fileRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<ProjectFile> & { project?: Project };
      const loaded = parsed.project;
      if (!loaded || !Array.isArray(loaded.scenes)) {
        throw new Error("Not a valid VibeEdit project file");
      }
      setProject(loaded);
      toast.success(`Imported "${loaded.name ?? "Untitled"}" (${loaded.scenes.length} scenes)`);
    } catch (err) {
      toast.error("Import failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={handleExport}
        title="Export project as .vibeedit.json"
        className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
      >
        <DownloadIcon className="h-4 w-4" />
      </button>
      <button
        onClick={handleImportClick}
        title="Import .vibeedit.json project"
        className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
      >
        <Upload className="h-4 w-4" />
      </button>
      <button
        onClick={handleGc}
        title="Delete voiceover MP3s that no project references"
        className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
