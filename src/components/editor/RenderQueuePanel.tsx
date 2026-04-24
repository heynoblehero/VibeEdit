"use client";

import { CheckCircle2, Download, Loader2, Trash2, X, XCircle } from "lucide-react";
import { useRenderQueueStore } from "@/store/render-queue-store";

const STATE_META: Record<
  string,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  queued: { label: "Queued", className: "text-neutral-400", icon: Loader2 },
  rendering: { label: "Rendering", className: "text-emerald-300", icon: Loader2 },
  done: { label: "Done", className: "text-emerald-400", icon: CheckCircle2 },
  downloaded: { label: "Downloaded", className: "text-neutral-500", icon: CheckCircle2 },
  failed: { label: "Failed", className: "text-red-400", icon: XCircle },
};

export function RenderQueuePanel() {
  const items = useRenderQueueStore((s) => s.items);
  const open = useRenderQueueStore((s) => s.panelOpen);
  const setOpen = useRenderQueueStore((s) => s.setPanelOpen);
  const remove = useRenderQueueStore((s) => s.remove);
  const clearDone = useRenderQueueStore((s) => s.clearDone);

  if (!open || items.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-neutral-950 border border-neutral-800 rounded-lg shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Download className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-xs font-semibold text-white">Render queue</span>
          <span className="text-[10px] text-neutral-500">{items.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearDone}
            className="text-[10px] text-neutral-500 hover:text-white px-2 py-0.5 rounded transition-colors"
            title="Clear completed jobs"
          >
            clear done
          </button>
          <button
            onClick={() => setOpen(false)}
            className="p-1 text-neutral-500 hover:text-white transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="flex flex-col max-h-96 overflow-y-auto">
        {items.map((it) => {
          const meta = STATE_META[it.state] ?? STATE_META.queued;
          const Icon = meta.icon;
          const pct = Math.round(it.progress * 100);
          const spinning = it.state === "rendering" || it.state === "queued";
          return (
            <div
              key={it.jobId}
              className="flex items-center gap-2 px-3 py-2 border-b border-neutral-900 last:border-b-0"
            >
              <Icon
                className={`h-3.5 w-3.5 shrink-0 ${meta.className} ${spinning ? "animate-spin" : ""}`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white truncate">
                    {it.projectName}
                  </span>
                  <span className="text-[10px] text-neutral-500">{it.presetId}</span>
                </div>
                {it.state === "rendering" && (
                  <div className="mt-1 h-1 w-full bg-neutral-900 rounded overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
                <div className="text-[10px] text-neutral-500">
                  {it.state === "rendering" &&
                    `${pct}% · ${it.renderedFrames}/${it.totalFrames} frames`}
                  {it.state === "done" && "waiting for download..."}
                  {it.state === "downloaded" &&
                    it.sizeBytes &&
                    `${(it.sizeBytes / 1024 / 1024).toFixed(1)} MB`}
                  {it.state === "failed" && (it.error ?? "failed")}
                  {it.state === "queued" && "waiting for free slot"}
                </div>
              </div>
              <button
                onClick={() => remove(it.jobId)}
                className="p-1 text-neutral-600 hover:text-red-400 transition-colors"
                title="Remove from queue"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
