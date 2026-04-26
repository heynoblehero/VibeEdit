"use client";

/**
 * Premiere-Pro-style keyframe property graph editor (light version).
 *
 * Renders an SVG canvas with the property's keyframes as circles + a
 * curve sampled per pixel via evaluateKeyframes() (so the visible line
 * matches what the renderer will produce on screen).
 *
 * v1 user controls:
 *   - Click empty space → add keyframe at the clicked (frame, value).
 *   - Drag a circle → move the keyframe (frame + value snap to 1f / 1px).
 *   - Right-click → context menu (delete / pick easing).
 *
 * Pro-mode (bezier handles) is stubbed by useEditorStore.proKeyframes —
 * v1 ignores the toggle. The data path is already wired (Keyframe.bezierIn
 * / bezierOut) so flipping the flag later just unlocks the UI.
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import { evaluateKeyframes } from "@/lib/anim";
import type { Easing, Keyframe, KeyframeProperty } from "@/lib/scene-schema";
import { useProjectStore } from "@/store/project-store";

interface KeyframeGraphProps {
  sceneId: string;
  property: KeyframeProperty;
  durationFrames: number;
  /** Default value to render when no keyframes exist (for the curve baseline). */
  fallbackValue?: number;
}

const PAD = 16;
const HEIGHT = 180;

