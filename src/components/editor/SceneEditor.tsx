"use client";

import { Activity, ArrowLeft, Captions as CaptionsIcon, Film, Loader2, Mic, RefreshCw, Sparkles, User, Type, Palette, Zap, Hash } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAssetStore } from "@/store/asset-store";
import { useEditorStore, type EditTarget } from "@/store/editor-store";
import { useProjectStore } from "@/store/project-store";
import { defaultPlaceholderTextItem, migrateLegacyTextToTextItems } from "@/lib/scene-schema";
import type { BRoll, Easing, EnterDirection, KeyframeProperty, MotionPreset, Scene, SceneShape, TextItem } from "@/lib/scene-schema";
import { BgRemoveButton } from "./BgRemoveButton";
import { CropModal } from "./CropModal";
import { KeyframeGraph } from "./KeyframeGraph";
import { VideoEditModal } from "./VideoEditModal";
import {
  AnimateModal,
  AnimateTrigger,
  EffectsModal,
  EffectsTrigger,
  LookModal,
  LookTrigger,
} from "./PropertyModals";

const DIRECTIONS: EnterDirection[] = ["left", "right", "bottom", "scale"];

const TARGET_META: Record<Exclude<EditTarget, null>, { icon: any; label: string; color: string }> = {
  character: { icon: User, label: "Character", color: "text-emerald-400" },
  text: { icon: Type, label: "Text", color: "text-blue-400" },
  effects: { icon: Zap, label: "Effects", color: "text-amber-400" },
  background: { icon: Palette, label: "Background", color: "text-purple-400" },
  counter: { icon: Hash, label: "Counter", color: "text-orange-400" },
  broll: { icon: Film, label: "B-Roll", color: "text-pink-400" },
  keyframes: { icon: Activity, label: "Animate", color: "text-cyan-400" },
  media: { icon: Film, label: "Media", color: "text-purple-400" },
  shape: { icon: Sparkles, label: "Shape", color: "text-amber-400" },
};

export function SceneEditor() {
  const { project, selectedSceneId, updateScene } = useProjectStore();
  const { editTarget, setEditTarget } = useEditorStore();
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const setSelectedLayerId = useEditorStore((s) => s.setSelectedLayerId);
  const animateModalOpen = useEditorStore((s) => s.animateModalOpen);
  const setAnimateModalOpen = useEditorStore((s) => s.setAnimateModalOpen);
  const { characters, sfx } = useAssetStore();
  const scene = project.scenes.find((s) => s.id === selectedSceneId);

  if (!scene) {
    return (
      <div className="flex items-center justify-center h-full text-neutral-600 text-sm p-6 text-center">
        Select a scene to edit
      </div>
    );
  }

  const update = (patch: Partial<Scene>) => updateScene(scene.id, patch);
  const sceneIdx = project.scenes.findIndex((s) => s.id === scene.id) + 1;

  // Edit targets are always available now that workflow gating is gone.
  const canShow = (_t: Exclude<EditTarget, null>) => true;

  // Figma-style unified chrome. The right panel ALWAYS renders the
  // same shell: a breadcrumb at the top showing "Frame N [ › Selected ]"
  // and a single scrollable body of property sections below. There's no
  // back-arrow, no mode-switch — clicking a different layer in the
  // SceneCard or canvas just swaps which sections are visible.
  const selection = computeSelection(scene, selectedLayerId, editTarget);
  const goBackToFrame = () => {
    setSelectedLayerId(null);
    setEditTarget(null);
  };

  const isLayerSelected = selection.kind !== "frame";

  return (
    <div className="overflow-y-auto max-h-[calc(100vh-50px)]">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-neutral-700/70 bg-neutral-800 sticky top-0 z-10 shadow-sm">
        {isLayerSelected && (
          <button
            onClick={goBackToFrame}
            title="Back to scene"
            aria-label="Back to scene"
            className="shrink-0 h-5 w-5 rounded flex items-center justify-center text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
          >
            <ArrowLeft className="h-3 w-3" />
          </button>
        )}
        <span className={`text-[11px] font-semibold truncate ${selection.color}`}>
          {selection.label}
          {selection.kind === "frame" && (
            <span className="text-neutral-500 font-normal"> {sceneIdx}</span>
          )}
        </span>
        <button
          onClick={() => navigator.clipboard?.writeText(scene.id).catch(() => {})}
          title="Click to copy scene id"
          className="ml-auto text-[9px] font-mono text-neutral-600 hover:text-emerald-400 transition-colors"
        >
          {scene.id.slice(0, 6)}
        </button>
      </div>
      <div className="p-3 space-y-3">
        {selection.kind === "frame" && (
          <FrameProperties
            scene={scene}
            sceneIdx={sceneIdx}
            update={update}
            canShow={canShow}
            setEditTarget={setEditTarget}
          />
        )}
        {selection.kind === "text-item" && <TextPanel scene={scene} update={update} />}
        {selection.kind === "shape" && <ShapePanel scene={scene} update={update} />}
        {selection.kind === "background" && <BackgroundPanel scene={scene} update={update} />}
        {selection.kind === "character" && (
          <CharacterPanel scene={scene} update={update} characters={characters} />
        )}
        {selection.kind === "broll" && <MediaPanel scene={scene} update={update} />}
        {selection.kind === "panel" && (
          <>
            {editTarget === "character" && <CharacterPanel scene={scene} update={update} characters={characters} />}
            {editTarget === "text" && <TextPanel scene={scene} update={update} />}
            {editTarget === "effects" && <EffectsPanel scene={scene} update={update} sfx={sfx} />}
            {editTarget === "background" && <BackgroundPanel scene={scene} update={update} />}
            {editTarget === "counter" && <CounterPanel scene={scene} update={update} />}
            {editTarget === "shape" && <ShapePanel scene={scene} update={update} />}
          </>
        )}
      </div>

      <AnimateModal
        open={animateModalOpen}
        onClose={() => setAnimateModalOpen(false)}
        scene={scene}
      />
    </div>
  );
}

type SelectionInfo =
  | { kind: "frame"; label: string; color: string }
  | { kind: "text-item"; label: string; color: string; itemId: string }
  | { kind: "shape"; label: string; color: string }
  | { kind: "background"; label: string; color: string }
  | { kind: "character"; label: string; color: string }
  | { kind: "broll"; label: string; color: string; brollId: string }
  | { kind: "panel"; label: string; color: string };

function computeSelection(
  scene: Scene,
  layerId: string | null,
  editTarget: EditTarget,
): SelectionInfo {
  if (layerId?.startsWith("text-item:")) {
    const itemId = layerId.slice("text-item:".length);
    const item = scene.textItems?.find((it) => it.id === itemId);
    const label = item?.content ? `Text · ${item.content.slice(0, 18)}` : "Text item";
    return { kind: "text-item", label, color: "text-emerald-300", itemId };
  }
  if (layerId?.startsWith("shape:")) {
    const shapeId = layerId.slice("shape:".length);
    const shape = scene.shapes?.find((sh) => sh.id === shapeId);
    const label = shape ? `Shape · ${shape.kind}` : "Shape";
    return { kind: "shape", label, color: "text-amber-300" };
  }
  if (layerId === "media:bg") {
    const mode = scene.background.videoUrl
      ? "Video"
      : scene.background.imageUrl
        ? "Image"
        : "Media";
    return { kind: "background", label: `Background · ${mode}`, color: "text-purple-300" };
  }
  if (layerId === "media:character") {
    return { kind: "character", label: "Character", color: "text-emerald-300" };
  }
  if (layerId?.startsWith("media:broll:")) {
    const brollId = layerId.slice("media:broll:".length);
    return { kind: "broll", label: "B-roll item", color: "text-pink-300", brollId };
  }
  if (editTarget) {
    const meta = TARGET_META[editTarget];
    return { kind: "panel", label: meta.label, color: meta.color };
  }
  return { kind: "frame", label: "Scene", color: "text-white" };
}

/**
 * Frame Properties — what you see when a scene is selected and no
 * specific layer is being edited. Modeled after Figma / Canva: the
 * frame's own visual properties (bg, outline, shadow, animation,
 * duration, transition) live here. To put TEXT / MEDIA / SHAPE on
 * top of the frame, use the "+ Add item" picker.
 */
