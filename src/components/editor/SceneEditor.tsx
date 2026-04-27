"use client";

import { Activity, ArrowLeft, Captions as CaptionsIcon, Film, Loader2, Mic, RefreshCw, Sparkles, User, Type, Palette, Zap, Hash } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAssetStore } from "@/store/asset-store";
import { useEditorStore, type EditTarget } from "@/store/editor-store";
import { useProjectStore } from "@/store/project-store";
import type { EnterDirection, KeyframeProperty, MotionPreset, Scene } from "@/lib/scene-schema";
import { getWorkflow } from "@/lib/workflows/registry";
import { BRollPanel } from "./BRollPanel";
import { KeyframeGraph } from "./KeyframeGraph";
import { MediaModelPicker } from "./MediaModelPicker";

const DIRECTIONS: EnterDirection[] = ["left", "right", "bottom", "scale"];

const TARGET_META: Record<Exclude<EditTarget, null>, { icon: any; label: string; color: string }> = {
  character: { icon: User, label: "Character", color: "text-emerald-400" },
  text: { icon: Type, label: "Text", color: "text-blue-400" },
  effects: { icon: Zap, label: "Effects", color: "text-amber-400" },
  background: { icon: Palette, label: "Background", color: "text-purple-400" },
  counter: { icon: Hash, label: "Counter", color: "text-orange-400" },
  broll: { icon: Film, label: "B-Roll", color: "text-pink-400" },
  keyframes: { icon: Activity, label: "Animate", color: "text-cyan-400" },
};

