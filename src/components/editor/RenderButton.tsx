"use client";

import { ChevronDown, Download, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  RENDER_PRESETS,
  totalDurationSeconds,
  type RenderPresetId,
} from "@/lib/scene-schema";
import { useAssetStore } from "@/store/asset-store";
import { useProjectStore } from "@/store/project-store";
import { useRenderQueueStore } from "@/store/render-queue-store";

export function RenderButton() {
  const project = useProjectStore((s) => s.project);
  const { characters, sfx } = useAssetStore();
  const addToQueue = useRenderQueueStore((s) => s.add);
  const updateQueue = useRenderQueueStore((s) => s.update);

  const [presetId, setPresetId] = useState<RenderPresetId>("1080p");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Warm the Remotion bundle in the background so the first render is fast.
    fetch("/api/render/warm", { method: "POST" }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const runRender = async (selectedPresetId: RenderPresetId) => {
    if (project.scenes.length === 0) return;

    const charMap: Record<string, string> = {};
    for (const c of characters) charMap[c.id] = c.src;
    const sfxMap: Record<string, string> = {};
    for (const s of sfx) sfxMap[s.id] = s.src;

    let jobId: string;
    try {
      const startRes = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project,
          characters: charMap,
          sfx: sfxMap,
          presetId: selectedPresetId,
        }),
      });
      if (!startRes.ok) {
        const err = await startRes.text();
        throw new Error(`Failed to start render: ${err.slice(0, 200)}`);
      }
      const data = (await startRes.json()) as { jobId: string };
      jobId = data.jobId;
    } catch (e) {
      toast.error("Render failed to start", {
        description: e instanceof Error ? e.message : String(e),
      });
      return;
    }

    addToQueue({
      jobId,
      projectId: project.id,
      projectName: project.name || "Untitled",
      presetId: selectedPresetId,
    });

    const events = new EventSource(`/api/render/${jobId}/events`);
    events.onmessage = async (e) => {
      try {
        const evt = JSON.parse(e.data);
        switch (evt.type) {
          case "stage":
            updateQueue(jobId, { state: "rendering" });
            break;
          case "composition":
            updateQueue(jobId, { state: "rendering", totalFrames: evt.totalFrames });
            break;
          case "progress":
            updateQueue(jobId, {
              state: "rendering",
              progress: evt.progress,
              renderedFrames: evt.renderedFrames,
              totalFrames: evt.totalFrames,
            });
            break;
          case "done": {
            events.close();
            updateQueue(jobId, {
              state: "done",
              progress: 1,
              sizeBytes: evt.sizeBytes,
            });
            await downloadRender(jobId, project.name, selectedPresetId);
            updateQueue(jobId, { state: "downloaded" });
            break;
          }
          case "failed":
            events.close();
            updateQueue(jobId, {
              state: "failed",
              error: evt.error ?? "render failed",
            });
            toast.error(`Render failed (${project.name})`, {
              description: evt.error ?? "unknown error",
            });
            break;
        }
      } catch (parseErr) {
        console.error("SSE parse error:", parseErr);
      }
    };
    events.onerror = () => {
      events.close();
      updateQueue(jobId, {
        state: "failed",
        error: "connection to render stream lost",
      });
    };
  };

  const handleClickDefault = () => {
    setMenuOpen(false);
    void runRender(presetId);
  };

  const handlePresetClick = (id: RenderPresetId) => {
    setPresetId(id);
    setMenuOpen(false);
    void runRender(id);
  };

  const active = useRenderQueueStore((s) =>
    s.items.find(
      (it) =>
        it.projectId === project.id &&
        (it.state === "queued" || it.state === "rendering"),
    ),
  );
  const pct = active ? Math.round(active.progress * 100) : 0;
  const isBusy = !!active;
  const dur = totalDurationSeconds(project.scenes);
  // Rough ETA: 1.5× real-time per scene at 1080p, more at 4k. Good enough to
  // set expectations (not promise).
  const etaMultiplier = presetId === "4k" ? 3 : presetId === "1080p" ? 1.5 : 1;
  const etaSec = Math.round(dur * etaMultiplier);
  const etaLabel =
    etaSec < 60 ? `~${etaSec}s` : `~${Math.round(etaSec / 60)}m`;
  const renderTooltip =
    project.scenes.length === 0
      ? "No scenes yet"
      : `${project.scenes.length} scenes · ${dur.toFixed(1)}s · ETA ${etaLabel}`;

  return (
    <div className="flex items-stretch" ref={menuRef}>
      <button
        onClick={handleClickDefault}
        disabled={isBusy || project.scenes.length === 0}
        title={renderTooltip}
        className="flex items-center gap-2 bg-white text-black text-sm font-semibold px-4 py-1.5 rounded-l-lg disabled:opacity-30 hover:bg-neutral-200 transition-colors"
      >
        {isBusy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {isBusy
          ? pct > 0
            ? `Rendering ${pct}%`
            : "Rendering..."
          : project.scenes.length > 0
            ? `Render · ${dur.toFixed(1)}s`
            : "Render"}
      </button>
      <button
        onClick={() => setMenuOpen((v) => !v)}
        disabled={project.scenes.length === 0}
        className="flex items-center bg-neutral-200 text-black px-1.5 py-1.5 rounded-r-lg border-l border-neutral-400 hover:bg-neutral-300 disabled:opacity-30 transition-colors"
        title="Change render preset"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
      {menuOpen && (
        <div className="absolute top-full right-4 mt-1 w-60 bg-neutral-950 border border-neutral-800 rounded-lg shadow-xl z-50 p-1.5">
          {RENDER_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => handlePresetClick(p.id)}
              className={`flex flex-col items-start w-full px-2 py-1.5 rounded text-left transition-colors ${
                p.id === presetId
                  ? "bg-emerald-500/10 text-emerald-300"
                  : "hover:bg-neutral-800 text-neutral-200"
              }`}
            >
              <span className="text-xs font-medium">{p.label}</span>
              <span className="text-[10px] text-neutral-500">{p.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

async function downloadRender(
  jobId: string,
  projectName: string,
  presetId: RenderPresetId,
) {
  try {
    const dlRes = await fetch(`/api/render/${jobId}/download`);
    if (!dlRes.ok) {
      const err = await dlRes.text();
      throw new Error(`Download failed: ${err.slice(0, 200)}`);
    }
    const blob = await dlRes.blob();
    const extension =
      RENDER_PRESETS.find((p) => p.id === presetId)?.extension ?? "mp4";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectName || "vibeedit"}-${Date.now()}.${extension}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Render complete: ${projectName}`, {
      description: `${(blob.size / 1024 / 1024).toFixed(1)} MB · ${presetId}`,
    });
  } catch (e) {
    toast.error("Download failed", {
      description: e instanceof Error ? e.message : String(e),
    });
  }
}
