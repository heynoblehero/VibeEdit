"use client";

import {
  ChevronDown,
  ChevronRight,
  Copy,
  Film,
  GripVertical,
  Image as ImageIcon,
  ImagePlay,
  Lock,
  Mic,
  Play,
  Sparkles,
  Target,
  Trash2,
  Type,
  Unlock,
  UserSquare2,
  Wand2,
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useRef } from "react";
import type { Scene } from "@/lib/scene-schema";
import {
  type LayerKind,
  deriveItemsFromScene,
  kindToEditTarget,
} from "@/lib/timeline-items";
import { useEditorStore } from "@/store/editor-store";
import { useProjectStore } from "@/store/project-store";
import { SceneThumbnail } from "./SceneThumbnail";

const LAYER_ICON: Record<LayerKind, React.ComponentType<{ className?: string }>> = {
  bg: ImageIcon,
  character: UserSquare2,
  "text-main": Type,
  "text-emphasis": Type,
  "text-subtitle": Type,
  broll: ImagePlay,
  effects: Sparkles,
  voiceover: Mic,
  montage: Film,
  stat: Wand2,
  bullets: Wand2,
  quote: Wand2,
  "bar-chart": Wand2,
  three: Wand2,
  split: Wand2,
  counter: Wand2,
};

const LAYER_COLOR: Record<LayerKind, string> = {
  bg: "text-neutral-300",
  character: "text-sky-300",
  "text-main": "text-emerald-300",
  "text-emphasis": "text-emerald-300",
  "text-subtitle": "text-emerald-300",
  broll: "text-amber-300",
  effects: "text-purple-300",
  voiceover: "text-cyan-300",
  montage: "text-pink-300",
  stat: "text-pink-300",
  bullets: "text-pink-300",
  quote: "text-pink-300",
  "bar-chart": "text-pink-300",
  three: "text-pink-300",
  split: "text-pink-300",
  counter: "text-pink-300",
};

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
  const updateScene = useProjectStore((s) => s.updateScene);
  const project = useProjectStore((s) => s.project);

  const isActive = selectedSceneId === scene.id;
  const isInMulti = selectedSceneIds.includes(scene.id);
  const playingSceneId = useEditorStore((s) => s.playingSceneId);
  const isPlaying = playingSceneId === scene.id;
  const focusedSceneId = useEditorStore((s) => s.focusedSceneId);
  const setFocusedSceneId = useEditorStore((s) => s.setFocusedSceneId);
  const setEditTarget = useEditorStore((s) => s.setEditTarget);
  const isFocused = focusedSceneId === scene.id;
  const expandedSceneIds = useEditorStore((s) => s.expandedSceneIds);
  const toggleSceneExpanded = useEditorStore((s) => s.toggleSceneExpanded);
  const isExpanded = !!expandedSceneIds[scene.id];
  const rowRef = useRef<HTMLDivElement | null>(null);

  // Derive the layers for this scene. Frame=0 since we only need the
  // labels + kinds — the actual playhead doesn't matter for the list.
  const layers = useMemo(
    () => deriveItemsFromScene(scene, 0, project.fps),
    [scene, project.fps],
  );

  // Scroll the active card into view — driven by either selection (kbd nav)
  // or playback position. Playback uses 'nearest' so it doesn't jerk the
  // list around mid-watch.
  useEffect(() => {
    if ((isActive || isPlaying) && rowRef.current) {
      rowRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [isActive, isPlaying]);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: scene.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : scene.muted ? 0.4 : 1,
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
    >
    <div
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      title={
        scene.emphasisText || scene.text
          ? `${scene.type} · ${scene.duration}s\n${scene.emphasisText ?? ""}${scene.emphasisText && scene.text ? "\n" : ""}${scene.text ?? ""}`
          : `${scene.type} · ${scene.duration}s`
      }
      className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors border ${
        isPlaying
          ? "border-sky-400 bg-sky-500/15 ring-2 ring-sky-400/40 ring-offset-1 ring-offset-neutral-950"
          : isActive
          ? "border-emerald-500 bg-emerald-500/10"
          : isInMulti
            ? "border-emerald-700/60 bg-emerald-900/15"
            : "border-neutral-800 bg-neutral-900 hover:border-neutral-600"
      }`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggleSceneExpanded(scene.id);
        }}
        className="shrink-0 text-neutral-500 hover:text-emerald-300 transition-colors"
        aria-label={isExpanded ? "Hide layers" : "Show layers"}
        title={isExpanded ? "Hide layers" : "Show layers"}
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5" />
        )}
      </button>
      <button
        {...attributes}
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 cursor-grab active:cursor-grabbing text-neutral-600 hover:text-neutral-300"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-3 w-3" />
      </button>
      <span className="text-[9px] font-mono text-neutral-600 shrink-0 w-5 text-right flex items-center justify-end">
        {isPlaying ? (
          <Play className="h-2.5 w-2.5 text-sky-400 fill-sky-400 animate-pulse" />
        ) : (
          String(index + 1).padStart(2, "0")
        )}
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
          {scene.voiceover?.audioUrl && (
            <span
              className="text-[9px]"
              title="Has voiceover"
            >
              🎙
            </span>
          )}
          {scene.background?.videoUrl && (
            <span className="text-[9px]" title="Has video background">
              🎬
            </span>
          )}
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
      {/* The Focus button stays visible when active so the user can spot
          + click to exit. Hidden by default; the rest of the action row
          still hides on hover. */}
      {isFocused && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setFocusedSceneId(null);
          }}
          title="Focused — click to exit focus mode"
          className="p-1 text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          <Target className="h-3 w-3" />
        </button>
      )}
      <div className="flex items-center">
        {/* Lock toggle is always visible — when locked, becomes the
            scene's "this is finalized" badge so the user can see at a
            glance which scenes the agent will refuse to touch. */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            updateScene(scene.id, { locked: !scene.locked });
          }}
          title={scene.locked ? "Unlock — agent can edit again" : "Lock — agent will skip this scene"}
          className={`p-1 transition-colors ${
            scene.locked
              ? "text-amber-400 hover:text-amber-300"
              : "text-neutral-600 opacity-0 group-hover:opacity-100 hover:text-amber-400"
          }`}
        >
          {scene.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
        </button>
        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
          {!isFocused && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFocusedSceneId(scene.id);
              }}
              title="Focus agent on this scene only"
              className="p-1 text-neutral-500 hover:text-emerald-400 transition-colors"
            >
              <Target className="h-3 w-3" />
            </button>
          )}
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
    </div>
    {isExpanded && layers.length > 0 && (
      <div className="ml-6 mt-1 mb-1 pl-2 border-l border-neutral-800 space-y-0.5">
        {layers.map((layer) => {
          const Icon = LAYER_ICON[layer.kind];
          const colorClass = LAYER_COLOR[layer.kind];
          return (
            <button
              key={layer.id}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                selectScene(scene.id);
                const target = kindToEditTarget(layer.kind);
                if (target !== null) setEditTarget(target);
              }}
              className="w-full flex items-center gap-1.5 px-2 py-1 rounded text-left hover:bg-neutral-800/60 transition-colors"
              title={`${layer.label} · click to edit`}
            >
              <Icon className={`h-3 w-3 shrink-0 opacity-80 ${colorClass}`} />
              <span className={`flex-1 truncate text-[10.5px] ${colorClass}`}>
                {layer.label}
              </span>
            </button>
          );
        })}
      </div>
    )}
    </div>
  );
}
