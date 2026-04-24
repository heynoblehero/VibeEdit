"use client";

import { RotateCw } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type { Scene } from "@/lib/scene-schema";
import { useProjectStore } from "@/store/project-store";

interface CanvasOverlayProps {
  containerWidth: number;
  containerHeight: number;
  compWidth: number;
  compHeight: number;
}

type DragMode = "move" | "scale" | "rotate" | null;

export function CanvasOverlay({
  containerWidth,
  containerHeight,
  compWidth,
  compHeight,
}: CanvasOverlayProps) {
  const { project, selectedSceneId, updateScene } = useProjectStore();
  const scene = project.scenes.find((s) => s.id === selectedSceneId);

  const [dragMode, setDragMode] = useState<DragMode>(null);
  const startRef = useRef({ mx: 0, my: 0, ox: 0, oy: 0, os: 1, or: 0 });

  const scaleX = containerWidth / compWidth;
  const scaleY = containerHeight / compHeight;
  const scale = Math.min(scaleX, scaleY);
  const offsetX = (containerWidth - compWidth * scale) / 2;
  const offsetY = (containerHeight - compHeight * scale) / 2;

  const toScreen = (cx: number, cy: number) => ({
    sx: cx * scale + offsetX,
    sy: cy * scale + offsetY,
  });

  const toComp = (sx: number, sy: number) => ({
    cx: (sx - offsetX) / scale,
    cy: (sy - offsetY) / scale,
  });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, mode: DragMode) => {
      if (!scene?.characterId) return;
      e.preventDefault();
      e.stopPropagation();
      setDragMode(mode);
      startRef.current = {
        mx: e.clientX,
        my: e.clientY,
        ox: scene.characterX ?? 1300,
        oy: scene.characterY ?? 850,
        os: scene.characterScale ?? 1.3,
        or: 0,
      };

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startRef.current.mx;
        const dy = ev.clientY - startRef.current.my;

        if (mode === "move") {
          updateScene(scene.id, {
            characterX: Math.round(startRef.current.ox + dx / scale),
            characterY: Math.round(startRef.current.oy + dy / scale),
          });
        } else if (mode === "scale") {
          const dist = Math.sqrt(dx * dx + dy * dy) * (dy < 0 ? 1 : -1);
          const newScale = Math.max(0.2, Math.min(4, startRef.current.os + dist / 200));
          updateScene(scene.id, {
            characterScale: Math.round(newScale * 100) / 100,
          });
        }
      };

      const onUp = () => {
        setDragMode(null);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [scene, scale, updateScene],
  );

  if (!scene?.characterId) return null;

  const cx = scene.characterX ?? 1300;
  const cy = scene.characterY ?? 850;
  const cs = scene.characterScale ?? 1.3;
  const { sx, sy } = toScreen(cx, cy);

  const boxW = 120 * cs * scale;
  const boxH = 160 * cs * scale;

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 30 }}>
      {/* Character bounding box */}
      <div
        className="absolute border-2 border-emerald-400/60 rounded pointer-events-auto cursor-move"
        style={{
          left: sx - boxW / 2,
          top: sy - boxH,
          width: boxW,
          height: boxH,
        }}
        onMouseDown={(e) => handleMouseDown(e, "move")}
      >
        {/* Position label */}
        <div className="absolute -top-5 left-0 text-[9px] font-mono text-emerald-400 bg-black/70 px-1 rounded">
          {Math.round(cx)}, {Math.round(cy)} &middot; {cs.toFixed(1)}x
        </div>

        {/* Scale handle (bottom-right corner) */}
        <div
          className="absolute -bottom-2 -right-2 w-4 h-4 bg-emerald-400 rounded-full cursor-nwse-resize pointer-events-auto border-2 border-black"
          onMouseDown={(e) => handleMouseDown(e, "scale")}
        />

        {/* Move handle (center) */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-emerald-400/30 border border-emerald-400 flex items-center justify-center pointer-events-auto cursor-move"
          onMouseDown={(e) => handleMouseDown(e, "move")}
        >
          <div className="w-2 h-2 bg-emerald-400 rounded-full" />
        </div>

        {/* Flip button */}
        <button
          className="absolute -top-2 -right-2 w-5 h-5 bg-neutral-800 border border-neutral-600 rounded-full flex items-center justify-center pointer-events-auto hover:bg-neutral-700 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            updateScene(scene.id, { flipCharacter: !scene.flipCharacter });
          }}
          title="Flip character"
        >
          <RotateCw className="h-2.5 w-2.5 text-white" />
        </button>
      </div>

      {/* Drag indicator */}
      {dragMode && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-emerald-500/90 text-black text-[10px] font-semibold px-2 py-0.5 rounded">
          {dragMode === "move" ? "Moving" : dragMode === "scale" ? "Scaling" : "Rotating"}
        </div>
      )}
    </div>
  );
}
