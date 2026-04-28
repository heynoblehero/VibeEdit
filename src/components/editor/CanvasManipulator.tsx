"use client";

/**
 * CanvasManipulator — direct-manipulation handles for the bg image,
 * character and bg video on the preview canvas. The user drags corners
 * to scale and the center to move; this writes directly to the scene's
 * scale/offset fields, bypassing the agent for layout.
 *
 * MVP scope: bg image only. Character + video share the same pattern
 * and ship in a follow-up — the math is identical, only the field
 * names differ.
 *
 * Mounted as an overlay sibling of the Remotion Player. Pointer math:
 * convert screen-pixel deltas through the player's bounding rect into
 * normalized canvas coords (0..frameW × 0..frameH). The bounding box
 * we draw assumes no cameraMove transform is active (cameraMove is
 * an animated overlay on top of imageScale; we're editing the base
 * scale, which is what the user perceives as "size").
 */

import { useCallback, useRef, useState } from "react";
import type { Scene } from "@/lib/scene-schema";
import { useProjectStore } from "@/store/project-store";

type Handle = "tl" | "tr" | "bl" | "br" | "center";

interface Props {
  scene: Scene;
  frameW: number;
  frameH: number;
  /** Wrapper that contains the Player; used to compute pointer-pixel
   *  deltas relative to displayed canvas size. */
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const SIGN_BY_HANDLE: Record<Exclude<Handle, "center">, [number, number]> = {
  br: [1, 1],
  bl: [-1, 1],
  tr: [1, -1],
  tl: [-1, -1],
};

export function CanvasManipulator({ scene, frameW, frameH, containerRef }: Props) {
  const updateScene = useProjectStore((s) => s.updateScene);
  const [active, setActive] = useState<Handle | null>(null);
  const dragStart = useRef<{
    pointerX: number;
    pointerY: number;
    scale: number;
    offX: number;
    offY: number;
  } | null>(null);

  const bg = scene.background;
  if (!bg?.imageUrl) return null;

  const scale = bg.imageScale ?? 1;
  const offX = bg.imageOffsetX ?? 0;
  const offY = bg.imageOffsetY ?? 0;

  // Visible bounding box (% of player container). At scale=1 with no
  // offset → covers 0–100% × 0–100%. At scale=0.5 → 25–75% (centered).
  // Offsets shift the box; expressed as % of canvas, then mapped 1:1
  // into the player rect (which is sized to match canvas aspect).
  const boxLeftPct = 50 - 50 * scale + (offX / frameW) * 100;
  const boxTopPct = 50 - 50 * scale + (offY / frameH) * 100;
  const boxSizeWPct = 100 * scale;
  const boxSizeHPct = 100 * scale;

  const onHandleDown = useCallback(
    (handle: Handle) => (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setActive(handle);
      dragStart.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        scale,
        offX,
        offY,
      };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const start = dragStart.current;
        const wrapper = containerRef.current;
        if (!start || !wrapper) return;
        const rect = wrapper.getBoundingClientRect();
        const dxPx = ev.clientX - start.pointerX;
        const dyPx = ev.clientY - start.pointerY;

        if (handle === "center") {
          // Convert screen px → canvas px proportional to display rect.
          const dxCanvas = (dxPx / rect.width) * frameW;
          const dyCanvas = (dyPx / rect.height) * frameH;
          updateScene(scene.id, {
            background: {
              ...bg,
              imageOffsetX: Math.round(start.offX + dxCanvas),
              imageOffsetY: Math.round(start.offY + dyCanvas),
            },
          });
        } else {
          // Project the drag onto the corner's outward axis. Positive
          // outward = bigger. 300px drag = +1 scale unit (~3x sensitivity).
          const [sx, sy] = SIGN_BY_HANDLE[handle];
          const outwardPx = sx * dxPx + sy * dyPx;
          const next = Math.max(0.1, Math.min(3, start.scale + outwardPx / 300));
          updateScene(scene.id, {
            background: { ...bg, imageScale: Math.round(next * 100) / 100 },
          });
        }
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        setActive(null);
        dragStart.current = null;
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [scale, offX, offY, scene.id, bg, updateScene, frameW, frameH, containerRef],
  );

  const cornerCls =
    "absolute w-3 h-3 bg-emerald-400 border border-emerald-600 rounded-sm pointer-events-auto hover:scale-125 transition-transform";

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${boxLeftPct}%`,
        top: `${boxTopPct}%`,
        width: `${boxSizeWPct}%`,
        height: `${boxSizeHPct}%`,
        outline: `1px dashed ${active ? "rgba(16,185,129,0.95)" : "rgba(16,185,129,0.55)"}`,
        outlineOffset: "0px",
        zIndex: 25,
      }}
    >
      {/* Center drag pad — large hit area in the middle for moving. */}
      <div
        onPointerDown={onHandleDown("center")}
        className={`absolute pointer-events-auto cursor-move ${
          active === "center" ? "bg-emerald-400/10" : "hover:bg-emerald-400/5"
        }`}
        style={{ inset: "12%" }}
        title="Drag to move · double-click to reset"
        onDoubleClick={() => {
          updateScene(scene.id, {
            background: {
              ...bg,
              imageScale: 1,
              imageOffsetX: 0,
              imageOffsetY: 0,
            },
          });
        }}
      />
      {/* Four corner handles — uniform scale around center. */}
      <div onPointerDown={onHandleDown("tl")} className={`${cornerCls} -top-1.5 -left-1.5 cursor-nwse-resize`} />
      <div onPointerDown={onHandleDown("tr")} className={`${cornerCls} -top-1.5 -right-1.5 cursor-nesw-resize`} />
      <div onPointerDown={onHandleDown("bl")} className={`${cornerCls} -bottom-1.5 -left-1.5 cursor-nesw-resize`} />
      <div onPointerDown={onHandleDown("br")} className={`${cornerCls} -bottom-1.5 -right-1.5 cursor-nwse-resize`} />

      {/* Live readout — shows scale + offset while dragging. */}
      {active && (
        <div className="absolute -top-6 left-0 px-1.5 py-0.5 text-[10px] font-mono bg-emerald-500 text-black rounded pointer-events-none whitespace-nowrap">
          {active === "center"
            ? `(${offX}, ${offY})`
            : `${Math.round(scale * 100)}%`}
        </div>
      )}
    </div>
  );
}
