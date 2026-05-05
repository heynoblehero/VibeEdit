"use client";

import { CheckCircle2, Download, Loader2, Trash2, X, XCircle } from "lucide-react";
import { toast } from "@/lib/toast";
import { useRenderQueueStore } from "@/store/render-queue-store";

function formatEta(item: {
  progress: number;
  createdAt: number;
  state: string;
}): string {
  if (item.state !== "rendering" || item.progress <= 0.01) return "estimating…";
  const elapsedMs = Date.now() - item.createdAt;
  const totalMs = elapsedMs / item.progress;
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const sec = Math.ceil(remainingMs / 1000);
  if (sec < 60) return `${sec}s left`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")} left`;
}

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

  if (items.length === 0) return null;

  // Collapsed pill — visible on every page (dashboard included) so the
  // user can monitor in-flight renders without losing them on
  // navigation. Click expands the full panel.
  if (!open) {
    const active = items.filter(
      (i) => i.state === "rendering" || i.state === "queued",
    );
    const done = items.filter(
      (i) => i.state === "done" || i.state === "downloaded",
    );
    const failed = items.filter((i) => i.state === "failed");
    const summary = active.length
      ? `${active.length} rendering`
      : failed.length
        ? `${failed.length} failed`
        : `${done.length} ready`;
    const tone = active.length
      ? "border-emerald-500/40 text-emerald-200"
      : failed.length
        ? "border-red-500/40 text-red-200"
        : "border-neutral-700 text-neutral-300";
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-full bg-neutral-950 border ${tone} shadow-lg motion-pop hover:bg-neutral-900 transition-colors`}
      >
        {active.length ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : failed.length ? (
          <XCircle className="h-3.5 w-3.5" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5" />
        )}
        <span className="text-[11px] font-semibold">{summary}</span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-neutral-950 border border-neutral-800 rounded-lg shadow-2xl z-50 flex flex-col motion-slide-up">
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
                      className="h-full bg-emerald-500 transition-[width] duration-300 ease-out"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
                <div className="text-[10px] text-neutral-500 flex items-center gap-1.5">
                  {it.state === "rendering" && (
                    <>
                      <span className="text-emerald-300/70 tabular-nums">
                        {pct}%
                      </span>
                      <span>·</span>
                      <span className="tabular-nums">
                        {it.renderedFrames}/{it.totalFrames} frames
                      </span>
                      <span>·</span>
                      <span className="text-emerald-200/70 tabular-nums">
                        {formatEta(it)}
                      </span>
                    </>
                  )}
                  {it.state === "done" && "ready for download"}
                  {it.state === "downloaded" &&
                    it.sizeBytes &&
                    `${(it.sizeBytes / 1024 / 1024).toFixed(1)} MB`}
                  {it.state === "failed" && (it.error ?? "failed")}
                  {it.state === "queued" && "waiting for free slot"}
                </div>
              </div>
              {(it.state === "rendering" || it.state === "queued") && (
                <button
                  type="button"
                  onClick={async () => {
                    // Best-effort cancel — the server route may not exist
                    // yet; surface a hint to the user if it doesn't.
                    try {
                      const res = await fetch(`/api/render/${it.jobId}/cancel`, {
                        method: "POST",
                      });
                      if (res.ok) {
                        toast.info("Render cancelled");
                      } else {
                        toast.error("Couldn't cancel — server didn't accept it");
                      }
                    } catch {
                      toast.error("Couldn't reach server");
                    }
                    remove(it.jobId);
                  }}
                  className="p-1 text-neutral-600 hover:text-orange-400 transition-colors"
                  title="Cancel render"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
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
