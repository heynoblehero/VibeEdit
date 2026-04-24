"use client";

import { Copy, GripVertical, Trash2 } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useRef } from "react";
import type { Scene } from "@/lib/scene-schema";
import { useProjectStore } from "@/store/project-store";
import { SceneThumbnail } from "./SceneThumbnail";

interface SceneCardProps {
  scene: Scene;
  index: number;
}


export function SceneCard({ scene, index }: SceneCardProps) {
  const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
  const selectedSceneIds = useProjectStore((s) => s.selectedSceneIds);
  const selectScene = useProjectStore((s) => s.selectScene);
  const removeScene = useProjectStore((s) => s.removeScene);
  const duplicateScene = useProjectStore((s) => s.duplicateScene);

  const isActive = selectedSceneId === scene.id;
  const isInMulti = selectedSceneIds.includes(scene.id);
  const rowRef = useRef<HTMLDivElement | null>(null);

  // When selection moves via keyboard, scroll the active card into view.
  useEffect(() => {
    if (isActive && rowRef.current) {
      rowRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [isActive]);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: scene.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  const handleClick = (e: React.MouseEvent) => {
    const multi = e.shiftKey || e.metaKey || e.ctrlKey;
    selectScene(scene.id, multi);
  };

  const handleDoubleClick = async (e: React.MouseEvent) => {
    // Double-click drops you into the chat with an "edit scene N" draft.
    e.stopPropagation();
    const { useChatStore } = await import("@/store/chat-store");
    useChatStore.getState().addUserMessage(`Edit scene ${index + 1}: `);
    document.querySelector<HTMLTextAreaElement>("aside textarea")?.focus();
  };

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        rowRef.current = el;
      }}
      style={style}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors border ${
        isActive
          ? "border-emerald-500 bg-emerald-500/10"
          : isInMulti
            ? "border-emerald-700/60 bg-emerald-900/15"
            : "border-neutral-800 bg-neutral-900 hover:border-neutral-600"
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 cursor-grab active:cursor-grabbing text-neutral-600 hover:text-neutral-300"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-3 w-3" />
      </button>
      <span className="text-[9px] font-mono text-neutral-600 shrink-0 w-5 text-right">
        {String(index + 1).padStart(2, "0")}
      </span>
      {scene.emphasisColor && (
        <span
          className="h-2 w-2 rounded-full shrink-0 ring-1 ring-black/40"
          style={{ backgroundColor: scene.emphasisColor }}
          title={scene.emphasisColor}
        />
      )}
      <SceneThumbnail scene={scene} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {scene.characterId && (
            <span
              className="text-[9px] uppercase font-mono text-neutral-500 px-1 rounded bg-neutral-800 border border-neutral-700"
              title={scene.characterId}
            >
              {scene.characterId.slice(0, 3)}
            </span>
          )}
          <span className="text-xs font-medium text-white truncate">
            {scene.emphasisText || scene.text || scene.type}
          </span>
        </div>
      </div>
      <span
        className={`text-[10px] shrink-0 font-mono ${
          scene.duration < 1.5
            ? "text-red-400"
            : scene.duration > 4
              ? "text-amber-400"
              : "text-neutral-500"
        }`}
        title={
          scene.duration < 1.5
            ? "Very short — may feel rushed"
            : scene.duration > 4
              ? "Long — may drag"
              : "Good pacing"
        }
      >
        {scene.duration}s
      </span>
      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation();
            duplicateScene(scene.id);
          }}
          title="Duplicate (Cmd/Ctrl+D)"
          className="p-1 text-neutral-500 hover:text-emerald-400 transition-colors"
        >
          <Copy className="h-3 w-3" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            removeScene(scene.id);
          }}
          title="Delete"
          className="p-1 text-neutral-500 hover:text-red-400 transition-colors"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
