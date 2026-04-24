"use client";

import { CalendarClock, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { RENDER_PRESETS, type RenderPresetId } from "@/lib/scene-schema";
import { useAssetStore } from "@/store/asset-store";
import { useProjectStore } from "@/store/project-store";

interface ScheduledItem {
  id: string;
  runAt: number;
  project: { id: string; name?: string };
  presetId: string;
  jobId?: string;
  firedAt?: number;
}

function defaultWhenISO(): string {
  // default: 10 minutes from now, rounded down to minute
  const d = new Date(Date.now() + 10 * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function ScheduleRenderDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const project = useProjectStore((s) => s.project);
  const { characters, sfx } = useAssetStore();
  const [when, setWhen] = useState(defaultWhenISO);
  const [presetId, setPresetId] = useState<RenderPresetId>("1080p");
  const [busy, setBusy] = useState(false);
  const [scheduled, setScheduled] = useState<ScheduledItem[]>([]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/render/schedule")
      .then((r) => r.json())
      .then((d) => setScheduled((d.scheduled ?? []) as ScheduledItem[]))
      .catch(() => {});
  }, [open]);

  const cancel = async (id: string) => {
    try {
      await fetch(`/api/render/schedule?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setScheduled((prev) => prev.filter((s) => s.id !== id));
      toast.success("Scheduled render cancelled");
    } catch (e) {
      toast.error("Cancel failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    }
  };

  if (!open) return null;

  const pending = scheduled.filter((s) => !s.firedAt);

  const submit = async () => {
    setBusy(true);
    try {
      const charMap: Record<string, string> = {};
      for (const c of characters) charMap[c.id] = c.src;
      const sfxMap: Record<string, string> = {};
      for (const s of sfx) sfxMap[s.id] = s.src;
      const runAt = new Date(when);
      if (Number.isNaN(runAt.getTime())) throw new Error("invalid time");
      const res = await fetch("/api/render/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runAt: runAt.toISOString(),
          project,
          characters: charMap,
          sfx: sfxMap,
          presetId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `schedule failed (${res.status})`);
      toast.success(`Render scheduled for ${runAt.toLocaleString()}`);
      onClose();
    } catch (e) {
      toast.error("Schedule failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-neutral-950 border border-neutral-800 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-semibold text-white">Schedule render</span>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-neutral-500">
            Run at
          </label>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wider text-neutral-500">
            Preset
          </label>
          <select
            value={presetId}
            onChange={(e) => setPresetId(e.target.value as RenderPresetId)}
            className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-amber-500"
          >
            {RENDER_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
        <p className="text-[10px] text-neutral-600 leading-tight">
          Scheduled renders fire via in-process timers — keep the dev server running past the scheduled time.
        </p>

        {pending.length > 0 && (
          <div className="flex flex-col gap-1 pt-2 border-t border-neutral-800">
            <span className="text-[10px] uppercase tracking-wider text-neutral-500">
              Pending
            </span>
            {pending.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded px-2 py-1"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-white truncate">
                    {s.project.name ?? "Untitled"}
                  </div>
                  <div className="text-[10px] text-neutral-500">
                    {new Date(s.runAt).toLocaleString()} · {s.presetId}
                  </div>
                </div>
                <button
                  onClick={() => cancel(s.id)}
                  className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
                  title="Cancel"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="text-[11px] text-neutral-500 hover:text-white px-2"
          >
            cancel
          </button>
          <button
            onClick={submit}
            disabled={busy}
            className="ml-auto flex items-center gap-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
}
