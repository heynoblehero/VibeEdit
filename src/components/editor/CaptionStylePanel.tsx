"use client";

import { Captions as CaptionsIcon } from "lucide-react";
import { DEFAULT_CAPTION_STYLE, type CaptionPosition } from "@/lib/scene-schema";
import { useProjectStore } from "@/store/project-store";

const POSITIONS: { value: CaptionPosition; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "top", label: "Top" },
  { value: "center", label: "Center" },
  { value: "bottom", label: "Bottom" },
];

export function CaptionStylePanel() {
  const style = useProjectStore((s) => s.project.captionStyle ?? DEFAULT_CAPTION_STYLE);
  const setCaptionStyle = useProjectStore((s) => s.setCaptionStyle);

  return (
    <div className="flex flex-col gap-2 p-4 border-b border-neutral-800">
      <div className="flex items-center gap-2">
        <CaptionsIcon className="h-4 w-4 text-sky-400" />
        <span className="text-sm font-semibold text-white">Caption style</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-neutral-500">Color</label>
          <input
            type="color"
            value={style.color}
            onChange={(e) => setCaptionStyle({ color: e.target.value })}
            className="h-7 w-full rounded cursor-pointer bg-transparent border border-neutral-700"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-neutral-500">Outline</label>
          <input
            type="color"
            value={style.strokeColor}
            onChange={(e) => setCaptionStyle({ strokeColor: e.target.value })}
            className="h-7 w-full rounded cursor-pointer bg-transparent border border-neutral-700"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] text-neutral-500">Emphasis</label>
          <input
            type="color"
            value={style.highlightColor ?? "#000000"}
            onChange={(e) => setCaptionStyle({ highlightColor: e.target.value })}
            className="h-7 w-full rounded cursor-pointer bg-transparent border border-neutral-700"
            title="One word per chunk gets this color (set to black to disable)"
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-[11px] text-neutral-400 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={!!style.highlightColor && style.highlightColor !== "#000000"}
          onChange={(e) =>
            setCaptionStyle({
              highlightColor: e.target.checked ? "#fbbf24" : undefined,
            })
          }
          className="accent-sky-500"
        />
        <span>Highlight one word per chunk (TikTok style)</span>
      </label>
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-neutral-500 w-14">Size</label>
        <input
          type="range"
          min={36}
          max={140}
          value={style.fontSize}
          onChange={(e) => setCaptionStyle({ fontSize: Number(e.target.value) })}
          className="flex-1 accent-sky-500 h-1"
        />
        <span className="text-[11px] text-white font-mono w-8">{style.fontSize}</span>
      </div>
      <div className="flex items-center gap-2">
        <label className="text-[10px] text-neutral-500 w-14">Words</label>
        <input
          type="range"
          min={1}
          max={6}
          value={style.maxWordsPerChunk}
          onChange={(e) => setCaptionStyle({ maxWordsPerChunk: Number(e.target.value) })}
          className="flex-1 accent-sky-500 h-1"
        />
        <span className="text-[11px] text-white font-mono w-8">{style.maxWordsPerChunk}</span>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-[10px] text-neutral-500">Position</label>
        <div className="grid grid-cols-4 gap-1">
          {POSITIONS.map((p) => (
            <button
              key={p.value}
              onClick={() => setCaptionStyle({ position: p.value })}
              className={`text-[10px] py-1 rounded border transition-colors ${
                style.position === p.value
                  ? "border-sky-500 bg-sky-500/10 text-sky-300"
                  : "border-neutral-700 text-neutral-400 hover:border-neutral-500"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-[11px] text-neutral-400 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={style.uppercase}
          onChange={(e) => setCaptionStyle({ uppercase: e.target.checked })}
          className="accent-sky-500"
        />
        <span>Uppercase</span>
      </label>
    </div>
  );
}
