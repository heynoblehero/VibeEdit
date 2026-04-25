import {
  type CaptionStyle,
  type Project,
  type Scene,
  DEFAULT_CAPTION_STYLE,
  DIMENSIONS,
  createId,
} from "@/lib/scene-schema";
import type { CharacterAsset, SfxAsset } from "@/store/asset-store";
import { applyPresetToScene, getPreset, STYLE_PRESETS } from "@/lib/style-presets";
import { generateScenesFromScript } from "@/lib/generate-scenes";
import { WORKFLOWS } from "@/lib/workflows/registry";
import { listJobs, startRenderJob } from "@/lib/server/render-jobs";

export interface ToolContext {
  project: Project;
  characters: CharacterAsset[];
  sfx: SfxAsset[];
  origin: string;
}

export interface ToolResult {
  ok: boolean;
  message: string;
}

type ToolArgs = Record<string, unknown>;

// Claude tool definition shape (subset we care about).
interface ClaudeTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

interface AgentTool {
  schema: ClaudeTool;
  /** Mutates ctx.project in place. */
  execute: (args: ToolArgs, ctx: ToolContext) => Promise<ToolResult>;
}

function describeScene(s: Scene, idx: number): string {
  const label = s.emphasisText ?? s.text ?? s.subtitleText ?? s.type;
  return `scene ${idx + 1} (${s.id}): ${s.type}, ${s.duration}s, "${label}"`;
}

export function summarizeProject(project: Project): string {
  const scenes = project.scenes.map((s, i) => describeScene(s, i)).join("\n");
  const dims = `${project.width}×${project.height} ${project.height > project.width ? "portrait" : "landscape"}`;
  return [
    `Project: "${project.name}" (id ${project.id})`,
    `Workflow: ${project.workflowId ?? "faceless"}`,
    `Dimensions: ${dims}, fps ${project.fps}`,
    `Music: ${project.music ? `"${project.music.name}"` : "none"}`,
    `Caption style: ${project.captionStyle ? "customized" : "default"}`,
    `Script (${project.script.split("\n").filter(Boolean).length} lines):`,
    project.script ? project.script.slice(0, 800) : "(empty)",
    `Scenes (${project.scenes.length}):`,
    scenes || "(none)",
  ].join("\n");
}