export function KeyframeGraph({
  sceneId,
  property,
  durationFrames,
  fallbackValue = 0,
}: KeyframeGraphProps) {
  const project = useProjectStore((s) => s.project);
  const upsertKeyframe = useProjectStore((s) => s.upsertKeyframe);
  const removeKeyframe = useProjectStore((s) => s.removeKeyframe);
  const scene = useMemo(
    () => project.scenes.find((s) => s.id === sceneId),
    [project.scenes, sceneId],
  );
  const kfs: Keyframe[] = scene?.keyframes?.[property] ?? [];

  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(600);
  const [draggingFrame, setDraggingFrame] = useState<number | null>(null);

  React.useEffect(() => {
    const update = () => {
      if (svgRef.current) setWidth(svgRef.current.clientWidth);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Auto-scale Y to keyframe min/max + 10% pad. When no keyframes, use
  // a small symmetric range around the fallback value.
  const { minVal, maxVal } = useMemo(() => {
    if (kfs.length === 0) {
      const v = fallbackValue;
      return { minVal: v - 10, maxVal: v + 10 };
    }
    let min = kfs[0].value;
    let max = kfs[0].value;
    for (const k of kfs) {
      if (k.value < min) min = k.value;
      if (k.value > max) max = k.value;
    }
    if (max - min < 1) {
      // Avoid flat curves rendering as a single line on the axis.
      max += 1;
      min -= 1;
    }
    const pad = (max - min) * 0.1;
    return { minVal: min - pad, maxVal: max + pad };
  }, [kfs, fallbackValue]);

  const xToFrame = useCallback(
    (x: number) => {
      const ratio = (x - PAD) / Math.max(1, width - 2 * PAD);
      return Math.max(0, Math.min(durationFrames, Math.round(ratio * durationFrames)));
    },
    [width, durationFrames],
  );
  const yToValue = useCallback(
    (y: number) => {
      const ratio = (HEIGHT - PAD - y) / Math.max(1, HEIGHT - 2 * PAD);
      return Math.round((minVal + ratio * (maxVal - minVal)) * 100) / 100;
    },
    [minVal, maxVal],
  );
  const frameToX = useCallback(
    (frame: number) =>
      PAD + (frame / Math.max(1, durationFrames)) * (width - 2 * PAD),
    [width, durationFrames],
  );
  const valueToY = useCallback(
    (v: number) =>
      HEIGHT - PAD - ((v - minVal) / Math.max(0.001, maxVal - minVal)) * (HEIGHT - 2 * PAD),
    [minVal, maxVal],
  );

  const onSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    if (draggingFrame !== null) return;
    // Only fire when clicking empty graph (target === svg). Clicks on
    // circles bubble through with their own handlers and stopPropagation.
    if (e.target !== svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const frame = xToFrame(e.clientX - rect.left);
    const value = yToValue(e.clientY - rect.top);
    upsertKeyframe(sceneId, property, { frame, value });
  };

  const startDrag = (kfFrame: number) => {
    setDraggingFrame(kfFrame);
  };
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggingFrame === null || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const frame = xToFrame(e.clientX - rect.left);
    const value = yToValue(e.clientY - rect.top);
    const original = kfs.find((k) => k.frame === draggingFrame);
    if (!original) return;
    // Remove the old, insert the new — supports moving along both axes.
    if (frame !== draggingFrame) {
      removeKeyframe(sceneId, property, draggingFrame);
      upsertKeyframe(sceneId, property, { ...original, frame, value });
      setDraggingFrame(frame);
    } else {
      upsertKeyframe(sceneId, property, { ...original, frame, value });
    }
  };
  const endDrag = () => setDraggingFrame(null);

  const onContextMenu = (e: React.MouseEvent, kfFrame: number) => {
    e.preventDefault();
    e.stopPropagation();
    removeKeyframe(sceneId, property, kfFrame);
  };

  // Sample the curve every 4px for a smooth rendered line.
  const pathD = useMemo(() => {
    if (kfs.length === 0) {
      const y = valueToY(fallbackValue);
      return `M ${PAD} ${y} L ${width - PAD} ${y}`;
    }
    const segments: string[] = [];
    const step = 4;
    for (let x = PAD; x <= width - PAD; x += step) {
      const frame = xToFrame(x);
      const v = evaluateKeyframes(frame, kfs);
      const y = valueToY(v);
      segments.push(`${x},${y}`);
    }
    return "M " + segments.join(" L ");
  }, [kfs, width, fallbackValue, xToFrame, valueToY]);

  if (!scene) return null;

  return (
    <div className="rounded border border-neutral-800 bg-neutral-950 p-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-neutral-500">
          {property}
        </span>
        <span className="text-[10px] font-mono text-neutral-600">
          {kfs.length} keyframe{kfs.length === 1 ? "" : "s"}
          {" · "}click to add · drag to move · right-click to remove
        </span>
      </div>
      <svg
        ref={svgRef}
        height={HEIGHT}
        width="100%"
        viewBox={`0 0 ${width} ${HEIGHT}`}
        onClick={onSvgClick}
        onMouseMove={onMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
        className="block w-full cursor-crosshair select-none"
      >
        {/* Grid */}
        <line x1={PAD} y1={HEIGHT / 2} x2={width - PAD} y2={HEIGHT / 2} stroke="#262626" strokeDasharray="3 3" />
        <line x1={PAD} y1={PAD} x2={PAD} y2={HEIGHT - PAD} stroke="#262626" />
        <line x1={PAD} y1={HEIGHT - PAD} x2={width - PAD} y2={HEIGHT - PAD} stroke="#262626" />

        {/* Curve */}
        <path d={pathD} fill="none" stroke="#10b981" strokeWidth={2} />

        {/* Keyframe circles */}
        {kfs.map((k) => {
          const cx = frameToX(k.frame);
          const cy = valueToY(k.value);
          return (
            <g key={k.frame}>
              <circle
                cx={cx}
                cy={cy}
                r={6}
                fill="#10b981"
                stroke="#0a0a0a"
                strokeWidth={2}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  startDrag(k.frame);
                }}
                onContextMenu={(e) => onContextMenu(e, k.frame)}
                style={{ cursor: "grab" }}
              />
              <text
                x={cx}
                y={cy - 12}
                textAnchor="middle"
                fontSize="9"
                fill="#a3a3a3"
                style={{ pointerEvents: "none" }}
              >
                {k.value.toFixed(0)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
