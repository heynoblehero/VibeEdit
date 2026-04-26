"use client";

import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Cut, CutKind, Easing, Scene } from "@/lib/scene-schema";
import { useProjectStore } from "@/store/project-store";

const CUT_KINDS: CutKind[] = [
  "hard",
  "fade",
  "dip_to_black",
  "dip_to_white",
  "iris",
  "clock_wipe",
  "flip",
  "wipe",
  "slide_left",
  "slide_right",
  "zoom_blur",
  "beat_flash",
  "beat_flash_colored",
  "smash_cut",
  "whip_pan",
  "glitch_cut",
  "jump_cut",
  "match_cut",
];

const EASINGS: Easing[] = [
  "linear",
  "ease_in",
  "ease_out",
  "ease_in_out",
  "ease_in_back",
  "ease_out_back",
  "ease_in_out_back",
  "spring",
  "snappy",
  "bouncy",
];

/** Cut kinds that render a colored layer (beat_flash_colored, dip_to_*,
 *  smash_cut). For these we show the color picker; others hide it. */
const KINDS_WITH_COLOR = new Set<CutKind>([
  "beat_flash_colored",
  "dip_to_black",
  "dip_to_white",
  "smash_cut",
]);

interface Props {
  cut: Cut;
  fromScene: Scene;
  toScene: Scene;
  onClose: () => void;
}

export function CutEditPopover({ cut, fromScene, toScene, onClose }: Props) {
  const upsertCut = useProjectStore((s) => s.upsertCut);
  const [kind, setKind] = useState<CutKind>(cut.kind);
  const [durationFrames, setDurationFrames] = useState<number>(cut.durationFrames);
  const [easing, setEasing] = useState<Easing>(cut.easing ?? "ease_in_out");
  const [color, setColor] = useState<string>(cut.color ?? "#10b981");
  const [audioLeadFrames, setAudioLeadFrames] = useState<number>(cut.audioLeadFrames ?? 0);
  const [audioTrailFrames, setAudioTrailFrames] = useState<number>(cut.audioTrailFrames ?? 0);
  const ref = useRef<HTMLDivElement>(null);

  // Click-outside / Esc closes.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const save = () => {
    upsertCut({
      ...cut,
      kind,
      durationFrames: Math.max(0, Math.round(durationFrames)),
      easing,
      color: KINDS_WITH_COLOR.has(kind) ? color : undefined,
      audioLeadFrames: audioLeadFrames > 0 ? Math.round(audioLeadFrames) : undefined,
      audioTrailFrames: audioTrailFrames > 0 ? Math.round(audioTrailFrames) : undefined,
    });
    onClose();
  };

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-2 w-72 bg-neutral-950 border border-neutral-700 rounded-lg shadow-2xl p-3 text-sm text-neutral-200"
      role="dialog"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] uppercase tracking-wider text-neutral-500">
          Cut · scene {fromScene.id.slice(0, 4)} → {toScene.id.slice(0, 4)}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-neutral-600 hover:text-white"
          aria-label="close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <label className="block text-[10px] uppercase tracking-wider text-neutral-500 mt-2 mb-1">
        Kind
      </label>
      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as CutKind)}
        className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none"
      >
        {CUT_KINDS.map((k) => (
          <option key={k} value={k}>
            {k.replace(/_/g, " ")}
          </option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-2 mt-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
            Duration (f)
          </label>
          <input
            type="number"
            min={0}
            step={1}
            value={durationFrames}
            onChange={(e) => setDurationFrames(parseInt(e.target.value, 10) || 0)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
            Easing
          </label>
          <select
            value={easing}
            onChange={(e) => setEasing(e.target.value as Easing)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm focus:border-emerald-500 focus:outline-none"
          >
            {EASINGS.map((e) => (
              <option key={e} value={e}>
                {e.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      {KINDS_WITH_COLOR.has(kind) && (
        <div className="mt-3">
          <label className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
            Color
          </label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-7 w-full rounded bg-transparent border border-neutral-700"
          />
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-neutral-800">
        <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-2">
          Audio offsets (J / L cuts)
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[9px] uppercase text-neutral-600 mb-1">
              Lead-in (J)
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={audioLeadFrames}
              onChange={(e) => setAudioLeadFrames(parseInt(e.target.value, 10) || 0)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-[9px] uppercase text-neutral-600 mb-1">
              Trail-out (L)
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={audioTrailFrames}
              onChange={(e) => setAudioTrailFrames(parseInt(e.target.value, 10) || 0)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>
        <div className="text-[9px] text-neutral-600 mt-1.5">
          Lead-in: incoming voice starts N frames before the visual cut.
          Trail-out: outgoing voice continues N frames past it.
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-neutral-500 hover:text-white px-3 py-1.5"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs px-3 py-1.5 rounded"
        >
          Apply cut
        </button>
      </div>
    </div>
  );
}
