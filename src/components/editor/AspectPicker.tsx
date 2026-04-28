"use client";

/**
 * Reusable aspect-ratio picker. Two modes:
 *  - inline: lays the options out as a vertical list (used in the
 *    empty-state inside the player and the +New scene popover).
 *  - compact: small horizontal pills (reserved — no caller yet).
 *
 * Always renders a "Use this for every new scene" checkbox so the
 * user's pick can stick across future scene-adds without reopening
 * the picker each time.
 */

import { useState } from "react";
import {
  ASPECT_OPTIONS,
  type AspectOption,
  getRememberAspect,
  setRememberAspect,
} from "@/lib/aspect-prefs";

interface Props {
  currentWidth?: number;
  currentHeight?: number;
  onPick: (opt: AspectOption) => void;
  showRememberCheckbox?: boolean;
  layout?: "list" | "menu";
}

/** Tiny rectangle glyph that visually communicates an aspect ratio. */
export function AspectGlyph({ w, h, size = 22 }: { w: number; h: number; size?: number }) {
  const ratio = w / h;
  const boxW = ratio >= 1 ? size : Math.max(8, Math.round(size * ratio));
  const boxH = ratio >= 1 ? Math.max(8, Math.round(size / ratio)) : size;
  return (
    <div
      className="shrink-0 rounded-sm border border-neutral-600 bg-neutral-800"
      style={{ width: boxW, height: boxH }}
    />
  );
}

export function AspectPicker({
  currentWidth,
  currentHeight,
  onPick,
  showRememberCheckbox = true,
  layout = "menu",
}: Props) {
  const [remember, setRemember] = useState<boolean>(() => getRememberAspect());

  return (
    <div className="flex flex-col">
      <div className="flex flex-col">
        {ASPECT_OPTIONS.map((opt) => {
          const isCurrent =
            currentWidth === opt.width && currentHeight === opt.height;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onPick(opt)}
              className={`flex items-center gap-2.5 px-3 py-2 text-left hover:bg-emerald-500/10 transition-colors border-b border-neutral-900 last:border-b-0 ${
                isCurrent ? "bg-emerald-500/5" : ""
              } ${layout === "list" ? "rounded-md hover:rounded-md" : ""}`}
            >
              <AspectGlyph w={opt.width} h={opt.height} />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-white">
                  {opt.label}
                </div>
                <div className="text-[10px] text-neutral-500 truncate">
                  {opt.description}
                </div>
              </div>
              <span className="text-[9px] font-mono text-neutral-600">
                {opt.width}×{opt.height}
              </span>
            </button>
          );
        })}
      </div>
      {showRememberCheckbox && (
        <label className="flex items-center gap-2 px-3 py-2 border-t border-neutral-800/60 text-[11px] text-neutral-400 cursor-pointer hover:text-neutral-200">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => {
              setRemember(e.target.checked);
              setRememberAspect(e.target.checked);
            }}
            className="accent-emerald-500"
          />
          <span>Use this for every new scene</span>
        </label>
      )}
    </div>
  );
}