export function SceneEditor() {
  const { project, selectedSceneId, updateScene } = useProjectStore();
  const { editTarget, setEditTarget } = useEditorStore();
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

  const workflow = getWorkflow(project.workflowId);
  const allowedTargets = new Set(
    workflow.sceneEditorTargets ?? [
      "character",
      "text",
      "effects",
      "background",
      "counter",
      "broll",
    ],
  );
  const canShow = (t: Exclude<EditTarget, null>) => allowedTargets.has(t);

  if (!editTarget) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-xs font-semibold text-white">Scene {sceneIdx}</span>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(scene.id).catch(() => {});
            }}
            title="Click to copy — paste into chat to reference this scene"
            className="text-[9px] font-mono text-neutral-600 hover:text-emerald-400 transition-colors"
          >
            {scene.id}
          </button>
          <span className="text-[10px] text-neutral-500">— click to edit</span>
          <button
            onClick={() => useProjectStore.getState().clearSelection()}
            title="Close (Esc)"
            className="ml-auto text-neutral-500 hover:text-white px-1 text-sm leading-none"
          >
            ×
          </button>
        </div>
        {workflow.sceneActions && workflow.sceneActions.length > 0 && (
          <SceneActionsRow workflowId={workflow.id} scene={scene} actions={workflow.sceneActions} />
        )}
        <div className="space-y-1.5">
          {canShow("character") && scene.characterId && <TargetButton target="character" onClick={() => setEditTarget("character")} />}
          {canShow("text") && (scene.text || scene.emphasisText) && <TargetButton target="text" onClick={() => setEditTarget("text")} />}
          {canShow("counter") && scene.type === "big_number" && <TargetButton target="counter" onClick={() => setEditTarget("counter")} />}
          {canShow("effects") && <TargetButton target="effects" onClick={() => setEditTarget("effects")} />}
          {canShow("background") && <TargetButton target="background" onClick={() => setEditTarget("background")} />}
          {canShow("broll") && <TargetButton target="broll" onClick={() => setEditTarget("broll")} />}
        </div>
        <div className="pt-3 border-t border-neutral-800">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-neutral-500 w-14">Duration</label>
            <input type="range" min={0.5} max={8} step={0.5} value={scene.duration}
              onChange={(e) => update({ duration: Number(e.target.value) })}
              className="flex-1 accent-emerald-500 h-1" />
            <span className="text-[11px] text-white font-mono w-8">{scene.duration}s</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <label className="text-[10px] text-neutral-500 w-14">Type</label>
            <select value={scene.type} onChange={(e) => update({ type: e.target.value as Scene["type"] })}
              className="input-field flex-1 text-[11px] py-1">
              <option value="character_text">Character + Text</option>
              <option value="text_only">Text Only</option>
              <option value="big_number">Big Number</option>
              <option value="character_pop">Character Pop</option>
            </select>
          </div>
        </div>
        <VoiceoverSection scene={scene} />
        <RefineSection scene={scene} />
      </div>
    );
  }

  const meta = TARGET_META[editTarget];
  const Icon = meta.icon;

  return (
    <div className="overflow-y-auto max-h-[calc(100vh-50px)]">
      <div className="flex items-center gap-2 p-3 border-b border-neutral-800 bg-neutral-900/50 sticky top-0 z-10">
        <button
          onClick={() => setEditTarget(null)}
          title="Back to scene tools"
          className="p-1.5 hover:bg-neutral-800 rounded transition-colors"
        >
          <ArrowLeft className="h-4 w-4 text-neutral-400" />
        </button>
        <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
        <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
        <span className="text-[10px] text-neutral-600 ml-auto">Scene {sceneIdx}</span>
      </div>
      <div className="p-3 space-y-3">
        {editTarget === "character" && <CharacterPanel scene={scene} update={update} characters={characters} />}
        {editTarget === "text" && <TextPanel scene={scene} update={update} />}
        {editTarget === "effects" && <EffectsPanel scene={scene} update={update} sfx={sfx} />}
        {editTarget === "background" && <BackgroundPanel scene={scene} update={update} />}
        {editTarget === "counter" && <CounterPanel scene={scene} update={update} />}
        {editTarget === "broll" && <BRollPanel scene={scene} />}
        {editTarget === "keyframes" && <AnimatePanel scene={scene} />}
      </div>
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

function AnimatePanel({ scene }: { scene: Scene }) {
  const [property, setProperty] = useState<KeyframeProperty>("textY");
  const fps = useProjectStore((s) => s.project.fps);
  const durationFrames = Math.max(1, Math.round(scene.duration * fps));
  // Sticky tabs: 3 most recently edited channels — for now just track in
  // local state. A future iteration could persist across tab switches.
  const [recent, setRecent] = useState<KeyframeProperty[]>([]);
  const pickProperty = (p: KeyframeProperty) => {
    setProperty(p);
    setRecent((prev) => [p, ...prev.filter((x) => x !== p)].slice(0, 3));
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-neutral-500">Property</span>
        <select
          value={property}
          onChange={(e) => pickProperty(e.target.value as KeyframeProperty)}
          className="input-field text-xs flex-1"
        >
          {KEYFRAME_PROPERTIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      {recent.length > 1 && (
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] uppercase text-neutral-600">Recent</span>
          {recent.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProperty(p)}
              className={
                p === property
                  ? "px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/60 text-[10px] text-emerald-300"
                  : "px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-700 text-[10px] text-neutral-400 hover:text-white"
              }
            >
              {p}
            </button>
          ))}
        </div>
      )}
      <KeyframeGraph
        sceneId={scene.id}
        property={property}
        durationFrames={durationFrames}
        fallbackValue={(() => {
          // Sensible defaults so the curve baseline isn't always at 0.
          if (property === "textY") return scene.textY ?? 300;
          if (property === "textScale" || property === "emphasisScale" || property === "characterScale" || property === "bgScale") return 1;
          if (property.endsWith("Opacity")) return 1;
          return 0;
        })()}
      />
      <div className="text-[10px] text-neutral-600 leading-relaxed">
        Click empty space on the graph to add a keyframe at that frame +
        value. Drag a keyframe to move it. Right-click to delete. Pick the
        easing for the segment leaving an active keyframe via the dropdown
        in the graph header.
      </div>
    </div>
  );
}

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

