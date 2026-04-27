"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { Scene } from "@/lib/scene-schema";
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
