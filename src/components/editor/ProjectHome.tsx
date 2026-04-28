"use client";

import { FolderPlus, Search, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { totalDurationSeconds } from "@/lib/scene-schema";
import { useProjectStore } from "@/store/project-store";

// Shown when the user has no content in the current project AND there's
// either only one empty project or no meaningful work yet. Replaces the
// "dive straight into editor with empty Draft" landing.
export function ProjectHome({
  onStart,
}: {
  onStart: () => void;
}) {
  const projects = useProjectStore((s) => s.projects);
  const currentId = useProjectStore((s) => s.project.id);
  const createProject = useProjectStore((s) => s.createProject);
  const switchProject = useProjectStore((s) => s.switchProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const setProject = useProjectStore((s) => s.setProject);

  const [dragOver, setDragOver] = useState(false);

  const handleFileDrop = async (files: FileList) => {
    const file = Array.from(files).find(
      (f) => /\.(json|vibeedit)$/i.test(f.name) || f.type === "application/json",
    );
    if (!file) {
      toast.error("Drop a .vibeedit or .json project file");
      return;
    }
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as { project?: unknown };
      const p = parsed.project as { scenes?: unknown } | undefined;
      if (!p || !Array.isArray(p.scenes)) {
        throw new Error("Not a VibeEdit project file");
      }
      setProject(p as Parameters<typeof setProject>[0]);
      onStart();
      toast.success("Project imported");
    } catch (err) {
      toast.error("Import failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const [query, setQuery] = useState("");

  const raw = Object.values(projects).map((p) => ({
    ...p,
    scenes: p.scenes.length,
    duration: totalDurationSeconds(p.scenes),
  }));
  // Hide the auto-created 'Draft' shell when it's empty AND the user has
  // real projects. Keeps the list focused on actual work.
  const hasNonDraft = raw.some((p) => p.name !== "Draft" || p.scenes > 0);
  const list = raw
    .filter((p) => {
      if (hasNonDraft && p.name === "Draft" && p.scenes === 0) return false;
      return query ? p.name.toLowerCase().includes(query.toLowerCase()) : true;
    })
    .sort((a, b) => (a.name === "Draft" ? 1 : b.name === "Draft" ? -1 : 0));

  const handleNew = () => {
    createProject();
    onStart();
    toast.success("New project", { duration: 800 });
  };

  const handlePick = (id: string) => {
    if (id !== currentId) switchProject(id);
    onStart();
  };

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    deleteProject(id);
    toast(`Deleted "${name}"`, { duration: 800 });
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length > 0) void handleFileDrop(e.dataTransfer.files);
      }}
      className={`relative flex flex-col items-center justify-start h-full overflow-y-auto px-8 py-16 gap-10 ${
        dragOver ? "ring-2 ring-inset ring-emerald-400/60" : ""
      }`}
      style={{
        backgroundImage:
          "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(16,185,129,0.08), transparent 70%), radial-gradient(ellipse 80% 50% at 50% 100%, rgba(59,130,246,0.04), transparent 70%)",
      }}
    >
      <div className="flex flex-col items-center gap-3 max-w-2xl text-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-emerald-500/30 blur-2xl" />
          <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/40">
            <Sparkles className="h-7 w-7 text-black" strokeWidth={2.5} />
          </div>
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight bg-gradient-to-b from-white to-neutral-400 bg-clip-text text-transparent">
          VibeEdit
        </h1>
        <p className="text-sm text-neutral-400 max-w-md leading-relaxed">
          A web video editor with the polish of Premiere, the speed of a
          browser, and an AI quietly in your corner when you need it.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3 w-full max-w-sm">
        <button
          onClick={handleNew}
          className="group relative flex items-center justify-center gap-2 w-full bg-gradient-to-b from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 text-black font-semibold text-[15px] px-6 py-3.5 rounded-xl shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all hover:-translate-y-px"
        >
          <FolderPlus className="h-5 w-5" />
          <span>Create a new project</span>
          <kbd className="ml-1 hidden sm:inline-block text-[10px] font-mono bg-black/15 text-black/60 px-1.5 py-0.5 rounded">
            ⌘⇧N
          </kbd>
        </button>
        <p className="text-[11px] text-neutral-500 text-center">
          Drop in clips and edit. Pick aspect later from the header.
        </p>
      </div>

      {(list.length > 0 || query) && (
        <div className="w-full max-w-2xl flex flex-col gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 font-medium">
              Your projects
            </span>
            <span className="text-[10px] text-neutral-700 font-mono">
              {list.length}
            </span>
            {Object.keys(projects).length >= 5 && (
              <div className="flex-1 relative ml-auto max-w-[220px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-neutral-600" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="filter…"
                  className="w-full bg-neutral-900/60 border border-neutral-800 rounded-md pl-7 pr-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 focus:bg-neutral-900 transition-colors"
                />
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {list.map((p) => (
              <div
                key={p.id}
                className={`group flex items-center gap-2 p-3.5 rounded-xl border transition-all hover:-translate-y-px ${
                  p.id === currentId
                    ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 to-transparent shadow-md shadow-emerald-500/10"
                    : "border-neutral-800/80 bg-neutral-900/40 hover:border-neutral-700 hover:bg-neutral-900/80"
                }`}
              >
                <button
                  onClick={() => handlePick(p.id)}
                  className="flex-1 min-w-0 text-left"
                >
                  <div className="text-sm font-semibold text-white truncate">
                    {p.name}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    {p.scenes === 0
                      ? "Empty"
                      : `${p.scenes} scenes · ${p.duration.toFixed(1)}s`}
                    <span className="text-neutral-700"> · </span>
                    <span className="font-mono text-neutral-600">
                      {p.width}×{p.height}
                    </span>
                  </div>
                </button>
                {list.length > 1 && (
                  <button
                    onClick={() => handleDelete(p.id, p.name)}
                    title="Delete project"
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
