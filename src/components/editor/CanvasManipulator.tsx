"use client";

/**
 * CanvasManipulator — direct-manipulation handles for the bg image,
 * character or bg video on the preview canvas. Drag corners to scale,
 * center to move; writes directly to the scene's scale/offset fields,
 * bypassing the agent for layout.
 *
 * Mounted as an overlay sibling of the Remotion Player. Pointer math:
 * convert screen-px deltas through the player's bounding rect into
 * canvas-pixel deltas (0..frameW × 0..frameH).
 *
 * Bounding-box math differs per target:
 *  - image / video: full-frame box centered. scale=1 covers 0..100%,
 *    scale=0.5 → 25..75%. Offset shifts the box.
 *  - character: bottom-anchored. charY is the bottom edge in canvas
 *    pixels; height = CHAR_HEIGHT * charScale. Width assumed ≈ 0.8 *
 *    height (matches the renderer's 0.4 left-offset).
 */

import { useCallback, useRef, useState } from "react";
import type { Scene } from "@/lib/scene-schema";
import { useProjectStore } from "@/store/project-store";

type Handle = "tl" | "tr" | "bl" | "br" | "center";
export type ManipulatorTarget = "image" | "character" | "video";

interface Props {
  scene: Scene;
  frameW: number;
  frameH: number;
  target: ManipulatorTarget;
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

const CHAR_HEIGHT = 550; // mirror of SceneRenderer constant
const CHAR_WIDTH_RATIO = 0.8; // approx; matches the 0.4 half-width offset

const COLORS: Record<ManipulatorTarget, { stroke: string; strokeActive: string; handle: string; handleBorder: string; readout: string }> = {
  image: {
    stroke: "rgba(16,185,129,0.55)",
    strokeActive: "rgba(16,185,129,0.95)",
    handle: "bg-emerald-400 border-emerald-600",
    handleBorder: "border-emerald-600",
    readout: "bg-emerald-500 text-black",
  },
  character: {
    stroke: "rgba(251,191,36,0.55)",
    strokeActive: "rgba(251,191,36,0.95)",
    handle: "bg-amber-400 border-amber-600",
    handleBorder: "border-amber-600",
    readout: "bg-amber-400 text-black",
  },
  video: {
    stroke: "rgba(34,211,238,0.55)",
    strokeActive: "rgba(34,211,238,0.95)",
    handle: "bg-cyan-400 border-cyan-600",
    handleBorder: "border-cyan-600",
    readout: "bg-cyan-400 text-black",
  },
};

interface TargetState {
  available: boolean;
  scale: number;
  offX: number;
  offY: number;
  /** Box geometry in canvas % of player rect. */
  box: { left: number; top: number; width: number; height: number };
  /** Maps a drag delta to a partial scene patch. */
  apply: (patch: { scale?: number; offX?: number; offY?: number }) => Partial<Scene>;
  resetPatch: Partial<Scene>;
}

function readTarget(scene: Scene, target: ManipulatorTarget, frameW: number, frameH: number): TargetState | null {
  const bg = scene.background;
  if (target === "image") {
    if (!bg?.imageUrl) return null;
    const scale = bg.imageScale ?? 1;
    const offX = bg.imageOffsetX ?? 0;
    const offY = bg.imageOffsetY ?? 0;
    return {
      available: true,
      scale,
      offX,
      offY,
      box: {
        left: 50 - 50 * scale + (offX / frameW) * 100,
        top: 50 - 50 * scale + (offY / frameH) * 100,
        width: 100 * scale,
        height: 100 * scale,
      },
      apply: (p) => ({
        background: {
          ...bg,
          ...(p.scale !== undefined ? { imageScale: Math.round(p.scale * 100) / 100 } : {}),
          ...(p.offX !== undefined ? { imageOffsetX: Math.round(p.offX) } : {}),
          ...(p.offY !== undefined ? { imageOffsetY: Math.round(p.offY) } : {}),
        },
      }),
      resetPatch: {
        background: { ...bg, imageScale: 1, imageOffsetX: 0, imageOffsetY: 0 },
      },
    };
  }
  if (target === "video") {
    if (!bg?.videoUrl) return null;
    const scale = bg.videoScale ?? 1;
    const offX = bg.videoOffsetX ?? 0;
    const offY = bg.videoOffsetY ?? 0;
    return {
      available: true,
      scale,
      offX,
      offY,
      box: {
        left: 50 - 50 * scale + (offX / frameW) * 100,
        top: 50 - 50 * scale + (offY / frameH) * 100,
        width: 100 * scale,
        height: 100 * scale,
      },
      apply: (p) => ({
        background: {
          ...bg,
          ...(p.scale !== undefined ? { videoScale: Math.round(p.scale * 100) / 100 } : {}),
          ...(p.offX !== undefined ? { videoOffsetX: Math.round(p.offX) } : {}),
          ...(p.offY !== undefined ? { videoOffsetY: Math.round(p.offY) } : {}),
        },
      }),
      resetPatch: {
        background: { ...bg, videoScale: 1, videoOffsetX: 0, videoOffsetY: 0 },
      },
    };
  }
  // character
  const hasChar = !!scene.characterId || !!scene.characterUrl;
  if (!hasChar) return null;
  const scale = scene.characterScale ?? 1;
  const charX = scene.characterX ?? Math.round(frameW / 2);
  const charY = scene.characterY ?? Math.round(frameH * 0.83);
  const pxHeight = CHAR_HEIGHT * scale;
  const pxWidth = pxHeight * CHAR_WIDTH_RATIO;
  return {
    available: true,
    scale,
    offX: charX,
    offY: charY,
    box: {
      left: ((charX - pxWidth / 2) / frameW) * 100,
      top: ((charY - pxHeight) / frameH) * 100,
      width: (pxWidth / frameW) * 100,
      height: (pxHeight / frameH) * 100,
    },
    apply: (p) => ({
      ...(p.scale !== undefined ? { characterScale: Math.round(p.scale * 100) / 100 } : {}),
      ...(p.offX !== undefined ? { characterX: Math.round(p.offX) } : {}),
      ...(p.offY !== undefined ? { characterY: Math.round(p.offY) } : {}),
    }),
    resetPatch: {
      characterScale: 1,
      characterX: Math.round(frameW / 2),
      characterY: Math.round(frameH * 0.83),
    },
  };
}

export function CanvasManipulator({ scene, frameW, frameH, containerRef, target }: Props) {
  const updateScene = useProjectStore((s) => s.updateScene);
  const [active, setActive] = useState<Handle | null>(null);
  const dragStart = useRef<{
    pointerX: number;
    pointerY: number;
    scale: number;
    offX: number;
    offY: number;
  } | null>(null);

  const t = readTarget(scene, target, frameW, frameH);
  if (!t) return null;

  const colors = COLORS[target];

  const onHandleDown = useCallback(
    (handle: Handle) => (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setActive(handle);
      dragStart.current = {
        pointerX: e.clientX,
        pointerY: e.clientY,
        scale: t.scale,
        offX: t.offX,
        offY: t.offY,
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
          const dxCanvas = (dxPx / rect.width) * frameW;
          const dyCanvas = (dyPx / rect.height) * frameH;
          updateScene(scene.id, t.apply({ offX: start.offX + dxCanvas, offY: start.offY + dyCanvas }));
        } else {
          const [sx, sy] = SIGN_BY_HANDLE[handle];
          const outwardPx = sx * dxPx + sy * dyPx;
          const next = Math.max(0.1, Math.min(3, start.scale + outwardPx / 300));
          updateScene(scene.id, t.apply({ scale: next }));
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
    [t, scene.id, updateScene, frameW, frameH, containerRef],
  );

  const cornerCls = `absolute w-3 h-3 ${colors.handle} border rounded-sm pointer-events-auto hover:scale-125 transition-transform`;

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${t.box.left}%`,
        top: `${t.box.top}%`,
        width: `${t.box.width}%`,
        height: `${t.box.height}%`,
        outline: `1px dashed ${active ? colors.strokeActive : colors.stroke}`,
        outlineOffset: "0px",
        zIndex: 25,
      }}
    >
      <div
        onPointerDown={onHandleDown("center")}
        className={`absolute pointer-events-auto cursor-move ${
          active === "center" ? "bg-white/10" : "hover:bg-white/5"
        }`}
        style={{ inset: "12%" }}
        title={`Drag to move ${target} · double-click to reset`}
        onDoubleClick={() => updateScene(scene.id, t.resetPatch)}
      />
      <div onPointerDown={onHandleDown("tl")} className={`${cornerCls} -top-1.5 -left-1.5 cursor-nwse-resize`} />
      <div onPointerDown={onHandleDown("tr")} className={`${cornerCls} -top-1.5 -right-1.5 cursor-nesw-resize`} />
      <div onPointerDown={onHandleDown("bl")} className={`${cornerCls} -bottom-1.5 -left-1.5 cursor-nesw-resize`} />
      <div onPointerDown={onHandleDown("br")} className={`${cornerCls} -bottom-1.5 -right-1.5 cursor-nwse-resize`} />

      {active && (
        <div className={`absolute -top-6 left-0 px-1.5 py-0.5 text-[10px] font-mono rounded pointer-events-none whitespace-nowrap ${colors.readout}`}>
          {active === "center"
            ? `${target} (${Math.round(t.offX)}, ${Math.round(t.offY)})`
            : `${target} ${Math.round(t.scale * 100)}%`}
        </div>
      )}
    </div>
  );
}
