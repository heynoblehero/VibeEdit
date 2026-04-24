"use client";

import { FolderPlus, Sparkles, Trash2 } from "lucide-react";
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

  const list = Object.values(projects)
    .map((p) => ({
      ...p,
      scenes: p.scenes.length,
      duration: totalDurationSeconds(p.scenes),
    }))
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
    <div className="flex flex-col items-center justify-center h-full overflow-y-auto px-8 py-12 gap-8">
      <div className="flex flex-col items-center gap-2 max-w-lg text-center">
        <Sparkles className="h-8 w-8 text-emerald-400" />
        <h1 className="text-2xl font-semibold text-white">VibeEdit</h1>
        <p className="text-sm text-neutral-400">
          AI video editor where you dictate and the agent does the editing.
          Start a new project or pick one up.
        </p>
      </div>

      <button
        onClick={handleNew}
        className="flex items-center justify-center gap-2 w-full max-w-sm bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-6 py-3 rounded-lg transition-colors"
      >
        <FolderPlus className="h-5 w-5" />
        Start a new video
      </button>

      {list.length > 0 && (
        <div className="w-full max-w-lg flex flex-col gap-2">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">
            Your projects
          </span>
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
