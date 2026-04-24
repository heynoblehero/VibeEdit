"use client";

import { ChevronDown, Copy, FolderPlus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { totalDurationSeconds } from "@/lib/scene-schema";
import { useProjectStore } from "@/store/project-store";

export function ProjectSwitcher() {
  const project = useProjectStore((s) => s.project);
  const projects = useProjectStore((s) => s.projects);
  const renameProject = useProjectStore((s) => s.renameProject);
  const createProject = useProjectStore((s) => s.createProject);
  const duplicateProject = useProjectStore((s) => s.duplicateProject);
  const switchProject = useProjectStore((s) => s.switchProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(project.name);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(project.name);
  }, [project.name, project.id]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const commitName = () => {
    const trimmed = name.trim() || "Untitled";
    renameProject(trimmed);
    setName(trimmed);
    setEditing(false);
  };

  const handleNew = () => {
    createProject();
    setOpen(false);
    toast.success("New project created");
  };

  const handleDuplicateStyle = () => {
    duplicateProject({ copyScenes: false });
    setOpen(false);
    toast.success("Duplicated style — script + scenes reset");
  };

  const handleDuplicateFull = () => {
    duplicateProject({ copyScenes: true });
    setOpen(false);
    toast.success("Duplicated project");
  };

  const handleSwitch = (id: string) => {
    switchProject(id);
    setOpen(false);
  };

  const handleDelete = (id: string) => {
    const target = projects[id];
    if (!target) return;
    deleteProject(id);
    toast.success(`Deleted "${target.name}"`);
  };

  const projectList = Object.values(projects).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return (
    <div className="relative flex items-center gap-1" ref={menuRef}>
      {editing ? (
        <input
          ref={inputRef}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitName();
            if (e.key === "Escape") {
              setName(project.name);
              setEditing(false);
            }
          }}
          className="bg-neutral-900 border border-neutral-700 rounded px-2 py-0.5 text-sm text-white w-44 focus:outline-none focus:border-emerald-500"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          title="Click to rename"
          className="text-sm font-medium text-white hover:text-emerald-300 transition-colors max-w-[180px] truncate"
        >
          {project.name}
        </button>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-0.5 rounded text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors"
        title="Switch project"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-neutral-950 border border-neutral-800 rounded-lg shadow-xl z-50 p-1.5">
          <button
            onClick={handleNew}
            className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/10 rounded transition-colors"
          >
            <FolderPlus className="h-3.5 w-3.5" />
            New project
          </button>
          <button
            onClick={handleDuplicateStyle}
            title="Same style/music/captions/workflow — empty script + scenes"
            className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 rounded transition-colors"
          >
            <Copy className="h-3.5 w-3.5" />
            New from this style
          </button>
          <button
            onClick={handleDuplicateFull}
            title="Full copy including scenes"
            className="flex items-center gap-2 w-full px-2 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800 rounded transition-colors"
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicate project
          </button>
          <div className="border-t border-neutral-800 my-1" />
          <div className="max-h-72 overflow-y-auto">
            {projectList.length === 0 && (
              <div className="px-2 py-2 text-[11px] text-neutral-600">
                No projects yet
              </div>
            )}
            {projectList.map((p) => {
              const active = p.id === project.id;
              const dur = totalDurationSeconds(p.scenes);
              const canDelete = projectList.length > 1;
              return (
                <div
                  key={p.id}
                  className={`group flex items-center gap-1 px-2 py-1.5 rounded transition-colors ${
                    active
                      ? "bg-emerald-500/10 text-emerald-300"
                      : "hover:bg-neutral-800 text-neutral-200"
                  }`}
                >
                  <button
                    onClick={() => handleSwitch(p.id)}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="text-xs font-medium truncate">{p.name}</div>
                    <div className="text-[10px] text-neutral-500">
                      {p.scenes.length} scenes · {dur.toFixed(1)}s · {p.width}×{p.height}
                    </div>
                  </button>
                  {canDelete && (
                    <button
                      onClick={() => handleDelete(p.id)}
                      title="Delete project"
                      className="opacity-0 group-hover:opacity-100 p-1 text-neutral-500 hover:text-red-400 transition-all"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
