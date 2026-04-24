"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Scene } from "@/lib/scene-schema";
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

  const editInChat = async () => {
    const { useChatStore } = await import("@/store/chat-store");
    useChatStore.getState().addUserMessage(`Edit scene ${index + 1}: `);
    document.querySelector<HTMLTextAreaElement>("aside textarea")?.focus();
    onClose();
  };

  return (
    <div
      ref={ref}
      style={{ left: x, top: y }}
      className="fixed z-50 w-48 rounded-md border border-neutral-800 bg-neutral-900 py-1 shadow-lg text-[12px]"
    >
      <button
        onClick={editInChat}
        className="w-full text-left px-3 py-1.5 text-neutral-200 hover:bg-neutral-800"
      >
        Edit in chat
      </button>
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
