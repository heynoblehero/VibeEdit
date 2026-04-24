"use client";

import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { getOrientation, type Scene } from "@/lib/scene-schema";
import type {
  InputSlot,
  SlotAiGenerator,
  SlotValues,
  WorkflowDefinition,
} from "@/lib/workflows/types";
import { useAssetStore } from "@/store/asset-store";
import { useProjectStore } from "@/store/project-store";
import { SortFolderButton } from "./SortFolderButton";

interface SlotProps {
  slot: InputSlot;
  value: unknown;
  onChange: (v: unknown) => void;
  onRunAi?: (generator: SlotAiGenerator) => void;
  onSubmit?: () => void;
  aiRunning: boolean;
  accent: string;
}

function TextSlot({
  slot,
  value,
  onChange,
  onRunAi,
  onSubmit,
  aiRunning,
  accent,
}: SlotProps) {
  const multiline = slot.type === "text";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
          {slot.label}
        </label>
        {slot.aiGenerator && onRunAi && (
          <button
            onClick={() => onRunAi(slot.aiGenerator!)}
            disabled={aiRunning}
            className="flex items-center gap-1 text-[10px] font-medium text-white px-2 py-0.5 rounded transition-colors disabled:opacity-50"
            style={{ backgroundColor: `${accent}cc` }}
          >
            {aiRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
            {slot.aiGenerator.label}
          </button>
        )}
      </div>
      {multiline ? (
        <textarea
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (onSubmit && (e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              onSubmit();
            }
          }}
          placeholder={slot.description}
          className="w-full h-36 bg-neutral-900 border border-neutral-700 rounded-lg p-2.5 text-sm text-white resize-none focus:outline-none focus:border-emerald-500 placeholder:text-neutral-600 leading-relaxed"
        />
      ) : (
        <input
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (slot.aiGenerator && onRunAi && (e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              onRunAi(slot.aiGenerator);
            }
          }}
          placeholder={slot.description}
          className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500 placeholder:text-neutral-600"
        />
      )}
    </div>
  );
}

