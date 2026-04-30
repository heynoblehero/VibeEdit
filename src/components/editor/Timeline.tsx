"use client";

import { Lock, Plus, Scissors } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PlayerRef } from "@remotion/player";
import type { Cut, Scene } from "@/lib/scene-schema";
import { createId, defaultPlaceholderTextItem, DEFAULT_BG, sceneDurationFrames, totalDurationFrames } from "@/lib/scene-schema";
import { useEditorStore } from "@/store/editor-store";
import { useProjectStore } from "@/store/project-store";
import { AudioWaveform } from "./AudioWaveform";
import { CutMarker } from "./CutMarker";

// Two- or three-letter abbrev for the scene block label so the user
// can tell at-a-glance what kind of scene each block is at low zoom.
const SCENE_TYPE_ABBR: Record<string, string> = {
  text_only: "txt",
  character_text: "char",
  character_pop: "pop",
  big_number: "num",
  stat: "stat",
  montage: "mtg",
  split: "spl",
  bullet_list: "list",
  quote: "quo",
  bar_chart: "bar",
  three_text: "3tx",
  three_card: "3cd",
  three_particles: "3p",
};

interface TimelineProps {
  playerRef: React.RefObject<PlayerRef | null>;
  currentFrame: number;
  isFullPreview: boolean;
}