function FrameProperties({
  scene,
  sceneIdx,
  update,
  canShow,
  setEditTarget,
}: {
  scene: Scene;
  sceneIdx: number;
  update: (p: Partial<Scene>) => void;
  canShow: (t: Exclude<EditTarget, null>) => boolean;
  setEditTarget: (t: EditTarget) => void;
}) {
  const addUpload = useProjectStore((s) => s.addUpload);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const setSelectedLayerId = useEditorStore((s) => s.setSelectedLayerId);
  const setPaused = useEditorStore((s) => s.setPaused);
  const setAnimateModalOpen = useEditorStore((s) => s.setAnimateModalOpen);
  const [effectsOpen, setEffectsOpen] = useState(false);

  const addText = () => {
    // Same shape as the "edit me" placeholder so new text behaves
    // identically — full scene span (no startFrame/durationFrames so
    // the resolver falls back), same defaults. Cascade x/y by item
    // count so new items don't stack exactly on top of existing ones
    // (which made them un-clickable since hit-boxes overlapped).
    const count = (scene.textItems ?? []).length;
    const offset = count * 60;
    const next = defaultPlaceholderTextItem({
      content: "New text",
      x: 200 + offset,
      y: 400 + offset,
    });
    update({ textItems: [...(scene.textItems ?? []), next] });
    setSelectedLayerId(`text-item:${next.id}`);
    setEditTarget("text");
    setPaused(true);
  };

  const addShape = (kind: SceneShape["kind"]) => {
    const id = `sh-${Math.random().toString(36).slice(2, 8)}`;
    const defaults: Record<SceneShape["kind"], Partial<SceneShape>> = {
      rect: { w: 400, h: 240, color: "#10b981", borderRadius: 16 },
      circle: { w: 240, h: 240, color: "#3b82f6" },
      line: { w: 480, h: 0, strokeColor: "#ffffff", strokeWidth: 6 },
      triangle: { w: 280, h: 240, color: "#f59e0b" },
    };
    const next: SceneShape = {
      id,
      kind,
      x: 300,
      y: 300,
      w: 400,
      h: 240,
      ...defaults[kind],
    } as SceneShape;
    update({ shapes: [...(scene.shapes ?? []), next] });
    setSelectedLayerId(`shape:${id}`);
    setEditTarget("shape");
  };

  const handleFiles = async (files: FileList | File[]) => {
    const { uploadFiles } = await import("@/lib/upload-files");
    const results = await uploadFiles(files, addUpload);
    for (const r of results) {
      const mime = r.upload.type ?? "";
      if (mime.startsWith("video/")) {
        update({ background: { ...scene.background, videoUrl: r.upload.url } });
      } else if (mime.startsWith("image/")) {
        if (!scene.background.imageUrl) {
          update({ background: { ...scene.background, imageUrl: r.upload.url } });
        } else {
          const broll = scene.broll ?? [];
          update({
            broll: [
              ...broll,
              {
                id: `b-${Math.random().toString(36).slice(2, 8)}`,
                kind: "image",
                url: r.upload.url,
                position: "overlay-tr",
                startFrame: 0,
                durationFrames: 60,
                source: "upload",
              },
            ],
          });
        }
      }
    }
    setEditTarget("media");
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        hidden
        accept="image/*,video/*"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <AddItemPicker
        canMedia={canShow("background") || canShow("character") || canShow("broll")}
        onAddText={addText}
        onAddMedia={() => fileInputRef.current?.click()}
        onAddShape={addShape}
      />

      <details className="rounded-md border border-neutral-700/70 bg-neutral-900 shadow-sm overflow-hidden" open>
        <summary className="cursor-pointer flex items-center gap-2 px-3 py-2 text-[10.5px] uppercase tracking-wider text-neutral-100 font-semibold select-none border-b border-neutral-700/60 bg-neutral-800/60 [&::-webkit-details-marker]:hidden">
          <span className="h-3 w-0.5 rounded-full bg-emerald-400" aria-hidden />
          Size & duration
        </summary>
        <div className="px-3 pb-3 pt-1 space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-neutral-500 w-14">Duration</label>
            <input
              type="range"
              min={0.5}
              max={Math.max(60, scene.duration + 1)}
              step={0.25}
              value={scene.duration}
              onChange={(e) => update({ duration: Number(e.target.value) })}
              className="flex-1 accent-emerald-500 h-1"
            />
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={scene.duration}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isFinite(v) || v <= 0) return;
                update({ duration: v });
              }}
              className="input-field w-14 text-[11px] py-0.5 px-1 text-right"
            />
            <span className="text-[10px] text-neutral-500">s</span>
          </div>
        </div>
      </details>

      <details className="rounded-md border border-neutral-700/70 bg-neutral-900 shadow-sm overflow-hidden" open>
        <summary className="cursor-pointer flex items-center gap-2 px-3 py-2 text-[10.5px] uppercase tracking-wider text-neutral-100 font-semibold select-none border-b border-neutral-700/60 bg-neutral-800/60 [&::-webkit-details-marker]:hidden">
          <span className="h-3 w-0.5 rounded-full bg-emerald-400" aria-hidden />
          Background
        </summary>
        <div className="px-3 pb-3 pt-1 space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-neutral-500 w-14">Color</label>
            <input
              type="color"
              value={scene.background.color}
              onChange={(e) =>
                update({ background: { ...scene.background, color: e.target.value } })
              }
              className="h-7 w-10 rounded cursor-pointer bg-transparent border border-neutral-700"
            />
            <span className="text-[10px] text-neutral-500 font-mono">
              {scene.background.color}
            </span>
            <button
              type="button"
              onClick={() => setEditTarget("background")}
              className="ml-auto text-[10px] text-emerald-400 hover:text-emerald-300 underline decoration-dotted"
            >
              Advanced
            </button>
          </div>
        </div>
      </details>

      <details className="rounded-md border border-neutral-700/70 bg-neutral-900 shadow-sm overflow-hidden">
        <summary className="cursor-pointer flex items-center gap-2 px-3 py-2 text-[10.5px] uppercase tracking-wider text-neutral-100 font-semibold select-none border-b border-neutral-700/60 bg-neutral-800/60 [&::-webkit-details-marker]:hidden">
          <span className="h-3 w-0.5 rounded-full bg-emerald-400" aria-hidden />
          Outline & shadow
        </summary>
        <div className="px-3 pb-3 pt-1 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Outline color">
              <input
                type="color"
                value={scene.outlineColor ?? "#ffffff"}
                onChange={(e) => update({ outlineColor: e.target.value })}
                className="h-7 w-full rounded cursor-pointer bg-transparent border border-neutral-700"
              />
            </Field>
            <Field label="Outline width">
              <input
                type="range"
                min={0}
                max={40}
                step={1}
                value={scene.outlineWidth ?? 0}
                onChange={(e) => update({ outlineWidth: Number(e.target.value) })}
                className="w-full accent-blue-500 h-1.5"
              />
              <span className="text-[10px] text-neutral-500">{scene.outlineWidth ?? 0}px</span>
            </Field>
          </div>
          <ShadowControls
            shadow={scene.shadow}
            onChange={(s) => update({ shadow: s })}
          />
        </div>
      </details>

      <details className="rounded-md border border-neutral-700/70 bg-neutral-900 shadow-sm overflow-hidden">
        <summary className="cursor-pointer flex items-center gap-2 px-3 py-2 text-[10.5px] uppercase tracking-wider text-neutral-100 font-semibold select-none border-b border-neutral-700/60 bg-neutral-800/60 [&::-webkit-details-marker]:hidden">
          <span className="h-3 w-0.5 rounded-full bg-emerald-400" aria-hidden />
          Transition & fades
        </summary>
        <div className="px-3 pb-3 pt-1 space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-neutral-500 w-14">Transition</label>
            <select
              value={scene.transition ?? "none"}
              onChange={(e) =>
                update({ transition: e.target.value as Scene["transition"] })
              }
              className="input-field flex-1 text-[11px] py-1"
            >
              <option value="none">none</option>
              <option value="beat_flash">beat flash</option>
              <option value="beat_flash_colored">beat flash (colored)</option>
              <option value="slide_left">slide left</option>
              <option value="slide_right">slide right</option>
              <option value="zoom_blur">zoom blur</option>
            </select>
            {(scene.transition === "beat_flash_colored" ||
              scene.transition === "slide_left" ||
              scene.transition === "slide_right") && (
              <input
                type="color"
                value={scene.transitionColor ?? "#10b981"}
                onChange={(e) => update({ transitionColor: e.target.value })}
                title="Transition color"
                className="h-7 w-7 rounded cursor-pointer bg-transparent border border-neutral-700"
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-neutral-500 w-14">Fade in</label>
            <input
              type="range"
              min={0}
              max={30}
              step={1}
              value={scene.fadeInFrames ?? 4}
              onChange={(e) => update({ fadeInFrames: Number(e.target.value) })}
              className="flex-1 accent-emerald-500 h-1"
            />
            <span className="text-[10px] text-neutral-500 font-mono w-10 text-right">
              {scene.fadeInFrames ?? 4}f
            </span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-neutral-500 w-14">Fade out</label>
            <input
              type="range"
              min={0}
              max={30}
              step={1}
              value={scene.fadeOutFrames ?? 0}
              onChange={(e) => update({ fadeOutFrames: Number(e.target.value) })}
              className="flex-1 accent-emerald-500 h-1"
            />
            <span className="text-[10px] text-neutral-500 font-mono w-10 text-right">
              {scene.fadeOutFrames ?? 0}f
            </span>
          </div>
        </div>
      </details>

      <div className="space-y-2 pt-1">
        <EffectsTrigger scene={scene} onOpen={() => setEffectsOpen(true)} />
        <AnimateTrigger scene={scene} onOpen={() => setAnimateModalOpen(true)} />
      </div>

      <EffectsModal
        open={effectsOpen}
        onClose={() => setEffectsOpen(false)}
        scene={scene}
        update={update}
      />
    </>
  );
}