function SelectionSlot({ slot, value, onChange, accent }: SlotProps) {
  const options = slot.options ?? [];
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
        {slot.label}
      </label>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const selected = String(value ?? "") === o.value;
          return (
            <button
              key={o.value}
              onClick={() => onChange(o.value)}
              title={o.description}
              className="text-[10px] py-1 px-2 rounded border transition-colors"
              style={{
                backgroundColor: selected ? `${accent}22` : "transparent",
                borderColor: selected ? accent : "#3f3f46",
                color: selected ? accent : "#a3a3a3",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {slot.description && (
        <span className="text-[10px] text-neutral-600 leading-tight">{slot.description}</span>
      )}
    </div>
  );
}

function FileListSlot({ slot, value, onChange, onRunAi, aiRunning, accent }: SlotProps) {
  const files = (value as Array<{ url: string; name?: string; prompt?: string }> | undefined) ?? [];
  const accepts = (slot.accepts ?? []).join(",");
  const isImageOnly = accepts === "image/*" || accepts === "";
  const [urlImporting, setUrlImporting] = useState(false);

  const handleUrlImport = async () => {
    const url = window.prompt("Paste a YouTube or podcast URL:");
    if (!url?.trim()) return;
    setUrlImporting(true);
    try {
      const res = await fetch("/api/ingest-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), kind: slot.supportsUrlImport }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `ingest failed (${res.status})`);
      onChange([
        ...files,
        { url: data.url, name: data.name, prompt: data.name },
      ]);
    } catch (e) {
      const { toast } = await import("sonner");
      toast.error("URL import failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setUrlImporting(false);
    }
  };

  const handleUpload = async (incoming: FileList | null) => {
    if (!incoming || incoming.length === 0) return;
    const list = Array.from(incoming);
    const results: Array<{ url: string; name: string; prompt?: string }> = [];
    for (const f of list) {
      const isImage = f.type.startsWith("image/");
      // Images: data-URL inline (fits in localStorage for small sets).
      // Video/audio: upload to /api/assets/upload so the file lives on disk.
      if (isImage && f.size < 2 * 1024 * 1024) {
        const dataUrl: string = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = () => reject(r.error);
          r.readAsDataURL(f);
        });
        results.push({ url: dataUrl, name: f.name, prompt: f.name });
      } else {
        const form = new FormData();
        form.append("file", f);
        const res = await fetch("/api/assets/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `upload failed (${res.status})`);
        results.push({ url: data.url, name: f.name, prompt: f.name });
      }
    }
    onChange([...files, ...results]);
  };

  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
          {slot.label}
        </label>
        {slot.aiGenerator && onRunAi && (
          <button
            onClick={() => onRunAi(slot.aiGenerator!)}
            disabled={aiRunning}
            className="flex items-center gap-1 text-[10px] font-medium text-white px-2 py-0.5 rounded transition-colors disabled:opacity-50"
            style={{ backgroundColor: `${accent}cc` }}
          >
            {aiRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
            {slot.aiGenerator.label}
          </button>
        )}
      </div>
      {slot.description && (
        <span className="text-[10px] text-neutral-600 leading-tight">{slot.description}</span>
      )}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setDragOver(false);
          try {
            await handleUpload(e.dataTransfer.files);
          } catch (err) {
            const { toast } = await import("sonner");
            toast.error("Upload failed", {
              description: err instanceof Error ? err.message : String(err),
            });
          }
        }}
        className={`border border-dashed rounded p-2 transition-colors ${
          dragOver ? "border-emerald-500 bg-emerald-500/5" : "border-neutral-800"
        }`}
      >
        {files.length === 0 ? (
          <div className="text-[11px] text-neutral-600 italic text-center py-2">
            Drag files here, click below, or use AI generate
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1">
            {files.map((f, i) => (
              isImageOnly || /\.(png|jpe?g|gif|webp)$/i.test(f.url) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={f.url}
                  alt=""
                  title={f.name ?? f.prompt}
                  className="aspect-square object-cover w-full rounded border border-neutral-800"
                />
              ) : (
                <div
                  key={i}
                  title={f.name ?? f.prompt}
                  className="aspect-square w-full rounded border border-neutral-800 bg-neutral-900 flex items-center justify-center text-[9px] text-neutral-400 p-1 text-center overflow-hidden"
                >
                  {f.name ?? `file-${i + 1}`}
                </div>
              )
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-neutral-500 cursor-pointer hover:text-neutral-300">
          <input
            type="file"
            multiple
            accept={accepts || undefined}
            className="hidden"
            onChange={async (e) => {
              try {
                await handleUpload(e.target.files);
              } catch (err) {
                const { toast } = await import("sonner");
                toast.error("Upload failed", {
                  description: err instanceof Error ? err.message : String(err),
                });
              }
              e.target.value = "";
            }}
          />
          + upload
        </label>
        {slot.supportsUrlImport && (
          <button
            onClick={handleUrlImport}
            disabled={urlImporting}
            className="text-[10px] text-neutral-500 hover:text-white disabled:opacity-50"
          >
            {urlImporting ? "importing..." : "+ from URL"}
          </button>
        )}
        {files.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="text-[10px] text-neutral-500 hover:text-red-400"
          >
            clear
          </button>
        )}
        <span className="ml-auto text-[10px] text-neutral-600">{files.length} items</span>
      </div>
    </div>
  );
}

function FileSingleSlot({ slot, value, onChange, accent }: SlotProps) {
  const current = value as { url: string; name?: string } | undefined;
  const accepts = (slot.accepts ?? []).join(",");
  const [urlImporting, setUrlImporting] = useState(false);

  const handleUpload = async (incoming: FileList | null) => {
    const f = incoming?.[0];
    if (!f) return;
    const form = new FormData();
    form.append("file", f);
    const res = await fetch("/api/assets/upload", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `upload failed (${res.status})`);
    onChange({ url: data.url, name: f.name });
  };

  const handleUrlImport = async () => {
    const url = window.prompt("Paste a YouTube or podcast URL:");
    if (!url?.trim()) return;
    setUrlImporting(true);
    try {
      const res = await fetch("/api/ingest-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), kind: slot.supportsUrlImport }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `ingest failed (${res.status})`);
      onChange({ url: data.url, name: data.name });
    } catch (e) {
      const { toast } = await import("sonner");
      toast.error("URL import failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setUrlImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
        {slot.label}
      </label>
      {slot.description && (
        <span className="text-[10px] text-neutral-600 leading-tight">{slot.description}</span>
      )}
      {current ? (
        <div className="flex items-center gap-2 text-xs text-neutral-300 bg-neutral-900 border border-neutral-800 rounded px-2 py-1 truncate">
          <span className="truncate flex-1">{current.name ?? current.url}</span>
          <button
            onClick={() => onChange(undefined)}
            className="text-[10px] text-neutral-500 hover:text-red-400"
          >
            remove
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <label
            className="flex items-center justify-center gap-2 text-[11px] text-neutral-400 border border-dashed border-neutral-800 rounded py-2 cursor-pointer hover:border-neutral-600"
            style={{ color: accent }}
          >
            <input
              type="file"
              accept={accepts || undefined}
              className="hidden"
              onChange={async (e) => {
                try {
                  await handleUpload(e.target.files);
                } catch (err) {
                  const { toast } = await import("sonner");
                  toast.error("Upload failed", {
                    description: err instanceof Error ? err.message : String(err),
                  });
                }
                e.target.value = "";
              }}
            />
            + upload
          </label>
          {slot.supportsUrlImport && (
            <button
              onClick={handleUrlImport}
              disabled={urlImporting}
              className="text-[10px] text-neutral-500 hover:text-white disabled:opacity-50 text-center"
            >
              {urlImporting ? "importing..." : "or paste a URL"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function StructuredListSlot({ slot, value, onChange, onRunAi, aiRunning, accent }: SlotProps) {
  type Item = { title: string; description?: string; imageUrl?: string };
  const items = (value as Item[] | undefined) ?? [];

  const updateItem = (idx: number, patch: Partial<Item>) => {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange(next);
  };
  const addItem = () => onChange([...items, { title: "" }]);
  const removeItem = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
          {slot.label}
        </label>
        {slot.aiGenerator && onRunAi && (
          <button
            onClick={() => onRunAi(slot.aiGenerator!)}
            disabled={aiRunning}
            className="flex items-center gap-1 text-[10px] font-medium text-white px-2 py-0.5 rounded transition-colors disabled:opacity-50"
            style={{ backgroundColor: `${accent}cc` }}
          >
            {aiRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
            {slot.aiGenerator.label}
          </button>
        )}
      </div>
      {slot.description && (
        <span className="text-[10px] text-neutral-600 leading-tight">{slot.description}</span>
      )}
      <div className="flex flex-col gap-1.5">
        {items.map((it, i) => (
          <div key={i} className="flex items-start gap-1.5 bg-neutral-900 border border-neutral-800 rounded p-1.5">
            <span className="text-[10px] font-mono text-neutral-500 pt-1 w-5 text-right">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="flex-1 flex flex-col gap-1">
              <input
                type="text"
                value={it.title}
                onChange={(e) => updateItem(i, { title: e.target.value })}
                placeholder="Title"
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <input
                type="text"
                value={it.description ?? ""}
                onChange={(e) => updateItem(i, { description: e.target.value })}
                placeholder="Description (optional)"
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-1.5 py-0.5 text-[11px] text-neutral-300 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button
              onClick={() => removeItem(i)}
              className="text-[10px] text-neutral-600 hover:text-red-400 px-1"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          onClick={addItem}
          className="text-[11px] text-neutral-500 hover:text-white text-left px-1 py-1"
        >
          + add item
        </button>
      </div>
    </div>
  );
}

interface Props {
  workflow: WorkflowDefinition;
}

export function WorkflowInputs({ workflow }: Props) {
  const project = useProjectStore((s) => s.project);
  const setScenes = useProjectStore((s) => s.setScenes);
  const setWorkflowInputs = useProjectStore((s) => s.setWorkflowInputs);
  const isGenerating = useProjectStore((s) => s.isGenerating);
  const setGenerating = useProjectStore((s) => s.setGenerating);
  const setScript = useProjectStore((s) => s.setScript);
  const applyStylePreset = useProjectStore((s) => s.applyStylePreset);
  const { characters, sfx } = useAssetStore();
  const [runningAi, setRunningAi] = useState<string | null>(null);

  const orientation = getOrientation(project);
  const ctx = useMemo(
    () => ({ orientation, characters, sfx }),
    [orientation, characters, sfx],
  );

  const values = useMemo(() => {
    const raw = project.workflowInputs ?? {};
    const filled: Record<string, unknown> = { ...raw };
    for (const slot of workflow.slots) {
      if (filled[slot.id] === undefined && slot.defaultValue !== undefined) {
        filled[slot.id] = slot.defaultValue;
      }
    }
    // Keep slot.script in sync with project.script for backwards compat.
    if (filled.script === undefined && project.script) {
      filled.script = project.script;
    }
    return filled;
  }, [project.workflowInputs, project.script, workflow.slots]);

  useEffect(() => {
    // Seed the workflow inputs with defaults the first time the user picks
    // this workflow.
    if (!project.workflowInputs || Object.keys(project.workflowInputs).length === 0) {
      const defaults: SlotValues = {};
      for (const slot of workflow.slots) {
        if (slot.defaultValue !== undefined) defaults[slot.id] = slot.defaultValue;
      }
      if (Object.keys(defaults).length > 0) {
        setWorkflowInputs(defaults);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow.id]);

  const update = (slotId: string, v: unknown) => {
    setWorkflowInputs({ [slotId]: v });
    if (slotId === "script" || slotId === "story") {
      setScript(typeof v === "string" ? v : "");
    }
  };

  const handleRunAi = async (generator: SlotAiGenerator) => {
    setRunningAi(generator.produces);
    try {
      if (!workflow.runAiGenerator) {
        throw new Error("This workflow has no AI generators");
      }
      const result = await workflow.runAiGenerator(generator, values, ctx);
      update(generator.produces, result);
      toast.success(`${generator.label} done`);
    } catch (e) {
      toast.error(`${generator.label} failed`, {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setRunningAi(null);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    const toastId = toast.loading("Generating scenes...");
    try {
      if (workflow.generateStream) {
        const collected: Scene[] = [];
        setScenes([]);
        await workflow.generateStream(values, ctx, {
          onScene: (s) => {
            collected.push(s);
            setScenes([...collected]);
            toast.loading(`Generating... (${collected.length})`, { id: toastId });
          },
          onDone: (count) => {
            toast.success(`Generated ${count || collected.length} scenes`, { id: toastId });
          },
          onError: (msg) => {
            throw new Error(msg);
          },
        });
      } else {
        const result = await workflow.generate(values, ctx);
        setScenes(result.scenes as Scene[]);
        if (result.script && !project.script) setScript(result.script);
        toast.success(`Generated ${result.scenes.length} scenes`, { id: toastId });
      }

      // Apply style preset if this workflow has one selected.
      const stylePreset = String(values.stylePreset ?? "");
      if (stylePreset) {
        applyStylePreset(stylePreset);
      }
    } catch (e) {
      toast.error("Generate failed", {
        id: toastId,
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setGenerating(false);
    }
  };

  const canGenerate = workflow.slots
    .filter((s) => s.required)
    .every((s) => {
      const v = values[s.id];
      if (typeof v === "string") return v.trim().length > 0;
      if (Array.isArray(v)) return v.length > 0;
      return v != null;
    });

  return (
    <div className="flex flex-col gap-3 p-4 border-b border-neutral-800">
      {workflow.slots.some((s) => s.type === "file-folder" || s.type === "image-pack") && (
        <SortFolderButton
          slots={workflow.slots}
          values={values}
          onBulkUpdate={(patch) => {
            // setWorkflowInputs accepts a patch — each key becomes a slot id.
            setWorkflowInputs(patch);
          }}
        />
      )}

      {workflow.slots.map((slot) => {
        const v = values[slot.id];
        const aiRunning = runningAi === slot.aiGenerator?.produces;
        const common = {
          slot,
          value: v,
          onChange: (nv: unknown) => update(slot.id, nv),
          onRunAi: handleRunAi,
          onSubmit: handleGenerate,
          aiRunning,
          accent: workflow.accentColor,
        };
        if (slot.type === "file-folder" || slot.type === "image-pack") {
          return <FileListSlot key={slot.id} {...common} />;
        }
        if (slot.type === "file-single") {
          return <FileSingleSlot key={slot.id} {...common} />;
        }
        if (slot.type === "selection") {
          return <SelectionSlot key={slot.id} {...common} />;
        }
        if (slot.type === "structured-list") {
          return <StructuredListSlot key={slot.id} {...common} />;
        }
        return <TextSlot key={slot.id} {...common} />;
      })}

      <button
        onClick={handleGenerate}
        disabled={isGenerating || !canGenerate}
        className="flex items-center justify-center gap-2 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
        style={{ backgroundColor: workflow.accentColor }}
      >
        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        Make video
      </button>
    </div>
  );
}
