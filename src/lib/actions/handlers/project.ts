import {
  type CaptionStyle,
  type Cut,
  type CutKind,
  type Easing,
  type Keyframe,
  type KeyframeProperty,
  type MotionPreset,
  type Orientation,
  type Scene,
  type SceneBackground,
  createId,
  DEFAULT_CAPTION_STYLE,
  DIMENSIONS,
} from "@/lib/scene-schema";
import { applyPresetToScene, getPreset } from "@/lib/style-presets";
import type { Action } from "../types";

interface SceneCreateArgs extends Record<string, unknown> {
  type: Scene["type"];
  duration: number;
  insertAt?: number;
  /** Optional partial scene fields. Treated as patch over the defaults. */
  text?: string;
  emphasisText?: string;
  emphasisColor?: string;
  textColor?: string;
  backgroundColor?: string;
  backgroundImageUrl?: string;
  backgroundVideoUrl?: string;
  characterId?: string;
  characterUrl?: string;
}

export const sceneCreateAction: Action<SceneCreateArgs> = {
  name: "scene.create",
  description:
    "Append a scene to the project. Required: type, duration. All other fields optional. Use insertAt to insert at a specific index.",
  validate(args) {
    if (typeof args?.type !== "string") return "type required";
    if (typeof args?.duration !== "number") return "duration (seconds) required";
    return null;
  },
  handler(project, args) {
    const bg: SceneBackground = {
      color: args.backgroundColor ?? "#0a0a0a",
      imageUrl: args.backgroundImageUrl,
      videoUrl: args.backgroundVideoUrl,
      kenBurns: !!args.backgroundImageUrl,
      vignette: 0.35,
    };
    const scene: Scene = {
      id: createId(),
      type: args.type,
      duration: Math.max(0.5, Math.min(20, Number(args.duration))),
      text: args.text,
      emphasisText: args.emphasisText,
      emphasisColor: args.emphasisColor,
      textColor: args.textColor,
      characterId: args.characterId,
      characterUrl: args.characterUrl,
      background: bg,
    };
    const at =
      typeof args.insertAt === "number"
        ? Math.max(0, Math.min(project.scenes.length, Math.floor(args.insertAt)))
        : project.scenes.length;
    const scenes = [
      ...project.scenes.slice(0, at),
      scene,
      ...project.scenes.slice(at),
    ];
    return {
      ok: true,
      project: { ...project, scenes },
      message: `created scene ${scene.id} at index ${at}`,
      data: { id: scene.id, index: at },
    };
  },
};

export const captionStyleSetAction: Action<Record<string, unknown>> = {
  name: "caption.style.set",
  description:
    "Patch the burned-in caption style. Pass only the fields you want to change. highlightColor='' to disable.",
  handler(project, args) {
    const current: CaptionStyle = project.captionStyle ?? DEFAULT_CAPTION_STYLE;
    const patch: Partial<CaptionStyle> = {};
    for (const key of [
      "fontSize",
      "color",
      "strokeColor",
      "highlightColor",
      "position",
      "maxWordsPerChunk",
      "uppercase",
    ] as const) {
      if (args[key] !== undefined) (patch as Record<string, unknown>)[key] = args[key];
    }
    const next: CaptionStyle = { ...current, ...patch };
    if (patch.highlightColor === "") next.highlightColor = undefined;
    return {
      ok: true,
      project: { ...project, captionStyle: next },
      message: `caption style updated (${Object.keys(patch).length} fields)`,
    };
  },
};

interface MotionPresetSetArgs extends Record<string, unknown> {
  sceneId: string;
  element: "text" | "emphasis" | "character" | "bg";
  preset: MotionPreset;
}

export const motionPresetSetAction: Action<MotionPresetSetArgs> = {
  name: "motion.preset.set",
  description:
    "Apply a named motion preset to one of a scene's elements. element=text|emphasis|character|bg. preset=none|drift_up|drift_down|pulse|shake|ken_burns_in|ken_burns_out|parallax_slow|parallax_fast|bounce_in|bounce_pop_in|stagger_fade_scale|fade_in_out|wobble.",
  validate(args) {
    if (typeof args?.sceneId !== "string") return "sceneId required";
    if (!["text", "emphasis", "character", "bg"].includes(String(args?.element)))
      return "element must be one of text|emphasis|character|bg";
    return null;
  },
  handler(project, args) {
    const idx = project.scenes.findIndex((s) => s.id === args.sceneId);
    if (idx < 0) return { ok: false, project, message: `no scene with id ${args.sceneId}` };
    const value = args.preset === "none" ? undefined : args.preset;
    const scene = project.scenes[idx];
    const next: Scene = (() => {
      switch (args.element) {
        case "text":
          return { ...scene, textMotion: value };
        case "emphasis":
          return { ...scene, emphasisMotion: value };
        case "character":
          return { ...scene, characterMotion: value };
        case "bg":
          return { ...scene, bgMotion: value };
      }
    })();
    return {
      ok: true,
      project: {
        ...project,
        scenes: project.scenes.map((s, i) => (i === idx ? next : s)),
      },
      message: `${args.element}Motion = ${args.preset} on scene ${args.sceneId.slice(0, 6)}`,
    };
  },
};