function AddItemPicker({
  canMedia,
  onAddText,
  onAddMedia,
  onAddShape,
}: {
  canMedia: boolean;
  onAddText: () => void;
  onAddMedia: () => void;
  onAddShape: (kind: SceneShape["kind"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [shapeOpen, setShapeOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/10 text-[11px] text-emerald-300 hover:text-emerald-200 transition-colors font-medium"
      >
        <span className="text-emerald-400 text-base leading-none">+</span>
        <span>Add item</span>
      </button>
      {open && (
        <div className="absolute left-0 right-0 mt-1 z-20 rounded-lg border border-neutral-800 bg-neutral-950 shadow-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onAddText();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-neutral-300 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
          >
            <Type className="h-3.5 w-3.5 text-blue-400" />
            <span>Text</span>
          </button>
          {canMedia && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onAddMedia();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-neutral-300 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
            >
              <Film className="h-3.5 w-3.5 text-purple-400" />
              <span>Media (image / video)</span>
            </button>
          )}
          <div>
            <button
              type="button"
              onClick={() => setShapeOpen((v) => !v)}
              className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-neutral-300 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              <span>Shape</span>
              <span className="ml-auto text-neutral-600">{shapeOpen ? "−" : "+"}</span>
            </button>
            {shapeOpen && (
              <div className="grid grid-cols-2 gap-1 px-2 pb-2">
                {(["rect", "circle", "line", "triangle"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setShapeOpen(false);
                      onAddShape(k);
                    }}
                    className="px-2 py-1.5 rounded text-[11px] capitalize text-neutral-300 hover:text-amber-300 hover:bg-amber-500/10 border border-neutral-800 hover:border-amber-500/40 transition-colors"
                  >
                    {k}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ShadowControls({
  shadow,
  onChange,
}: {
  shadow: Scene["shadow"];
  onChange: (s: Scene["shadow"]) => void;
}) {
  const has = !!shadow;
  const next = (patch: Partial<NonNullable<Scene["shadow"]>>) => {
    onChange({
      color: shadow?.color ?? "#000000",
      blur: shadow?.blur ?? 24,
      x: shadow?.x ?? 0,
      y: shadow?.y ?? 12,
      opacity: shadow?.opacity ?? 0.6,
      ...patch,
    });
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-[10px] uppercase tracking-wider text-neutral-500 flex-1">
          Shadow
        </label>
        <ToggleChip
          active={has}
          onClick={() =>
            has
              ? onChange(undefined)
              : onChange({ color: "#000000", blur: 24, x: 0, y: 12, opacity: 0.6 })
          }
          label={has ? "On" : "Off"}
        />
      </div>
      {has && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Color">
              <input
                type="color"
                value={shadow.color}
                onChange={(e) => next({ color: e.target.value })}
                className="h-7 w-full rounded cursor-pointer bg-transparent border border-neutral-700"
              />
            </Field>
            <Field label="Opacity">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={shadow.opacity ?? 0.6}
                onChange={(e) => next({ opacity: Number(e.target.value) })}
                className="w-full accent-blue-500 h-1.5"
              />
              <span className="text-[10px] text-neutral-500">
                {Math.round((shadow.opacity ?? 0.6) * 100)}%
              </span>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="X">
              <input
                type="range"
                min={-100}
                max={100}
                step={1}
                value={shadow.x}
                onChange={(e) => next({ x: Number(e.target.value) })}
                className="w-full accent-blue-500 h-1.5"
              />
              <span className="text-[10px] text-neutral-500">{shadow.x}px</span>
            </Field>
            <Field label="Y">
              <input
                type="range"
                min={-100}
                max={100}
                step={1}
                value={shadow.y}
                onChange={(e) => next({ y: Number(e.target.value) })}
                className="w-full accent-blue-500 h-1.5"
              />
              <span className="text-[10px] text-neutral-500">{shadow.y}px</span>
            </Field>
            <Field label="Blur">
              <input
                type="range"
                min={0}
                max={200}
                step={2}
                value={shadow.blur}
                onChange={(e) => next({ blur: Number(e.target.value) })}
                className="w-full accent-blue-500 h-1.5"
              />
              <span className="text-[10px] text-neutral-500">{shadow.blur}px</span>
            </Field>
          </div>
        </>
      )}
    </div>
  );
}

const KEYFRAME_PROPERTIES: KeyframeProperty[] = [
  "textY",
  "textOpacity",
  "textScale",
  "emphasisY",
  "emphasisOpacity",
  "emphasisScale",
  "characterY",
  "characterScale",
  "bgScale",
  "bgOffsetX",
  "bgOffsetY",
  "overlayOpacity",
];

const EASING_OPTIONS: Easing[] = [
  "linear",
  "ease_in",
  "ease_out",
  "ease_in_out",
  "ease_in_back",
  "ease_out_back",
  "ease_in_out_back",
  "spring",
  "snappy",
  "bouncy",
];


function TargetButton({ target, onClick }: { target: Exclude<EditTarget, null>; onClick: () => void }) {
  const meta = TARGET_META[target];
  const Icon = meta.icon;
  return (
    <button onClick={onClick}
      className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border border-neutral-800 hover:border-neutral-600 bg-neutral-900 hover:bg-neutral-800/80 transition-all text-left">
      <Icon className={`h-4 w-4 ${meta.color}`} />
      <span className="text-xs font-medium text-neutral-200">{meta.label}</span>
      <ArrowLeft className="h-3 w-3 text-neutral-600 ml-auto rotate-180" />
    </button>
  );
}

function CharacterPanel({ scene, update, characters }: { scene: Scene; update: (p: Partial<Scene>) => void; characters: any[] }) {
  return (
    <>
      <Field label="Pose">
        <div className="grid grid-cols-3 gap-1.5">
          {characters.map((c: any) => (
            <button key={c.id} onClick={() => update({ characterId: c.id })}
              className={`relative h-16 rounded-lg border overflow-hidden transition-all ${scene.characterId === c.id ? "border-emerald-500 bg-emerald-500/10" : "border-neutral-700 bg-neutral-900 hover:border-neutral-500"}`}>
              <img src={c.src} alt={c.name} className="w-full h-full object-contain p-1" />
              <span className="absolute bottom-0 inset-x-0 text-[8px] text-center bg-black/60 text-neutral-300 py-0.5">{c.name}</span>
            </button>
          ))}
          <button onClick={() => update({ characterId: undefined })}
            className={`h-16 rounded-lg border flex items-center justify-center text-[10px] transition-all ${!scene.characterId ? "border-red-500 bg-red-500/10 text-red-400" : "border-neutral-700 bg-neutral-900 text-neutral-500 hover:border-red-500/50"}`}>
            None
          </button>
        </div>
      </Field>
      {scene.characterId && (
        <>
          <AnimateTrigger
            scene={scene}
            onOpen={() => useEditorStore.getState().setAnimateModalOpen(true)}
          />
          <Field label="X position">
            <input type="range" min={100} max={1800} value={scene.characterX ?? 960} onChange={(e) => update({ characterX: Number(e.target.value) })} className="w-full accent-emerald-500 h-1.5" />
            <div className="flex justify-between text-[9px] text-neutral-600"><span>Left</span><span>{scene.characterX ?? 960}</span><span>Right</span></div>
          </Field>
          <Field label="Y position">
            <input type="range" min={400} max={1050} value={scene.characterY ?? 950} onChange={(e) => update({ characterY: Number(e.target.value) })} className="w-full accent-emerald-500 h-1.5" />
            <div className="flex justify-between text-[9px] text-neutral-600"><span>Up</span><span>{scene.characterY ?? 950}</span><span>Down</span></div>
          </Field>
          <Field label="Scale">
            <input type="range" min={0.3} max={2.5} step={0.1} value={scene.characterScale ?? 1} onChange={(e) => update({ characterScale: Number(e.target.value) })} className="w-full accent-emerald-500 h-1.5" />
            <span className="text-[10px] text-neutral-500 font-mono">{(scene.characterScale ?? 1).toFixed(1)}x</span>
          </Field>
          <Field label="Entrance">
            <div className="grid grid-cols-4 gap-1">
              {DIRECTIONS.map((d) => (
                <button key={d} onClick={() => update({ enterFrom: d })}
                  className={`text-[10px] py-1.5 rounded-md border transition-colors ${(scene.enterFrom ?? "scale") === d ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-neutral-700 text-neutral-400 hover:border-neutral-500"}`}>{d}</button>
              ))}
            </div>
          </Field>
          <label className="flex items-center gap-2 text-xs text-neutral-400 cursor-pointer">
            <input type="checkbox" checked={scene.flipCharacter ?? false} onChange={(e) => update({ flipCharacter: e.target.checked })} className="accent-emerald-500 rounded" />
            Flip horizontal
          </label>
        </>
      )}
    </>
  );
}

/**
 * Text routing. Every text in a scene is a free-positioned TextItem;
 * legacy emphasisText/text/subtitleText scenes are migrated to
 * TextItems on first open. This panel routes to TextItemPanel for the
 * selected item, or shows an empty-state with + Add text otherwise.
 */
function TextPanel({ scene, update }: { scene: Scene; update: (p: Partial<Scene>) => void }) {
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const setSelectedLayerId = useEditorStore((s) => s.setSelectedLayerId);

  // One-shot migration: if this scene still carries legacy text fields,
  // convert them to TextItems and persist. Effect runs once per scene
  // open.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only re-run when scene id flips
  useEffect(() => {
    try {
      if (scene.emphasisText || scene.text || scene.subtitleText) {
        const migrated = migrateLegacyTextToTextItems(scene);
        const { id: _id, ...patch } = migrated;
        update(patch as Partial<Scene>);
      }
    } catch (err) {
      console.warn("[text-migrate] failed:", err);
    }
  }, [scene.id]);

  if (selectedLayerId?.startsWith("text-item:")) {
    const itemId = selectedLayerId.slice("text-item:".length);
    return <TextItemPanel scene={scene} update={update} itemId={itemId} />;
  }

  const items = scene.textItems ?? [];
  return (
    <Section title="Text">
      {items.length === 0 ? (
        <div className="text-[11px] text-neutral-500 px-1 py-2 text-center">
          No text on this scene yet. Use the frame's "+ Add item" picker
          to add a text layer.
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
            Pick a text to edit
          </div>
          {items.map((it, i) => (
            <button
              key={it.id}
              type="button"
              onClick={() => setSelectedLayerId(`text-item:${it.id}`)}
              className="flex items-center gap-2 px-2 py-1.5 rounded border border-neutral-800 hover:border-emerald-500/60 hover:bg-emerald-500/5 text-left text-neutral-300 hover:text-emerald-200 transition-colors text-[11px]"
            >
              <span className="text-neutral-500">Text {i + 1}</span>
              <span className="truncate flex-1">{it.content || "(empty)"}</span>
            </button>
          ))}
        </div>
      )}
    </Section>
  );
}

/**
 * Editor for a single free-positioned text item. Routed to from the
 * TextPanel router when selectedLayerId is `text-item:<id>`.
 */
function TextItemPanel({
  scene,
  update,
  itemId,
}: {
  scene: Scene;
  update: (p: Partial<Scene>) => void;
  itemId: string;
}) {
  const setSelectedLayerId = useEditorStore((s) => s.setSelectedLayerId);
  const setEditTarget = useEditorStore((s) => s.setEditTarget);
  const items = scene.textItems ?? [];
  const item = items.find((it) => it.id === itemId);
  if (!item) {
    return (
      <div className="text-[11px] text-neutral-500 px-2 py-3">
        Text item missing.
      </div>
    );
  }
  const patch = (p: Partial<TextItem>) => {
    update({
      textItems: items.map((it) => (it.id === itemId ? { ...it, ...p } : it)),
    });
  };
  const remove = () => {
    update({ textItems: items.filter((it) => it.id !== itemId) });
    setSelectedLayerId(null);
    setEditTarget(null);
  };
  return (
    <div className="space-y-3">
      <Section title="Content">
        <textarea
          value={item.content}
          onChange={(e) => patch({ content: e.target.value })}
          rows={2}
          className="input-field w-full text-[11px] py-1 resize-none"
        />
      </Section>

      <TextItemSizeDurationSection item={item} sceneDuration={scene.duration} patch={patch} />

      <Section title="Position (X · Y · Z)">
        <div className="grid grid-cols-3 gap-2">
          <Field label="X">
            <input
              type="number"
              value={item.x}
              onChange={(e) => patch({ x: Number(e.target.value) })}
              className="input-field w-full text-[11px] py-1"
            />
          </Field>
          <Field label="Y">
            <input
              type="number"
              value={item.y}
              onChange={(e) => patch({ y: Number(e.target.value) })}
              className="input-field w-full text-[11px] py-1"
            />
          </Field>
          <Field label="Z (rot°)">
            <input
              type="number"
              value={item.rotation ?? 0}
              onChange={(e) => patch({ rotation: Number(e.target.value) })}
              className="input-field w-full text-[11px] py-1"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Max width (blank = auto)">
            <input
              type="number"
              value={item.w ?? ""}
              onChange={(e) =>
                patch({ w: e.target.value === "" ? undefined : Number(e.target.value) })
              }
              className="input-field w-full text-[11px] py-1"
            />
          </Field>
          <Field label="Opacity">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={item.opacity ?? 1}
              onChange={(e) => patch({ opacity: Number(e.target.value) })}
              className="w-full accent-blue-500 h-1.5"
            />
            <span className="text-[10px] text-neutral-500">
              {Math.round((item.opacity ?? 1) * 100)}%
            </span>
          </Field>
        </div>
      </Section>

      <Section title="Font">
        <Field label="Font family">
          <select
            value={item.fontFamily ?? "system"}
            onChange={(e) => patch({ fontFamily: e.target.value as TextItem["fontFamily"] })}
            className="input-field w-full text-[11px] py-1"
          >
            <option value="system">System sans</option>
            <option value="serif">Serif</option>
            <option value="mono">Monospace</option>
            <option value="display">Display (Bebas / Impact)</option>
          </select>
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Weight">
            <input
              type="number"
              min={100}
              max={900}
              step={100}
              value={item.weight ?? 800}
              onChange={(e) => patch({ weight: Number(e.target.value) })}
              className="input-field w-full text-[11px] py-1"
            />
          </Field>
          <Field label="Italic">
            <ToggleChip
              active={!!item.italic}
              onClick={() => patch({ italic: !item.italic })}
              label={item.italic ? "On" : "Off"}
            />
          </Field>
          <Field label="Underline">
            <ToggleChip
              active={!!item.underline}
              onClick={() => patch({ underline: !item.underline })}
              label={item.underline ? "On" : "Off"}
            />
          </Field>
        </div>
        <Field label="Align">
          <div className="flex gap-1">
            {(["left", "center", "right"] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => patch({ align: a })}
                className={`flex-1 px-2 py-1 rounded text-[11px] capitalize border transition-colors ${
                  (item.align ?? "left") === a
                    ? "border-emerald-500 bg-emerald-500/15 text-emerald-300"
                    : "border-neutral-800 text-neutral-400 hover:border-neutral-600"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Letter spacing">
            <input
              type="number"
              value={item.letterSpacing ?? 0}
              onChange={(e) => patch({ letterSpacing: Number(e.target.value) })}
              className="input-field w-full text-[11px] py-1"
            />
          </Field>
          <Field label="Line height">
            <input
              type="number"
              step={0.05}
              value={item.lineHeight ?? 1.1}
              onChange={(e) => patch({ lineHeight: Number(e.target.value) })}
              className="input-field w-full text-[11px] py-1"
            />
          </Field>
        </div>
        <Field label="Transform">
          <select
            value={item.transform ?? "none"}
            onChange={(e) =>
              patch({ transform: e.target.value as TextItem["transform"] })
            }
            className="input-field w-full text-[11px] py-1"
          >
            <option value="none">None</option>
            <option value="uppercase">UPPERCASE</option>
            <option value="lowercase">lowercase</option>
            <option value="capitalize">Capitalize</option>
          </select>
        </Field>
        <Field label="Text color">
          <input
            type="color"
            value={item.color}
            onChange={(e) => patch({ color: e.target.value })}
            className="h-7 w-full rounded cursor-pointer bg-transparent border border-neutral-700"
          />
        </Field>
      </Section>

      <Section title="Background">
        <Field label="Background color (blank = off)">
          <input
            type="color"
            value={item.bgColor ?? "#000000"}
            onChange={(e) => patch({ bgColor: e.target.value })}
            className="h-7 w-full rounded cursor-pointer bg-transparent border border-neutral-700"
          />
          <button
            type="button"
            onClick={() => patch({ bgColor: undefined })}
            className="mt-1 text-[10px] text-neutral-500 hover:text-neutral-300 underline decoration-dotted"
          >
            clear
          </button>
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Padding">
            <input
              type="number"
              min={0}
              value={item.bgPadding ?? 0}
              onChange={(e) => patch({ bgPadding: Number(e.target.value) })}
              className="input-field w-full text-[11px] py-1"
            />
          </Field>
          <Field label="Radius">
            <input
              type="number"
              min={0}
              value={item.bgRadius ?? 0}
              onChange={(e) => patch({ bgRadius: Number(e.target.value) })}
              className="input-field w-full text-[11px] py-1"
            />
          </Field>
        </div>
      </Section>

      <Section title="Border">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Border color">
            <input
              type="color"
              value={item.outlineColor ?? "#ffffff"}
              onChange={(e) => patch({ outlineColor: e.target.value })}
              className="h-7 w-full rounded cursor-pointer bg-transparent border border-neutral-700"
            />
          </Field>
          <Field label="Border width">
            <input
              type="range"
              min={0}
              max={20}
              step={1}
              value={item.outlineWidth ?? 0}
              onChange={(e) => patch({ outlineWidth: Number(e.target.value) })}
              className="w-full accent-blue-500 h-1.5"
            />
            <span className="text-[10px] text-neutral-500">
              {item.outlineWidth ?? 0}px
            </span>
          </Field>
        </div>
      </Section>

      <Section title="Highlight (glow)">
        <Field label="Highlight color (blank = off)">
          <input
            type="color"
            value={item.glowColor ?? "#ffff66"}
            onChange={(e) => patch({ glowColor: e.target.value })}
            className="h-7 w-full rounded cursor-pointer bg-transparent border border-neutral-700"
          />
          <button
            type="button"
            onClick={() => patch({ glowColor: undefined })}
            className="mt-1 text-[10px] text-neutral-500 hover:text-neutral-300 underline decoration-dotted"
          >
            clear
          </button>
        </Field>
      </Section>

      <Section title="Effects (stroke & shadow)">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Stroke color">
            <input
              type="color"
              value={item.strokeColor ?? "#000000"}
              onChange={(e) => patch({ strokeColor: e.target.value })}
              className="h-7 w-full rounded cursor-pointer bg-transparent border border-neutral-700"
            />
          </Field>
          <Field label="Stroke width">
            <input
              type="number"
              min={0}
              max={20}
              value={item.strokeWidth ?? 0}
              onChange={(e) => patch({ strokeWidth: Number(e.target.value) })}
              className="input-field w-full text-[11px] py-1"
            />
          </Field>
        </div>
        <ShadowControls
          shadow={item.shadow}
          onChange={(s) => patch({ shadow: s })}
        />
      </Section>

      <TextItemTransitionSection item={item} patch={patch} />
      <TextItemAnimationSection item={item} patch={patch} />

      <button
        type="button"
        onClick={remove}
        className="w-full px-3 py-2 rounded border border-red-900/50 bg-red-950/30 hover:bg-red-900/40 text-[11px] text-red-300 hover:text-red-200 transition-colors"
      >
        Remove text item
      </button>
    </div>
  );
}

/** Always-open titled section. Same chrome as <details> but never collapses. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-neutral-700/70 bg-neutral-900 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 text-[10.5px] uppercase tracking-wider text-neutral-100 font-semibold border-b border-neutral-700/60 bg-neutral-800/60">
        <span className="h-3 w-0.5 rounded-full bg-emerald-400" aria-hidden />
        {title}
      </div>
      <div className="px-3 py-3 space-y-2">{children}</div>
    </div>
  );
}

function TextItemSizeDurationSection({
  item,
  sceneDuration,
  patch,
}: {
  item: TextItem;
  sceneDuration: number;
  patch: (p: Partial<TextItem>) => void;
}) {
  const fps = useProjectStore((s) => s.project.fps);
  const sceneFrames = Math.max(1, Math.round(sceneDuration * fps));
  const start = item.startFrame ?? 0;
  const dur = item.durationFrames ?? sceneFrames - start;
  return (
    <Section title="Size & duration">
      <Field label="Font size (px)">
        <input
          type="number"
          min={8}
          value={item.fontSize}
          onChange={(e) => patch({ fontSize: Number(e.target.value) })}
          className="input-field w-full text-[11px] py-1"
        />
      </Field>
      <Field label={`Start frame (0–${sceneFrames})`}>
        <input
          type="range"
          min={0}
          max={sceneFrames}
          step={1}
          value={start}
          onChange={(e) => {
            const v = Number(e.target.value);
            const maxDur = Math.max(1, sceneFrames - v);
            patch({
              startFrame: v,
              durationFrames: Math.min(dur, maxDur),
            });
          }}
          className="w-full accent-emerald-500 h-1.5"
        />
        <span className="text-[10px] text-neutral-500">
          {start}f ({(start / fps).toFixed(2)}s)
        </span>
      </Field>
      <Field label="Duration (frames)">
        <input
          type="range"
          min={1}
          max={Math.max(1, sceneFrames - start)}
          step={1}
          value={dur}
          onChange={(e) => patch({ durationFrames: Number(e.target.value) })}
          className="w-full accent-emerald-500 h-1.5"
        />
        <span className="text-[10px] text-neutral-500">
          {dur}f ({(dur / fps).toFixed(2)}s)
        </span>
      </Field>
    </Section>
  );
}

const TEXT_ITEM_ENTER_KINDS: Array<TextItem["enterMotion"]> = [
  undefined,
  "fade_in",
  "slide_in_left",
  "slide_in_right",
  "slide_in_top",
  "slide_in_bottom",
  "zoom_in",
  "pulse",
];

const TEXT_ITEM_EXIT_KINDS: Array<TextItem["exitMotion"]> = [
  undefined,
  "fade_out",
  "slide_out_left",
  "slide_out_right",
  "slide_out_top",
  "slide_out_bottom",
  "zoom_out",
];

function TextItemTimingSection({
  item,
  sceneDuration,
  patch,
}: {
  item: TextItem;
  sceneDuration: number;
  patch: (p: Partial<TextItem>) => void;
}) {
  const fps = useProjectStore((s) => s.project.fps);
  const sceneFrames = Math.max(1, Math.round(sceneDuration * fps));
  const start = item.startFrame ?? 0;
  const dur = item.durationFrames ?? sceneFrames - start;
  return (
    <details className="rounded border border-neutral-800 bg-neutral-950/40" open>
      <summary className="cursor-pointer px-3 py-2 text-[10px] uppercase tracking-wider text-neutral-400 font-medium select-none">
        Timing
      </summary>
      <div className="px-3 pb-3 pt-1 space-y-2">
        <Field label={`Start frame (0–${sceneFrames})`}>
          <input
            type="range"
            min={0}
            max={sceneFrames}
            step={1}
            value={start}
            onChange={(e) => {
              const v = Number(e.target.value);
              const maxDur = Math.max(1, sceneFrames - v);
              patch({
                startFrame: v,
                durationFrames: Math.min(dur, maxDur),
              });
            }}
            className="w-full accent-emerald-500 h-1.5"
          />
          <span className="text-[10px] text-neutral-500">
            {start}f ({(start / fps).toFixed(2)}s)
          </span>
        </Field>
        <Field label="Duration (frames)">
          <input
            type="range"
            min={1}
            max={Math.max(1, sceneFrames - start)}
            step={1}
            value={dur}
            onChange={(e) => patch({ durationFrames: Number(e.target.value) })}
            className="w-full accent-emerald-500 h-1.5"
          />
          <span className="text-[10px] text-neutral-500">
            {dur}f ({(dur / fps).toFixed(2)}s)
          </span>
        </Field>
      </div>
    </details>
  );
}

function TextItemOutlineShadowSection({
  item,
  patch,
}: {
  item: TextItem;
  patch: (p: Partial<TextItem>) => void;
}) {
  return (
    <details className="rounded border border-neutral-800 bg-neutral-950/40">
      <summary className="cursor-pointer px-3 py-2 text-[10px] uppercase tracking-wider text-neutral-400 font-medium select-none">
        Outline & shadow
      </summary>
      <div className="px-3 pb-3 pt-1 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Outline color">
            <input
              type="color"
              value={item.outlineColor ?? "#ffffff"}
              onChange={(e) => patch({ outlineColor: e.target.value })}
              className="h-7 w-full rounded cursor-pointer bg-transparent border border-neutral-700"
            />
          </Field>
          <Field label="Outline width">
            <input
              type="range"
              min={0}
              max={20}
              step={1}
              value={item.outlineWidth ?? 0}
              onChange={(e) => patch({ outlineWidth: Number(e.target.value) })}
              className="w-full accent-blue-500 h-1.5"
            />
            <span className="text-[10px] text-neutral-500">
              {item.outlineWidth ?? 0}px
            </span>
          </Field>
        </div>
        <ShadowControls
          shadow={item.shadow}
          onChange={(s) => patch({ shadow: s })}
        />
      </div>
    </details>
  );
}

function TextItemTransitionSection({
  item,
  patch,
}: {
  item: TextItem;
  patch: (p: Partial<TextItem>) => void;
}) {
  return (
    <Section title="Transition (enter / exit)">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Enter">
          <select
            value={item.enterMotion ?? ""}
            onChange={(e) =>
              patch({
                enterMotion: (e.target.value || undefined) as TextItem["enterMotion"],
              })
            }
            className="input-field w-full text-[11px] py-1"
          >
            {TEXT_ITEM_ENTER_KINDS.map((k) => (
              <option key={k ?? "none"} value={k ?? ""}>
                {k ? k.replace(/_/g, " ") : "none"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Enter duration (f)">
          <input
            type="number"
            min={1}
            value={item.enterDurationFrames ?? 12}
            onChange={(e) =>
              patch({ enterDurationFrames: Number(e.target.value) })
            }
            className="input-field w-full text-[11px] py-1"
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Exit">
          <select
            value={item.exitMotion ?? ""}
            onChange={(e) =>
              patch({
                exitMotion: (e.target.value || undefined) as TextItem["exitMotion"],
              })
            }
            className="input-field w-full text-[11px] py-1"
          >
            {TEXT_ITEM_EXIT_KINDS.map((k) => (
              <option key={k ?? "none"} value={k ?? ""}>
                {k ? k.replace(/_/g, " ") : "none"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Exit duration (f)">
          <input
            type="number"
            min={1}
            value={item.exitDurationFrames ?? 12}
            onChange={(e) =>
              patch({ exitDurationFrames: Number(e.target.value) })
            }
            className="input-field w-full text-[11px] py-1"
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Fade in (f)">
          <input
            type="number"
            min={0}
            value={item.fadeInFrames ?? 0}
            onChange={(e) => patch({ fadeInFrames: Number(e.target.value) })}
            className="input-field w-full text-[11px] py-1"
          />
        </Field>
        <Field label="Fade out (f)">
          <input
            type="number"
            min={0}
            value={item.fadeOutFrames ?? 0}
            onChange={(e) => patch({ fadeOutFrames: Number(e.target.value) })}
            className="input-field w-full text-[11px] py-1"
          />
        </Field>
      </div>
    </Section>
  );
}

function TextItemAnimationSection({
  item,
  patch,
}: {
  item: TextItem;
  patch: (p: Partial<TextItem>) => void;
}) {
  const setEditTarget = useEditorStore((s) => s.setEditTarget);
  const clipCount = item.motionClips?.length ?? 0;
  const kfCount = Object.values(item.keyframes ?? {}).reduce(
    (acc, arr) => acc + (arr?.length ?? 0),
    0,
  );
  return (
    <Section title="Animation">
      <MotionPresetField
        label="Motion preset"
        value={item.motion}
        onChange={(v) => patch({ motion: v })}
      />
      <div className="flex items-center gap-2 text-[10px] text-neutral-500">
        <span>Motion clips: {clipCount}</span>
        <span className="opacity-40">·</span>
        <span>Keyframes: {kfCount}</span>
        <button
          type="button"
          onClick={() => useEditorStore.getState().setAnimateModalOpen(true)}
          className="ml-auto text-[10px] text-emerald-400 hover:text-emerald-300 underline decoration-dotted"
        >
          Open keyframes
        </button>
      </div>
      <p className="text-[10px] text-neutral-600 leading-snug">
        Use the chat agent to add motion clips on this item — pass the
        item id with addMotionClip / addKeyframe.
      </p>
    </Section>
  );
}

function BRollStylePanel({
  broll,
  onChange,
}: {
  broll: BRoll;
  onChange: (patch: Partial<BRoll>) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-1 py-1 text-[10px] uppercase tracking-wider text-neutral-500 hover:text-emerald-300"
      >
        <span>Frame & shadow</span>
        <span className="text-neutral-600">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="space-y-2 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Corner radius">
              <input
                type="range"
                min={0}
                max={120}
                step={2}
                value={broll.borderRadius ?? 16}
                onChange={(e) => onChange({ borderRadius: Number(e.target.value) })}
                className="w-full accent-blue-500 h-1.5"
              />
              <span className="text-[10px] text-neutral-500">
                {broll.borderRadius ?? 16}px
              </span>
            </Field>
            <Field label="Shadow">
              <select
                value={broll.shadow ?? "soft"}
                onChange={(e) => onChange({ shadow: e.target.value as BRoll["shadow"] })}
                className="input-field h-7 text-[11px]"
              >
                <option value="none">None</option>
                <option value="soft">Soft</option>
                <option value="hard">Hard</option>
                <option value="glow">Glow</option>
              </select>
            </Field>
          </div>
          {broll.shadow === "glow" && (
            <Field label="Glow color">
              <input
                type="color"
                value={broll.shadowColor ?? "#ffffff"}
                onChange={(e) => onChange({ shadowColor: e.target.value })}
                className="h-7 w-full rounded cursor-pointer bg-transparent border border-neutral-700"
              />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Field label="Border color">
              <input
                type="color"
                value={broll.borderColor ?? "#ffffff"}
                onChange={(e) => onChange({ borderColor: e.target.value })}
                className="h-7 w-full rounded cursor-pointer bg-transparent border border-neutral-700"
              />
            </Field>
            <Field label="Border width">
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={broll.borderWidth ?? 0}
                onChange={(e) => onChange({ borderWidth: Number(e.target.value) })}
                className="w-full accent-blue-500 h-1.5"
              />
              <span className="text-[10px] text-neutral-500">
                {broll.borderWidth ?? 0}px
              </span>
            </Field>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2 h-7 text-[11px] rounded border transition-colors ${
        active
          ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/60"
          : "text-neutral-400 hover:text-emerald-300 border-neutral-700 hover:border-emerald-500/40"
      }`}
    >
      {label}
    </button>
  );
}

/**
 * Flat media-layer panel — one card per media item on the scene
 * (background image / video, character, each broll). Compact inline
 * controls; "Advanced" link drills into the dedicated panel for the
 * power-user fields (chroma key, color grading, etc.).
 */
function MediaPanel({
  scene,
  update,
}: {
  scene: Scene;
  update: (p: Partial<Scene>) => void;
}) {
  const setEditTarget = useEditorStore((s) => s.setEditTarget);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const addUpload = useProjectStore((s) => s.addUpload);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Filter to a single media layer when the user picked one in the
  // SceneList. "media:bg" / "media:character" / "media:broll:<id>".
  const focus =
    selectedLayerId && selectedLayerId.startsWith("media:")
      ? selectedLayerId.slice(6)
      : null;
  const showBg = !focus || focus === "bg";
  const showCharacter = !focus || focus === "character";
  const focusedBrollId = focus?.startsWith("broll:") ? focus.slice(6) : null;

  const handleFiles = async (files: FileList | File[]) => {
    const { uploadFiles } = await import("@/lib/upload-files");
    const results = await uploadFiles(files, addUpload);
    for (const r of results) {
      const mime = r.upload.type ?? "";
      if (mime.startsWith("video/")) {
        update({ background: { ...scene.background, videoUrl: r.upload.url } });
      } else if (mime.startsWith("image/")) {
        if (!scene.background.imageUrl) {
          update({ background: { ...scene.background, imageUrl: r.upload.url } });
        } else if (!scene.characterUrl && !scene.characterId) {
          update({ characterUrl: r.upload.url });
        } else {
          // Stack as broll overlay.
          const broll = scene.broll ?? [];
          const positions = ["overlay-tr", "overlay-bl", "overlay-br", "overlay-tl"] as const;
          update({
            broll: [
              ...broll,
              {
                id: `b-${Math.random().toString(36).slice(2, 8)}`,
                kind: "image",
                url: r.upload.url,
                position: positions[broll.length % positions.length],
                startFrame: 0,
                durationFrames: 60,
                source: "upload",
              },
            ],
          });
        }
      } else if (mime.startsWith("audio/")) {
        update({
          voiceover: {
            audioUrl: r.upload.url,
            audioDurationSec: scene.duration,
            provider: "openai",
            voice: "uploaded",
            text: "",
          },
        });
      }
    }
  };

  const hasImage = !!scene.background.imageUrl;
  const hasVideo = !!scene.background.videoUrl;
  const hasCharacter = !!scene.characterId || !!scene.characterUrl;
  const broll = scene.broll ?? [];

  return (
    <>
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

      {/* Background — color is always set; image / video are optional. */}
      {showBg && (
      <MediaCard
        title="Background"
        kind="bg"
        thumbnail={
          scene.background.imageUrl ? (
            <img src={scene.background.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : scene.background.videoUrl ? (
            <video src={scene.background.videoUrl} className="h-full w-full object-cover" muted />
          ) : (
            <div
              className="h-full w-full"
              style={{ backgroundColor: scene.background.color }}
            />
          )
        }
        meta={
          hasVideo
            ? "Video bg"
            : hasImage
              ? "Image bg"
              : "Color bg"
        }
        onAdvanced={() => setEditTarget("background")}
      >
        <Field label="Color">
          <input
            type="color"
            value={scene.background.color}
            onChange={(e) =>
              update({ background: { ...scene.background, color: e.target.value } })
            }
            className="h-7 w-full rounded cursor-pointer bg-transparent border border-neutral-700"
          />
        </Field>
        {hasImage && (
          <Field label="Image opacity">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={scene.background.imageOpacity ?? 1}
              onChange={(e) =>
                update({
                  background: {
                    ...scene.background,
                    imageOpacity: Number(e.target.value),
                  },
                })
              }
              className="w-full accent-blue-500 h-1.5"
            />
            <span className="text-[10px] text-neutral-500">
              {((scene.background.imageOpacity ?? 1) * 100).toFixed(0)}%
            </span>
          </Field>
        )}
        {(hasImage || hasVideo) && (
          <Field label="Scale">
            <input
              type="range"
              min={0.2}
              max={2}
              step={0.05}
              value={hasVideo ? (scene.background.videoScale ?? 1) : (scene.background.imageScale ?? 1)}
              onChange={(e) =>
                update({
                  background: {
                    ...scene.background,
                    [hasVideo ? "videoScale" : "imageScale"]: Number(e.target.value),
                  },
                })
              }
              className="w-full accent-blue-500 h-1.5"
            />
            <span className="text-[10px] text-neutral-500">
              {(hasVideo
                ? (scene.background.videoScale ?? 1)
                : (scene.background.imageScale ?? 1)
              ).toFixed(2)}×
            </span>
          </Field>
        )}
        {(hasImage || hasVideo) && (
          <button
            type="button"
            onClick={() =>
              update({
                background: {
                  ...scene.background,
                  imageUrl: undefined,
                  videoUrl: undefined,
                },
              })
            }
            className="text-[10px] text-neutral-500 hover:text-red-400 underline decoration-dotted"
          >
            Remove background media
          </button>
        )}
      </MediaCard>
      )}

      {/* Character. */}
      {showCharacter && hasCharacter && (
        <MediaCard
          title="Character"
          kind="character"
          thumbnail={
            scene.characterUrl ? (
              <img src={scene.characterUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-sky-900/50 text-sky-200 flex items-center justify-center text-[9px] font-mono">
                {(scene.characterId ?? "?").slice(0, 4)}
              </div>
            )
          }
          meta={`scale ${(scene.characterScale ?? 1).toFixed(2)}× · X ${scene.characterX ?? 960}, Y ${scene.characterY ?? 900}`}
          onAdvanced={() => setEditTarget("character")}
        >
          <Field label="Scale">
            <input
              type="range"
              min={0.4}
              max={3}
              step={0.05}
              value={scene.characterScale ?? 1}
              onChange={(e) => update({ characterScale: Number(e.target.value) })}
              className="w-full accent-blue-500 h-1.5"
            />
            <span className="text-[10px] text-neutral-500">
              {(scene.characterScale ?? 1).toFixed(2)}×
            </span>
          </Field>
          <button
            type="button"
            onClick={() =>
              update({ characterId: undefined, characterUrl: undefined })
            }
            className="text-[10px] text-neutral-500 hover:text-red-400 underline decoration-dotted"
          >
            Remove character
          </button>
        </MediaCard>
      )}

      {/* B-roll overlays. */}
      {(focusedBrollId
        ? broll.filter((b) => b.id === focusedBrollId)
        : focus === "bg" || focus === "character"
          ? []
          : broll
      ).map((b) => {
        const i = broll.findIndex((x) => x.id === b.id);
        return (
        <MediaCard
          key={b.id}
          title={`Overlay ${i + 1}`}
          kind="broll"
          thumbnail={
            b.kind === "clip" ? (
              <video src={b.url} className="h-full w-full object-cover" muted />
            ) : (
              <img src={b.url} alt="" className="h-full w-full object-cover" />
            )
          }
          meta={`${b.position} · ${(b.opacity ?? 1).toFixed(2)} op · ${(b.scale ?? 1).toFixed(2)}×`}
          onAdvanced={() => setEditTarget("broll")}
        >
          <Field label="Opacity">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={b.opacity ?? 1}
              onChange={(e) => {
                const next = [...broll];
                next[i] = { ...b, opacity: Number(e.target.value) };
                update({ broll: next });
              }}
              className="w-full accent-blue-500 h-1.5"
            />
            <span className="text-[10px] text-neutral-500">
              {((b.opacity ?? 1) * 100).toFixed(0)}%
            </span>
          </Field>
          <Field label="Scale">
            <input
              type="range"
              min={0.2}
              max={2}
              step={0.05}
              value={b.scale ?? 1}
              onChange={(e) => {
                const next = [...broll];
                next[i] = { ...b, scale: Number(e.target.value) };
                update({ broll: next });
              }}
              className="w-full accent-blue-500 h-1.5"
            />
            <span className="text-[10px] text-neutral-500">
              {(b.scale ?? 1).toFixed(2)}×
            </span>
          </Field>
          <BRollStylePanel
            broll={b}
            onChange={(patch) => {
              const next = [...broll];
              next[i] = { ...b, ...patch };
              update({ broll: next });
            }}
          />
          <button
            type="button"
            onClick={() => update({ broll: broll.filter((_, k) => k !== i) })}
            className="text-[10px] text-neutral-500 hover:text-red-400 underline decoration-dotted"
          >
            Remove overlay
          </button>
        </MediaCard>
        );
      })}

      {/* Add media — hidden in single-layer focus mode. */}
      {!focus && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-neutral-700 hover:border-emerald-500/60 hover:bg-emerald-500/5 text-[11px] text-neutral-400 hover:text-emerald-300 transition-colors"
        >
          <span className="text-emerald-400 text-base leading-none">+</span>
          <span>Upload image / video / audio</span>
        </button>
      )}
    </>
  );
}

function MediaCard({
  title,
  kind,
  thumbnail,
  meta,
  onAdvanced,
  children,
}: {
  title: string;
  kind: "bg" | "character" | "broll";
  thumbnail: React.ReactNode;
  meta?: string;
  onAdvanced: () => void;
  children: React.ReactNode;
}) {
  const accent: Record<typeof kind, string> = {
    bg: "border-purple-500/30",
    character: "border-sky-500/30",
    broll: "border-amber-500/30",
  };
  return (
    <div className={`rounded-lg border ${accent[kind]} bg-neutral-950/50 p-2.5 space-y-2`}>
      <div className="flex items-center gap-2">
        <div className="h-9 w-12 shrink-0 rounded overflow-hidden border border-neutral-800 bg-black">
          {thumbnail}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-medium text-white truncate">{title}</div>
          {meta && (
            <div className="text-[9.5px] text-neutral-500 truncate font-mono">{meta}</div>
          )}
        </div>
        <button
          type="button"
          onClick={onAdvanced}
          title="Open the full panel for this media kind"
          className="text-[9px] text-neutral-500 hover:text-emerald-300 underline decoration-dotted"
        >
          advanced
        </button>
      </div>
      {children}
    </div>
  );
}

function ShapePanel({
  scene,
  update,
}: {
  scene: Scene;
  update: (p: Partial<Scene>) => void;
}) {
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const setSelectedLayerId = useEditorStore((s) => s.setSelectedLayerId);
  const focusedShapeId =
    selectedLayerId && selectedLayerId.startsWith("shape:")
      ? selectedLayerId.slice(6)
      : null;
  const shapes = scene.shapes ?? [];
  const visible = focusedShapeId
    ? shapes.filter((sh) => sh.id === focusedShapeId)
    : shapes;

  const patchShape = (id: string, patch: Partial<SceneShape>) => {
    update({
      shapes: shapes.map((sh) => (sh.id === id ? { ...sh, ...patch } : sh)),
    });
  };
  const removeShape = (id: string) => {
    update({ shapes: shapes.filter((sh) => sh.id !== id) });
    if (focusedShapeId === id) setSelectedLayerId(null);
  };

  if (shapes.length === 0) {
    return (
      <div className="text-[11px] text-neutral-500 px-2 py-3 text-center">
        No shapes on this scene yet — add one from the frame's "+ Add item".
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {visible.map((sh, idx) => (
        <div
          key={sh.id}
          className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-2.5 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium capitalize">
              {sh.kind} {idx + 1}
            </span>
            <button
              type="button"
              onClick={() => removeShape(sh.id)}
              title="Remove this shape"
              className="text-[10px] text-neutral-600 hover:text-red-400 px-1"
            >
              ×
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="X">
              <input
                type="number"
                value={sh.x}
                onChange={(e) => patchShape(sh.id, { x: Number(e.target.value) })}
                className="input-field h-7 text-[11px]"
              />
            </Field>
            <Field label="Y">
              <input
                type="number"
                value={sh.y}
                onChange={(e) => patchShape(sh.id, { y: Number(e.target.value) })}
                className="input-field h-7 text-[11px]"
              />
            </Field>
            <Field label="W">
              <input
                type="number"
                value={sh.w}
                onChange={(e) => patchShape(sh.id, { w: Number(e.target.value) })}
                className="input-field h-7 text-[11px]"
              />
            </Field>
            <Field label="H">
              <input
                type="number"
                value={sh.h}
                onChange={(e) => patchShape(sh.id, { h: Number(e.target.value) })}
                className="input-field h-7 text-[11px]"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Fill">
              <input
                type="color"
                value={sh.color ?? "#10b981"}
                onChange={(e) => patchShape(sh.id, { color: e.target.value })}
                className="h-7 w-full rounded cursor-pointer bg-transparent border border-neutral-700"
              />
            </Field>
            <Field label="Opacity">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={sh.opacity ?? 1}
                onChange={(e) => patchShape(sh.id, { opacity: Number(e.target.value) })}
                className="w-full accent-blue-500 h-1.5"
              />
              <span className="text-[10px] text-neutral-500">
                {Math.round((sh.opacity ?? 1) * 100)}%
              </span>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Stroke">
              <input
                type="color"
                value={sh.strokeColor ?? "#ffffff"}
                onChange={(e) => patchShape(sh.id, { strokeColor: e.target.value })}
                className="h-7 w-full rounded cursor-pointer bg-transparent border border-neutral-700"
              />
            </Field>
            <Field label="Stroke width">
              <input
                type="range"
                min={0}
                max={20}
                step={1}
                value={sh.strokeWidth ?? 0}
                onChange={(e) => patchShape(sh.id, { strokeWidth: Number(e.target.value) })}
                className="w-full accent-blue-500 h-1.5"
              />
              <span className="text-[10px] text-neutral-500">
                {sh.strokeWidth ?? 0}px
              </span>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Rotation">
              <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={sh.rotation ?? 0}
                onChange={(e) => patchShape(sh.id, { rotation: Number(e.target.value) })}
                className="w-full accent-blue-500 h-1.5"
              />
              <span className="text-[10px] text-neutral-500">{sh.rotation ?? 0}°</span>
            </Field>
            {sh.kind === "rect" && (
              <Field label="Corner radius">
                <input
                  type="range"
                  min={0}
                  max={120}
                  step={2}
                  value={sh.borderRadius ?? 0}
                  onChange={(e) =>
                    patchShape(sh.id, { borderRadius: Number(e.target.value) })
                  }
                  className="w-full accent-blue-500 h-1.5"
                />
                <span className="text-[10px] text-neutral-500">
                  {sh.borderRadius ?? 0}px
                </span>
              </Field>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function AlignRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: "left" | "center" | "right" | undefined;
  onChange: (v: "left" | "center" | "right") => void;
}) {
  const current = value ?? "center";
  const options: Array<{ id: "left" | "center" | "right"; glyph: string }> = [
    { id: "left", glyph: "⇤" },
    { id: "center", glyph: "≡" },
    { id: "right", glyph: "⇥" },
  ];
  return (
    <div className="flex flex-col gap-1">
      {label && <span className="text-neutral-500 capitalize">{label}</span>}
      <div className="flex rounded border border-neutral-700 overflow-hidden">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onChange(opt.id);
              }
            }}
            title={`Align ${opt.id}`}
            className={`flex-1 py-0.5 text-sm leading-none ${
              current === opt.id
                ? "bg-blue-500/20 text-blue-300"
                : "text-neutral-500 hover:text-neutral-200"
            }`}
          >
            {opt.glyph}
          </button>
        ))}
      </div>
    </div>
  );
}

const MOTION_NAMES: Array<MotionPreset> = [
  "none",
  "drift_up",
  "drift_down",
  "pulse",
  "shake",
  "ken_burns_in",
  "ken_burns_out",
  "parallax_slow",
  "parallax_fast",
  "bounce_in",
  "fade_in_out",
  "wobble",
];

function MotionPresetField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: MotionPreset | undefined;
  onChange: (v: MotionPreset | undefined) => void;
}) {
  return (
    <Field label={label}>
      <select
        value={value ?? "none"}
        onChange={(e) => {
          const v = e.target.value as MotionPreset;
          onChange(v === "none" ? undefined : v);
        }}
        className="input-field w-full text-xs"
      >
        {MOTION_NAMES.map((n) => (
          <option key={n} value={n}>
            {n.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </Field>
  );
}

function EffectsPanel({ scene, update, sfx }: { scene: Scene; update: (p: Partial<Scene>) => void; sfx: any[] }) {
  return (
    <>
      <Field label="SFX">
        <select value={scene.sfxId ?? ""} onChange={(e) => update({ sfxId: e.target.value || undefined })} className="input-field w-full text-xs">
          <option value="">None</option>
          {sfx.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="Zoom punch">
        <input type="range" min={0} max={1.4} step={0.05} value={scene.zoomPunch ?? 0} onChange={(e) => update({ zoomPunch: Number(e.target.value) })} className="w-full accent-amber-500 h-1.5" />
        <span className="text-[10px] text-neutral-500">{scene.zoomPunch ? `${((scene.zoomPunch - 1) * 100).toFixed(0)}% overshoot` : "off"}</span>
      </Field>
      <Field label="Screen shake">
        <input type="range" min={0} max={15} step={1} value={scene.shakeIntensity ?? 0} onChange={(e) => update({ shakeIntensity: Number(e.target.value) })} className="w-full accent-amber-500 h-1.5" />
        <span className="text-[10px] text-neutral-500">{scene.shakeIntensity ?? 0}px</span>
      </Field>
      <Field label="Beat flash">
        <div className="grid grid-cols-3 gap-1">
          {([["none", "None"], ["beat_flash", "White"], ["beat_flash_colored", "Color"]] as const).map(([v, l]) => (
            <button key={v} onClick={() => update({ transition: v as any })}
              className={`text-[10px] py-1.5 rounded-md border transition-colors ${(scene.transition ?? "none") === v ? "border-amber-500 bg-amber-500/10 text-amber-300" : "border-neutral-700 text-neutral-400 hover:border-neutral-500"}`}>{l}</button>
          ))}
        </div>
      </Field>

      {/* Speed warp + audio gain — separated so users see them as
          two distinct knobs rather than buried under a "media" submenu. */}
      <div className="pt-2 mt-2 border-t border-neutral-800">
        <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">
          Speed & audio
        </div>
        <Field label="Speed">
          <input
            type="range"
            min={0.25}
            max={4}
            step={0.05}
            value={scene.speedFactor ?? 1}
            onChange={(e) => update({ speedFactor: Number(e.target.value) })}
            className="w-full accent-amber-500 h-1.5"
          />
          <span className="text-[10px] text-neutral-500">
            {(scene.speedFactor ?? 1).toFixed(2)}× {(scene.speedFactor ?? 1) < 1 ? "(slow)" : (scene.speedFactor ?? 1) > 1 ? "(fast)" : "(normal)"}
          </span>
        </Field>
        <Field label="Volume">
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={scene.audioGain ?? 1}
            onChange={(e) => update({ audioGain: Number(e.target.value) })}
            className="w-full accent-amber-500 h-1.5"
          />
          <span className="text-[10px] text-neutral-500">
            {(scene.audioGain ?? 1) === 0 ? "muted" : `${((scene.audioGain ?? 1) * 100).toFixed(0)}%`}
          </span>
        </Field>
      </div>

      {scene.voiceover?.audioDurationSec && (
        <button
          type="button"
          onClick={() => {
            const targetSec = scene.voiceover?.audioDurationSec ?? scene.duration;
            update({ duration: Math.max(0.5, Number(targetSec.toFixed(2))) });
            toast(`Duration → ${targetSec.toFixed(2)}s`, { duration: 600 });
          }}
          className="w-full text-xs px-2 py-1.5 rounded border border-neutral-700 text-neutral-300 hover:border-emerald-500 hover:text-emerald-300"
          title={`Set scene duration = voiceover length (${scene.voiceover.audioDurationSec.toFixed(2)}s)`}
        >
          Fit duration to VO
        </button>
      )}

      <div className="border-t border-neutral-800 pt-3 mt-2 space-y-2">
        <div className="text-[11px] uppercase tracking-wide text-neutral-500">
          Fade
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="In (frames)">
            <input
              type="number"
              min={0}
              max={120}
              step={1}
              value={scene.fadeInFrames ?? 4}
              onChange={(e) =>
                update({ fadeInFrames: Math.max(0, Number(e.target.value)) })
              }
              className="input-field w-full text-xs tabular-nums"
            />
          </Field>
          <Field label="Out (frames)">
            <input
              type="number"
              min={0}
              max={120}
              step={1}
              value={scene.fadeOutFrames ?? 0}
              onChange={(e) =>
                update({ fadeOutFrames: Math.max(0, Number(e.target.value)) })
              }
              className="input-field w-full text-xs tabular-nums"
            />
          </Field>
        </div>
      </div>
    </>
  );
}

function BackgroundPanel({ scene, update }: { scene: Scene; update: (p: Partial<Scene>) => void }) {
  const [lookOpen, setLookOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [videoEditOpen, setVideoEditOpen] = useState(false);
  const addUpload = useProjectStore((s) => s.addUpload);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  const handleImageFiles = async (files: FileList | File[]) => {
    const { uploadFiles } = await import("@/lib/upload-files");
    const results = await uploadFiles(files, addUpload);
    const first = results[0];
    if (first) {
      update({
        background: {
          ...scene.background,
          imageUrl: first.upload.url,
          imageUrlOriginal: undefined,
          imageCrop: undefined,
        },
      });
    }
  };

  const handleVideoFiles = async (files: FileList | File[]) => {
    const { uploadFiles } = await import("@/lib/upload-files");
    const results = await uploadFiles(files, addUpload);
    const first = results[0];
    if (first) {
      update({
        background: {
          ...scene.background,
          videoUrl: first.upload.url,
          videoCrop: undefined,
          videoStartSec: undefined,
          videoEndSec: undefined,
          videoPlaybackRate: undefined,
          videoLoop: undefined,
        },
      });
    }
  };

  const hasImage = !!scene.background.imageUrl;
  const hasVideo = !!scene.background.videoUrl;
  const hasMedia = hasImage || hasVideo;

  return (
    <>
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          if (e.target.files?.length) handleImageFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        hidden
        onChange={(e) => {
          if (e.target.files?.length) handleVideoFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Media card — only renders when something is set. Non-destructive:
          users explicitly remove with the × button if they want to swap. */}
      {hasMedia && (
        <div className="rounded-md border border-neutral-700/70 bg-neutral-900 overflow-hidden">
          <div className="relative h-24 bg-black">
            {hasVideo ? (
              <video
                src={scene.background.videoUrl}
                muted
                playsInline
                autoPlay
                loop
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={scene.background.imageUrl}
                alt="background"
                className="w-full h-full object-cover"
              />
            )}
            <span className="absolute top-1.5 left-1.5 text-[9px] uppercase tracking-wider text-white/80 bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-sm">
              {hasVideo ? "Video" : "Image"}
            </span>
          </div>
          <div className="flex items-center gap-2 px-2 py-1.5 border-t border-neutral-800 bg-neutral-950/40">
            <button
              type="button"
              onClick={() =>
                hasVideo ? videoInputRef.current?.click() : imageInputRef.current?.click()
              }
              className="text-[11px] text-neutral-300 hover:text-emerald-300 px-2 py-1 rounded border border-neutral-700 hover:border-emerald-500"
            >
              Replace
            </button>
            {hasVideo && (
              <button
                type="button"
                onClick={() => setVideoEditOpen(true)}
                className={`text-[11px] px-2 py-1 rounded border ${
                  scene.background.videoStartSec !== undefined ||
                  scene.background.videoEndSec !== undefined ||
                  scene.background.videoPlaybackRate !== undefined ||
                  scene.background.videoLoop ||
                  scene.background.videoCrop
                    ? "border-sky-500/60 text-sky-300 bg-sky-500/10"
                    : "border-neutral-700 text-neutral-300 hover:text-sky-300 hover:border-sky-500"
                }`}
                title="Trim, speed, loop, crop, look"
              >
                Edit video
              </button>
            )}
            {!hasVideo && (
              <button
                type="button"
                onClick={() => setCropOpen(true)}
                className={`text-[11px] px-2 py-1 rounded border ${
                  scene.background.imageCrop
                    ? "border-cyan-500/60 text-cyan-300 bg-cyan-500/10"
                    : "border-neutral-700 text-neutral-300 hover:text-cyan-300 hover:border-cyan-500"
                }`}
                title="Crop / reframe the visible portion"
              >
                Crop
              </button>
            )}
            <button
              type="button"
              onClick={() =>
                update({
                  background: hasVideo
                    ? {
                        ...scene.background,
                        videoUrl: undefined,
                        videoCrop: undefined,
                        videoStartSec: undefined,
                        videoEndSec: undefined,
                        videoPlaybackRate: undefined,
                        videoLoop: undefined,
                      }
                    : {
                        ...scene.background,
                        imageUrl: undefined,
                        imageCrop: undefined,
                        imageUrlOriginal: undefined,
                      },
                })
              }
              className="ml-auto text-[11px] text-neutral-500 hover:text-red-400 px-2 py-1"
              title="Remove media — color shows through"
            >
              Remove
            </button>
          </div>
          {hasImage && !hasVideo && (
            <div className="flex items-center px-2 py-1.5 border-t border-neutral-800">
              <BgRemoveButton
                imageUrl={scene.background.imageUrl ?? ""}
                originalUrl={scene.background.imageUrlOriginal}
                onReplace={(nextUrl, originalUrl) =>
                  update({
                    background: {
                      ...scene.background,
                      imageUrl: nextUrl,
                      imageUrlOriginal: originalUrl,
                    },
                  })
                }
              />
            </div>
          )}
          {hasImage && !hasVideo && (
            <label className="flex items-center gap-2 text-[11px] text-neutral-300 px-2 py-1.5 border-t border-neutral-800">
              <input
                type="checkbox"
                checked={!!scene.background.kenBurns}
                onChange={(e) =>
                  update({ background: { ...scene.background, kenBurns: e.target.checked } })
                }
                className="accent-emerald-500"
              />
              Ken Burns (slow zoom)
            </label>
          )}
          {/* Corner radius — softens the bg media's edges. 0 = sharp. */}
          <div className="flex items-center gap-2 text-[11px] text-neutral-300 px-2 py-1.5 border-t border-neutral-800">
            <label className="text-[10px] text-neutral-500 w-20 shrink-0">
              Corner radius
            </label>
            <input
              type="range"
              min={0}
              max={120}
              step={2}
              value={scene.background.borderRadius ?? 0}
              onChange={(e) =>
                update({
                  background: {
                    ...scene.background,
                    borderRadius: Number(e.target.value),
                  },
                })
              }
              className="flex-1 accent-emerald-500 h-1"
            />
            <span className="text-[10px] text-neutral-500 font-mono tabular-nums w-10 text-right">
              {scene.background.borderRadius ?? 0}px
            </span>
          </div>
        </div>
      )}

      {/* No media yet — surface upload entry points. The frame's color
          lives in the Frame Properties panel, not here. */}
      {!hasMedia && (
        <div className="rounded-md border border-dashed border-neutral-700 bg-neutral-950/40 p-3 space-y-2">
          <div className="text-[11px] text-neutral-500">
            No background image or video on this scene.
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-md border border-neutral-700 hover:border-emerald-500 hover:bg-emerald-500/5 text-[11px] text-neutral-400 hover:text-emerald-300 transition-colors"
            >
              + Image
            </button>
            <button
              type="button"
              onClick={() => videoInputRef.current?.click()}
              className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-md border border-neutral-700 hover:border-emerald-500 hover:bg-emerald-500/5 text-[11px] text-neutral-400 hover:text-emerald-300 transition-colors"
            >
              + Video
            </button>
          </div>
        </div>
      )}

      {hasMedia && (
        <AnimateTrigger
          scene={scene}
          onOpen={() => useEditorStore.getState().setAnimateModalOpen(true)}
        />
      )}

      {hasImage && (
        <PxSizeRow
          widthPx={scene.background.imageWidthPx}
          heightPx={scene.background.imageHeightPx}
          onChange={(patch) => update({ background: { ...scene.background, ...patch } })}
          widthKey="imageWidthPx"
          heightKey="imageHeightPx"
        />
      )}
      {hasVideo && (
        <PxSizeRow
          widthPx={scene.background.videoWidthPx}
          heightPx={scene.background.videoHeightPx}
          onChange={(patch) => update({ background: { ...scene.background, ...patch } })}
          widthKey="videoWidthPx"
          heightKey="videoHeightPx"
        />
      )}

      <div className="pt-1">
        <LookTrigger scene={scene} onOpen={() => setLookOpen(true)} />
      </div>

      <LookModal
        open={lookOpen}
        onClose={() => setLookOpen(false)}
        scene={scene}
        update={update}
      />

      {hasMedia && (
        <CropModal
          open={cropOpen}
          onClose={() => setCropOpen(false)}
          src={(hasVideo ? scene.background.videoUrl : scene.background.imageUrl) ?? ""}
          mediaKind={hasVideo ? "video" : "image"}
          value={hasVideo ? scene.background.videoCrop : scene.background.imageCrop}
          onChange={(rect) =>
            update({
              background: hasVideo
                ? { ...scene.background, videoCrop: rect }
                : { ...scene.background, imageCrop: rect },
            })
          }
        />
      )}

      {hasVideo && (
        <VideoEditModal
          open={videoEditOpen}
          onClose={() => setVideoEditOpen(false)}
          scene={scene}
          update={update}
          onOpenCrop={() => setCropOpen(true)}
          onOpenLook={() => setLookOpen(true)}
          onOpenAnimate={() => useEditorStore.getState().setAnimateModalOpen(true)}
        />
      )}

      <div className="border-t border-neutral-800 pt-3 mt-2 space-y-2">
        <div className="text-[11px] uppercase tracking-wide text-neutral-500">
          Anchor
        </div>
        <div>
          <div className="text-[10px] text-neutral-500 mb-1">
            Where the contained media sits in the frame
          </div>
          <div className="grid grid-cols-3 gap-0.5 w-fit">
            {([
              ["top-left", "↖"],
              ["top", "↑"],
              ["top-right", "↗"],
              ["left", "←"],
              ["center", "•"],
              ["right", "→"],
              ["bottom-left", "↙"],
              ["bottom", "↓"],
              ["bottom-right", "↘"],
            ] as const).map(([pos, glyph]) => {
              const active = (scene.background.objectPosition ?? "center") === pos;
              return (
                <button
                  key={pos}
                  type="button"
                  onClick={() =>
                    update({
                      background: { ...scene.background, objectPosition: pos },
                    })
                  }
                  className={`w-7 h-7 text-xs rounded border ${
                    active
                      ? "border-emerald-500 text-emerald-300 bg-emerald-500/15"
                      : "border-neutral-700 text-neutral-500 hover:border-neutral-500 hover:text-neutral-300"
                  }`}
                  title={pos}
                >
                  {glyph}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="border-t border-neutral-800 pt-3 mt-2 space-y-2">
        <div className="text-[11px] uppercase tracking-wide text-neutral-500">
          Orientation
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              update({
                background: {
                  ...scene.background,
                  flipH: !scene.background.flipH,
                },
              })
            }
            className={`px-2 py-1 rounded text-xs border ${
              scene.background.flipH
                ? "border-emerald-500 text-emerald-300 bg-emerald-500/10"
                : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
            }`}
            title="Mirror horizontally"
          >
            Flip H
          </button>
          <button
            type="button"
            onClick={() =>
              update({
                background: {
                  ...scene.background,
                  flipV: !scene.background.flipV,
                },
              })
            }
            className={`px-2 py-1 rounded text-xs border ${
              scene.background.flipV
                ? "border-emerald-500 text-emerald-300 bg-emerald-500/10"
                : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
            }`}
            title="Mirror vertically"
          >
            Flip V
          </button>
          <button
            type="button"
            onClick={() => {
              const cur = scene.background.rotate ?? 0;
              const next = (cur + 90) % 360 as 0 | 90 | 180 | 270;
              update({
                background: { ...scene.background, rotate: next },
              });
            }}
            className="px-2 py-1 rounded text-xs border border-neutral-700 text-neutral-300 hover:border-neutral-500"
            title="Rotate 90° clockwise"
          >
            ↻ {scene.background.rotate ?? 0}°
          </button>
        </div>
      </div>
    </>
  );
}


function CounterPanel({ scene, update }: { scene: Scene; update: (p: Partial<Scene>) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Field label="From"><input type="number" value={scene.numberFrom ?? 0} onChange={(e) => update({ numberFrom: Number(e.target.value) })} className="input-field w-full text-xs" /></Field>
        <Field label="To"><input type="number" value={scene.numberTo ?? 0} onChange={(e) => update({ numberTo: Number(e.target.value) })} className="input-field w-full text-xs" /></Field>
      </div>
      <Field label="Suffix"><input type="text" value={scene.numberSuffix ?? ""} onChange={(e) => update({ numberSuffix: e.target.value })} className="input-field w-full text-xs" placeholder=" subs" /></Field>
      <Field label="Color"><input type="color" value={scene.numberColor ?? "#10b981"} onChange={(e) => update({ numberColor: e.target.value })} className="h-8 w-full rounded cursor-pointer bg-transparent border border-neutral-700" /></Field>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">{label}</label>
      {children}
    </div>
  );
}

/**
 * Width/Height in px for an image or video background. Either dimension
 * can be left blank to fall back to full-frame on that axis. The `key`
 * pair lets us reuse the same row for image (imageWidthPx/imageHeightPx)
 * and video (videoWidthPx/videoHeightPx) without prop-drilling six
 * fields into BackgroundPanel.
 */
function PxSizeRow({
  widthPx,
  heightPx,
  onChange,
  widthKey,
  heightKey,
}: {
  widthPx?: number;
  heightPx?: number;
  onChange: (patch: Record<string, number | undefined>) => void;
  widthKey: string;
  heightKey: string;
}) {
  const parse = (value: string): number | undefined => {
    if (value.trim() === "") return undefined;
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return undefined;
    return Math.round(n);
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      <Field label="Width (px)">
        <input
          type="number"
          min={1}
          step={1}
          value={widthPx ?? ""}
          onChange={(e) => onChange({ [widthKey]: parse(e.target.value) })}
          placeholder="auto"
          className="input-field w-full text-xs"
        />
      </Field>
      <Field label="Height (px)">
        <input
          type="number"
          min={1}
          step={1}
          value={heightPx ?? ""}
          onChange={(e) => onChange({ [heightKey]: parse(e.target.value) })}
          placeholder="auto"
          className="input-field w-full text-xs"
        />
      </Field>
    </div>
  );
}
