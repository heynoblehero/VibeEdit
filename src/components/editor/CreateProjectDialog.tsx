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

type Orientation = "landscape" | "portrait";

interface PendingAsset {
  name: string;
  size: number;
  file: File;
}

// Proper "Create Project" dialog: name, orientation, goal / instructions,
// and an asset drop zone. Replaces the old "just click Start and figure it
// out" landing flow.
export function CreateProjectDialog({ open, onClose, onCreated }: Props) {
  const createProject = useProjectStore((s) => s.createProject);
  const renameProject = useProjectStore((s) => s.renameProject);
  const setOrientation = useProjectStore((s) => s.setOrientation);
  const setSystemPrompt = useProjectStore((s) => s.setSystemPrompt);

  const [name, setName] = useState("");
  const [orientation, setOrient] = useState<Orientation>("landscape");
  const [goal, setGoal] = useState("");
  const [assets, setAssets] = useState<PendingAsset[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [creating, setCreating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const goalRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => goalRef.current?.focus(), 30);
    } else {
      // Reset on close so the next open starts clean.
      setName("");
      setOrient("landscape");
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
      // 1. Create the project + apply name/orientation/prompt.
      const id = createProject();
      const finalName =
        name.trim() ||
        goal
          .trim()
          .split(/\s+/)
          .slice(0, 6)
          .join(" ")
          .replace(/[,.?!]+$/, "")
          .slice(0, 60);
      if (finalName) renameProject(finalName);
      if (orientation !== "landscape") setOrientation(orientation);
      if (goal.trim()) setSystemPrompt(goal.trim());
      void id;

      // 2. Upload assets (if any) and hand their URLs to the chat.
      const uploaded: Array<{ name: string; url: string; type: string }> = [];
      if (assets.length > 0) {
        const toastId = toast.loading(`Uploading ${assets.length} asset(s)...`);
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
            uploaded.push({ name: a.name, url: data.url, type: a.file.type });
          }
          toast.success(`Uploaded ${uploaded.length}`, { id: toastId });
        } catch (e) {
          toast.error("Upload failed", {
            id: toastId,
            description: e instanceof Error ? e.message : String(e),
          });
          setCreating(false);
          return;
        }
      }

      // 3. Queue an opening user message into the chat so the agent can
      //    start acting immediately after we land on the editor.
      const { useChatStore } = await import("@/store/chat-store");
      const chat = useChatStore.getState();
      const lines: string[] = [];
      if (goal.trim()) lines.push(goal.trim());
      if (uploaded.length > 0) {
        lines.push("\nI've uploaded these assets:");
        for (const u of uploaded) {
          lines.push(`- ${u.name} (${u.type || "file"}) at ${u.url}`);
        }
        lines.push("Use them in the right places.");
      }
      if (lines.length > 0) {
        chat.addUserMessage(lines.join("\n"));
      }

      onCreated();
      // Fire a submit so the chat sends the queued message automatically.
      setTimeout(() => {
        document.querySelector<HTMLFormElement>("aside form")?.requestSubmit();
      }, 80);
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

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-[10px] uppercase tracking-wider text-neutral-500">
              Project name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. How I grew to $5K MRR"
              className="w-full mt-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-neutral-500">
              Format
            </label>
            <div className="flex gap-1 mt-1 p-0.5 rounded bg-neutral-900 border border-neutral-700">
              {(["landscape", "portrait"] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => setOrient(o)}
                  className={`px-2 py-1 text-[11px] rounded ${
                    orientation === o
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {o === "landscape" ? "16:9" : "9:16"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider text-neutral-500">
            What are we making? (instructions the agent will follow)
          </label>
          <textarea
            ref={goalRef}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder={`Describe the video. e.g. "A 60-second TikTok about morning routines for coders — punchy, self-deprecating, ends on a call to action."\n\nYou can also write a system prompt here that steers the agent across every turn in this project.`}
            rows={6}
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
