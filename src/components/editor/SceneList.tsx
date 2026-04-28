"use client";

import { Plus } from "lucide-react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import React, { useState } from "react";
import { createId, DEFAULT_BG, type Cut, type Scene } from "@/lib/scene-schema";
import { totalDurationSeconds } from "@/lib/scene-schema";
import { getWorkflow } from "@/lib/workflows/registry";
import { useProjectStore } from "@/store/project-store";
import { CutMarker } from "./CutMarker";
import { SceneCard } from "./SceneCard";
import { SceneContextMenu } from "./SceneContextMenu";

export function SceneList() {
  const { project, addScene, moveScene } = useProjectStore();
  const selectAllScenes = useProjectStore((s) => s.selectAllScenes);
  const isGenerating = useProjectStore((s) => s.isGenerating);
  const totalSec = totalDurationSeconds(project.scenes);
  const [ctxMenu, setCtxMenu] = useState<{
    scene: Scene;
    index: number;
    x: number;
    y: number;
  } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const handleAdd = () => {
    // Use a workflow-appropriate blank scene. Faceless workflows get a
    // character scene; text-driven workflows (slideshow, commentary, etc.)
    // get a text_only scene so there's nothing character-specific to clean up.
    const workflow = getWorkflow(project.workflowId);
    const hasCharacter = workflow.sceneEditorTargets?.includes("character") ?? true;
    const portrait = project.height > project.width;
    addScene(
      hasCharacter
        ? {
            id: createId(),
            type: "character_text",
            duration: 2,
            characterId: "point",
            characterX: portrait ? 540 : 1350,
            characterY: portrait ? 1500 : 850,
            characterScale: 1.3,
            enterFrom: "right",
            text: "New scene",
            emphasisText: "edit me",
            emphasisColor: "white",
            textY: portrait ? 300 : 300,
            sfxId: "click1",
            transition: "beat_flash",
            background: { ...DEFAULT_BG },
          }
        : {
            id: createId(),
            type: "text_only",
            duration: 2,
            emphasisText: "edit me",
            emphasisSize: portrait ? 96 : 72,
            emphasisColor: "#ffffff",
            textY: portrait ? 500 : 380,
            transition: "beat_flash",
            background: { ...DEFAULT_BG },
          },
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = project.scenes.findIndex((s) => s.id === active.id);
    const to = project.scenes.findIndex((s) => s.id === over.id);
    if (from < 0 || to < 0) return;
    moveScene(from, to);
  };

  return (
    <div className="flex flex-col gap-1">
      {/* Sticky column heading — Scenes / count / + new */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-neutral-300 font-semibold">
            Scenes
          </span>
          <button
            onClick={() => project.scenes.length > 0 && selectAllScenes()}
            className="text-[10px] font-mono hover:underline"
            style={{
              // Short-form sweet spot is 15-60s. Color-hint when we're outside.
              color:
                project.scenes.length === 0
                  ? "#525252"
                  : totalSec < 10
                    ? "#f87171"
                    : totalSec > 90
                      ? "#fbbf24"
                      : "#10b981",
            }}
            title={
              totalSec < 10
                ? "Very short — may feel abrupt"
                : totalSec > 90
                  ? "Long for short-form — consider trimming"
                  : "Good short-form runtime"
            }
          >
            {project.scenes.length > 0
              ? `${project.scenes.length} · ${totalSec.toFixed(1)}s`
              : "0"}
          </button>
        </div>
        <button
          onClick={handleAdd}
          title="Add blank scene (N)"
          className="flex items-center gap-1 px-2 py-1 rounded text-[10.5px] font-medium text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/15 border border-emerald-500/30 transition-colors"
        >
          <Plus className="h-3 w-3" />
          <span>New scene</span>
        </button>
      </div>
      <div className="flex flex-col gap-1 overflow-y-auto max-h-[60vh] p-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={project.scenes.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {project.scenes.map((scene, i) => {
              const next = project.scenes[i + 1];
              // Look up the cut going OUT of this scene (to the next one)
              // so we can render a marker in the gap below this card.
              const cutToNext: Cut | null = next
                ? (project.cuts ?? []).find(
                    (c) =>
                      c.fromSceneId === scene.id && c.toSceneId === next.id,
                  ) ?? {
                    id: `auto-${scene.id}-${next.id}`,
                    fromSceneId: scene.id,
                    toSceneId: next.id,
                    kind: "hard",
                    durationFrames: 0,
                  }
                : null;
              return (
                <React.Fragment key={scene.id}>
                  <div
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setCtxMenu({ scene, index: i, x: e.clientX, y: e.clientY });
                    }}
                  >
                    <SceneCard scene={scene} index={i} />
                  </div>
                  {cutToNext && next && (
                    <div className="relative">
                      <CutMarker
                        cut={cutToNext}
                        fromScene={scene}
                        toScene={next}
                        orientation="vertical"
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </SortableContext>
        </DndContext>
        {project.scenes.length === 0 && !isGenerating && (
          <div className="flex flex-col items-center gap-2 py-6 text-neutral-600 text-[11px] leading-relaxed">
            <span>No scenes yet</span>
            <button
              onClick={handleAdd}
              className="text-[11px] text-emerald-400 hover:text-emerald-300 underline decoration-dotted underline-offset-2"
            >
              + Add a blank scene
            </button>
            <span className="text-[10px] text-neutral-700">
              or press <kbd className="text-emerald-400">N</kbd> · or ask in chat (<kbd className="text-emerald-400">Cmd+K</kbd>)
            </span>
          </div>
        )}
        {isGenerating && (
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg border border-neutral-800 bg-neutral-900/60 animate-pulse">
            <div className="h-7 w-12 rounded bg-neutral-800" />
            <div className="flex-1 h-3 rounded bg-neutral-800" />
            <span className="text-[10px] text-neutral-600 font-mono">...</span>
          </div>
        )}
      </div>
      {ctxMenu && (
        <SceneContextMenu
          scene={ctxMenu.scene}
          index={ctxMenu.index}
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}
