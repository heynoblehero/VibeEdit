"use client";

import { Copy, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { STYLE_PRESETS } from "@/lib/style-presets";
import { useAssetStore } from "@/store/asset-store";
import { useProjectStore } from "@/store/project-store";
import { useRenderQueueStore } from "@/store/render-queue-store";

/**
 * Renders N variants of the current project in one click. Each variant gets a
 * different style preset + accent — creates N renders in the queue.
 */
export function BatchVariantsButton() {
  const project = useProjectStore((s) => s.project);
  const duplicateProject = useProjectStore((s) => s.duplicateProject);
  const switchProject = useProjectStore((s) => s.switchProject);
  const applyStylePreset = useProjectStore((s) => s.applyStylePreset);
  const { characters, sfx } = useAssetStore();
  const addToQueue = useRenderQueueStore((s) => s.add);
  const updateQueue = useRenderQueueStore((s) => s.update);
  const [busy, setBusy] = useState(false);
  const [n, setN] = useState(3);

  const run = async () => {
    if (project.scenes.length === 0) {
      toast.error("Generate scenes first");
      return;
    }
    setBusy(true);
    const toastId = toast.loading(`Queuing ${n} variants...`);
    const originalId = project.id;
    try {
      const charMap: Record<string, string> = {};
      for (const c of characters) charMap[c.id] = c.src;
      const sfxMap: Record<string, string> = {};
      for (const s of sfx) sfxMap[s.id] = s.src;

      for (let i = 0; i < n; i++) {
        // Duplicate with scenes, then re-apply a rotating preset.
        const newId = duplicateProject({ copyScenes: true });
        const preset = STYLE_PRESETS[i % STYLE_PRESETS.length];
        applyStylePreset(preset.id);

        // Rename variant clearly.
        const state = useProjectStore.getState();
        state.renameProject(
          `${project.name} · variant ${i + 1} (${preset.name})`,
        );

        const latest = useProjectStore.getState().project;
        const startRes = await fetch("/api/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project: latest,
            characters: charMap,
            sfx: sfxMap,
            presetId: "720p",
          }),
        });
        const startData = await startRes.json();
        if (!startRes.ok) {
          console.error("variant render start failed:", startData.error);
          continue;
        }
        const { jobId } = startData as { jobId: string };
        addToQueue({
          jobId,
          projectId: newId,
          projectName: latest.name,
          presetId: "720p",
        });

        // Stream progress without blocking the loop.
        const events = new EventSource(`/api/render/${jobId}/events`);
        events.onmessage = (e) => {
          try {
            const evt = JSON.parse(e.data);
            if (evt.type === "progress") {
              updateQueue(jobId, {
                state: "rendering",
                progress: evt.progress,
                renderedFrames: evt.renderedFrames,
                totalFrames: evt.totalFrames,
              });
            } else if (evt.type === "done") {
              events.close();
              updateQueue(jobId, { state: "done", progress: 1 });
            } else if (evt.type === "failed") {
              events.close();
              updateQueue(jobId, { state: "failed", error: evt.error });
            }
          } catch {
            // ignore
          }
        };
      }

      // Switch back to the original project so the user isn't surprised.
      switchProject(originalId);
      toast.success(`${n} variants queued`, {
        id: toastId,
        description: "Watch the render queue for progress.",
      });
    } catch (e) {
      toast.error("Batch variants failed", {
        id: toastId,
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <select
        value={n}
        onChange={(e) => setN(Number(e.target.value))}
        disabled={busy}
        className="bg-neutral-900 border border-neutral-700 rounded px-1.5 py-0.5 text-[11px] text-white focus:outline-none focus:border-emerald-500"
        title="Number of variants"
      >
        {[2, 3, 4, 5, 6].map((x) => (
          <option key={x} value={x}>{x}×</option>
        ))}
      </select>
      <button
        onClick={run}
        disabled={busy || project.scenes.length === 0}
        title="Queue N variants (different style presets) in parallel"
        className="flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded border border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500 disabled:opacity-50 transition-colors"
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Copy className="h-3 w-3" />}
        Variants
      </button>
    </div>
  );
}
