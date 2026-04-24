"use client";

import { Loader2, Scissors } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useProjectStore } from "@/store/project-store";

interface ClipItem {
  url: string;
  name?: string;
  trimStart?: number;
  trimEnd?: number;
  durationSec?: number;
  silenceGaps?: Array<{ startSec: number; endSec: number }>;
}

interface Props {
  slotId: string;
}

export function ClipTrimPanel({ slotId }: Props) {
  const project = useProjectStore((s) => s.project);
  const setWorkflowInputs = useProjectStore((s) => s.setWorkflowInputs);
  const clips = (project.workflowInputs?.[slotId] as ClipItem[] | undefined) ?? [];
  const [busy, setBusy] = useState<string | null>(null);

  if (clips.length === 0) return null;

  const updateClip = (idx: number, patch: Partial<ClipItem>) => {
    const next = clips.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    setWorkflowInputs({ [slotId]: next });
  };

  const autoCut = async (idx: number) => {
    setBusy(String(idx));
    try {
      const { detectSilence, trimAroundSilence } = await import("@/lib/silence-detect");
      const clip = clips[idx];
      const { durationSec, ranges } = await detectSilence(clip.url);
      const { trimStart, trimEnd } = trimAroundSilence(durationSec, ranges);
      updateClip(idx, {
        durationSec,
        silenceGaps: ranges,
        trimStart,
        trimEnd,
      });
      toast.success(
        `Trimmed ${(trimStart + (durationSec - trimEnd)).toFixed(1)}s of silence`,
        { description: `${ranges.length} silence ranges found` },
      );
    } catch (e) {
      toast.error("Silence detect failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-2 p-4 border-b border-neutral-800">
      <div className="flex items-center gap-2">
        <Scissors className="h-3.5 w-3.5 text-orange-400" />
        <span className="text-xs font-semibold text-white">Clip trim</span>
      </div>
      <p className="text-[10px] text-neutral-600 leading-tight">
        Auto-cut removes leading / trailing silence. Manually drag the sliders to fine-tune.
      </p>
      {clips.map((clip, i) => {
        const dur = clip.durationSec ?? 60;
        const start = clip.trimStart ?? 0;
        const end = clip.trimEnd ?? dur;
        return (
          <div
            key={i}
            className="flex flex-col gap-1 bg-neutral-900 border border-neutral-800 rounded p-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-neutral-500">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="text-[11px] text-white truncate flex-1">
                {clip.name ?? `clip-${i + 1}`}
              </span>
              <button
                onClick={() => autoCut(i)}
                disabled={busy === String(i)}
                className="flex items-center gap-1 text-[10px] bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white px-2 py-0.5 rounded"
              >
                {busy === String(i) ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Scissors className="h-3 w-3" />
                )}
                Auto-cut
              </button>
            </div>
            {clip.durationSec && (
              <>
                <div className="flex items-center gap-1 text-[10px] text-neutral-500">
                  <span className="w-10">Start</span>
                  <input
                    type="range"
                    min={0}
                    max={dur}
                    step={0.1}
                    value={start}
                    onChange={(e) =>
                      updateClip(i, { trimStart: Number(e.target.value) })
                    }
                    className="flex-1 accent-orange-500 h-1"
                  />
                  <span className="font-mono w-10 text-right">{start.toFixed(1)}s</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-neutral-500">
                  <span className="w-10">End</span>
                  <input
                    type="range"
                    min={0}
                    max={dur}
                    step={0.1}
                    value={end}
                    onChange={(e) =>
                      updateClip(i, { trimEnd: Number(e.target.value) })
                    }
                    className="flex-1 accent-orange-500 h-1"
                  />
                  <span className="font-mono w-10 text-right">{end.toFixed(1)}s</span>
                </div>
                {clip.silenceGaps && clip.silenceGaps.length > 0 && (
                  <div className="text-[9px] text-neutral-600">
                    {clip.silenceGaps.length} silence range
                    {clip.silenceGaps.length === 1 ? "" : "s"} · dur {dur.toFixed(1)}s
                  </div>
                )}
              </>
            )}
            {!clip.durationSec && (
              <div className="text-[9px] text-neutral-600 italic">
                Click Auto-cut to analyze this clip.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
