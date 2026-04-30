"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Scene } from "@/lib/scene-schema";
import { defaultPlaceholderTextItem } from "@/lib/scene-schema";
import { useEditorStore } from "@/store/editor-store";
import { useProjectStore } from "@/store/project-store";

interface Props {
  scene: Scene;
  index: number;
  x: number;
  y: number;
  onClose: () => void;
}

interface AISuggestion {
  label: string;
  prompt: string;
  /** When true, also flip focus mode on the scene before sending. */
  focusFirst?: boolean;
}

const AI_SUGGESTIONS: AISuggestion[] = [
  {
    label: "Improve this scene",
    prompt: "Improve this scene — pick the weakest aspect (visual, narration, motion, or pacing) and fix it. Don't touch other scenes.",
    focusFirst: true,
  },
  {
    label: "Re-narrate",
    prompt: "Re-narrate this scene with a different voice or tone — keep the script but make it more engaging.",
    focusFirst: true,
  },
  {
    label: "Generate new image",
    prompt: "Replace this scene's background image with a fresh AI-generated one that matches the script.",
    focusFirst: true,
  },
  {
    label: "Match style to next scene",
    prompt: "Make this scene's color grade, motion, and font weight match the next scene so they feel like a sequence.",
    focusFirst: true,
  },
  {
    label: "Run selfCritique here",
    prompt: "Run selfCritique on this scene only and apply the top fix.",
    focusFirst: true,
  },
];

// Lightweight right-click menu. Rendered at the page level by SceneList so it
// can overlay everything.
export function SceneContextMenu({ scene, index, x, y, onClose }: Props) {
  const removeScene = useProjectStore((s) => s.removeScene);
  const duplicateScene = useProjectStore((s) => s.duplicateScene);
  const updateScene = useProjectStore((s) => s.updateScene);
  const setFocusedSceneId = useEditorStore((s) => s.setFocusedSceneId);
  const ref = useRef<HTMLDivElement>(null);
  const [aiOpen, setAiOpen] = useState(false);

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

  const editInChat = async () => {
    const { useChatStore } = await import("@/store/chat-store");
    useChatStore.getState().addUserMessage(`Edit scene ${index + 1}: `);
    document.querySelector<HTMLTextAreaElement>("aside textarea")?.focus();
    onClose();
  };

  const runAISuggestion = async (s: AISuggestion) => {
    if (s.focusFirst) setFocusedSceneId(scene.id);
    // Open chat sidebar via the same Cmd+K event the keyboard handler uses.
    const evt = new KeyboardEvent("keydown", {
      key: "k",
      metaKey: true,
      bubbles: true,
    });
    window.dispatchEvent(evt);
    setTimeout(async () => {
      const { useChatStore } = await import("@/store/chat-store");
      useChatStore.getState().addUserMessage(s.prompt);
      document.querySelector<HTMLFormElement>("aside form")?.requestSubmit();
    }, 80);
    onClose();
  };

  return (
    <div
      ref={ref}
      style={{ left: x, top: y }}
      className="fixed z-50 w-56 rounded-md border border-neutral-800 bg-neutral-900 py-1 shadow-lg text-[12px]"
    >
      <button
        onClick={editInChat}
        className="w-full text-left px-3 py-1.5 text-neutral-200 hover:bg-neutral-800"
      >
        Edit in chat
      </button>
      {/* AI suggestions submenu — opens a nested panel rather than a true
          flyout so it stays within the parent menu's hit-area on small
          screens. */}
      <button
        onMouseEnter={() => setAiOpen(true)}
        onClick={() => setAiOpen((v) => !v)}
        className={
          aiOpen
            ? "w-full text-left px-3 py-1.5 flex items-center gap-2 bg-emerald-500/10 text-emerald-300"
            : "w-full text-left px-3 py-1.5 flex items-center gap-2 text-neutral-200 hover:bg-neutral-800"
        }
      >
        <Sparkles className="h-3 w-3 text-emerald-400" />
        AI suggestions
        <span className="ml-auto text-neutral-600">▸</span>
      </button>
      {aiOpen && (
        <div className="border-y border-neutral-800 bg-neutral-950">
          {AI_SUGGESTIONS.map((s) => (
            <button
              key={s.label}
              onClick={() => runAISuggestion(s)}
              className="w-full text-left px-3 py-1.5 pl-7 text-[11px] text-neutral-300 hover:bg-emerald-500/10 hover:text-emerald-200"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
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
