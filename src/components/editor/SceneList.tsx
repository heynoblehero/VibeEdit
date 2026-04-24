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
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useState } from "react";
import { createId, DEFAULT_BG, type Scene } from "@/lib/scene-schema";
import { totalDurationSeconds } from "@/lib/scene-schema";
import { getWorkflow } from "@/lib/workflows/registry";
import { useProjectStore } from "@/store/project-store";
import { SceneCard } from "./SceneCard";
import { SceneContextMenu } from "./SceneContextMenu";

export function SceneList() {
  const { project, addScene, moveScene } = useProjectStore();
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
    <div className="flex flex-col gap-1 p-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] text-neutral-500 font-mono">
          {project.scenes.length > 0
            ? `${project.scenes.length} · ${totalSec.toFixed(1)}s`
            : "scenes"}
        </span>
        <button
          onClick={handleAdd}
          title="Add blank scene"
          className="p-0.5 text-neutral-500 hover:text-emerald-300 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex flex-col gap-1 overflow-y-auto max-h-[60vh]">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={project.scenes.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            {project.scenes.map((scene, i) => (
              <div
                key={scene.id}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setCtxMenu({ scene, index: i, x: e.clientX, y: e.clientY });
                }}
              >
                <SceneCard scene={scene} index={i} />
              </div>
            ))}
          </SortableContext>
        </DndContext>
        {project.scenes.length === 0 && !isGenerating && (
          <div className="text-center py-6 text-neutral-600 text-[11px] leading-relaxed">
            No scenes yet.
            <br />
            Ask the agent to make them (<kbd className="text-emerald-400">Cmd+K</kbd>).
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
