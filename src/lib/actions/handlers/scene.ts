import {
  type Project,
  type Scene,
  type SceneBackground,
  createId,
  VALID_BACKGROUND_FIELDS,
  VALID_SCENE_FIELDS,
} from "@/lib/scene-schema";
import type { Action, ActionResult } from "../types";

/**
 * Bridge createScene-style flat aliases (backgroundColor, backgroundImageUrl,
 * etc.) into the nested background.* shape so callers don't have to remember
 * which form belongs to which surface. Used by scene.update.
 */
const FLAT_BACKGROUND_ALIASES: Record<string, keyof SceneBackground> = {
  backgroundColor: "color",
  backgroundImageUrl: "imageUrl",
  backgroundVideoUrl: "videoUrl",
  backgroundKenBurns: "kenBurns",
  backgroundCameraMove: "cameraMove",
  backgroundColorGrade: "colorGrade",
  backgroundBlur: "blur",
  backgroundOpacity: "imageOpacity",
  backgroundVignette: "vignette",
};

interface SceneUpdateArgs extends Record<string, unknown> {
  id: string;
  patch: Partial<Scene> & Record<string, unknown>;
}

export const sceneUpdateAction: Action<SceneUpdateArgs> = {
  name: "scene.update",
  description:
    "Patch a scene by id with a partial Scene object. Top-level flat aliases like backgroundColor / backgroundImageUrl are auto-translated into the nested background.* shape. Unknown fields fail loudly so silent no-ops can't ship.",
  validate(args) {
    if (!args || typeof args.id !== "string") return "id required";
    if (!args.patch || typeof args.patch !== "object") return "patch required";
    return null;
  },
  handler(project, args) {
    const idx = project.scenes.findIndex((s) => s.id === args.id);
    if (idx < 0) {
      return {
        ok: false,
        project,
        message: `no scene with id ${args.id}`,
      };
    }

    const rawPatch = { ...args.patch };

    // Bridge flat aliases.
    const bridged: string[] = [];
    const bgFromAliases: Record<string, unknown> = {};
    for (const [flat, nested] of Object.entries(FLAT_BACKGROUND_ALIASES)) {
      if (Object.prototype.hasOwnProperty.call(rawPatch, flat)) {
        const v = rawPatch[flat];
        if (v !== null) bgFromAliases[nested] = v;
        delete rawPatch[flat];
        bridged.push(flat);
      }
    }
    if (Object.keys(bgFromAliases).length > 0) {
      const existing = (rawPatch.background as Record<string, unknown> | undefined) ?? {};
      // background here is a *partial* patch — the required `color`
      // field is filled by the merge against prev.background later.
      // The Scene type's `background: SceneBackground` describes the
      // final shape, not the patch shape, so we double-cast.
      rawPatch.background = { ...existing, ...bgFromAliases } as unknown as SceneBackground;
    }

    const unknownTop = Object.keys(rawPatch).filter(
      (k) => !VALID_SCENE_FIELDS.has(k as keyof Scene),
    );
    const rawBg = (rawPatch.background as Record<string, unknown> | undefined) ?? null;
    const unknownBg = rawBg
      ? Object.keys(rawBg).filter(
          (k) => !VALID_BACKGROUND_FIELDS.has(k as keyof SceneBackground),
        )
      : [];
    if (unknownTop.length > 0 || unknownBg.length > 0) {
      const parts: string[] = [];
      if (unknownTop.length > 0) parts.push(`scene fields: ${unknownTop.join(", ")}`);
      if (unknownBg.length > 0) parts.push(`background fields: ${unknownBg.join(", ")}`);
      return {
        ok: false,
        project,
        message:
          `[invalid-patch] unknown ${parts.join("; ")}. ` +
          `Use textAlign / emphasisAlign / subtitleAlign for horizontal text alignment, textY for vertical placement, ` +
          `textColor / emphasisColor / subtitleColor for colors. Re-call with valid fields.`,
      };
    }

    const prev = project.scenes[idx];
    const patch = rawPatch as Partial<Scene>;
    const next: Scene = {
      ...prev,
      ...patch,
      background: patch.background
        ? { ...prev.background, ...patch.background }
        : prev.background,
    };
    const note = bridged.length > 0
      ? ` (bridged ${bridged.join(", ")} → background.*)`
      : "";
    return {
      ok: true,
      project: {
        ...project,
        scenes: project.scenes.map((s, i) => (i === idx ? next : s)),
      },
      message: `updated scene ${args.id}${note}`,
    };
  },
};

interface SceneRemoveArgs extends Record<string, unknown> {
  id: string;
}

export const sceneRemoveAction: Action<SceneRemoveArgs> = {
  name: "scene.remove",
  description:
    "Delete a scene by id. Locked scenes are refused. Drops cuts touching the scene and bridges prev→next with a hard cut so the timeline stays continuous.",
  validate(args) {
    if (typeof args?.id !== "string") return "id required";
    return null;
  },
  handler(project, args) {
    const idx = project.scenes.findIndex((s) => s.id === args.id);
    if (idx < 0) return { ok: false, project, message: `no scene with id ${args.id}` };
    const target = project.scenes[idx];
    if (target.locked) {
      return { ok: false, project, message: `scene ${args.id} is locked — unlock it first` };
    }
    const prev = idx > 0 ? project.scenes[idx - 1] : null;
    const next = idx < project.scenes.length - 1 ? project.scenes[idx + 1] : null;
    const filtered = (project.cuts ?? []).filter(
      (c) => c.fromSceneId !== args.id && c.toSceneId !== args.id,
    );
    const bridged = prev && next
      ? [
          ...filtered,
          {
            id: createId(),
            fromSceneId: prev.id,
            toSceneId: next.id,
            kind: "hard" as const,
            durationFrames: 0,
          },
        ]
      : filtered;
    return {
      ok: true,
      project: {
        ...project,
        scenes: project.scenes.filter((s) => s.id !== args.id),
        cuts: bridged.length > 0 ? bridged : undefined,
      },
      message: `removed scene ${args.id}`,
    };
  },
};

interface ScriptSetArgs extends Record<string, unknown> {
  script: string;
}

export const scriptSetAction: Action<ScriptSetArgs> = {
  name: "script.set",
  description: "Replace the project script (one line per scene).",
  validate(args) {
    if (typeof args?.script !== "string") return "script required";
    return null;
  },
  handler(project, args) {
    const lines = args.script.split("\n").filter((l) => l.trim()).length;
    return {
      ok: true,
      project: { ...project, script: args.script },
      message: `script set (${lines} lines)`,
    };
  },
};

interface MusicSetArgs extends Record<string, unknown> {
  url: string;
  name?: string;
  volume?: number;
  duckedVolume?: number;
}

export const musicSetAction: Action<MusicSetArgs> = {
  name: "music.set",
  description: "Set the project music bed.",
  validate(args) {
    if (typeof args?.url !== "string" || !args.url) return "url required";
    return null;
  },
  handler(project, args) {
    return {
      ok: true,
      project: {
        ...project,
        music: {
          url: args.url,
          name: args.name ?? "music",
          volume: args.volume ?? 0.55,
          duckedVolume: args.duckedVolume ?? 0.18,
        },
      },
      message: `music set: ${args.name ?? args.url}`,
    };
  },
};
