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
            // Stable, shareable URL the queue item exposes to the
            // Render tab + share sheet. We point at the same /download
            // endpoint we'd auto-fetch from; the server keeps the file
            // around for re-download (no longer one-shot). Building it
            // off `location.origin` so links work both on the live web
            // and inside the Capacitor WebView.
            const origin = typeof window !== "undefined" ? window.location.origin : "";
            const outputUrl = `${origin}/api/render/${jobId}/download`;
            updateQueue(jobId, {
              state: "done",
              progress: 1,
              sizeBytes: evt.sizeBytes,
              outputUrl,
            });
            await finishRender(jobId, project.name, selectedPresetId, outputUrl);
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

  // Cmd+R global shortcut → render with the current default preset.
  // Emitted by KeyboardShortcuts so the binding can be discovered
  // alongside the rest of the editor keys.
  useEffect(() => {
    const onTrigger = () => {
      if (project.scenes.length === 0) {
        toast.error("Add a scene first");
        return;
      }
      void runRender(presetId);
    };
    window.addEventListener("vibeedit:render-now", onTrigger);
    return () => window.removeEventListener("vibeedit:render-now", onTrigger);
    // runRender is stable enough; presetId changes are intentionally captured.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetId, project.scenes.length]);

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

/**
 * Render-completion handler.
 *
 * On a desktop browser we trigger a synthetic-anchor download so the
 * file lands in the user's Downloads folder automatically — that's
 * the existing UX, no reason to break it.
 *
 * On Capacitor (Android/iOS WebView) the synthetic-click pattern
 * silently fails: the WebView has no DownloadListener wired by
 * default, so the click goes nowhere and the user thinks the render
 * vanished. Skip the auto-download there entirely; instead the queue
 * item's `outputUrl` (set by the caller) drives the Render tab's
 * Share + Download buttons, which use the system share sheet.
 *
 * Either way we toast prominently with a "Render tab" action so the
 * user always knows where the file is.
 */
async function finishRender(
  jobId: string,
  projectName: string,
  presetId: RenderPresetId,
  outputUrl: string,
) {
  let isNative = false;
  try {
    const { Capacitor } = await import("@capacitor/core");
    isNative = Capacitor.isNativePlatform();
  } catch {
    isNative = false;
  }

  // Read size for the toast — cheap HEAD probe, doesn't pull the bytes.
  let sizeMb: string | null = null;
  try {
    const head = await fetch(outputUrl, { method: "HEAD" });
    const len = Number(head.headers.get("content-length") || 0);
    if (len > 0) sizeMb = `${(len / 1024 / 1024).toFixed(1)} MB`;
  } catch {
    // non-fatal
  }

  if (!isNative) {
    // Desktop / web: auto-save to Downloads as before.
    try {
      const res = await fetch(outputUrl);
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const blob = await res.blob();
      const extension =
        RENDER_PRESETS.find((p) => p.id === presetId)?.extension ?? "mp4";
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${projectName || "vibeedit"}-${Date.now()}.${extension}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      toast.error("Auto-download failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Always toast — on phone this is the only signal the user gets.
  toast.success(`Render complete: ${projectName}`, {
    description: sizeMb
      ? `${sizeMb} · ${presetId} · open the Render tab to save or share`
      : `${presetId} · open the Render tab to save or share`,
    duration: 8000,
  });
}
