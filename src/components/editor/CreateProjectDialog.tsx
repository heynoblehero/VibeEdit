"use client";

import { Loader2, Paperclip, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useProjectStore } from "@/store/project-store";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called after the project is created + populated. */
  onCreated: () => void;
}

interface PendingAsset {
  name: string;
  size: number;
  file: File;
}

// "Create Project" dialog: name, optional system prompt, optional asset
// drop zone. Aspect ratio + AI build flows live OUTSIDE this dialog —
// pick aspect from the header AspectSwitcher dropdown after creation;
// summon the agent via ⌘K once you're in the editor.
export function CreateProjectDialog({ open, onClose, onCreated }: Props) {
  const createProject = useProjectStore((s) => s.createProject);
  const renameProject = useProjectStore((s) => s.renameProject);
  const setSystemPrompt = useProjectStore((s) => s.setSystemPrompt);
  const setWorkflowId = useProjectStore((s) => s.setWorkflowId);

  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [assets, setAssets] = useState<PendingAsset[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => nameRef.current?.focus(), 30);
    } else {
      // Reset on close so the next open starts clean.
      setName("");
      setGoal("");
      setAssets([]);
    }
  }, [open]);

  const addFiles = (files: FileList | File[]) => {
    const list = Array.from(files);
    const tooBig = list.filter((f) => f.size > 200 * 1024 * 1024);
    if (tooBig.length > 0) {
      toast.error(`${tooBig.length} file${tooBig.length === 1 ? "" : "s"} over 200MB — skipped`);
    }
    const ok = list.filter((f) => f.size <= 200 * 1024 * 1024);
    setAssets((prev) => [
      ...prev,
      ...ok.map((f) => ({ name: f.name, size: f.size, file: f })),
    ]);
  };

  const removeAsset = (name: string) => {
    setAssets((prev) => prev.filter((a) => a.name !== name));
  };

  const submit = async () => {
    if (creating) return;
    setCreating(true);
    try {
      // 1. Create the project + apply name + optional system prompt.
      //    Aspect ratio is left at the project default — pick it later
      //    from the header AspectSwitcher dropdown.
      const id = createProject();
      const finalName =
        name.trim() ||
        goal
          .trim()
          .split(/\s+/)
          .slice(0, 6)
          .join(" ")
          .replace(/[,.?!]+$/, "")
          .slice(0, 60) ||
        "Untitled";
      renameProject(finalName);
      if (goal.trim()) setSystemPrompt(goal.trim());
      // Auto-pick workflow from prompt text so character-style projects
      // don't default to faceless and pick up Isaac stick-figures.
      const goalLower = goal.toLowerCase();
      if (/\b(reaction|reacting|opinion|controversy|drama|tea)\b/.test(goalLower)) {
        setWorkflowId("commentary");
      } else if (/\b(review|hands.on|tested|first impressions|unboxing)\b/.test(goalLower)) {
        setWorkflowId("review");
      } else if (/\b(animated|cartoon|anime|illustrated)\b/.test(goalLower)) {
        setWorkflowId("ai-animated");
      } else if (/\b(short|tiktok|reel|fyp)\b/.test(goalLower)) {
        setWorkflowId("shorts");
      } else if (/\b(faceless|pov|story.?time)\b/.test(goalLower)) {
        setWorkflowId("faceless");
      }
      void id;

      // 2. Upload assets (if any). They land in project.uploads via the
      //    existing /api/assets/upload pipe; the user can drag them onto
      //    the timeline from the Uploads tab.
      if (assets.length > 0) {
        const toastId = toast.loading(`Uploading ${assets.length} asset(s)...`);
        const addUpload = useProjectStore.getState().addUpload;
        try {
          for (const a of assets) {
            const form = new FormData();
            form.append("file", a.file);
            const res = await fetch("/api/assets/upload", {
              method: "POST",
              body: form,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error ?? "upload failed");
            addUpload({
              id: `up-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              name: a.name,
              url: data.url,
              type: a.file.type,
              bytes: a.size,
              uploadedAt: Date.now(),
            });
          }
          toast.success(`Uploaded ${assets.length}`, { id: toastId });
        } catch (e) {
          toast.error("Upload failed", {
            id: toastId,
            description: e instanceof Error ? e.message : String(e),
          });
          setCreating(false);
          return;
        }
      }

      onCreated();
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            void submit();
          }
          if (e.key === "Escape") onClose();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
        }}
        className={`w-full max-w-xl bg-neutral-950 border border-neutral-800 rounded-xl p-5 flex flex-col gap-4 shadow-2xl relative ${
          dragOver ? "ring-2 ring-emerald-400/60" : ""
        }`}
      >
        {dragOver && (
          <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center rounded-xl bg-emerald-500/10">
            <span className="text-sm font-semibold text-emerald-300">Drop to attach</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Create a new project</h2>
          <button
            onClick={onClose}
            title="Close"
            className="text-neutral-500 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-neutral-500">
            Project name
          </label>
          <input
            ref={nameRef}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. How I grew to $5K MRR"
            className="w-full mt-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-neutral-500">
            System prompt (optional)
          </label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder={`Describe the project tone / style / constraints. The agent (when you summon it via \u2318K) reads this every turn. Leave blank to start with no preset behaviour.`}
            rows={4}
            className="w-full mt-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-[13px] text-white resize-none focus:outline-none focus:border-emerald-500 placeholder:text-neutral-600"
          />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-neutral-500 flex items-center justify-between">
            <span>Assets (optional)</span>
            <span className="text-neutral-600 normal-case">Drop files here or click</span>
          </label>
          <button
            onClick={() => fileRef.current?.click()}
            className="mt-1 flex items-center justify-center gap-2 w-full h-20 border-2 border-dashed border-neutral-800 hover:border-emerald-500/60 rounded text-xs text-neutral-500 hover:text-white transition-colors"
          >
            <Paperclip className="h-4 w-4" />
            {assets.length === 0
              ? "Drag in images, clips, audio, comic panels — anything the agent should use"
              : `${assets.length} file${assets.length === 1 ? "" : "s"} queued`}
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          {assets.length > 0 && (
            <div className="flex flex-col gap-1 mt-2 max-h-32 overflow-y-auto">
              {assets.map((a) => (
                <div
                  key={a.name}
                  className="flex items-center gap-2 px-2 py-1 rounded bg-neutral-900 border border-neutral-800"
                >
                  <span className="text-[11px] text-neutral-300 truncate flex-1">{a.name}</span>
                  <span className="text-[10px] text-neutral-600 font-mono shrink-0">
                    {(a.size / 1024).toFixed(0)}K
                  </span>
                  <button
                    onClick={() => removeAsset(a.name)}
                    className="text-neutral-600 hover:text-red-400"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onClose}
            className="text-sm text-neutral-500 hover:text-white px-3 py-2"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={creating}
            title="Create (Cmd/Ctrl+Enter)"
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-semibold px-4 py-2 rounded transition-colors"
          >
            {creating && <Loader2 className="h-4 w-4 animate-spin" />}
            Create project
          </button>
        </div>
      </div>
    </div>
  );
}
