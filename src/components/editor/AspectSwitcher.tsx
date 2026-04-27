"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/store/project-store";

interface Preset {
  id: string;
  label: string;
  ratio: string;
  width: number;
  height: number;
}

/**
 * Header dropdown for project aspect ratio. Six built-in presets +
 * 'Custom...' which opens a tiny modal for free-form W×H. The
 * currently-active preset is highlighted by ratio match (so old
 * 1920×1080 projects show '16:9 Landscape').
 */
const PRESETS: Preset[] = [
  { id: "16x9", label: "Landscape", ratio: "16:9", width: 1920, height: 1080 },
  { id: "9x16", label: "Portrait / Reels", ratio: "9:16", width: 1080, height: 1920 },
  { id: "1x1", label: "Square", ratio: "1:1", width: 1080, height: 1080 },
  { id: "4x5", label: "IG Feed", ratio: "4:5", width: 1080, height: 1350 },
  { id: "21x9", label: "Cinemascope", ratio: "21:9", width: 2520, height: 1080 },
  { id: "2x3", label: "Vertical print", ratio: "2:3", width: 1080, height: 1620 },
];

export function AspectSwitcher() {
  const project = useProjectStore((s) => s.project);
  const setDimensions = useProjectStore((s) => s.setDimensions);
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customW, setCustomW] = useState(project.width);
  const [customH, setCustomH] = useState(project.height);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const activePreset = PRESETS.find(
    (p) => p.width === project.width && p.height === project.height,
  );
  const ratioOf = (w: number, h: number) =>
    h === 0 ? "?:?" : `${(w / h).toFixed(2)}:1`;
  const currentRatio = activePreset?.ratio ?? ratioOf(project.width, project.height);

  return (
    <div ref={ref} className="hidden md:block relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title={`Aspect: ${currentRatio} (${project.width}×${project.height}) — click to change`}
        className="flex items-center gap-1 rounded border border-neutral-800 bg-neutral-900/60 px-2 py-1 text-[10px] text-neutral-300 hover:border-neutral-600 hover:text-white"
      >
        <span className="font-mono">{currentRatio}</span>
        <ChevronDown className="h-3 w-3 text-neutral-500" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 bg-neutral-950 border border-neutral-800 rounded-md shadow-xl overflow-hidden">
          {PRESETS.map((p) => {
            const isActive = activePreset?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => {
                  setDimensions(p.width, p.height);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-[11px] flex items-baseline justify-between hover:bg-neutral-900 ${
                  isActive ? "bg-emerald-500/10 text-emerald-300" : "text-neutral-200"
                }`}
              >
                <span>
                  <span className="font-mono mr-1.5">{p.ratio}</span>
                  <span className="text-neutral-500">{p.label}</span>
                </span>
                <span className="text-[9px] text-neutral-600 font-mono">
                  {p.width}×{p.height}
                </span>
              </button>
            );
          })}
          <button
            onClick={() => {
              setCustomW(project.width);
              setCustomH(project.height);
              setCustomOpen(true);
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-[11px] text-cyan-300 hover:bg-neutral-900 border-t border-neutral-800"
          >
            Custom…
          </button>
        </div>
      )}
      {customOpen && (
        <div
          className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setCustomOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-72 bg-neutral-950 border border-neutral-800 rounded-lg shadow-xl p-4 space-y-3"
          >
            <div className="text-xs uppercase tracking-wide text-neutral-500">
              Custom frame
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[11px]">
                <span className="text-neutral-400">Width</span>
                <input
                  type="number"
                  min={64}
                  max={7680}
                  step={2}
                  value={customW}
                  onChange={(e) => setCustomW(Number(e.target.value))}
                  className="mt-0.5 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-neutral-100 tabular-nums"
                />
              </label>
              <label className="block text-[11px]">
                <span className="text-neutral-400">Height</span>
                <input
                  type="number"
                  min={64}
                  max={7680}
                  step={2}
                  value={customH}
                  onChange={(e) => setCustomH(Number(e.target.value))}
                  className="mt-0.5 w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-neutral-100 tabular-nums"
                />
              </label>
            </div>
            <div className="text-[10px] text-neutral-500 font-mono">
              ratio ≈ {ratioOf(customW, customH)}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCustomOpen(false)}
                className="px-3 py-1 text-[11px] rounded border border-neutral-700 text-neutral-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setDimensions(customW, customH);
                  setCustomOpen(false);
                }}
                className="px-3 py-1 text-[11px] rounded bg-emerald-500 text-black font-semibold hover:bg-emerald-400"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