function TextPanel({ scene, update }: { scene: Scene; update: (p: Partial<Scene>) => void }) {
  const textLen = (scene.text ?? "").length;
  const emphasisLen = (scene.emphasisText ?? "").length;
  return (
    <>
      <Field label={`Main text (secondary) · ${textLen}${textLen > 80 ? " — long, may wrap" : ""}`}>
        <textarea
          value={scene.text ?? ""}
          onChange={(e) => update({ text: e.target.value })}
          className={`input-field w-full text-xs h-16 resize-none ${textLen > 80 ? "border-amber-500/60" : ""}`}
          placeholder="smaller grey text..."
        />
      </Field>
      <Field label={`Emphasis text (primary) · ${emphasisLen}${emphasisLen > 40 ? " — long, may wrap" : ""}`}>
        <textarea
          value={scene.emphasisText ?? ""}
          onChange={(e) => update({ emphasisText: e.target.value })}
          className={`input-field w-full text-xs h-16 resize-none ${emphasisLen > 40 ? "border-amber-500/60" : ""}`}
          placeholder="THE BIG MESSAGE"
        />
      </Field>
      <Field label="Subtitle">
        <input type="text" value={scene.subtitleText ?? ""} onChange={(e) => update({ subtitleText: e.target.value })} className="input-field w-full text-xs" placeholder="small text below..." />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Color">
          <input type="color" value={scene.emphasisColor ?? "#ffffff"} onChange={(e) => update({ emphasisColor: e.target.value })} className="h-8 w-full rounded cursor-pointer bg-transparent border border-neutral-700" />
        </Field>
        <Field label="Glow">
          <input type="color" value={scene.emphasisGlow ?? "#ffffff00"} onChange={(e) => update({ emphasisGlow: e.target.value })} className="h-8 w-full rounded cursor-pointer bg-transparent border border-neutral-700" />
        </Field>
      </div>
      {/* Quick-pick accent palette — matches the defaults the generator uses. */}
      <div className="flex items-center flex-wrap gap-1">
        {[
          "#ef4444", "#f59e0b", "#10b981", "#38bdf8",
          "#818cf8", "#a78bfa", "#fb923c", "#ec4899",
          "#ffffff", "#aaaaaa",
        ].map((c) => (
          <button
            key={c}
            onClick={() => update({ emphasisColor: c })}
            onContextMenu={(e) => {
              e.preventDefault();
              navigator.clipboard?.writeText(c).catch(() => {});
            }}
            className={`h-5 w-5 rounded-full border-2 ${scene.emphasisColor === c ? "border-white" : "border-neutral-700"}`}
            style={{ backgroundColor: c }}
            title={`${c} — click to apply, right-click to copy`}
          />
        ))}
        <button
          onClick={() => {
            const project = useProjectStore.getState().project;
            const patch = { emphasisColor: scene.emphasisColor };
            for (const s of project.scenes) {
              if (s.id !== scene.id) useProjectStore.getState().updateScene(s.id, patch);
            }
          }}
          className="ml-auto text-[9px] text-neutral-500 hover:text-emerald-400 underline"
          title="Apply this accent color to every scene"
        >
          apply to all
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Size">
          <input type="range" min={24} max={200} step={4} value={scene.emphasisSize ?? 80} onChange={(e) => update({ emphasisSize: Number(e.target.value) })} className="w-full accent-blue-500 h-1.5" />
          <span className="text-[10px] text-neutral-500">{scene.emphasisSize ?? 80}px</span>
        </Field>
        <Field label="Y position">
          <input type="range" min={50} max={800} step={10} value={scene.textY ?? 300} onChange={(e) => update({ textY: Number(e.target.value) })} className="w-full accent-blue-500 h-1.5" />
          <span className="text-[10px] text-neutral-500">{scene.textY ?? 300}</span>
        </Field>
      </div>
      <MotionPresetField
        label="Text motion"
        value={scene.textMotion}
        onChange={(v) => update({ textMotion: v })}
      />
      <MotionPresetField
        label="Emphasis motion"
        value={scene.emphasisMotion}
        onChange={(v) => update({ emphasisMotion: v })}
      />
    </>
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
  // Derived "mode" of the background so the UI is tab-like instead of
  // three separate fields you have to figure out.
  const mode: "color" | "image" | "video" = scene.background.videoUrl
    ? "video"
    : scene.background.imageUrl
      ? "image"
      : "color";

  const setMode = (next: "color" | "image" | "video") => {
    if (next === "color")
      update({ background: { ...scene.background, imageUrl: undefined, videoUrl: undefined } });
    if (next === "image")
      update({ background: { ...scene.background, videoUrl: undefined } });
    if (next === "video")
      update({ background: { ...scene.background, imageUrl: undefined } });
  };

  return (
    <>
      <div className="flex gap-1 p-0.5 rounded-md bg-neutral-900 border border-neutral-800">
        {(["color", "image", "video"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 text-[11px] px-2 py-1 rounded capitalize transition-colors ${
              mode === m ? "bg-emerald-500/20 text-emerald-300" : "text-neutral-500 hover:text-white"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {mode === "color" && (
        <>
          <Field label="Background color">
            <input type="color" value={scene.background.color} onChange={(e) => update({ background: { ...scene.background, color: e.target.value } })} className="h-10 w-full rounded cursor-pointer bg-transparent border border-neutral-700" />
          </Field>
          {/* Dark-mode BG palette for fast picks. */}
          <div className="flex flex-wrap gap-1">
            {["#0a0a0a", "#111118", "#1a1a2e", "#0f172a", "#1e1b4b", "#164e63", "#042f2e", "#7c2d12", "#581c87", "#831843", "#fafafa"].map((c) => (
              <button
                key={c}
                onClick={() => update({ background: { ...scene.background, color: c } })}
                className={`h-5 w-5 rounded border-2 ${scene.background.color === c ? "border-white" : "border-neutral-700"}`}
                style={{ backgroundColor: c }}
                title={c}
              />
            ))}
          </div>
          <Field label="Gradient graphic">
            <select value={scene.background.graphic ?? ""} onChange={(e) => update({ background: { ...scene.background, graphic: e.target.value || undefined } })} className="input-field w-full text-xs">
              <option value="">None</option>
              <option value="gradient1">Blue swoosh</option>
              <option value="gradient3">Gradient 3</option>
              <option value="gradient5">Gradient 5</option>
              <option value="gradient6">Gradient 6</option>
              <option value="rect1">Rectangle</option>
              <option value="swoosh1">Swoosh</option>
            </select>
          </Field>
        </>
      )}

      {mode === "image" && (
        <>
          <MediaModelPicker sceneId={scene.id} kind="image" />
          <Field label="Image URL">
            <input
              type="text"
              value={scene.background.imageUrl ?? ""}
              onChange={(e) => update({ background: { ...scene.background, imageUrl: e.target.value || undefined } })}
              placeholder="https://..."
              className="input-field w-full text-xs"
            />
          </Field>
          {scene.background.imageUrl && (
            <img
              src={scene.background.imageUrl}
              alt="background preview"
              className="w-full h-20 object-cover rounded border border-neutral-800"
            />
          )}
          <label className="flex items-center gap-2 text-[11px] text-neutral-400">
            <input
              type="checkbox"
              checked={!!scene.background.kenBurns}
              onChange={(e) => update({ background: { ...scene.background, kenBurns: e.target.checked } })}
            />
            Ken Burns (slow zoom)
          </label>
          <span className="text-[10px] text-neutral-600">
            Tip: ask the agent &ldquo;generate an AI image for this scene&rdquo; to fill this automatically.
          </span>
        </>
      )}

      {mode === "video" && (
        <>
          <MediaModelPicker sceneId={scene.id} kind="video" />
          <Field label="Video URL">
            <input
              type="text"
              value={scene.background.videoUrl ?? ""}
              onChange={(e) => update({ background: { ...scene.background, videoUrl: e.target.value || undefined } })}
              placeholder="https://... or /uploads/..."
              className="input-field w-full text-xs"
            />
          </Field>
          {scene.background.videoUrl && (
            <video
              src={scene.background.videoUrl}
              muted
              playsInline
              className="w-full h-20 object-cover rounded border border-neutral-800"
            />
          )}
          <span className="text-[10px] text-neutral-600">
            Drag a video file into chat to upload, or run the avatar tool to fill this.
          </span>
        </>
      )}

      <Field label="Vignette">
        <input type="range" min={0} max={0.8} step={0.05} value={scene.background.vignette ?? 0.5} onChange={(e) => update({ background: { ...scene.background, vignette: Number(e.target.value) } })} className="w-full accent-purple-500 h-1.5" />
        <span className="text-[10px] text-neutral-500">{((scene.background.vignette ?? 0.5) * 100).toFixed(0)}%</span>
      </Field>

      {/* Manual color-grading sliders. Compose on top of the
          colorGrade preset (preset applied first, sliders multiply). */}
      <div className="pt-2 mt-2 border-t border-neutral-800">
        <div className="text-[10px] uppercase tracking-wider text-neutral-500 mb-1.5">
          Color grade
        </div>
        <Field label="Brightness">
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.02}
            value={scene.background.brightness ?? 1}
            onChange={(e) =>
              update({
                background: { ...scene.background, brightness: Number(e.target.value) },
              })
            }
            className="w-full accent-purple-500 h-1.5"
          />
          <span className="text-[10px] text-neutral-500">
            {(scene.background.brightness ?? 1).toFixed(2)}×
          </span>
        </Field>
        <Field label="Contrast">
          <input
            type="range"
            min={0.5}
            max={1.5}
            step={0.02}
            value={scene.background.contrast ?? 1}
            onChange={(e) =>
              update({
                background: { ...scene.background, contrast: Number(e.target.value) },
              })
            }
            className="w-full accent-purple-500 h-1.5"
          />
          <span className="text-[10px] text-neutral-500">
            {(scene.background.contrast ?? 1).toFixed(2)}×
          </span>
        </Field>
        <Field label="Saturation">
          <input
            type="range"
            min={0}
            max={1.5}
            step={0.02}
            value={scene.background.saturation ?? 1}
            onChange={(e) =>
              update({
                background: { ...scene.background, saturation: Number(e.target.value) },
              })
            }
            className="w-full accent-purple-500 h-1.5"
          />
          <span className="text-[10px] text-neutral-500">
            {(scene.background.saturation ?? 1).toFixed(2)}×
          </span>
        </Field>
        <Field label="Temperature">
          <input
            type="range"
            min={-1}
            max={1}
            step={0.05}
            value={scene.background.temperature ?? 0}
            onChange={(e) =>
              update({
                background: { ...scene.background, temperature: Number(e.target.value) },
              })
            }
            className="w-full accent-purple-500 h-1.5"
          />
          <span className="text-[10px] text-neutral-500">
            {(scene.background.temperature ?? 0) > 0 ? "warmer" : (scene.background.temperature ?? 0) < 0 ? "cooler" : "neutral"}
          </span>
        </Field>
      </div>

      <KeyingSection scene={scene} update={update} />

      <div className="border-t border-neutral-800 pt-3 mt-2">
        <button
          type="button"
          onClick={() => {
            // Copy this scene's color-grade bundle to every other scene.
            const bundle = {
              colorGrade: scene.background.colorGrade,
              brightness: scene.background.brightness,
              contrast: scene.background.contrast,
              saturation: scene.background.saturation,
              temperature: scene.background.temperature,
              blur: scene.background.blur,
              chromaKey: scene.background.chromaKey,
              lumaKey: scene.background.lumaKey,
            };
            const all = useProjectStore.getState().project.scenes;
            for (const sc of all) {
              if (sc.id === scene.id) continue;
              useProjectStore.getState().updateScene(sc.id, {
                background: { ...sc.background, ...bundle },
              });
            }
            toast(`Look applied to ${all.length - 1} other scene${all.length - 1 === 1 ? "" : "s"}`, {
              duration: 1000,
            });
          }}
          className="w-full text-xs px-2 py-1.5 rounded border border-neutral-700 text-neutral-300 hover:border-emerald-500 hover:text-emerald-300"
          title="Copy this scene's color grade + keying to every other scene in the project"
        >
          Apply look to all scenes
        </button>
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

function KeyingSection({
  scene,
  update,
}: {
  scene: Scene;
  update: (p: Partial<Scene>) => void;
}) {
  const chroma = scene.background.chromaKey;
  const luma = scene.background.lumaKey;
  const setChroma = (
    patch: Partial<NonNullable<Scene["background"]["chromaKey"]>> | null,
  ) => {
    if (patch === null) {
      update({ background: { ...scene.background, chromaKey: undefined } });
      return;
    }
    update({
      background: {
        ...scene.background,
        chromaKey: {
          color: chroma?.color ?? "#00ff00",
          tolerance: chroma?.tolerance ?? 0.4,
          softness: chroma?.softness ?? 0.3,
          ...patch,
        },
      },
    });
  };
  const setLuma = (
    patch: Partial<NonNullable<Scene["background"]["lumaKey"]>> | null,
  ) => {
    if (patch === null) {
      update({ background: { ...scene.background, lumaKey: undefined } });
      return;
    }
    update({
      background: {
        ...scene.background,
        lumaKey: {
          threshold: luma?.threshold ?? 0.3,
          softness: luma?.softness ?? 0.05,
          invert: luma?.invert ?? false,
          ...patch,
        },
      },
    });
  };

  return (
    <div className="border-t border-neutral-800 pt-3 mt-2 space-y-3">
      <div className="flex items-baseline justify-between">
        <h4 className="text-[11px] uppercase tracking-wide text-neutral-500">
          Keying
        </h4>
        <span className="text-[10px] text-neutral-600">chroma · luma</span>
      </div>

      <div className="space-y-2">
        <label className="flex items-center justify-between text-xs">
          <span className="text-neutral-300">Chroma key</span>
          <input
            type="checkbox"
            checked={!!chroma}
            onChange={(e) => (e.target.checked ? setChroma({}) : setChroma(null))}
            className="accent-emerald-500"
          />
        </label>
        {chroma && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Color">
              <input
                type="color"
                value={chroma.color}
                onChange={(e) => setChroma({ color: e.target.value })}
                className="h-7 w-full rounded cursor-pointer bg-transparent border border-neutral-700"
              />
            </Field>
            <Field label="Tolerance">
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={chroma.tolerance}
                onChange={(e) => setChroma({ tolerance: Number(e.target.value) })}
                className="w-full accent-emerald-500 h-1.5"
              />
              <span className="text-[10px] text-neutral-500">
                {(chroma.tolerance * 100).toFixed(0)}%
              </span>
            </Field>
            <Field label="Softness">
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={chroma.softness}
                onChange={(e) => setChroma({ softness: Number(e.target.value) })}
                className="w-full accent-emerald-500 h-1.5"
              />
              <span className="text-[10px] text-neutral-500">
                {(chroma.softness * 100).toFixed(0)}%
              </span>
            </Field>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="flex items-center justify-between text-xs">
          <span className="text-neutral-300">Luma key</span>
          <input
            type="checkbox"
            checked={!!luma}
            onChange={(e) => (e.target.checked ? setLuma({}) : setLuma(null))}
            className="accent-emerald-500"
          />
        </label>
        {luma && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Threshold">
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={luma.threshold}
                onChange={(e) => setLuma({ threshold: Number(e.target.value) })}
                className="w-full accent-emerald-500 h-1.5"
              />
              <span className="text-[10px] text-neutral-500">
                {(luma.threshold * 100).toFixed(0)}%
              </span>
            </Field>
            <Field label="Softness">
              <input
                type="range"
                min={0}
                max={0.5}
                step={0.02}
                value={luma.softness}
                onChange={(e) => setLuma({ softness: Number(e.target.value) })}
                className="w-full accent-emerald-500 h-1.5"
              />
              <span className="text-[10px] text-neutral-500">
                {(luma.softness * 100).toFixed(0)}%
              </span>
            </Field>
            <label className="col-span-2 flex items-center gap-2 text-[11px] text-neutral-300">
              <input
                type="checkbox"
                checked={!!luma.invert}
                onChange={(e) => setLuma({ invert: e.target.checked })}
                className="accent-emerald-500"
              />
              Invert (cull bright pixels instead of dark)
            </label>
          </div>
        )}
      </div>
    </div>
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

function RefineSection({ scene }: { scene: Scene }) {
  const { updateScene } = useProjectStore();
  const [prompt, setPrompt] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  const callRefine = async (instruction: string) => {
    const res = await fetch("/api/refine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scene, instruction }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? `Refine failed (${res.status})`);
    return data.patch;
  };

  const handleRefine = async () => {
    if (!prompt.trim()) return;
    setIsRefining(true);
    try {
      const patch = await callRefine(prompt);
      if (patch) {
        updateScene(scene.id, patch);
        toast.success("Scene refined");
      }
      setPrompt("");
    } catch (e) {
      toast.error("Refine failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsRefining(false);
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    try {
      const patch = await callRefine(
        "Regenerate this scene: keep the same text/emphasisText/numberFrom/numberTo/type, but vary every visual choice (character, pose, positions, colors, transitions, zoomPunch, background). Pick a fresh bright accent color and different character position than before.",
      );
      if (patch) {
        updateScene(scene.id, patch);
        toast.success("Scene regenerated");
      }
    } catch (e) {
      toast.error("Regenerate failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="pt-3 border-t border-neutral-800">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-3.5 w-3.5 text-purple-400" />
        <span className="text-xs font-semibold text-white">AI Refine</span>
      </div>
      <button
        onClick={handleRegenerate}
        disabled={isRegenerating || isRefining}
        className="flex items-center justify-center gap-1.5 w-full bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-900 disabled:text-neutral-600 text-neutral-200 text-xs font-medium px-3 py-1.5 rounded-md mb-2 transition-colors"
      >
        {isRegenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
        Regenerate this scene
      </button>
      <div className="flex gap-1.5">
        <input type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleRefine()} placeholder="make it punchier..." className="input-field flex-1 text-xs" />
        <button onClick={handleRefine} disabled={isRefining || isRegenerating || !prompt.trim()} className="bg-purple-600 hover:bg-purple-500 disabled:bg-neutral-700 text-white text-xs px-3 py-1.5 rounded-md shrink-0">
          {isRefining ? <Loader2 className="h-3 w-3 animate-spin" /> : "Go"}
        </button>
      </div>
      <div className="flex flex-wrap gap-1 mt-1.5">
        {["punchier", "bigger text", "zoom + shake", "red theme", "slower"].map((q) => (
          <button key={q} onClick={() => setPrompt(q)} className="text-[9px] text-neutral-500 hover:text-purple-400 bg-neutral-900 px-1.5 py-0.5 rounded-full border border-neutral-800 hover:border-purple-500/50 transition-colors">{q}</button>
        ))}
      </div>
    </div>
  );
}

const VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];

function VoiceoverSection({ scene }: { scene: Scene }) {
  const setSceneVoiceover = useProjectStore((s) => s.setSceneVoiceover);
  const setSceneCaptions = useProjectStore((s) => s.setSceneCaptions);
  const updateScene = useProjectStore((s) => s.updateScene);
  const [voice, setVoice] = useState(scene.voiceover?.voice ?? "alloy");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const narrationText =
    scene.voiceover?.text ??
    [scene.text, scene.emphasisText, scene.subtitleText]
      .filter(Boolean)
      .join(" ")
      .trim();

  const handleGenerate = async () => {
    if (!narrationText) {
      toast.error("No text to narrate in this scene");
      return;
    }
    setIsGenerating(true);
    try {
      const res = await fetch("/api/voiceover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: narrationText, voice }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `voiceover failed (${res.status})`);
      setSceneVoiceover(scene.id, {
        audioUrl: data.audioUrl,
        audioDurationSec: data.audioDurationSec,
        provider: "openai",
        voice,
        text: narrationText,
        captions: scene.voiceover?.text === narrationText ? scene.voiceover?.captions : undefined,
      });
      toast.success("Voiceover ready");
      // Auto-caption: fire transcription in the background. Non-fatal if it fails.
      fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrl: data.audioUrl }),
      })
        .then((r) => r.json())
        .then((d) => {
          if (Array.isArray(d.captions)) {
            setSceneCaptions(scene.id, d.captions);
          }
        })
        .catch(() => {});
    } catch (e) {
      toast.error("Voiceover failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTranscribe = async () => {
    if (!scene.voiceover?.audioUrl) return;
    setIsTranscribing(true);
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioUrl: scene.voiceover.audioUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `transcribe failed (${res.status})`);
      setSceneCaptions(scene.id, data.captions);
      toast.success(`Captions ready (${data.captions.length} words)`);
    } catch (e) {
      toast.error("Transcribe failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleClear = () => {
    setSceneVoiceover(scene.id, undefined);
    toast.success("Voiceover cleared");
  };

  return (
    <div className="pt-3 border-t border-neutral-800">
      <div className="flex items-center gap-2 mb-2">
        <Mic className="h-3.5 w-3.5 text-sky-400" />
        <span className="text-xs font-semibold text-white">Voiceover</span>
      </div>
      <div className="flex items-center gap-1.5 mb-2">
        <select
          value={voice}
          onChange={(e) => setVoice(e.target.value)}
          className="flex-1 input-field text-[10px]"
        >
          {VOICES.map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !narrationText}
          className="bg-sky-600 hover:bg-sky-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white text-xs px-3 py-1.5 rounded-md shrink-0"
          title={narrationText ? "Generate voiceover" : "Add text/emphasisText to narrate"}
        >
          {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Narrate"}
        </button>
      </div>
      {scene.voiceover && (
        <>
          <audio
            src={scene.voiceover.audioUrl}
            controls
            className="w-full h-7 mb-2"
            preload="metadata"
          />
          <div className="flex items-center gap-1.5 mb-2">
            <button
              onClick={handleTranscribe}
              disabled={isTranscribing}
              className="flex items-center gap-1 flex-1 justify-center bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-900 text-neutral-200 text-[11px] py-1 rounded-md transition-colors"
            >
              {isTranscribing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CaptionsIcon className="h-3 w-3" />
              )}
              {scene.voiceover.captions?.length
                ? `Re-transcribe (${scene.voiceover.captions.length} words)`
                : "Auto-caption"}
            </button>
            <label
              className="text-[11px] text-neutral-500 hover:text-sky-400 px-2 cursor-pointer"
              title="Import an SRT file"
            >
              <input
                type="file"
                accept=".srt,text/plain"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  try {
                    const text = await f.text();
                    const { parseSrt } = await import("@/lib/srt");
                    const captions = parseSrt(text);
                    if (captions.length === 0) throw new Error("no cues parsed");
                    setSceneCaptions(scene.id, captions);
                    toast.success(`Imported ${captions.length} caption words`);
                  } catch (err) {
                    toast.error("SRT import failed", {
                      description: err instanceof Error ? err.message : String(err),
                    });
                  }
                }}
              />
              srt
            </label>
            <button
              onClick={handleClear}
              className="text-[11px] text-neutral-500 hover:text-red-400 px-2"
            >
              clear
            </button>
          </div>
          {scene.voiceover.captions && (
            <label className="flex items-center gap-2 text-[11px] text-neutral-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={scene.showCaptions !== false}
                onChange={(e) => updateScene(scene.id, { showCaptions: e.target.checked })}
                className="accent-sky-500"
              />
              <span>Show burned captions</span>
            </label>
          )}
        </>
      )}
    </div>
  );
}

function SceneActionsRow({
  workflowId,
  scene,
  actions,
}: {
  workflowId: string;
  scene: Scene;
  actions: Array<{ id: string; label: string; kind: string }>;
}) {
  const updateScene = useProjectStore((s) => s.updateScene);
  const project = useProjectStore((s) => s.project);
  const [busy, setBusy] = useState<string | null>(null);

  const handle = async (kind: string) => {
    setBusy(kind);
    const toastId = toast.loading(actions.find((a) => a.kind === kind)?.label ?? kind);
    try {
      if (kind === "reprompt-image") {
        // Slideshow: generate a fresh image for this scene.
        const newPrompt = window.prompt(
          "New prompt for this scene's image:",
          scene.emphasisText ?? scene.text ?? "",
        );
        if (!newPrompt?.trim()) {
          toast.dismiss(toastId);
          return;
        }
        const orientation =
          project.height > project.width ? "portrait" : "landscape";
        const res = await fetch("/api/generate-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompts: [newPrompt.trim()],
            size: orientation === "portrait" ? "1024x1536" : "1536x1024",
            styleHint: "cinematic storybook illustration, rich colors",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `image failed (${res.status})`);
        const url = data.images?.[0]?.url;
        if (!url) throw new Error("no image url returned");
        updateScene(scene.id, {
          background: { ...scene.background, imageUrl: url },
        });
        toast.success("Image updated", { id: toastId });
      } else {
        toast.error(`Action "${kind}" not implemented`, { id: toastId });
      }
    } catch (e) {
      toast.error(`Action failed`, {
        id: toastId,
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-1 pb-2 border-b border-neutral-800">
      {actions.map((a) => (
        <button
          key={a.id}
          onClick={() => handle(a.kind)}
          disabled={busy === a.kind}
          className="flex items-center gap-1 text-[10px] bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-200 px-2 py-0.5 rounded transition-colors"
        >
          {busy === a.kind ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          {a.label}
        </button>
      ))}
    </div>
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
