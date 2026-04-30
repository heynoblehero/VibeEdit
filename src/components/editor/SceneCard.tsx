"use client";

import {
  Copy,
  Film,
  GripVertical,
  Image as ImageIcon,
  ImagePlay,
  Lock,
  Mic,
  Play,
  Shapes,
  Sparkles,
  Target,
  Trash2,
  Type,
  Unlock,
  Upload,
  UserSquare2,
  Wand2,
} from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useRef, useState } from "react";
import { defaultPlaceholderTextItem } from "@/lib/scene-schema";
import type { BRollPosition, Scene } from "@/lib/scene-schema";
import {
  type LayerKind,
  deriveItemsFromScene,
  kindToEditTarget,
} from "@/lib/timeline-items";
import { uploadFiles } from "@/lib/upload-files";
import { useEditorStore } from "@/store/editor-store";
import { useProjectStore } from "@/store/project-store";
import { SceneThumbnail } from "./SceneThumbnail";

const LAYER_ICON: Record<LayerKind, React.ComponentType<{ className?: string }>> = {
  bg: ImageIcon,
  character: UserSquare2,
  "text-main": Type,
  "text-emphasis": Type,
  "text-subtitle": Type,
  "text-item": Type,
  shape: Shapes,
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

/** Compute the per-scene layer id used by selectedLayerId — same
 *  format the SceneEditor reads to scope its panels to a single
 *  layer. brollIds are stable across reorders; effect indices aren't,
 *  but effects are a smaller surface and the panel re-derives. */
function computeLayerId(
  layerKind: LayerKind,
  brollId: string | undefined,
  effectIdx: number | undefined,
  shapeId: string | undefined,
  textItemId: string | undefined,
): string | null {
  switch (layerKind) {
    case "bg":
      return "media:bg";
    case "character":
      return "media:character";
    case "broll":
      return brollId ? `media:broll:${brollId}` : null;
    case "text-main":
      return "text:main";
    case "text-emphasis":
      return "text:emphasis";
    case "text-subtitle":
      return "text:subtitle";
    case "text-item":
      return textItemId ? `text-item:${textItemId}` : null;
    case "effects":
      return effectIdx !== undefined ? `effect:${effectIdx}` : null;
    case "shape":
      return shapeId ? `shape:${shapeId}` : null;
    case "voiceover":
      return "voiceover";
    default:
      return null;
  }
}

const LAYER_COLOR: Record<LayerKind, string> = {
  bg: "text-neutral-300",
  character: "text-sky-300",
  "text-main": "text-emerald-300",
  "text-emphasis": "text-emerald-300",
  "text-subtitle": "text-emerald-300",
  "text-item": "text-emerald-300",
  shape: "text-amber-300",
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
  const addUpload = useProjectStore((s) => s.addUpload);

  const isActive = selectedSceneId === scene.id;
  const isInMulti = selectedSceneIds.includes(scene.id);
  const playingSceneId = useEditorStore((s) => s.playingSceneId);
  const isPlaying = playingSceneId === scene.id;
  const focusedSceneId = useEditorStore((s) => s.focusedSceneId);
  const setFocusedSceneId = useEditorStore((s) => s.setFocusedSceneId);
  const setEditTarget = useEditorStore((s) => s.setEditTarget);
  const setSelectedLayerId = useEditorStore((s) => s.setSelectedLayerId);
  const isFocused = focusedSceneId === scene.id;
  const rowRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Derive the layers for this scene. Frame=0 since we only need the
  // labels + kinds — the actual playhead doesn't matter for the list.
  const layers = useMemo(
    () => deriveItemsFromScene(scene, 0, project.fps),
    [scene, project.fps],
  );

  /** Apply a freshly-uploaded file to this scene as the right kind of
   *  layer based on MIME type. Image → background image (or broll if
   *  already has one). Video → background video. Audio → voiceover. */
  const applyUploadToScene = (url: string, mime: string | undefined) => {
    const isVideo = (mime ?? "").startsWith("video/");
    const isImage = (mime ?? "").startsWith("image/");
    const isAudio = (mime ?? "").startsWith("audio/");
    if (isVideo) {
      updateScene(scene.id, {
        background: { ...scene.background, videoUrl: url },
      });
    } else if (isImage) {
      // First image becomes the bg; subsequent images stack as broll.
      if (!scene.background.imageUrl) {
        updateScene(scene.id, {
          background: { ...scene.background, imageUrl: url },
        });
      } else {
        const broll = scene.broll ?? [];
        const positions: BRollPosition[] = [
          "overlay-tr",
          "overlay-bl",
          "overlay-br",
          "overlay-tl",
        ];
        updateScene(scene.id, {
          broll: [
            ...broll,
            {
              id: `b-${Math.random().toString(36).slice(2, 8)}`,
              kind: "image",
              url,
              position: positions[broll.length % positions.length],
              startFrame: 0,
              durationFrames: Math.round(scene.duration * project.fps),
              source: "upload",
            },
          ],
        });
      }
    } else if (isAudio) {
      updateScene(scene.id, {
        voiceover: {
          audioUrl: url,
          audioDurationSec: scene.duration,
          provider: "openai",
          voice: "uploaded",
          text: "",
        },
      });
    }
  };

  const handleFiles = async (files: FileList | File[]) => {
    const results = await uploadFiles(files, addUpload);
    for (const r of results) {
      applyUploadToScene(r.upload.url, r.upload.type);
    }
  };

  /** Add a free-positioned TextItem to the scene. Cascades x/y so
   *  multiple new texts don't stack at the same coords (which made
   *  them un-clickable). Same shape as the "edit me" placeholder so
   *  every text in the scene flows through TextItemPanel — no more
   *  legacy emphasis/main/subtitle fork. */
  const addTextLayer = () => {
    const count = (scene.textItems ?? []).length;
    const offset = count * 60;
    const next = defaultPlaceholderTextItem({
      content: "New text",
      x: 200 + offset,
      y: 400 + offset,
    });
    updateScene(scene.id, {
      textItems: [...(scene.textItems ?? []), next],
    });
    selectScene(scene.id);
    setSelectedLayerId(`text-item:${next.id}`);
    setEditTarget("text");
  };

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
    // Clicking the card body (not a specific layer) means "show me
    // scene-level properties" — clear the layer focus + the panel
    // category. Layer-button onClicks below stop propagation so they
    // don't trigger this.
    setSelectedLayerId(null);
    setEditTarget(null);
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
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setIsDragOver(true);
        }
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        if (e.dataTransfer.files.length > 0) {
          e.preventDefault();
          setIsDragOver(false);
          handleFiles(e.dataTransfer.files);
        }
      }}
      className={`rounded-lg ${isDragOver ? "ring-2 ring-emerald-400/70 ring-offset-1 ring-offset-neutral-950" : ""}`}
    >
    <input
      ref={fileInputRef}
      type="file"
      multiple
      hidden
      accept="image/*,video/*,audio/*"
      onChange={(e) => {
        if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
        e.target.value = "";
      }}
    />
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
          ? "border-emerald-500 bg-emerald-500/15 ring-1 ring-emerald-500/30 shadow-md shadow-emerald-500/10"
          : isInMulti
            ? "border-emerald-700/60 bg-emerald-900/15"
            : "border-neutral-700 bg-neutral-900 hover:border-emerald-500/40 hover:bg-neutral-800/60"
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
    <div className="ml-4 mt-1 mb-2 pl-2 border-l border-neutral-800 space-y-0.5">
      {layers.length === 0 && (
        <div className="px-2 py-1 text-[10px] text-neutral-600 italic">
          No layers — drop a file here or click +
        </div>
      )}
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
              const brollId =
                layer.kind === "broll" && layer.index !== undefined
                  ? scene.broll?.[layer.index]?.id
                  : undefined;
              const shapeId =
                layer.kind === "shape" && layer.index !== undefined
                  ? scene.shapes?.[layer.index]?.id
                  : undefined;
              const textItemId =
                layer.kind === "text-item" && layer.index !== undefined
                  ? scene.textItems?.[layer.index]?.id
                  : undefined;
              const layerId = computeLayerId(
                layer.kind,
                brollId,
                layer.index,
                shapeId,
                textItemId,
              );
              setSelectedLayerId(layerId);
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
      <div className="flex items-center gap-1 pt-0.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            addTextLayer();
          }}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-neutral-400 hover:text-emerald-300 hover:bg-neutral-800/60 border border-neutral-800 hover:border-emerald-500/40 transition-colors"
          title="Add a text layer to this scene"
        >
          <Type className="h-3 w-3 shrink-0" />
          <span className="text-[10.5px] font-medium">Text</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1 rounded text-neutral-400 hover:text-emerald-300 hover:bg-neutral-800/60 border border-neutral-800 hover:border-emerald-500/40 transition-colors"
          title="Upload an image / video / audio to this scene"
        >
          <Upload className="h-3 w-3 shrink-0" />
          <span className="text-[10.5px] font-medium">Media</span>
        </button>
      </div>
    </div>
    </div>
  );
}
