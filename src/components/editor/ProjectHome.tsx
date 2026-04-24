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

  const list = Object.values(projects)
    .map((p) => ({
      ...p,
      scenes: p.scenes.length,
      duration: totalDurationSeconds(p.scenes),
    }))
    .filter((p) => (query ? p.name.toLowerCase().includes(query.toLowerCase()) : true))
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
      className={`flex flex-col items-center justify-center h-full overflow-y-auto px-8 py-12 gap-8 ${
        dragOver ? "ring-2 ring-inset ring-emerald-400/60" : ""
      }`}
    >
      <div className="flex flex-col items-center gap-2 max-w-lg text-center">
        <Sparkles className="h-8 w-8 text-emerald-400" />
        <h1 className="text-2xl font-semibold text-white">VibeEdit</h1>
        <p className="text-sm text-neutral-400">
          AI video editor where you dictate and the agent does the editing.
          Start a new project or pick one up.
        </p>
      </div>

      <div className="flex flex-col items-center gap-2 w-full max-w-sm">
        <button
          onClick={handleNew}
          className="flex items-center justify-center gap-2 w-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-6 py-3 rounded-lg transition-colors"
        >
          <FolderPlus className="h-5 w-5" />
          Start a new video
        </button>
        <button
          onClick={async () => {
            createProject();
            onStart();
            // Give page.tsx time to swap to editor before firing the chat send.
            setTimeout(async () => {
              const { useChatStore } = await import("@/store/chat-store");
              useChatStore
                .getState()
                .addUserMessage(
                  "Surprise me. Pick a fun workflow and make a fully-narrated 60s demo video.",
                );
              document.querySelector<HTMLFormElement>("aside form")?.requestSubmit();
            }, 50);
          }}
          className="flex items-center justify-center gap-2 w-full text-xs text-neutral-500 hover:text-white transition-colors"
        >
          🎲 or surprise me
        </button>
      </div>

      {(list.length > 0 || query) && (
        <div className="w-full max-w-lg flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">
              Your projects
            </span>
            {Object.keys(projects).length >= 5 && (
              <div className="flex-1 relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-neutral-600" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="filter…"
                  className="w-full bg-neutral-900 border border-neutral-800 rounded pl-7 pr-2 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            )}
          </div>
          {list.map((p) => (
            <div
              key={p.id}
              className={`group flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                p.id === currentId
                  ? "border-emerald-500/50 bg-emerald-500/5"
                  : "border-neutral-800 bg-neutral-900 hover:border-neutral-600"
              }`}
            >
              <button
                onClick={() => handlePick(p.id)}
                className="flex-1 min-w-0 text-left"
              >
                <div className="text-sm font-medium text-white truncate">
                  {p.name}
                </div>
                <div className="text-[11px] text-neutral-500">
                  {p.scenes === 0
                    ? "Empty"
                    : `${p.scenes} scenes · ${p.duration.toFixed(1)}s`}
                  {" · "}
                  {p.width}×{p.height}
                </div>
              </button>
              {list.length > 1 && (
                <button
                  onClick={() => handleDelete(p.id, p.name)}
                  title="Delete project"
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-neutral-500 hover:text-red-400 transition-all"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
