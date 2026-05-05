"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Scene } from "@/lib/scene-schema";
import { defaultPlaceholderTextItem } from "@/lib/scene-schema";
import { useProjectStore } from "@/store/project-store";

interface Props {
  scene: Scene;
  index: number;
  x: number;
  y: number;
  onClose: () => void;
}

// Lightweight right-click menu. Rendered at the page level by SceneList so it
// can overlay everything.
export function SceneContextMenu({ scene, index, x, y, onClose }: Props) {
  const removeScene = useProjectStore((s) => s.removeScene);
  const duplicateScene = useProjectStore((s) => s.duplicateScene);
  const updateScene = useProjectStore((s) => s.updateScene);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const copyText = () => {
    const text = [scene.text, scene.emphasisText, scene.subtitleText]
      .filter(Boolean)
      .join("\n");
    if (text) {
      navigator.clipboard?.writeText(text).catch(() => {});
      toast("Copied", { duration: 600 });
    }
    onClose();
  };

  return (
    <div
      ref={ref}
      style={{ left: x, top: y }}
      className="fixed z-50 w-56 rounded-md border border-neutral-800 bg-neutral-900 py-1 shadow-lg text-[12px]"
    >
      <button
        onClick={() => {
          duplicateScene(scene.id);
          toast("Duplicated", { duration: 600 });
          onClose();
        }}
        className="w-full text-left px-3 py-1.5 text-neutral-200 hover:bg-neutral-800"
      >
        Duplicate
      </button>
      <button
        onClick={() => {
          const all = useProjectStore.getState().project.scenes;
          const idx = all.findIndex((s) => s.id === scene.id);
          if (idx >= 0) {
            useProjectStore.getState().insertSceneAt(idx, {
              id: `scn-${Math.random().toString(36).slice(2, 10)}`,
              type: "text_only",
              duration: 2,
              background: { color: "#111111" },
              textItems: [defaultPlaceholderTextItem({ fontSize: 72, y: 380 })],
              transition: "beat_flash",
            });
          }
          onClose();
        }}
        className="w-full text-left px-3 py-1.5 text-neutral-200 hover:bg-neutral-800"
      >
        Insert blank before
      </button>
      <button
        onClick={() => {
          const all = useProjectStore.getState().project.scenes;
          const idx = all.findIndex((s) => s.id === scene.id);
          if (idx >= 0) {
            useProjectStore.getState().insertSceneAt(idx + 1, {
              id: `scn-${Math.random().toString(36).slice(2, 10)}`,
              type: "text_only",
              duration: 2,
              background: { color: "#111111" },
              textItems: [defaultPlaceholderTextItem({ fontSize: 72, y: 380 })],
              transition: "beat_flash",
            });
          }
          onClose();
        }}
        className="w-full text-left px-3 py-1.5 text-neutral-200 hover:bg-neutral-800"
      >
        Insert blank after
      </button>
      <button
        onClick={() => {
          const all = useProjectStore.getState().project.scenes;
          const idx = all.findIndex((s) => s.id === scene.id);
          if (idx > 0) useProjectStore.getState().moveScene(idx, 0);
          onClose();
        }}
        className="w-full text-left px-3 py-1.5 text-neutral-200 hover:bg-neutral-800"
      >
        Move to start
      </button>
      <button
        onClick={() => {
          const all = useProjectStore.getState().project.scenes;
          const idx = all.findIndex((s) => s.id === scene.id);
          if (idx >= 0 && idx < all.length - 1) {
            useProjectStore.getState().moveScene(idx, all.length - 1);
          }
          onClose();
        }}
        className="w-full text-left px-3 py-1.5 text-neutral-200 hover:bg-neutral-800"
      >
        Move to end
      </button>
      <button
        onClick={() => {
          // Find this scene's incoming cut (or fall back to scene.transition).
          const project = useProjectStore.getState().project;
          const idx = project.scenes.findIndex((s) => s.id === scene.id);
          let template: { kind: string; durationFrames: number; color?: string } | null = null;
          if (idx > 0) {
            const prev = project.scenes[idx - 1];
            const inCut = (project.cuts ?? []).find(
              (c) => c.fromSceneId === prev.id && c.toSceneId === scene.id,
            );
            if (inCut) {
              template = {
                kind: inCut.kind,
                durationFrames: inCut.durationFrames,
                color: inCut.color,
              };
            }
          }
          if (!template && scene.transition && scene.transition !== "none") {
            template = { kind: scene.transition, durationFrames: 12 };
          }
          if (!template) {
            toast("No transition on this scene to copy", { duration: 800 });
            return;
          }
          for (let i = 0; i < project.scenes.length - 1; i++) {
            const a = project.scenes[i];
            const b = project.scenes[i + 1];
            useProjectStore.getState().upsertCut({
              id: `cut-${a.id}-${b.id}`,
              fromSceneId: a.id,
              toSceneId: b.id,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              kind: template.kind as any,
              durationFrames: template.durationFrames,
              color: template.color,
            });
          }
          toast(`Applied to ${project.scenes.length - 1} cuts`, { duration: 900 });
          onClose();
        }}
        className="w-full text-left px-3 py-1.5 text-neutral-200 hover:bg-neutral-800"
        title="Copy this scene's incoming transition to every consecutive scene-pair"
      >
        Apply transition to all cuts
      </button>
      <button
        onClick={() => {
          const project = useProjectStore.getState().project;
          let overlay = project.tracks?.find((t) => t.kind === "overlay");
          if (!overlay) {
            // Create one and migrate the implicit V1 in the same step.
            const overlayCount =
              project.tracks?.filter((t) => t.kind === "overlay").length ?? 0;
            const newTrack = {
              id: `track-${Math.random().toString(36).slice(2, 8)}`,
              kind: "overlay" as const,
              name: `Overlay ${overlayCount + 1}`,
              sceneIds: [],
              opacity: 1,
              blendMode: "normal" as const,
            };
            useProjectStore.getState().addTrack(newTrack);
            overlay = newTrack;
          }
          useProjectStore
            .getState()
            .moveSceneToTrack(scene.id, overlay.id, overlay.sceneIds.length);
          toast(`→ ${overlay.name}`, { duration: 700 });
          onClose();
        }}
        className="w-full text-left px-3 py-1.5 text-neutral-200 hover:bg-neutral-800"
        title="Move this scene to an overlay track (creates one if none exists)"
      >
        Move to overlay track
      </button>
      <button
        onClick={copyText}
        className="w-full text-left px-3 py-1.5 text-neutral-200 hover:bg-neutral-800"
      >
        Copy text
      </button>
      <button
        onClick={() => {
          updateScene(scene.id, { muted: !scene.muted });
          toast(scene.muted ? "Unmuted" : "Muted (skipped on render)", {
            duration: 800,
          });
          onClose();
        }}
        className="w-full text-left px-3 py-1.5 text-neutral-200 hover:bg-neutral-800"
      >
        {scene.muted ? "Unmute scene" : "Mute scene (skip render)"}
      </button>
      <button
        onClick={() => {
          updateScene(scene.id, { locked: !scene.locked });
          toast(scene.locked ? "Unlocked" : "Locked", { duration: 800 });
          onClose();
        }}
        className="w-full text-left px-3 py-1.5 text-neutral-200 hover:bg-neutral-800"
      >
        {scene.locked ? "Unlock scene" : "Lock scene (read-only)"}
      </button>
      <button
        onClick={() => {
          // Solo: mute every OTHER scene, leave this one un-muted.
          // If this scene was already the only un-muted one, restore.
          const all = useProjectStore.getState().project.scenes;
          const isSoloed =
            !scene.muted && all.every((sc) => sc.id === scene.id || sc.muted);
          for (const sc of all) {
            const wantMuted = isSoloed ? false : sc.id !== scene.id;
            if (!!sc.muted !== wantMuted) {
              useProjectStore.getState().updateScene(sc.id, { muted: wantMuted });
            }
          }
          toast(isSoloed ? "Solo cleared" : "Soloed (others muted)", { duration: 800 });
          onClose();
        }}
        className="w-full text-left px-3 py-1.5 text-neutral-200 hover:bg-neutral-800"
      >
        Solo scene
      </button>
      <div className="px-3 py-1.5 flex items-center gap-1 text-[11px] text-neutral-400">
        <span className="mr-1">Tag:</span>
        {(["red", "amber", "green", "blue", "purple", "pink"] as const).map(
          (c) => (
            <button
              key={c}
              onClick={() => {
                updateScene(scene.id, {
                  colorTag: scene.colorTag === c ? undefined : c,
                });
                onClose();
              }}
              className={`w-4 h-4 rounded-full border ${
                scene.colorTag === c
                  ? "ring-2 ring-white border-transparent"
                  : "border-neutral-700"
              }`}
              style={{
                backgroundColor: {
                  red: "#ef4444",
                  amber: "#f59e0b",
                  green: "#10b981",
                  blue: "#3b82f6",
                  purple: "#a855f7",
                  pink: "#ec4899",
                }[c],
              }}
              title={c}
            />
          ),
        )}
      </div>
      <button
        onClick={() => {
          // Reset every visual / audio knob without touching media or text.
          updateScene(scene.id, {
            effects: undefined,
            speedFactor: 1,
            audioGain: 1,
            fadeInFrames: 4,
            fadeOutFrames: 0,
            background: {
              ...scene.background,
              colorGrade: undefined,
              brightness: 1,
              contrast: 1,
              saturation: 1,
              temperature: 0,
              blur: 0,
              chromaKey: undefined,
              lumaKey: undefined,
              flipH: false,
              flipV: false,
              rotate: 0,
            },
          });
          toast("Effects reset", { duration: 700 });
          onClose();
        }}
        className="w-full text-left px-3 py-1.5 text-neutral-200 hover:bg-neutral-800"
        title="Wipe effects, color grade, keying, speed, gain, fades, orientation"
      >
        Reset all effects
      </button>
      <div className="my-1 border-t border-neutral-800" />
      <button
        onClick={() => {
          removeScene(scene.id);
          onClose();
        }}
        className="w-full text-left px-3 py-1.5 text-red-400 hover:bg-red-500/10"
      >
        Delete
      </button>
    </div>
  );
}