export function Timeline({ playerRef, currentFrame, isFullPreview }: TimelineProps) {
  const project = useProjectStore((s) => s.project);
  const selectScene = useProjectStore((s) => s.selectScene);
  const updateScene = useProjectStore((s) => s.updateScene);
  const moveScene = useProjectStore((s) => s.moveScene);
  const splitScene = useProjectStore((s) => s.splitScene);
  const insertSceneAt = useProjectStore((s) => s.insertSceneAt);
  const playingSceneId = useEditorStore((s) => s.playingSceneId);
  // cutMode now lives on the store so the C/V keyboard shortcuts can
  // toggle it from anywhere (KeyboardShortcuts.tsx). Preserve the
  // setCutMode local alias so the rest of this component reads cleanly.
  const cutMode = useEditorStore((s) => s.cutMode);
  const setCutMode = useEditorStore((s) => s.setCutMode);
  const timelineZoom = useEditorStore((s) => s.timelineZoom);
  const setTimelineZoom = useEditorStore((s) => s.setTimelineZoom);
  const loopRange = useEditorStore((s) => s.loopRange);
  const addUpload = useProjectStore((s) => s.addUpload);

  // Upload a real File from a Finder/Explorer drop, then insert it as a
  // new scene. Reuses the same /api/assets/upload pipe and addUpload
  // store action so the file shows up in the Uploads bin afterwards.
  const uploadAndInsert = useCallback(
    async (file: File, insertIndex: number) => {
      if (file.size > 200 * 1024 * 1024) return;
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/assets/upload", { method: "POST", body: form });
      if (!res.ok) return;
      const data = await res.json();
      const upload = {
        id: `up-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: data.name ?? file.name,
        url: data.url as string,
        type: (data.type ?? file.type) as string,
        bytes: data.bytes ?? file.size,
        uploadedAt: Date.now(),
      };
      addUpload(upload);
      const portrait = project.height > project.width;
      const scene = upload.type.startsWith("video/")
        ? {
            id: createId(),
            type: "text_only" as const,
            duration: 3,
            background: { ...DEFAULT_BG, videoUrl: upload.url },
            transition: "beat_flash" as const,
          }
        : {
            id: createId(),
            type: "text_only" as const,
            duration: 3,
            background: { ...DEFAULT_BG, imageUrl: upload.url, kenBurns: true },
            textItems: [
              defaultPlaceholderTextItem({
                fontSize: portrait ? 96 : 72,
                y: portrait ? 500 : 380,
              }),
            ],
            transition: "beat_flash" as const,
          };
      insertSceneAt(insertIndex, scene);
    },
    [addUpload, insertSceneAt, project.height, project.width],
  );
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [trackHover, setTrackHover] = useState(false);

  const total = useMemo(
    () => Math.max(1, totalDurationFrames(project.scenes, project.fps)),
    [project.scenes, project.fps],
  );

  // Drag-to-resize state. When set, pointermove adjusts the scene's duration.
  const resizeRef = useRef<{
    sceneId: string;
    startX: number;
    startDuration: number;
    pxPerSec: number;
  } | null>(null);

  /**
   * Snap a duration in seconds to the nearest grid step. Steps:
   * - 0.25s ("quarter") — default; fine enough for hooks, coarse enough
   *   to not feel sticky.
   * Hold Alt during the drag to bypass and free-snap to the original
   * sub-frame precision.
   */
  const snapSec = useCallback((sec: number, alt: boolean) => {
    if (alt) return Number(sec.toFixed(2));
    const step = 0.25;
    return Number((Math.round(sec / step) * step).toFixed(2));
  }, []);

  const onResizeDown = useCallback(
    (e: React.PointerEvent, sceneId: string, startDuration: number) => {
      e.stopPropagation();
      e.preventDefault();
      const trackWidth = trackRef.current?.clientWidth ?? 0;
      const totalSec = total / project.fps;
      resizeRef.current = {
        sceneId,
        startX: e.clientX,
        startDuration,
        pxPerSec: trackWidth / Math.max(1, totalSec),
      };
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    },
    [total, project.fps],
  );
  const onResizeMove = useCallback(
    (e: React.PointerEvent) => {
      const st = resizeRef.current;
      if (!st) return;
      const dx = e.clientX - st.startX;
      const raw = st.startDuration + dx / st.pxPerSec;
      const snapped = snapSec(raw, e.altKey);
      let next = Math.max(0.5, Math.min(20, snapped));
      // Magnetic snap to the playhead: if the resized end is within
      // 0.15s of the playhead's projection onto this scene's duration,
      // snap exactly to it. Alt bypasses (free-snap).
      if (!e.altKey) {
        const sceneStart = (() => {
          let acc = 0;
          for (const sc of project.scenes) {
            if (sc.id === st.sceneId) return acc;
            acc += sceneDurationFrames(sc, project.fps);
          }
          return null;
        })();
        if (sceneStart !== null) {
          const playheadInScene = (currentFrame - sceneStart) / project.fps;
          if (
            playheadInScene > 0 &&
            playheadInScene < 20 &&
            Math.abs(playheadInScene - next) < 0.15
          ) {
            next = Number(playheadInScene.toFixed(2));
          }
        }
      }
      updateScene(st.sceneId, { duration: next });
    },
    [updateScene, snapSec, project.scenes, project.fps, currentFrame],
  );
  const onResizeUp = useCallback((e: React.PointerEvent) => {
    resizeRef.current = null;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  }, []);

  // Precompute scene boundaries in frames for tick positions and click lookup.
  const markers = useMemo(() => {
    let acc = 0;
    return project.scenes.map((s) => {
      const start = acc;
      const frames = sceneDurationFrames(s, project.fps);
      acc += frames;
      return { id: s.id, start, frames, endExclusive: acc };
    });
  }, [project.scenes, project.fps]);

  const trackRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the selected scene into view when zoomed in. Without
  // this, ⌘1-9 / arrow-key navigation could land on a scene off-screen
  // because the track is wider than the viewport at zoom > 1.
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  useEffect(() => {
    if (!selectedSceneId || !trackRef.current) return;
    if (timelineZoom <= 1) return;
    const idx = project.scenes.findIndex((s) => s.id === selectedSceneId);
    if (idx < 0) return;
    const m = markers[idx];
    if (!m) return;
    const trackEl = trackRef.current;
    const wrapper = trackEl.parentElement;
    if (!wrapper) return;
    const trackWidth = trackEl.clientWidth;
    const blockLeft = (m.start / total) * trackWidth;
    const blockRight = (m.endExclusive / total) * trackWidth;
    const scroll = wrapper.scrollLeft;
    const visibleLeft = scroll;
    const visibleRight = scroll + wrapper.clientWidth;
    if (blockLeft < visibleLeft || blockRight > visibleRight) {
      wrapper.scrollTo({
        left: blockLeft - wrapper.clientWidth / 2 + (blockRight - blockLeft) / 2,
        behavior: "smooth",
      });
    }
  }, [selectedSceneId, timelineZoom, markers, total, project.scenes]);

  const seekTo = useCallback(
    (frame: number) => {
      if (!playerRef.current) return;
      playerRef.current.seekTo(Math.max(0, Math.min(total - 1, frame)));
    },
    [playerRef, total],
  );

  const handleClick = (e: React.MouseEvent) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    let frame = Math.round(ratio * total);
    const marker = markers.find((m) => frame >= m.start && frame < m.endExclusive);
    if (cutMode) {
      // Cut at this frame inside the marker's scene. Snap the cut to
      // the nearest 0.25s relative to the scene's start so cuts land on
      // a clean grid; Alt bypasses for free placement.
      if (marker) {
        let within = frame - marker.start;
        if (!e.altKey) {
          const snappedSec = snapSec(within / project.fps, false);
          within = Math.round(snappedSec * project.fps);
          // Don't allow snap to land at exact 0 or end (splitScene rejects).
          within = Math.max(2, Math.min(marker.frames - 2, within));
          frame = marker.start + within;
        }
        const newId = splitScene(marker.id, within);
        if (newId) selectScene(newId);
      }
      // Stay in cut mode until the user toggles off.
      return;
    }
    seekTo(frame);
    if (marker) selectScene(marker.id);
  };

  // Empty-timeline drop zone: lets the user create their first scene
  // by dragging an upload / scene-type / title card onto the track.
  // Without this, drops on an empty project silently fail because the
  // track itself wouldn't be rendered.
  if (project.scenes.length === 0) {
    return (
      <div
        className="flex flex-col gap-1 shrink-0 pt-2"
        onDragOver={(e) => {
          const types = e.dataTransfer.types;
          if (
            types.includes("vibeedit/upload-url") ||
            types.includes("vibeedit/scene-type") ||
            types.includes("vibeedit/title") ||
            types.includes("Files")
          ) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }
        }}
        onDrop={(e) => {
          const portrait = project.height > project.width;
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files);
            (async () => {
              let target = 0;
              for (const f of files) {
                await uploadAndInsert(f, target);
                target += 1;
              }
            })();
            return;
          }
          const url = e.dataTransfer.getData("vibeedit/upload-url");
          if (url) {
            e.preventDefault();
            const type = e.dataTransfer.getData("vibeedit/upload-type");
            const scene = type.startsWith("video/")
              ? {
                  id: createId(),
                  type: "text_only" as const,
                  duration: 3,
                  background: { ...DEFAULT_BG, videoUrl: url },
                  transition: "beat_flash" as const,
                }
              : {
                  id: createId(),
                  type: "text_only" as const,
                  duration: 3,
                  background: { ...DEFAULT_BG, imageUrl: url, kenBurns: true },
                  textItems: [
                    defaultPlaceholderTextItem({
                      fontSize: portrait ? 96 : 72,
                      y: portrait ? 500 : 380,
                    }),
                  ],
                  transition: "beat_flash" as const,
                };
            insertSceneAt(0, scene);
            return;
          }
          const titlePayload = e.dataTransfer.getData("vibeedit/title");
          if (titlePayload) {
            e.preventDefault();
            try {
              const { params } = JSON.parse(titlePayload) as {
                params?: Record<string, unknown>;
              };
              if (params) {
                const base = {
                  id: createId(),
                  type: "text_only" as const,
                  duration: 3,
                  background: { ...DEFAULT_BG },
                };
                const merged = {
                  ...base,
                  ...(params as Record<string, unknown>),
                  id: base.id,
                  background: {
                    ...base.background,
                    ...((params as { background?: Record<string, unknown> }).background ??
                      {}),
                  },
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any;
                insertSceneAt(0, merged);
              }
            } catch {}
            return;
          }
          const sceneTypePayload = e.dataTransfer.getData("vibeedit/scene-type");
          if (sceneTypePayload) {
            e.preventDefault();
            try {
              const { value } = JSON.parse(sceneTypePayload) as { value: string };
              insertSceneAt(0, {
                id: createId(),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                type: value as any,
                duration: 3,
                background: { ...DEFAULT_BG },
                transition: "beat_flash" as const,
              });
            } catch {}
            return;
          }
        }}
      >
        <div className="text-[10px] uppercase tracking-wide text-neutral-500 px-1">
          Timeline
        </div>
        <div className="h-20 rounded border-2 border-dashed border-neutral-700 bg-neutral-900/40 flex flex-col items-center justify-center gap-0.5 text-xs text-neutral-500 hover:border-emerald-500 hover:text-emerald-400 transition-colors">
          <span className="text-sm">+ Drop to start</span>
          <span className="text-[10px] text-neutral-600">
            Files from Finder · Uploads tile · Scene type · Title template
          </span>
        </div>
      </div>
    );
  }

  // Always show the playhead. Preview computes a global currentFrame
  // (single-scene mode adds the selected scene's start offset) so the
  // line lands correctly even when the user is editing one scene.
  const playheadPct = Math.min(100, Math.max(0, (currentFrame / total) * 100));
  void isFullPreview;

  const seconds = (total / project.fps).toFixed(1);

  return (
    <div className="flex flex-col gap-1.5 shrink-0 pt-2 px-2 pb-2 mt-2 rounded-lg bg-neutral-950/40 border border-neutral-800/60">
      {/* Toolbar — three-column grid: [left tools] [center timecode] [right zoom] */}
      <div className="grid grid-cols-3 items-center gap-2 px-1 pb-1.5 border-b border-neutral-800/60">
        {/* Left cluster — cut + chips */}
        <div className="flex items-center gap-1.5 justify-self-start">
          <button
            type="button"
            onClick={() => setCutMode(!cutMode)}
            title={cutMode ? "Cut mode — click a scene to split" : "Cut tool (C)"}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all ${
              cutMode
                ? "bg-amber-500 text-black shadow-sm shadow-amber-500/40"
                : "bg-neutral-900/60 border border-neutral-800 text-neutral-400 hover:border-amber-400 hover:text-amber-300"
            }`}
          >
            <Scissors className="h-3 w-3" />
            <span>cut</span>
          </button>
          {loopRange && (
            <button
              type="button"
              onClick={() => useEditorStore.getState().clearLoopRange()}
              className="inline-flex items-center gap-1 text-cyan-300 hover:text-white px-2 py-1 border border-cyan-500/40 bg-cyan-500/10 rounded-md text-[10px] font-medium transition-colors"
              title={`Loop ${(loopRange.start / project.fps).toFixed(2)}s → ${(loopRange.end / project.fps).toFixed(2)}s — click to clear (\\)`}
            >
              <span className="text-[9px]">↻</span>
              <span className="tabular-nums">
                {(loopRange.start / project.fps).toFixed(1)}–
                {(loopRange.end / project.fps).toFixed(1)}s
              </span>
            </button>
          )}
          {project.markers && project.markers.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    `Remove all ${project.markers!.length} marker${project.markers!.length === 1 ? "" : "s"}?`,
                  )
                ) {
                  for (const m of [...project.markers!]) {
                    useProjectStore.getState().removeMarker(m.id);
                  }
                }
              }}
              className="inline-flex items-center gap-1 text-amber-300 hover:text-white px-2 py-1 border border-amber-500/30 bg-amber-500/5 rounded-md text-[10px] font-medium transition-colors"
              title={`${project.markers.length} marker${project.markers.length === 1 ? "" : "s"} · click to clear all`}
            >
              <span className="tabular-nums">M{project.markers.length}</span>
            </button>
          )}
          {cutMode && (
            <span className="text-[10px] text-amber-300 ml-1">
              click a scene to split
            </span>
          )}
        </div>

        {/* Center — timecode */}
        <div className="flex items-baseline gap-2 justify-self-center text-[11px] font-mono">
          <span className="tabular-nums text-emerald-300 text-[14px] font-semibold">
            {(currentFrame / project.fps).toFixed(2)}s
          </span>
          <span className="tabular-nums text-neutral-600">
            f{currentFrame.toString().padStart(3, "0")}
          </span>
          <span className="text-neutral-700">/</span>
          <span className="tabular-nums text-neutral-500">{seconds}s</span>
        </div>

        {/* Right cluster — zoom pill */}
        <div className="justify-self-end inline-flex items-center bg-neutral-900/60 border border-neutral-800 rounded-md overflow-hidden text-[10px] font-mono">
          <button
            type="button"
            onClick={() => setTimelineZoom(timelineZoom / 1.5)}
            title="Zoom out (⌘−)"
            className="px-2 py-1 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setTimelineZoom(1)}
            title="Fit (⌘0)"
            className="px-2 py-1 tabular-nums text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors border-x border-neutral-800"
          >
            {timelineZoom.toFixed(1)}×
          </button>
          <button
            type="button"
            onClick={() => setTimelineZoom(timelineZoom * 1.5)}
            title="Zoom in (⌘=)"
            className="px-2 py-1 text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            +
          </button>
        </div>
      </div>
      {/* Scene-block row — same left-rail width (56px) as layer rows
          below so everything reads down a clean column. */}
      <div className="flex items-stretch gap-1.5">
        <div
          className="w-14 shrink-0 flex items-center gap-1 px-2 rounded bg-neutral-900 border border-neutral-800/80 text-[9px] font-medium text-neutral-300 uppercase tracking-wider"
          title="Scene blocks — drag to reorder, drag right edge to trim"
        >
          <span className="text-neutral-600 text-[8px]">▾</span>
          <span>Scenes</span>
          <span className="ml-auto text-[8.5px] text-neutral-600 tabular-nums">
            {project.scenes.length}
          </span>
        </div>
      <div
        className="flex-1 overflow-x-auto overflow-y-hidden"
        style={{ scrollbarWidth: "thin" }}
        onWheel={(e) => {
          // Trackpad pinch on macOS / browsers fires wheel events with
          // ctrlKey set. Translate vertical pinch into a zoom factor.
          if (e.ctrlKey && e.deltaY !== 0) {
            e.preventDefault();
            const cur = useEditorStore.getState().timelineZoom;
            const factor = Math.exp(-e.deltaY * 0.01);
            useEditorStore.getState().setTimelineZoom(cur * factor);
            return;
          }
          // Horizontal scroll on shift+wheel — Premiere convention.
          // Also: wheel inside a zoomed-in track scrolls horizontally
          // by default (because the inner content is wider than the
          // container). This makes shift-wheel + plain wheel both work
          // for power users with track-pads vs mice.
          if (e.shiftKey && e.deltaY !== 0) {
            e.currentTarget.scrollLeft += e.deltaY;
          }
        }}
      >
      <div
        ref={trackRef}
        style={{ width: `${timelineZoom * 100}%`, minWidth: "100%" }}
        onClick={handleClick}
        onDragOver={(e) => {
          // Accept any of the four "insert new scene" payloads. Drop
          // targets that mutate an existing scene (effect / ai-action /
          // transition) are handled by per-block onDrop below — those
          // calls stopPropagation so they never reach this outer handler.
          const types = e.dataTransfer.types;
          if (
            types.includes("vibeedit/upload-url") ||
            types.includes("vibeedit/scene-type") ||
            types.includes("vibeedit/title") ||
            types.includes("Files")
          ) {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setTrackHover(true);
          }
        }}
        onDragLeave={() => setTrackHover(false)}
        onDrop={(e) => {
          setTrackHover(false);
          if (!trackRef.current) return;
          const rect = trackRef.current.getBoundingClientRect();
          const ratio = (e.clientX - rect.left) / rect.width;
          const frame = Math.round(ratio * total);
          let insertIndex = markers.length;
          for (let i = 0; i < markers.length; i++) {
            const m = markers[i];
            if (frame >= m.start && frame < m.endExclusive) {
              const within = (frame - m.start) / m.frames;
              insertIndex = within > 0.5 ? i + 1 : i;
              break;
            }
          }
          const portrait = project.height > project.width;
          // 0) Real files dragged in from Finder/Explorer. Upload them
          //    first then insert as scenes at the dropped position.
          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files);
            (async () => {
              let target = insertIndex;
              for (const f of files) {
                await uploadAndInsert(f, target);
                target += 1;
              }
            })();
            return;
          }
          // 1) Upload URL → media-backed scene.
          const url = e.dataTransfer.getData("vibeedit/upload-url");
          if (url) {
            e.preventDefault();
            const type = e.dataTransfer.getData("vibeedit/upload-type");
            const scene = type.startsWith("video/")
              ? {
                  id: createId(),
                  type: "text_only" as const,
                  duration: 3,
                  background: { ...DEFAULT_BG, videoUrl: url },
                  transition: "beat_flash" as const,
                }
              : {
                  id: createId(),
                  type: "text_only" as const,
                  duration: 3,
                  background: { ...DEFAULT_BG, imageUrl: url, kenBurns: true },
                  textItems: [
                    defaultPlaceholderTextItem({
                      fontSize: portrait ? 96 : 72,
                      y: portrait ? 500 : 380,
                    }),
                  ],
                  transition: "beat_flash" as const,
                };
            insertSceneAt(insertIndex, scene);
            return;
          }
          // 1.5) Title template → new scene with the template's full
          //      bundle of fields. Distinct from scene-type because
          //      titles include effects[], motion presets, transition,
          //      pre-filled text content. Just a deeper bundle.
          const titlePayload = e.dataTransfer.getData("vibeedit/title");
          if (titlePayload) {
            e.preventDefault();
            try {
              const { params } = JSON.parse(titlePayload) as {
                params?: Record<string, unknown>;
              };
              if (params) {
                // Merge over a base scene shape so id + minimal defaults
                // are present even when the template omits them.
                const base = {
                  id: createId(),
                  type: "text_only" as const,
                  duration: 3,
                  background: { ...DEFAULT_BG },
                };
                const merged = {
                  ...base,
                  ...(params as Record<string, unknown>),
                  id: base.id,
                  background: {
                    ...base.background,
                    ...((params as { background?: Record<string, unknown> }).background ??
                      {}),
                  },
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                } as any;
                insertSceneAt(insertIndex, merged);
              }
            } catch {}
            return;
          }
          // 2) Scene-type card → blank scene with that type pre-set.
          const sceneTypePayload = e.dataTransfer.getData("vibeedit/scene-type");
          if (sceneTypePayload) {
            e.preventDefault();
            try {
              const { value } = JSON.parse(sceneTypePayload) as { value: string };
              const baseScene = {
                id: createId(),
                type: value as "text_only",
                duration: 3,
                background: { ...DEFAULT_BG },
                transition: "beat_flash" as const,
              };
              // Per-type sensible defaults so the dropped scene isn't
              // a blank rectangle the user has to configure from zero.
              type SceneShape = typeof baseScene & {
                textItems?: ReturnType<typeof defaultPlaceholderTextItem>[];
                statValue?: string;
                statLabel?: string;
                quoteText?: string;
                quoteAttribution?: string;
                bulletItems?: string[];
                montageUrls?: string[];
                chartBars?: Array<{ label: string; value: number }>;
                splitLeftUrl?: string;
                splitRightUrl?: string;
              };
              const scene: SceneShape = baseScene;
              if (value === "text_only") {
                scene.textItems = [
                  defaultPlaceholderTextItem({
                    fontSize: portrait ? 96 : 72,
                    y: portrait ? 500 : 380,
                  }),
                ];
              } else if (value === "stat") {
                scene.statValue = "100%";
                scene.statLabel = "edit this label";
              } else if (value === "quote") {
                scene.quoteText = "Edit this quote";
                scene.quoteAttribution = "Author";
              } else if (value === "bullet_list") {
                scene.bulletItems = ["Point one", "Point two", "Point three"];
              } else if (value === "bar_chart") {
                scene.chartBars = [
                  { label: "A", value: 30 },
                  { label: "B", value: 60 },
                  { label: "C", value: 45 },
                ];
              }
              insertSceneAt(insertIndex, scene);
            } catch {
              // bad payload — silently ignore
            }
            return;
          }
        }}
        className={`group/timeline relative h-8 bg-neutral-900 rounded border ${
          trackHover
            ? "border-emerald-400 bg-emerald-500/10"
            : cutMode
              ? "border-amber-400 ring-1 ring-amber-400/40"
              : "border-neutral-800"
        } ${cutMode ? "cursor-crosshair" : "cursor-pointer"}`}
        title={cutMode ? "Click to cut at this frame" : "Click to jump · drop an upload to insert a scene"}
      >
        {markers.map((m, i) => {
          const left = (m.start / total) * 100;
          const width = (m.frames / total) * 100;
          const scene = project.scenes[i];
          const selected = scene.id === m.id;
          const isHoverTarget = hoverIndex === i && dragIndex !== null && dragIndex !== i;
          return (
            <div
              key={m.id}
              style={{ left: `${left}%`, width: `${width}%` }}
              draggable
              onDragStart={(e) => {
                setDragIndex(i);
                // M4: also expose the scene id so it can be dragged
                // onto the TracksPanel rows to switch tracks.
                e.dataTransfer.setData("vibeedit/scene-id", scene.id);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                // Accept the existing reorder drag AND new vibeedit/* card
                // drops so users can drop effects / transitions / ai-
                // actions onto a specific scene. Also intercept Shift-
                // held upload drops so they swap the scene's bg media
                // (instead of bubbling to the track for an insert).
                const types = e.dataTransfer.types;
                const wantsSwap =
                  e.shiftKey && types.includes("vibeedit/upload-url");
                if (
                  dragIndex !== null ||
                  types.includes("vibeedit/effect") ||
                  types.includes("vibeedit/transition") ||
                  types.includes("vibeedit/ai-action") ||
                  types.includes("vibeedit/look") ||
                  wantsSwap
                ) {
                  e.preventDefault();
                  e.stopPropagation();
                  setHoverIndex(i);
                  e.dataTransfer.dropEffect =
                    types.includes("vibeedit/effect") ||
                    types.includes("vibeedit/transition") ||
                    types.includes("vibeedit/ai-action") ||
                    types.includes("vibeedit/look") ||
                    wantsSwap
                      ? "copy"
                      : "move";
                }
              }}
              onDrop={(e) => {
                // Outer-track MIME types (upload-url / scene-type /
                // title) need to reach the track-level onDrop so the
                // user can insert a clip near a scene block. Don't
                // stopPropagation for these — let them bubble. EXCEPT
                // when Shift is held with an upload: that's the "swap
                // this scene's bg media" gesture, handled here.
                const types = e.dataTransfer.types;
                const isOuterMime =
                  types.includes("vibeedit/upload-url") ||
                  types.includes("vibeedit/scene-type") ||
                  types.includes("vibeedit/title");
                const wantsSwap =
                  e.shiftKey && types.includes("vibeedit/upload-url");
                if (wantsSwap) {
                  e.preventDefault();
                  e.stopPropagation();
                  const url = e.dataTransfer.getData("vibeedit/upload-url");
                  const utype = e.dataTransfer.getData("vibeedit/upload-type");
                  if (url) {
                    const isVid = utype.startsWith("video/");
                    updateScene(scene.id, {
                      background: {
                        ...scene.background,
                        ...(isVid
                          ? { videoUrl: url, imageUrl: undefined }
                          : { imageUrl: url, videoUrl: undefined, kenBurns: true }),
                      },
                    });
                  }
                  setDragIndex(null);
                  setHoverIndex(null);
                  return;
                }
                if (isOuterMime && dragIndex === null) {
                  setHoverIndex(null);
                  return;
                }
                e.preventDefault();
                e.stopPropagation();
                // 1) Effect card → push onto scene.effects.
                const effectPayload = e.dataTransfer.getData("vibeedit/effect");
                if (effectPayload) {
                  try {
                    const { value, params } = JSON.parse(effectPayload) as { value: string; params?: Record<string, unknown> };
                    const updated: Scene["effects"] = [
                      ...((scene.effects ?? []) as NonNullable<Scene["effects"]>),
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      { kind: value as any, startFrame: 0, ...(params ?? {}) },
                    ];
                    updateScene(scene.id, { effects: updated });
                    useEditorStore.getState().pushRecentAction("effect", value);
                  } catch {}
                  setDragIndex(null);
                  setHoverIndex(null);
                  return;
                }
                // 2) Transition card → set the cut going INTO this scene
                //    from its predecessor. End-of-track scene 0 has no
                //    predecessor; we silently no-op.
                const transPayload = e.dataTransfer.getData("vibeedit/transition");
                if (transPayload) {
                  try {
                    const { value, params } = JSON.parse(transPayload) as {
                      value: string;
                      params?: { durationFrames?: number; color?: string };
                    };
                    const prev = project.scenes[i - 1];
                    if (prev) {
                      const existing = (project.cuts ?? []).filter(
                        (c) => !(c.fromSceneId === prev.id && c.toSceneId === scene.id),
                      );
                      const newCut: Cut = {
                        id: createId(),
                        fromSceneId: prev.id,
                        toSceneId: scene.id,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        kind: value as any,
                        durationFrames: params?.durationFrames ?? 12,
                        color: params?.color,
                      };
                      // No public store action for raw "set cuts list" so
                      // fall through the upsertCut helper which already
                      // dedupes by from/to pair. We re-import inline.
                      void existing;
                      useProjectStore.getState().upsertCut(newCut);
                      useEditorStore.getState().pushRecentAction("transition", value);
                    }
                  } catch {}
                  setDragIndex(null);
                  setHoverIndex(null);
                  return;
                }
                // 3a) Look → merge bundled background fields onto the scene.
                const lookPayload = e.dataTransfer.getData("vibeedit/look");
                if (lookPayload) {
                  try {
                    const { value, params } = JSON.parse(lookPayload) as {
                      value?: string;
                      params?: Record<string, unknown>;
                    };
                    if (params) {
                      // Reset the keys we're setting to the new bundle so a
                      // second look fully replaces the first (vs additive).
                      const cleanedBg = { ...scene.background };
                      for (const k of [
                        "colorGrade",
                        "brightness",
                        "contrast",
                        "saturation",
                        "temperature",
                        "blur",
                      ] as const) {
                        delete (cleanedBg as Record<string, unknown>)[k];
                      }
                      updateScene(scene.id, {
                        background: { ...cleanedBg, ...(params as Record<string, unknown>) } as Scene["background"],
                      });
                      if (value) useEditorStore.getState().pushRecentAction("look", value);
                    }
                  } catch {}
                  setDragIndex(null);
                  setHoverIndex(null);
                  return;
                }
                // 3) AI action → focus this scene + run prefab prompt.
                const aiPayload = e.dataTransfer.getData("vibeedit/ai-action");
                if (aiPayload) {
                  try {
                    const { prompt } = JSON.parse(aiPayload) as { prompt: string };
                    void import("@/store/editor-store").then(({ useEditorStore }) => {
                      useEditorStore.getState().setFocusedSceneId(scene.id);
                    });
                    const evt = new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true });
                    window.dispatchEvent(evt);
                    setTimeout(async () => {
                      const { useChatStore } = await import("@/store/chat-store");
                      useChatStore.getState().addUserMessage(prompt);
                      document.querySelector<HTMLFormElement>("aside form")?.requestSubmit();
                    }, 80);
                  } catch {}
                  setDragIndex(null);
                  setHoverIndex(null);
                  return;
                }
                // 4) Existing reorder behavior.
                if (dragIndex !== null && dragIndex !== i) {
                  moveScene(dragIndex, i);
                }
                setDragIndex(null);
                setHoverIndex(null);
              }}
              onDragEnd={() => {
                setDragIndex(null);
                setHoverIndex(null);
              }}
              onDoubleClick={(e) => {
                if (cutMode) return;
                e.stopPropagation();
                const next = window.prompt(
                  "Scene label",
                  scene.label ?? `Scene ${i + 1}`,
                );
                if (next !== null) {
                  updateScene(scene.id, {
                    label: next.trim() === "" ? undefined : next.trim(),
                  });
                }
              }}
              className={`absolute top-0 bottom-0 border-l border-neutral-800/70 cursor-grab active:cursor-grabbing transition-colors ${
                playingSceneId === m.id
                  ? "bg-sky-500/40 ring-1 ring-sky-400 ring-inset"
                  : selected
                    ? "bg-emerald-500/25"
                    : "hover:bg-neutral-800/60"
              } ${isHoverTarget ? "ring-2 ring-sky-400 ring-inset" : ""} ${
                dragIndex === i ? "opacity-50" : ""
              } ${scene.muted ? "opacity-30 saturate-50" : ""}`}
              title={`${scene.label ?? `Scene ${i + 1}`} · ${(m.frames / project.fps).toFixed(1)}s${scene.muted ? " · muted (skipped on render)" : ""}\nDouble-click to rename · Drag body to reorder · drag right edge to trim · click to seek · right-click for menu`}
            >
              {scene.colorTag && (
                <span
                  className="absolute left-0 top-0 bottom-0 w-1 pointer-events-none"
                  style={{
                    backgroundColor: {
                      red: "#ef4444",
                      amber: "#f59e0b",
                      green: "#10b981",
                      blue: "#3b82f6",
                      purple: "#a855f7",
                      pink: "#ec4899",
                    }[scene.colorTag],
                  }}
                />
              )}
              <span className="absolute left-2 top-0 text-[9px] font-mono text-neutral-500 pointer-events-none z-10 truncate max-w-[80%]">
                {scene.label ?? `${i + 1}`}
                <span className="text-neutral-700"> · {SCENE_TYPE_ABBR[scene.type] ?? scene.type.slice(0, 3)}</span>
                {scene.muted && " · M"}
              </span>
              {scene.voiceover?.audioUrl && (
                <AudioWaveform src={scene.voiceover.audioUrl} height={32} />
              )}
              {(() => {
                const fxCount = scene.effects?.length ?? 0;
                const hasGrade =
                  scene.background.colorGrade && scene.background.colorGrade !== "neutral";
                const hasKey = scene.background.chromaKey || scene.background.lumaKey;
                const items: string[] = [];
                if (fxCount > 0) items.push(`fx${fxCount}`);
                if (hasGrade) items.push("look");
                if (hasKey) items.push("key");
                if (scene.speedFactor && scene.speedFactor !== 1)
                  items.push(`${scene.speedFactor}x`);
                if (items.length === 0) return null;
                return (
                  <span className="absolute right-3 top-0 text-[8.5px] font-mono text-neutral-500 pointer-events-none z-10 truncate">
                    {items.join(" · ")}
                  </span>
                );
              })()}
              {(() => {
                // Surfacing scenes whose duration cuts off the VO.
                const voDur = scene.voiceover?.audioDurationSec ?? 0;
                if (voDur > 0 && scene.duration < voDur - 0.1) {
                  return (
                    <span
                      className="absolute right-1 bottom-0.5 text-[9px] text-orange-400 pointer-events-none z-10"
                      title={`Scene is ${(voDur - scene.duration).toFixed(1)}s shorter than its VO — VO will be cut off`}
                    >
                      ✂
                    </span>
                  );
                }
                return null;
              })()}
              {(() => {
                // Surfacing empty scenes — no media, no text, no VO.
                // These render as a black void in the final video.
                const empty =
                  !scene.background.imageUrl &&
                  !scene.background.videoUrl &&
                  !scene.emphasisText &&
                  !scene.voiceover?.audioUrl &&
                  !scene.statValue &&
                  !scene.quoteText &&
                  !(scene.bulletItems && scene.bulletItems.length > 0) &&
                  !(scene.montageUrls && scene.montageUrls.length > 0);
                if (!empty) return null;
                return (
                  <span
                    className="absolute right-1 bottom-0.5 text-[9px] text-amber-400 pointer-events-none z-10"
                    title="Scene has no media, text, or voiceover — will render blank"
                  >
                    ⚠
                  </span>
                );
              })()}
              {scene.locked && (
                <Lock className="absolute right-1 bottom-0.5 h-2.5 w-2.5 text-amber-400 pointer-events-none z-10" />
              )}
              {/* Right-edge handle reveals on hover so the trim affordance
                  is visible without sniffing the cursor. Hidden when the
                  scene is locked. */}
              {!scene.locked && (
                <span
                  onPointerDown={(e) => onResizeDown(e, m.id, scene.duration)}
                  onPointerMove={onResizeMove}
                  onPointerUp={onResizeUp}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize group"
                  aria-label="Trim end of scene"
                >
                  <span className="block absolute right-0 top-0 bottom-0 w-1 bg-emerald-400/0 group-hover:bg-emerald-400/70 transition-colors" />
                </span>
              )}
            </div>
          );
        })}
        {(
          <div
            style={{ left: `${playheadPct}%` }}
            className="absolute top-0 bottom-0 w-[2px] bg-emerald-400 pointer-events-none"
          />
        )}
        {loopRange && (
          <div
            className="absolute top-0 bottom-0 bg-cyan-400/20 border-x border-cyan-300 pointer-events-none"
            style={{
              left: `${Math.max(0, Math.min(100, (loopRange.start / total) * 100))}%`,
              width: `${Math.max(0, Math.min(100, (loopRange.end / total) * 100) - Math.max(0, Math.min(100, (loopRange.start / total) * 100)))}%`,
            }}
            title={`Loop ${(loopRange.start / project.fps).toFixed(2)}s → ${(loopRange.end / project.fps).toFixed(2)}s`}
          />
        )}
        {(project.markers ?? []).map((mk) => {
          const pct = Math.min(100, Math.max(0, (mk.frame / total) * 100));
          const color = {
            red: "#ef4444",
            amber: "#f59e0b",
            green: "#10b981",
            blue: "#3b82f6",
            purple: "#a855f7",
            pink: "#ec4899",
          }[mk.color ?? "amber"];
          return (
            <div
              key={mk.id}
              style={{ left: `${pct}%`, borderColor: color }}
              className="absolute top-0 bottom-0 border-l-2 border-dashed group/marker"
              title={`${mk.label ?? "marker"} · ${(mk.frame / project.fps).toFixed(2)}s — drag to move · Alt-click to remove`}
              onClick={(e) => {
                if (e.altKey) {
                  e.stopPropagation();
                  useProjectStore.getState().removeMarker(mk.id);
                }
              }}
              onPointerDown={(e) => {
                if (e.altKey) return;
                e.stopPropagation();
                const trackEl = trackRef.current;
                if (!trackEl) return;
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                const rect = trackEl.getBoundingClientRect();
                const onMove = (ev: PointerEvent) => {
                  const ratio = (ev.clientX - rect.left) / rect.width;
                  const frame = Math.max(0, Math.min(total - 1, Math.round(ratio * total)));
                  useProjectStore.getState().updateMarker(mk.id, { frame });
                };
                const onUp = () => {
                  window.removeEventListener("pointermove", onMove);
                  window.removeEventListener("pointerup", onUp);
                };
                window.addEventListener("pointermove", onMove);
                window.addEventListener("pointerup", onUp);
              }}
            >
              <span
                className="absolute -top-1 left-0 -translate-x-1/2 w-2 h-2 rounded-full cursor-grab active:cursor-grabbing"
                style={{ backgroundColor: color }}
              />
              {mk.label && (
                <span
                  className="absolute -top-3.5 left-1 text-[9px] whitespace-nowrap pointer-events-none"
                  style={{ color }}
                >
                  {mk.label}
                </span>
              )}
            </div>
          );
        })}
        {/* Insert (+) buttons at every boundary AND at the very start and
            end. Hover-revealed; click → blank scene at that index pushed
            via insertSceneAt. */}
        {(() => {
          const portrait = project.height > project.width;
          const blankScene = () => ({
            id: createId(),
            type: "text_only" as const,
            duration: 2,
            textItems: [
              defaultPlaceholderTextItem({
                fontSize: portrait ? 96 : 72,
                y: portrait ? 500 : 380,
              }),
            ],
            transition: "beat_flash" as const,
            background: { ...DEFAULT_BG },
          });
          const buttons: React.ReactNode[] = [];
          for (let i = 0; i <= markers.length; i++) {
            const m = markers[i];
            const prevEnd = i === 0 ? 0 : markers[i - 1].endExclusive;
            const leftPct = ((i === 0 ? 0 : i === markers.length ? markers[markers.length - 1].endExclusive : m.start) / total) * 100;
            void prevEnd;
            buttons.push(
              <button
                key={`ins-${i}`}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  insertSceneAt(i, blankScene());
                }}
                title={`Insert blank scene at position ${i + 1}`}
                style={{ left: `${leftPct}%` }}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 opacity-0 hover:opacity-100 group-hover/timeline:opacity-100 transition-opacity h-4 w-4 rounded-full bg-emerald-500 text-black flex items-center justify-center hover:scale-110"
              >
                <Plus className="h-3 w-3" />
              </button>,
            );
          }
          return buttons;
        })()}
        {/* Cut markers between consecutive scenes. We mount them at the
            track level (above the scene blocks' z-index) so the popover
            anchors correctly without getting clipped by the block's
            overflow-hidden parent. */}
        {markers.slice(0, -1).map((m, i) => {
          const fromScene = project.scenes[i];
          const toScene = project.scenes[i + 1];
          if (!fromScene || !toScene) return null;
          const cut: Cut = (project.cuts ?? []).find(
            (c) =>
              c.fromSceneId === fromScene.id && c.toSceneId === toScene.id,
          ) ?? {
            id: `auto-${fromScene.id}-${toScene.id}`,
            fromSceneId: fromScene.id,
            toSceneId: toScene.id,
            kind: "hard",
            durationFrames: 0,
          };
          const leftPct = (m.endExclusive / total) * 100;
          return (
            <div
              key={`cut-${fromScene.id}-${toScene.id}`}
              style={{ left: `${leftPct}%`, position: "absolute", top: 0, bottom: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <CutMarker
                cut={cut}
                fromScene={fromScene}
                toScene={toScene}
                orientation="horizontal"
              />
            </div>
          );
        })}
      </div>
      </div>
      </div>
    </div>
  );
}
