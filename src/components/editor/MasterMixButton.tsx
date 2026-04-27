"use client";

import { Sliders } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/store/project-store";

/**
 * Header button + popover for project-wide audio gains. Each slider is
 * a 0–200% multiplier over the renderer's bed/voice/sfx volumes. Lets
 * the user dim music under VO globally without touching every scene.
 */
export function MasterMixButton() {
  const audioMix = useProjectStore((s) => s.project.audioMix);
  const setAudioMix = useProjectStore((s) => s.setAudioMix);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Global ⌘M toggle. Gated against text inputs so users can still
  // type 'm' inside chat / scene editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.shiftKey) return; // ⌘⇧M is mute toggle
      if (e.key.toLowerCase() !== "m") return;
      const t = e.target as HTMLElement | null;
      const inText =
        t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (inText) return;
      e.preventDefault();
      setOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const music = audioMix?.music ?? 1;
  const voice = audioMix?.voice ?? 1;
  const sfx = audioMix?.sfx ?? 1;
  const dirty = music !== 1 || voice !== 1 || sfx !== 1;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Master mix (music / voice / sfx)"
        aria-label="Master mix"
        className={`relative p-1.5 rounded-md transition-colors ${
          open
            ? "text-emerald-300 bg-neutral-800"
            : "text-neutral-400 hover:text-white hover:bg-neutral-800"
        }`}
      >
        <Sliders className="h-4 w-4" />
        {dirty && (
          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-neutral-900 border border-neutral-700 rounded-md shadow-lg p-3 space-y-3">
          <div className="text-[11px] uppercase tracking-wide text-neutral-500">
            Master mix
          </div>
          <MixRow
            label="Music"
            value={music}
            onChange={(v) => setAudioMix({ music: v })}
          />
          <MixRow
            label="Voice"
            value={voice}
            onChange={(v) => setAudioMix({ voice: v })}
          />
          <MixRow
            label="SFX"
            value={sfx}
            onChange={(v) => setAudioMix({ sfx: v })}
          />
          {dirty && (
            <button
              onClick={() =>
                setAudioMix({ music: 1, voice: 1, sfx: 1 })
              }
              className="w-full text-[11px] text-neutral-400 hover:text-white py-1"
            >
              Reset to 100%
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MixRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs text-neutral-300">{label}</span>
        <span className="text-[10px] text-neutral-500 tabular-nums">
          {Math.round(value * 100)}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={2}
        step={0.05}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        onDoubleClick={() => onChange(1)}
        className="w-full accent-emerald-500"
      />
    </label>
  );
}