const TOOLS: Record<string, AgentTool> = {
  createScene: {
    schema: {
      name: "createScene",
      description:
        "Append a new scene to the project. Required: type, duration. The text/emphasisText/colors are optional but the scene should usually have at least one of text or emphasisText unless it's a big_number.",
      input_schema: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["character_text", "text_only", "big_number", "character_pop"],
          },
          duration: { type: "number", description: "Scene duration in seconds (1.5-8)." },
          text: { type: "string" },
          emphasisText: { type: "string" },
          emphasisColor: { type: "string", description: "Hex color for emphasis text." },
          emphasisSize: { type: "number" },
          textColor: { type: "string" },
          textY: { type: "number", description: "Y position for text (canvas pixels)." },
          characterId: { type: "string" },
          characterX: { type: "number" },
          characterY: { type: "number" },
          enterFrom: {
            type: "string",
            enum: ["left", "right", "bottom", "scale"],
          },
          transition: {
            type: "string",
            enum: ["beat_flash", "beat_flash_colored", "none"],
          },
          transitionColor: { type: "string" },
          zoomPunch: { type: "number" },
          shakeIntensity: { type: "number" },
          numberFrom: { type: "number" },
          numberTo: { type: "number" },
          numberColor: { type: "string" },
          sfxId: { type: "string" },
          backgroundColor: {
            type: "string",
            description: "Scene background hex color.",
          },
          backgroundImageUrl: { type: "string" },
          backgroundKenBurns: { type: "boolean" },
          insertAt: {
            type: "number",
            description: "Zero-based index to insert at. Omit to append.",
          },
        },
        required: ["type", "duration"],
      },
    },
    async execute(args, ctx) {
      const scene: Scene = {
        id: createId(),
        type: args.type as Scene["type"],
        duration: Number(args.duration),
        text: args.text as string | undefined,
        emphasisText: args.emphasisText as string | undefined,
        emphasisColor: args.emphasisColor as string | undefined,
        emphasisSize: args.emphasisSize as number | undefined,
        textColor: args.textColor as string | undefined,
        textY: args.textY as number | undefined,
        characterId: args.characterId as string | undefined,
        characterX: args.characterX as number | undefined,
        characterY: args.characterY as number | undefined,
        enterFrom: args.enterFrom as Scene["enterFrom"],
        transition: args.transition as Scene["transition"],
        transitionColor: args.transitionColor as string | undefined,
        zoomPunch: args.zoomPunch as number | undefined,
        shakeIntensity: args.shakeIntensity as number | undefined,
        numberFrom: args.numberFrom as number | undefined,
        numberTo: args.numberTo as number | undefined,
        numberColor: args.numberColor as string | undefined,
        sfxId: args.sfxId as string | undefined,
        background: {
          color: (args.backgroundColor as string | undefined) ?? "#0a0a0a",
          imageUrl: args.backgroundImageUrl as string | undefined,
          kenBurns: args.backgroundKenBurns as boolean | undefined,
          vignette: 0.5,
        },
      };
      const insertAt =
        typeof args.insertAt === "number"
          ? Math.max(0, Math.min(ctx.project.scenes.length, Math.floor(args.insertAt)))
          : ctx.project.scenes.length;
      ctx.project.scenes = [
        ...ctx.project.scenes.slice(0, insertAt),
        scene,
        ...ctx.project.scenes.slice(insertAt),
      ];
      return { ok: true, message: `created scene ${scene.id} at index ${insertAt}` };
    },
  },

  updateScene: {
    schema: {
      name: "updateScene",
      description:
        "Update an existing scene by id. Only include the fields you want to change.",
      input_schema: {
        type: "object",
        properties: {
          id: { type: "string" },
          patch: {
            type: "object",
            description:
              "Partial Scene object. Background changes go under patch.background.",
          },
        },
        required: ["id", "patch"],
      },
    },
    async execute(args, ctx) {
      const id = String(args.id);
      const patch = (args.patch as Partial<Scene>) ?? {};
      const idx = ctx.project.scenes.findIndex((s) => s.id === id);
      if (idx < 0) return { ok: false, message: `no scene with id ${id}` };
      const prev = ctx.project.scenes[idx];
      const next: Scene = {
        ...prev,
        ...patch,
        background: patch.background
          ? { ...prev.background, ...patch.background }
          : prev.background,
      };
      ctx.project.scenes = ctx.project.scenes.map((s, i) => (i === idx ? next : s));
      return { ok: true, message: `updated scene ${id}` };
    },
  },

  removeScene: {
    schema: {
      name: "removeScene",
      description: "Delete a scene by id.",
      input_schema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
    async execute(args, ctx) {
      const id = String(args.id);
      const before = ctx.project.scenes.length;
      ctx.project.scenes = ctx.project.scenes.filter((s) => s.id !== id);
      if (ctx.project.scenes.length === before) {
        return { ok: false, message: `no scene with id ${id}` };
      }
      return { ok: true, message: `removed scene ${id}` };
    },
  },

  setScript: {
    schema: {
      name: "setScript",
      description: "Replace the project's script (one line per scene).",
      input_schema: {
        type: "object",
        properties: { script: { type: "string" } },
        required: ["script"],
      },
    },
    async execute(args, ctx) {
      ctx.project.script = String(args.script ?? "");
      const lines = ctx.project.script.split("\n").filter((l) => l.trim()).length;
      return { ok: true, message: `script set (${lines} lines)` };
    },
  },

  generateScenesFromScript: {
    schema: {
      name: "generateScenesFromScript",
      description:
        "Generate an ordered set of scenes from the script using the local heuristic (fast, no AI call). Replaces existing scenes. If you want custom scenes, call createScene per scene instead.",
      input_schema: {
        type: "object",
        properties: {
          script: {
            type: "string",
            description: "Optional — uses project.script if omitted.",
          },
        },
      },
    },
    async execute(args, ctx) {
      const script = String(args.script ?? ctx.project.script ?? "").trim();
      if (!script) return { ok: false, message: "script required" };
      ctx.project.script = script;
      const scenes = generateScenesFromScript(script, ctx.characters, ctx.sfx);
      ctx.project.scenes = scenes;
      return { ok: true, message: `generated ${scenes.length} scenes` };
    },
  },

  applyStylePreset: {
    schema: {
      name: "applyStylePreset",
      description: `Apply a named style preset across every scene. Available: ${STYLE_PRESETS.map((p) => `"${p.id}"`).join(", ")}.`,
      input_schema: {
        type: "object",
        properties: { presetId: { type: "string" } },
        required: ["presetId"],
      },
    },
    async execute(args, ctx) {
      const presetId = String(args.presetId);
      const preset = getPreset(presetId);
      if (!preset) {
        return {
          ok: false,
          message: `unknown preset "${presetId}". Try: ${STYLE_PRESETS.map((p) => p.id).join(", ")}`,
        };
      }
      ctx.project.scenes = ctx.project.scenes.map((s, i) =>
        applyPresetToScene(s, preset, i),
      );
      return { ok: true, message: `applied preset "${preset.name}"` };
    },
  },

  setCaptionStyle: {
    schema: {
      name: "setCaptionStyle",
      description:
        "Patch the burned-in caption style. Pass only the fields you want to change.",
      input_schema: {
        type: "object",
        properties: {
          fontSize: { type: "number" },
          color: { type: "string" },
          strokeColor: { type: "string" },
          highlightColor: {
            type: "string",
            description: "One word per chunk gets this color (TikTok style). Pass empty string to disable.",
          },
          position: { type: "string", enum: ["auto", "top", "center", "bottom"] },
          maxWordsPerChunk: { type: "number" },
          uppercase: { type: "boolean" },
        },
      },
    },
    async execute(args, ctx) {
      const current: CaptionStyle = ctx.project.captionStyle ?? DEFAULT_CAPTION_STYLE;
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
        if (args[key] !== undefined) {
          (patch as Record<string, unknown>)[key] = args[key];
        }
      }
      ctx.project.captionStyle = { ...current, ...patch };
      if (patch.highlightColor === "") ctx.project.captionStyle.highlightColor = undefined;
      return { ok: true, message: "caption style updated" };
    },
  },

  setOrientation: {
    schema: {
      name: "setOrientation",
      description: "Switch the project canvas to portrait (9:16) or landscape (16:9).",
      input_schema: {
        type: "object",
        properties: {
          orientation: { type: "string", enum: ["portrait", "landscape"] },
        },
        required: ["orientation"],
      },
    },
    async execute(args, ctx) {
      const orientation = args.orientation === "portrait" ? "portrait" : "landscape";
      const dims = DIMENSIONS[orientation];
      ctx.project.width = dims.width;
      ctx.project.height = dims.height;
      return { ok: true, message: `orientation set to ${orientation}` };
    },
  },

  setProjectName: {
    schema: {
      name: "setProjectName",
      description: "Rename the project.",
      input_schema: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    },
    async execute(args, ctx) {
      ctx.project.name = String(args.name ?? "Untitled").trim() || "Untitled";
      return { ok: true, message: `renamed to "${ctx.project.name}"` };
    },
  },

  setMusic: {
    schema: {
      name: "setMusic",
      description:
        "Set the project's background music. Pass null to remove. You can only set music that's already been uploaded (url starting with /music/ or /uploads/).",
      input_schema: {
        type: "object",
        properties: {
          url: { type: "string" },
          name: { type: "string" },
          volume: { type: "number" },
          duckedVolume: { type: "number" },
        },
      },
    },
    async execute(args, ctx) {
      const url = args.url as string | undefined;
      if (!url) {
        ctx.project.music = undefined;
        return { ok: true, message: "music removed" };
      }
      ctx.project.music = {
        url,
        name: String(args.name ?? url.split("/").pop() ?? "music"),
        volume: typeof args.volume === "number" ? args.volume : 0.55,
        duckedVolume: typeof args.duckedVolume === "number" ? args.duckedVolume : 0.18,
      };
      return { ok: true, message: `music set to "${ctx.project.music.name}"` };
    },
  },

  switchWorkflow: {
    schema: {
      name: "switchWorkflow",
      description: `Switch the active workflow. Use this when the user names a video type. Available ids: ${WORKFLOWS.filter((w) => w.enabled).map((w) => `"${w.id}"`).join(", ")}.`,
      input_schema: {
        type: "object",
        properties: {
          workflowId: { type: "string" },
          resetInputs: {
            type: "boolean",
            description: "If true, wipe workflowInputs so the user starts fresh. Default false.",
          },
        },
        required: ["workflowId"],
      },
    },
    async execute(args, ctx) {
      const id = String(args.workflowId);
      const wf = WORKFLOWS.find((w) => w.id === id);
      if (!wf || !wf.enabled) return { ok: false, message: `unknown or disabled workflow "${id}"` };
      ctx.project.workflowId = wf.id;
      const dims = DIMENSIONS[wf.defaultOrientation];
      ctx.project.width = dims.width;
      ctx.project.height = dims.height;
      if (args.resetInputs) ctx.project.workflowInputs = {};
      return { ok: true, message: `switched to ${wf.name} (${wf.defaultOrientation})` };
    },
  },

  listWorkflows: {
    schema: {
      name: "listWorkflows",
      description:
        "Return the catalog of available workflows so you can offer choices to the user. Pure read-only.",
      input_schema: { type: "object", properties: {} },
    },
    async execute() {
      const catalog = WORKFLOWS.filter((w) => w.enabled)
        .map((w) => `- ${w.id}: ${w.name} — ${w.tagline}`)
        .join("\n");
      return { ok: true, message: catalog };
    },
  },

  narrateScene: {
    schema: {
      name: "narrateScene",
      description:
        "Generate a voiceover for a single scene. Pick a voice from the catalog by id (e.g. openai-onyx for deep male, 11labs-rachel for premium female narrative). Omit voiceId for the default (openai-nova). Extends scene duration to fit the audio.",
      input_schema: {
        type: "object",
        properties: {
          sceneId: { type: "string" },
          voiceId: {
            type: "string",
            description:
              "Voice id from the catalog. Examples: openai-nova, openai-onyx, openai-shimmer, openai-fable, 11labs-rachel, 11labs-adam.",
          },
        },
        required: ["sceneId"],
      },
    },
    async execute(args, ctx) {
      const sceneId = String(args.sceneId);
      const idx = ctx.project.scenes.findIndex((s) => s.id === sceneId);
      if (idx < 0) return { ok: false, message: `no scene with id ${sceneId}` };
      const scene = ctx.project.scenes[idx];
      const text = [scene.text, scene.emphasisText, scene.subtitleText]
        .filter(Boolean)
        .join(" ")
        .trim();
      if (!text) return { ok: false, message: `scene ${sceneId} has no text to narrate` };
      const { getVoice, defaultVoiceId } = await import(
        "@/lib/server/voice-providers/models"
      );
      const voiceId = String(args.voiceId ?? args.voice ?? defaultVoiceId());
      const v = getVoice(voiceId);
      if (!v) return { ok: false, message: `unknown voice id: ${voiceId}` };
      try {
        const res = await fetch(`${ctx.origin}/api/voiceover`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            v.provider === "elevenlabs"
              ? { text, elevenLabsVoiceId: v.voiceParam }
              : { text, voice: v.voiceParam },
          ),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `voiceover failed (${res.status})`);
        scene.voiceover = {
          audioUrl: data.audioUrl,
          audioDurationSec: data.audioDurationSec,
          provider: v.provider === "elevenlabs" ? "elevenlabs" : "openai",
          voice: v.voiceParam,
          text,
        };
        scene.duration = Math.max(scene.duration, data.audioDurationSec + 0.3);
        ctx.project.scenes = ctx.project.scenes.map((s, i) => (i === idx ? scene : s));
        return {
          ok: true,
          message: `narrated scene ${sceneId} with ${v.name} (${data.audioDurationSec.toFixed(1)}s)`,
        };
      } catch (e) {
        return {
          ok: false,
          message: `narrate failed: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    },
  },

  narrateAllScenes: {
    schema: {
      name: "narrateAllScenes",
      description:
        "Narrate every scene that has text and doesn't already have a voiceover. Requires OPENAI_API_KEY.",
      input_schema: {
        type: "object",
        properties: {
          voice: { type: "string" },
          overwrite: { type: "boolean" },
        },
      },
    },
    async execute(args, ctx) {
      const voice = String(args.voice ?? "alloy");
      const overwrite = Boolean(args.overwrite);
      let ok = 0;
      let skip = 0;
      let fail = 0;
      for (let i = 0; i < ctx.project.scenes.length; i++) {
        const s = ctx.project.scenes[i];
        if (!overwrite && s.voiceover?.audioUrl) {
          skip++;
          continue;
        }
        const text = [s.text, s.emphasisText, s.subtitleText]
          .filter(Boolean)
          .join(" ")
          .trim();
        if (!text) {
          skip++;
          continue;
        }
        try {
          const res = await fetch(`${ctx.origin}/api/voiceover`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, voice }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error ?? "voiceover failed");
          s.voiceover = {
            audioUrl: data.audioUrl,
            audioDurationSec: data.audioDurationSec,
            provider: "openai",
            voice,
            text,
          };
          s.duration = Math.max(s.duration, data.audioDurationSec + 0.3);
          ok++;
        } catch {
          fail++;
        }
      }
      return {
        ok: fail === 0,
        message: `narrated ${ok} scenes${skip ? `, skipped ${skip}` : ""}${fail ? `, ${fail} failed` : ""}`,
      };
    },
  },

  generateImageForScene: {
    schema: {
      name: "generateImageForScene",
      description:
        "Generate an AI image for a scene's background. Routes to the right provider via /api/media/image. Pick a model from the catalog if the user has a preference (e.g. 'hero', 'cheap', 'with text'); omit `model` to use the default (gpt-image-1). Available image models: gpt-image-1, flux-1.1-pro-ultra, flux-schnell, ideogram-v3-turbo.",
      input_schema: {
        type: "object",
        properties: {
          sceneId: { type: "string" },
          prompt: { type: "string" },
          model: {
            type: "string",
            description: "Optional model id from the catalog. Default: gpt-image-1.",
          },
          styleHint: { type: "string", description: "Optional style appended to the prompt." },
        },
        required: ["sceneId", "prompt"],
      },
    },
    async execute(args, ctx) {
      const sceneId = String(args.sceneId);
      const idx = ctx.project.scenes.findIndex((s) => s.id === sceneId);
      if (idx < 0) return { ok: false, message: `no scene with id ${sceneId}` };
      const styleHint = args.styleHint ? String(args.styleHint) : "";
      const prompt = `${args.prompt}${styleHint ? ` — ${styleHint}` : ""}`;
      const aspectRatio: "16:9" | "9:16" =
        ctx.project.height > ctx.project.width ? "9:16" : "16:9";
      try {
        const res = await fetch(`${ctx.origin}/api/media/image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            modelId: args.model ? String(args.model) : undefined,
            aspectRatio,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `image failed (${res.status})`);
        const url = data.url;
        if (!url) throw new Error("no image url returned");
        const scene = ctx.project.scenes[idx];
        scene.background = {
          ...scene.background,
          imageUrl: url,
          kenBurns: true,
        };
        ctx.project.scenes = ctx.project.scenes.map((s, i) => (i === idx ? scene : s));
        return {
          ok: true,
          message: `image attached to scene ${sceneId} (via ${data.modelId})`,
        };
      } catch (e) {
        return {
          ok: false,
          message: `image failed: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    },
  },

  generateVideoForScene: {
    schema: {
      name: "generateVideoForScene",
      description:
        "Generate an AI text-to-video clip and attach it as the scene's background video. Pick a model from the catalog if the user has a preference. Models: seedance-1-pro (default — best $/quality), kling-v2.0 (image-to-video king, pass imageUrl), veo-3 (premium, has native audio), ltx-video (fast & cheap b-roll). When the scene already has a background image and you want to animate it, prefer kling-v2.0 with imageUrl=that.",
      input_schema: {
        type: "object",
        properties: {
          sceneId: { type: "string" },
          prompt: { type: "string" },
          model: {
            type: "string",
            description: "Optional model id. Default: seedance-1-pro.",
          },
          imageUrl: {
            type: "string",
            description: "Optional source image URL — triggers image-to-video on supporting models.",
          },
          durationSec: { type: "number", description: "Optional clip length in seconds." },
        },
        required: ["sceneId", "prompt"],
      },
    },
    async execute(args, ctx) {
      const sceneId = String(args.sceneId);
      const idx = ctx.project.scenes.findIndex((s) => s.id === sceneId);
      if (idx < 0) return { ok: false, message: `no scene with id ${sceneId}` };
      const aspectRatio: "16:9" | "9:16" =
        ctx.project.height > ctx.project.width ? "9:16" : "16:9";
      try {
        const res = await fetch(`${ctx.origin}/api/media/video`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: String(args.prompt),
            modelId: args.model ? String(args.model) : undefined,
            imageUrl: args.imageUrl ? String(args.imageUrl) : undefined,
            durationSec: args.durationSec ? Number(args.durationSec) : undefined,
            aspectRatio,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `video failed (${res.status})`);
        const url = data.url;
        if (!url) throw new Error("no video url returned");
        const scene = ctx.project.scenes[idx];
        scene.background = { ...scene.background, videoUrl: url };
        ctx.project.scenes = ctx.project.scenes.map((s, i) => (i === idx ? scene : s));
        return {
          ok: true,
          message: `video attached to scene ${sceneId} (via ${data.modelId})`,
        };
      } catch (e) {
        return {
          ok: false,
          message: `video failed: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    },
  },

  generateMusicForProject: {
    schema: {
      name: "generateMusicForProject",
      description:
        "Generate a backing music track from a text prompt and attach it to the project. Models: musicgen (default), musicgen-melody, stable-audio (cinematic). Pass durationSec to control length (default 30s, max 47s).",
      input_schema: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "e.g. 'upbeat lo-fi for a coding montage' or 'tense cinematic synth'.",
          },
          model: { type: "string" },
          durationSec: { type: "number" },
          volume: {
            type: "number",
            description: "0-1, default 0.6 (so voiceover stays audible).",
          },
        },
        required: ["prompt"],
      },
    },
    async execute(args, ctx) {
      const prompt = String(args.prompt ?? "");
      try {
        const res = await fetch(`${ctx.origin}/api/media/music`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            modelId: args.model ? String(args.model) : undefined,
            durationSec: args.durationSec ? Number(args.durationSec) : 30,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `music failed (${res.status})`);
        ctx.project.music = {
          url: data.url,
          name: prompt.slice(0, 60),
          volume: typeof args.volume === "number" ? Number(args.volume) : 0.6,
          duckedVolume: 0.15,
        };
        return {
          ok: true,
          message: `music attached (via ${data.modelId}, ${data.durationSec}s)`,
        };
      } catch (e) {
        return {
          ok: false,
          message: `music failed: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    },
  },

  generateSfxForScene: {
    schema: {
      name: "generateSfxForScene",
      description:
        "Generate a sound effect from a text prompt and attach it to a scene as the sceneSfxUrl. Use for transitions, stingers, ambient layers. Models: elevenlabs-sfx (default, best quality), audiogen (cheap fallback). Default duration 5s, max 22s.",
      input_schema: {
        type: "object",
        properties: {
          sceneId: { type: "string" },
          prompt: { type: "string" },
          model: { type: "string" },
          durationSec: { type: "number" },
        },
        required: ["sceneId", "prompt"],
      },
    },
    async execute(args, ctx) {
      const sceneId = String(args.sceneId);
      const idx = ctx.project.scenes.findIndex((s) => s.id === sceneId);
      if (idx < 0) return { ok: false, message: `no scene with id ${sceneId}` };
      try {
        const res = await fetch(`${ctx.origin}/api/media/sfx`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: String(args.prompt),
            modelId: args.model ? String(args.model) : undefined,
            durationSec: args.durationSec ? Number(args.durationSec) : 5,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `sfx failed (${res.status})`);
        const scene = ctx.project.scenes[idx];
        scene.sceneSfxUrl = data.url;
        ctx.project.scenes = ctx.project.scenes.map((s, i) => (i === idx ? scene : s));
        return {
          ok: true,
          message: `sfx attached to scene ${sceneId} (via ${data.modelId})`,
        };
      } catch (e) {
        return {
          ok: false,
          message: `sfx failed: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    },
  },

  generateAvatarForScene: {
    schema: {
      name: "generateAvatarForScene",
      description:
        "Generate a talking-head avatar video for a scene using its voiceover audio and a portrait image. Attaches the result as the scene's background video. Requires AVATAR_PROVIDER + FAL_API_KEY (or equivalent) on the server.",
      input_schema: {
        type: "object",
        properties: {
          sceneId: { type: "string" },
          imageUrl: {
            type: "string",
            description:
              "Public URL of the portrait image. Falls back to AVATAR_DEFAULT_PORTRAIT_URL env if omitted.",
          },
          prompt: {
            type: "string",
            description: "Optional style/expression hint for the generation.",
          },
        },
        required: ["sceneId"],
      },
    },
    async execute(args, ctx) {
      const sceneId = String(args.sceneId);
      const idx = ctx.project.scenes.findIndex((s) => s.id === sceneId);
      if (idx < 0) return { ok: false, message: `no scene with id ${sceneId}` };
      const scene = ctx.project.scenes[idx];
      const audioUrl = scene.voiceover?.audioUrl;
      if (!audioUrl) {
        return {
          ok: false,
          message:
            "scene has no voiceover — run narrateScene first so there's audio to drive the avatar",
        };
      }
      const imageUrl =
        (args.imageUrl as string | undefined) ??
        process.env.AVATAR_DEFAULT_PORTRAIT_URL;
      if (!imageUrl) {
        return {
          ok: false,
          message:
            "no imageUrl provided and AVATAR_DEFAULT_PORTRAIT_URL not set — give the tool a portrait URL",
        };
      }
      try {
        const res = await fetch(`${ctx.origin}/api/generate-avatar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl,
            audioUrl,
            prompt: args.prompt,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `avatar gen failed (${res.status})`);
        const videoUrl = data.videoUrl;
        if (!videoUrl) throw new Error("provider returned no video URL");
        scene.background = { ...scene.background, videoUrl };
        ctx.project.scenes = ctx.project.scenes.map((s, i) => (i === idx ? scene : s));
        return {
          ok: true,
          message: `avatar video attached to scene ${sceneId} (via ${data.provider})`,
        };
      } catch (e) {
        return {
          ok: false,
          message: `avatar gen failed: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    },
  },

  webSearch: {
    schema: {
      name: "webSearch",
      description:
        "Search the web for fresh links. Returns up to `limit` results: title + url + snippet. Use this when you need current info, external references, or image / video source URLs.",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "number", description: "1-10, default 5" },
        },
        required: ["query"],
      },
    },
    async execute(args, ctx) {
      const query = String(args.query ?? "").trim();
      if (!query) return { ok: false, message: "query required" };
      const limit = Math.max(1, Math.min(10, Number(args.limit ?? 5)));
      try {
        const res = await fetch(`${ctx.origin}/api/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, limit }),
        });
        const data = (await res.json()) as {
          provider?: string;
          results?: Array<{ title: string; url: string; snippet: string }>;
          error?: string;
        };
        if (!res.ok)
          return {
            ok: false,
            message: data.error ?? `search failed (${res.status})`,
          };
        const results = data.results ?? [];
        const summary = results
          .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
          .join("\n\n");
        return {
          ok: true,
          message:
            results.length > 0
              ? `${results.length} results via ${data.provider}:\n\n${summary}`
              : "no results",
        };
      } catch (e) {
        return {
          ok: false,
          message: `search failed: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    },
  },

  renderProject: {
    schema: {
      name: "renderProject",
      description:
        "Enqueue a render of the current project. Returns a jobId the user can watch in the render queue. Preset defaults to the best for the orientation.",
      input_schema: {
        type: "object",
        properties: {
          presetId: {
            type: "string",
            enum: ["1080p", "4k", "720p", "webm", "gif"],
          },
        },
      },
    },
    async execute(args, ctx) {
      if (ctx.project.scenes.length === 0) {
        return { ok: false, message: "no scenes to render" };
      }
      const charMap: Record<string, string> = {};
      for (const c of ctx.characters) charMap[c.id] = c.src;
      const sfxMap: Record<string, string> = {};
      for (const s of ctx.sfx) sfxMap[s.id] = s.src;
      const presetId =
        (args.presetId as
          | "1080p"
          | "4k"
          | "720p"
          | "webm"
          | "gif"
          | undefined) ?? "1080p";
      const job = startRenderJob({
        project: ctx.project,
        characters: charMap,
        sfx: sfxMap,
        origin: ctx.origin,
        presetId,
      });
      return {
        ok: true,
        message: `render queued (jobId ${job.id}, preset ${presetId})`,
      };
    },
  },

  duplicateScene: {
    schema: {
      name: "duplicateScene",
      description:
        "Duplicate a scene one or more times. New scenes are inserted immediately after the source, each with a fresh id.",
      input_schema: {
        type: "object",
        properties: {
          sceneId: { type: "string" },
          times: { type: "number", description: "How many copies (default 1)." },
        },
        required: ["sceneId"],
      },
    },
    async execute(args, ctx) {
      const id = String(args.sceneId);
      const times = Math.max(1, Math.min(20, Number(args.times ?? 1)));
      const idx = ctx.project.scenes.findIndex((s) => s.id === id);
      if (idx < 0) return { ok: false, message: `no scene ${id}` };
      const src = ctx.project.scenes[idx];
      const copies: Scene[] = [];
      for (let i = 0; i < times; i++) {
        copies.push({
          ...src,
          id: createId(),
          broll: src.broll?.map((b) => ({ ...b, id: createId() })),
        });
      }
      ctx.project.scenes = [
        ...ctx.project.scenes.slice(0, idx + 1),
        ...copies,
        ...ctx.project.scenes.slice(idx + 1),
      ];
      return { ok: true, message: `duplicated scene ${id} ×${times}` };
    },
  },

  reorderScenes: {
    schema: {
      name: "reorderScenes",
      description:
        "Reorder scenes by emitting the full list of scene ids in the new order.",
      input_schema: {
        type: "object",
        properties: {
          ids: { type: "array", items: { type: "string" } },
        },
        required: ["ids"],
      },
    },
    async execute(args, ctx) {
      const ids = (args.ids as string[]) ?? [];
      if (ids.length !== ctx.project.scenes.length) {
        return {
          ok: false,
          message: `expected ${ctx.project.scenes.length} ids, got ${ids.length}`,
        };
      }
      const byId = new Map(ctx.project.scenes.map((s) => [s.id, s]));
      const reordered: Scene[] = [];
      for (const id of ids) {
        const s = byId.get(id);
        if (!s) return { ok: false, message: `unknown id ${id}` };
        reordered.push(s);
      }
      ctx.project.scenes = reordered;
      return { ok: true, message: "reordered" };
    },
  },

  setSceneDuration: {
    schema: {
      name: "setSceneDuration",
      description: "Convenience: set a scene's duration in seconds.",
      input_schema: {
        type: "object",
        properties: {
          sceneId: { type: "string" },
          durationSec: { type: "number" },
        },
        required: ["sceneId", "durationSec"],
      },
    },
    async execute(args, ctx) {
      const id = String(args.sceneId);
      const dur = Math.max(0.5, Math.min(30, Number(args.durationSec ?? 2)));
      const idx = ctx.project.scenes.findIndex((s) => s.id === id);
      if (idx < 0) return { ok: false, message: `no scene ${id}` };
      ctx.project.scenes = ctx.project.scenes.map((s, i) =>
        i === idx ? { ...s, duration: dur } : s,
      );
      return { ok: true, message: `scene ${id} → ${dur}s` };
    },
  },

  applyStylePresetToScene: {
    schema: {
      name: "applyStylePresetToScene",
      description: `Apply a style preset to ONE scene instead of the whole project. Use for polishing a single beat. Presets: ${STYLE_PRESETS.map((p) => p.id).join(", ")}.`,
      input_schema: {
        type: "object",
        properties: {
          sceneId: { type: "string" },
          presetId: { type: "string" },
        },
        required: ["sceneId", "presetId"],
      },
    },
    async execute(args, ctx) {
      const id = String(args.sceneId);
      const preset = getPreset(String(args.presetId));
      if (!preset) return { ok: false, message: `unknown preset` };
      const idx = ctx.project.scenes.findIndex((s) => s.id === id);
      if (idx < 0) return { ok: false, message: `no scene ${id}` };
      ctx.project.scenes = ctx.project.scenes.map((s, i) =>
        i === idx ? applyPresetToScene(s, preset, i) : s,
      );
      return { ok: true, message: `${preset.name} → scene ${id}` };
    },
  },

  getRenderStatus: {
    schema: {
      name: "getRenderStatus",
      description:
        "Read the render queue. Tells you what renders are pending, running, or done. Useful when the user asks 'is it ready yet?'",
      input_schema: { type: "object", properties: {} },
    },
    async execute() {
      const jobs = listJobs();
      if (jobs.length === 0) return { ok: true, message: "render queue empty" };
      const lines = jobs.map((j) => {
        const pct = Math.round((j.progress ?? 0) * 100);
        return `${j.id.slice(0, 8)} · ${j.projectName} · ${j.presetId} · ${j.state}${
          j.state === "rendering" ? ` ${pct}%` : ""
        }`;
      });
      return { ok: true, message: lines.join("\n") };
    },
  },
};

export function listToolSchemas(): ClaudeTool[] {
  return Object.values(TOOLS).map((t) => t.schema);
}

export async function runTool(
  name: string,
  args: ToolArgs,
  ctx: ToolContext,
): Promise<ToolResult> {
  const tool = TOOLS[name];
  if (!tool) {
    return { ok: false, message: `unknown tool "${name}"` };
  }
  try {
    return await tool.execute(args, ctx);
  } catch (e) {
    return {
      ok: false,
      message: `tool ${name} threw: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