interface CutUpsertArgs extends Record<string, unknown> {
  fromSceneId: string;
  toSceneId: string;
  kind: CutKind;
  durationFrames: number;
  easing?: Easing;
  color?: string;
  audioLeadFrames?: number;
  audioTrailFrames?: number;
}

export const cutUpsertAction: Action<CutUpsertArgs> = {
  name: "cut.upsert",
  description:
    "Set or replace the cut between two consecutive scenes. Replaces any existing cut on the same from→to pair.",
  validate(args) {
    if (typeof args?.fromSceneId !== "string") return "fromSceneId required";
    if (typeof args?.toSceneId !== "string") return "toSceneId required";
    if (typeof args?.kind !== "string") return "kind required";
    if (typeof args?.durationFrames !== "number") return "durationFrames required";
    return null;
  },
  handler(project, args) {
    if (!project.scenes.some((s) => s.id === args.fromSceneId))
      return { ok: false, project, message: `fromSceneId ${args.fromSceneId} not in project` };
    if (!project.scenes.some((s) => s.id === args.toSceneId))
      return { ok: false, project, message: `toSceneId ${args.toSceneId} not in project` };
    const cut: Cut = {
      id: createId(),
      fromSceneId: args.fromSceneId,
      toSceneId: args.toSceneId,
      kind: args.kind,
      durationFrames: Math.max(0, Math.round(args.durationFrames)),
      easing: args.easing,
      color: args.color,
      audioLeadFrames:
        args.audioLeadFrames !== undefined
          ? Math.max(0, Math.round(args.audioLeadFrames))
          : undefined,
      audioTrailFrames:
        args.audioTrailFrames !== undefined
          ? Math.max(0, Math.round(args.audioTrailFrames))
          : undefined,
    };
    const existing = (project.cuts ?? []).filter(
      (c) => !(c.fromSceneId === args.fromSceneId && c.toSceneId === args.toSceneId),
    );
    return {
      ok: true,
      project: { ...project, cuts: [...existing, cut] },
      message: `cut ${args.fromSceneId.slice(0, 6)}→${args.toSceneId.slice(0, 6)}: ${cut.kind} · ${cut.durationFrames}f`,
    };
  },
};

interface KeyframeUpsertArgs extends Record<string, unknown> {
  sceneId: string;
  property: KeyframeProperty;
  frame: number;
  value: number;
  easing?: Easing;
}

export const keyframeUpsertAction: Action<KeyframeUpsertArgs> = {
  name: "keyframe.upsert",
  description:
    "Add or replace a keyframe on a scene's animatable property. Replaces any existing keyframe on the same frame for the same property.",
  validate(args) {
    if (typeof args?.sceneId !== "string") return "sceneId required";
    if (typeof args?.property !== "string") return "property required";
    if (typeof args?.frame !== "number") return "frame required";
    if (typeof args?.value !== "number") return "value required";
    return null;
  },
  handler(project, args) {
    const idx = project.scenes.findIndex((s) => s.id === args.sceneId);
    if (idx < 0) return { ok: false, project, message: `no scene with id ${args.sceneId}` };
    const scene = project.scenes[idx];
    const kf: Keyframe = {
      frame: Math.max(0, Math.round(args.frame)),
      value: args.value,
      easing: args.easing,
    };
    const existing = scene.keyframes?.[args.property] ?? [];
    const filtered = existing.filter((k) => k.frame !== kf.frame);
    const sorted = [...filtered, kf].sort((a, b) => a.frame - b.frame);
    const next: Scene = {
      ...scene,
      keyframes: { ...(scene.keyframes ?? {}), [args.property]: sorted },
    };
    return {
      ok: true,
      project: {
        ...project,
        scenes: project.scenes.map((s, i) => (i === idx ? next : s)),
      },
      message: `keyframe set ${args.sceneId.slice(0, 6)} ${args.property} @ ${kf.frame} = ${kf.value}`,
    };
  },
};

