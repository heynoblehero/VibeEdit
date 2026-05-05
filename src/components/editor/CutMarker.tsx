"use client";

import React, { useState } from "react";
import { Scissors } from "lucide-react";
import type { Cut, Scene } from "@/lib/scene-schema";
import { CutModal } from "./CutModal";

interface CutMarkerProps {
  /** The cut between fromScene → toScene. Always non-null because
   *  addScene auto-creates a hard cut for every boundary. */
  cut: Cut;
  fromScene: Scene;
  toScene: Scene;
  /** "horizontal" = sits on a Timeline boundary; "vertical" = sits in
   *   the gap between vertical SceneList cards. */
  orientation: "horizontal" | "vertical";
}

/**
 * Small clickable diamond at a scene boundary. Click to open the
 * CutModal with kind / duration / easing / color / J-L offsets.
 *
 * Renders nothing but a hover-revealed badge for `hard` cuts (the
 * default boring boundary) so quiet cuts stay quiet. Non-hard cuts
 * always show the kind label.
 */
export function CutMarker({ cut, fromScene, toScene, orientation }: CutMarkerProps) {
  const [open, setOpen] = useState(false);
  const isHard = cut.kind === "hard" && cut.durationFrames === 0;
  const label = isHard ? "" : cut.kind.replace(/_/g, " ");

  const containerStyle: React.CSSProperties =
    orientation === "horizontal"
      ? {
          position: "absolute",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 5,
        }
      : {
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "4px 0",
        };

  return (
    <div className="group" style={containerStyle}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        title={`Cut: ${cut.kind} · ${cut.durationFrames}f${cut.audioLeadFrames ? ` · J +${cut.audioLeadFrames}f` : ""}${cut.audioTrailFrames ? ` · L +${cut.audioTrailFrames}f` : ""}`}
        className={
          isHard
            ? "opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-neutral-800 hover:bg-emerald-500/20 border border-neutral-700 hover:border-emerald-500/60 text-[10px] text-neutral-400 hover:text-emerald-300"
            : "flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 hover:border-emerald-400 text-[10px] font-medium text-emerald-300"
        }
      >
        <Scissors className="h-3 w-3" />
        {label && <span className="uppercase tracking-wider">{label}</span>}
      </button>
      <CutModal
        open={open}
        onClose={() => setOpen(false)}
        cut={cut}
        fromScene={fromScene}
        toScene={toScene}
      />
    </div>
  );
}