interface ProjectOrientationSetArgs extends Record<string, unknown> {
  orientation: Orientation;
}

export const projectOrientationSetAction: Action<ProjectOrientationSetArgs> = {
  name: "project.orientation.set",
  description:
    "Set the project canvas orientation. portrait = 9:16 (1080×1920), landscape = 16:9 (1920×1080). Resizes the canvas; existing scenes don't reflow.",
  validate(args) {
    if (args?.orientation !== "portrait" && args?.orientation !== "landscape")
      return "orientation must be 'portrait' or 'landscape'";
    return null;
  },
  handler(project, args) {
    const dims = DIMENSIONS[args.orientation];
    if (project.width === dims.width && project.height === dims.height) {
      return { ok: true, project, message: `already ${args.orientation}` };
    }
    return {
      ok: true,
      project: { ...project, width: dims.width, height: dims.height },
      message: `orientation set to ${args.orientation} (${dims.width}×${dims.height})`,
    };
  },
};

interface ProjectRenameArgs extends Record<string, unknown> {
  name: string;
}

export const projectRenameAction: Action<ProjectRenameArgs> = {
  name: "project.rename",
  description:
    "Rename the project. Visible in the dashboard, the editor header, and exported file names.",
  validate(args) {
    if (typeof args?.name !== "string" || !args.name.trim()) return "name required";
    if (args.name.length > 80) return "name too long (max 80 chars)";
    return null;
  },
  handler(project, args) {
    const trimmed = args.name.trim();
    return {
      ok: true,
      project: { ...project, name: trimmed },
      message: `renamed to "${trimmed}"`,
    };
  },
};

interface ProjectStylePresetApplyArgs extends Record<string, unknown> {
  presetId: string;
}

export const projectStylePresetApplyAction: Action<ProjectStylePresetApplyArgs> = {
  name: "project.style.preset.apply",
  description:
    "Apply a named style preset (palette + typography + motion defaults) to every scene. Examples: 'minimal', 'bold', 'punchy', 'pastel', 'editorial'.",
  validate(args) {
    if (typeof args?.presetId !== "string") return "presetId required";
    return null;
  },
  handler(project, args) {
    const preset = getPreset(args.presetId);
    if (!preset)
      return { ok: false, project, message: `unknown preset "${args.presetId}"` };
    return {
      ok: true,
      project: {
        ...project,
        scenes: project.scenes.map((sc, i) => applyPresetToScene(sc, preset, i)),
      },
      message: `applied style preset "${args.presetId}" to ${project.scenes.length} scene${project.scenes.length === 1 ? "" : "s"}`,
    };
  },
};

interface ProjectPaletteApplyArgs extends Record<string, unknown> {
  /** 2-6 hex colors. First is canonical bg, rest cycle across scenes. */
  colors: string[];
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export const projectPaletteApplyAction: Action<ProjectPaletteApplyArgs> = {
  name: "project.palette.apply",
  description:
    "Apply a 2-6 color palette across the scene backgrounds. First color is the bg base; subsequent colors cycle as accent backgrounds across scenes for visual variety. Hex format #rrggbb required.",
  validate(args) {
    if (!Array.isArray(args?.colors) || args.colors.length < 2 || args.colors.length > 6)
      return "colors must be a 2-6 element array";
    for (const c of args.colors) {
      if (typeof c !== "string" || !HEX_RE.test(c))
        return `invalid color "${c}" — must be #rrggbb`;
    }
    return null;
  },
  handler(project, args) {
    const colors = args.colors;
    const scenes = project.scenes.map((sc, i) => ({
      ...sc,
      background: { ...sc.background, color: colors[i % colors.length] },
    }));
    return {
      ok: true,
      project: {
        ...project,
        scenes,
        paletteLock: { colors, appliedAt: Date.now() },
      },
      message: `applied palette across ${project.scenes.length} scene${project.scenes.length === 1 ? "" : "s"}`,
    };
  },
};

interface WorkflowSetArgs extends Record<string, unknown> {
  workflowId: string;
}

export const workflowSetAction: Action<WorkflowSetArgs> = {
  name: "workflow.set",
  description: "Set the project workflow id (template). Affects defaults and review criteria; does not touch scenes.",
  validate(args) {
    if (typeof args?.workflowId !== "string") return "workflowId required";
    return null;
  },
  handler(project, args) {
    return {
      ok: true,
      project: { ...project, workflowId: args.workflowId },
      message: `workflow set to ${args.workflowId}`,
    };
  },
};
