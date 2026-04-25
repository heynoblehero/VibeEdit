import {
  type CaptionStyle,
  type ExperimentRecord,
  type Project,
  type Scene,
  type ShotPlan,
  type ShotType,
  type CameraMove,
  type AssetSource,
  type VideoTask,
  DEFAULT_CAPTION_STYLE,
  DIMENSIONS,
  createId,
} from "@/lib/scene-schema";
import type { CharacterAsset, SfxAsset } from "@/store/asset-store";
import { applyPresetToScene, getPreset, STYLE_PRESETS } from "@/lib/style-presets";
import { generateScenesFromScript } from "@/lib/generate-scenes";
import { WORKFLOWS } from "@/lib/workflows/registry";
import { getJob, listJobs, startRenderJob } from "@/lib/server/render-jobs";

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

// Quick WCAG-relative contrast check between two hex colors. Returns the
// passed `textColor` if contrast is fine, otherwise returns a high-contrast
// fallback (white or black, whichever is further). Image backgrounds are
// unpredictable so we don't try to correct against them.
function ensureLegibleTextColor(
  textColor: string | undefined,
  backgroundColor: string | undefined,
): string | undefined {
  if (!textColor || !backgroundColor) return textColor;
  const parse = (hex: string) => {
    const m = hex.replace("#", "").match(/^([0-9a-f]{6}|[0-9a-f]{3})$/i);
    if (!m) return null;
    const v = m[0].length === 3 ? m[0].split("").map((c) => c + c).join("") : m[0];
    return [
      parseInt(v.slice(0, 2), 16) / 255,
      parseInt(v.slice(2, 4), 16) / 255,
      parseInt(v.slice(4, 6), 16) / 255,
    ] as const;
  };
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  const lum = (rgb: readonly [number, number, number]) =>
    0.2126 * lin(rgb[0]) + 0.7152 * lin(rgb[1]) + 0.0722 * lin(rgb[2]);
  const fg = parse(textColor);
  const bg = parse(backgroundColor);
  if (!fg || !bg) return textColor;
  const lf = lum(fg);
  const lb = lum(bg);
  const ratio = (Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05);
  if (ratio >= 4.5) return textColor;
  return lb > 0.45 ? "#0a0a0a" : "#ffffff";
}

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
            enum: ["character_text", "text_only", "big_number", "character_pop", "montage", "split", "stat", "bullet_list", "quote"],
            description: "montage = 3-5 quick image cuts. split = side-by-side compare. stat = hero number + small label. bullet_list = checkmark list (use scene.bulletItems). quote = pull-quote with attribution. Others as before.",
          },
          bulletItems: {
            type: "array",
            items: { type: "string" },
            description: "For type=bullet_list: 2-6 short lines that animate in with a stagger.",
          },
          bulletColor: { type: "string" },
          quoteText: { type: "string", description: "For type=quote: the pulled quote." },
          quoteAttribution: { type: "string", description: "For type=quote: who said it." },
          statValue: { type: "string", description: "For type=stat: the big hero number/percentage." },
          statLabel: { type: "string", description: "For type=stat: small label below the number." },
          statColor: { type: "string" },
          shotType: {
            type: "string",
            enum: ["wide", "medium", "closeup", "ecu", "ots", "insert", "montage", "split"],
            description: "Tag the scene's intended shot type so qualityScore can count distinct types accurately.",
          },
          act: {
            type: "number",
            enum: [1, 2, 3],
            description: "Three-act tag (1=hook/setup, 2=core, 3=payoff/CTA).",
          },
          effects: {
            type: "array",
            description: "Stack of overlay primitives (animated effects + framed graphics) on top of the scene. Each: {kind, startFrame?, color?, text?, subtext?, x?, y?, w?, h?, size?, thickness?}. Kinds: circle_ping (impact ring), radial_pulse (center flash on hooks), scan_line (vertical sweep), bar_wipe (label on a horizontal bar), corner_brackets (4-corner viewfinder), reveal_box (animated rectangle border), lower_third (slide-in name+title strap).",
            items: {
              type: "object",
              properties: {
                kind: {
                  type: "string",
                  enum: ["circle_ping", "radial_pulse", "scan_line", "bar_wipe", "corner_brackets", "reveal_box", "lower_third"],
                },
                startFrame: { type: "number" },
                color: { type: "string" },
                text: { type: "string" },
                subtext: { type: "string" },
                x: { type: ["number", "string"] },
                y: { type: ["number", "string"] },
                w: { type: ["number", "string"] },
                h: { type: ["number", "string"] },
                size: { type: "number" },
                thickness: { type: "number" },
              },
              required: ["kind"],
            },
          },
          montageUrls: {
            type: "array",
            items: { type: "string" },
            description: "For type=montage: 3-5 image URLs to cut through.",
          },
          splitLeftUrl: { type: "string", description: "For type=split: left half image url." },
          splitRightUrl: { type: "string", description: "For type=split: right half image url." },
          splitDivider: { type: "string", description: "Hex color for the VS divider stripe." },
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
            enum: ["beat_flash", "beat_flash_colored", "none", "slide_left", "slide_right", "zoom_blur"],
            description: "Cut treatment. beat_flash for default rhythm cuts; slide_* for chapter starts; zoom_blur for dramatic reveals.",
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
          backgroundCameraMove: {
            type: "string",
            enum: ["still", "push_in", "pull_out", "pan_lr", "pan_rl", "tilt_up", "tilt_down", "ken_burns"],
            description: "Camera move applied to image background. Overrides kenBurns. push_in=reveals, pull_out=context, pan=landscapes/lists, tilt=vertical objects.",
          },
          backgroundColorGrade: {
            type: "string",
            enum: ["warm", "cool", "punchy", "bw", "neutral"],
            description: "Color grade for the bg image/video. warm=nostalgic, cool=tech/news, punchy=hype/commentary, bw=archival/serious, neutral=untouched.",
          },
          lensFlare: {
            type: "boolean",
            description: "Fire a soft lens-flare overlay on frame 0. Use sparingly — best on reveals, big_number scenes, or hero shots.",
          },
          lensFlareColor: { type: "string" },
          backgroundBlur: {
            type: "number",
            description: "Blur the background image/video in px (0-30). Use 6-12 behind big_number / text_only scenes for a focus-pull look.",
          },
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
        montageUrls: args.montageUrls as string[] | undefined,
        splitLeftUrl: args.splitLeftUrl as string | undefined,
        splitRightUrl: args.splitRightUrl as string | undefined,
        splitDivider: args.splitDivider as string | undefined,
        lensFlare: args.lensFlare as boolean | undefined,
        lensFlareColor: args.lensFlareColor as string | undefined,
        statValue: args.statValue as string | undefined,
        statLabel: args.statLabel as string | undefined,
        statColor: args.statColor as string | undefined,
        shotType: args.shotType as ShotType | undefined,
        act: args.act as 1 | 2 | 3 | undefined,
        bulletItems: args.bulletItems as string[] | undefined,
        bulletColor: args.bulletColor as string | undefined,
        quoteText: args.quoteText as string | undefined,
        quoteAttribution: args.quoteAttribution as string | undefined,
        effects: args.effects as Scene["effects"],
        text: args.text as string | undefined,
        emphasisText: args.emphasisText as string | undefined,
        emphasisColor: args.emphasisColor as string | undefined,
        emphasisSize: args.emphasisSize as number | undefined,
        textColor: ensureLegibleTextColor(
          args.textColor as string | undefined,
          // Only correct against solid bg — image bg legibility is handled
          // by the caption stroke + drop shadow, not by flipping textColor.
          (args.backgroundImageUrl as string | undefined)
            ? undefined
            : (args.backgroundColor as string | undefined),
        ),
        textY: args.textY as number | undefined,
        characterId: args.characterId as string | undefined,
        characterX: args.characterX as number | undefined,
        characterY: args.characterY as number | undefined,
        // Default rotation for enterFrom + transition so consecutive scenes
        // don't all swoop in from the left with the same beat-flash. Cycles
        // off scene index — predictable but varied.
        enterFrom:
          (args.enterFrom as Scene["enterFrom"]) ??
          (["bottom", "right", "scale", "left"] as const)[
            ctx.project.scenes.length % 4
          ],
        transition:
          (args.transition as Scene["transition"]) ??
          (["beat_flash", "beat_flash_colored", "none"] as const)[
            ctx.project.scenes.length % 3
          ],
        transitionColor: args.transitionColor as string | undefined,
        // Auto-zoomPunch on text_only scenes that read as emphasis beats —
        // ALL-CAPS short text or scenes flagged by emphasisText. Agent often
        // forgets to set zoomPunch even when the scene clearly wants one.
        zoomPunch: (() => {
          const explicit = args.zoomPunch as number | undefined;
          if (typeof explicit === "number") return explicit;
          const t = args.type as string | undefined;
          const text = (args.text as string | undefined) ?? "";
          const looksLikePunch =
            t === "text_only" &&
            text.length > 0 &&
            text.length <= 24 &&
            text === text.toUpperCase();
          if (looksLikePunch) return 1.15;
          if (args.emphasisText) return 1.12;
          return undefined;
        })(),
        shakeIntensity: args.shakeIntensity as number | undefined,
        numberFrom: args.numberFrom as number | undefined,
        numberTo: args.numberTo as number | undefined,
        numberColor: args.numberColor as string | undefined,
        sfxId: args.sfxId as string | undefined,
        background: {
          color: (args.backgroundColor as string | undefined) ?? "#0a0a0a",
          imageUrl: args.backgroundImageUrl as string | undefined,
          kenBurns:
            (args.backgroundKenBurns as boolean | undefined) ??
            !!args.backgroundImageUrl,
          cameraMove: (() => {
            const explicit = args.backgroundCameraMove as Scene["background"]["cameraMove"] | undefined;
            if (explicit) return explicit;
            // Auto-pick a camera move when an image bg is present so we
            // don't end up with N static-image scenes in a row. Cycle
            // through 4 templates by scene index for variety.
            if (args.backgroundImageUrl) {
              return (["push_in", "pull_out", "pan_lr", "ken_burns"] as const)[
                ctx.project.scenes.length % 4
              ];
            }
            return undefined;
          })(),
          colorGrade: args.backgroundColorGrade as Scene["background"]["colorGrade"] | undefined,
          blur: args.backgroundBlur as number | undefined,
          // Lighter vignette by default — 0.5 was crushing image bgs.
          vignette: 0.35,
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
      // Workflow-aware voice default: when caller didn't pin one, pick a
      // voice that matches the project's tone instead of the global default.
      const wfVoiceMap: Record<string, string> = {
        commentary: "openai-onyx",
        review: "openai-nova",
        faceless: "openai-fable",
        shorts: "openai-shimmer",
        "ai-animated": "openai-alloy",
      };
      const wf = ctx.project.workflowId ?? "blank";
      const voiceId = String(args.voiceId ?? args.voice ?? wfVoiceMap[wf] ?? defaultVoiceId());
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
        scene.duration = Math.max(scene.duration, data.audioDurationSec + 0.6);
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
          s.duration = Math.max(s.duration, data.audioDurationSec + 0.6);
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
          shotType: {
            type: "string",
            enum: ["wide", "medium", "closeup", "ecu", "ots", "insert"],
            description: "Frames the prompt with composition language (wide=24mm, medium=50mm, closeup=85mm, ecu=macro, ots=over-shoulder, insert=isolated object). Falls back to scene.shotType if set.",
          },
        },
        required: ["sceneId", "prompt"],
      },
    },
    async execute(args, ctx) {
      const sceneId = String(args.sceneId);
      const idx = ctx.project.scenes.findIndex((s) => s.id === sceneId);
      if (idx < 0) return { ok: false, message: `no scene with id ${sceneId}` };
      const styleHint = args.styleHint ? String(args.styleHint) : "";
      // Auto-append cinematic quality boosters so prompts don't render as
      // flat / amateur. Skipped if the user's prompt already has its own
      // style language (any of these keywords).
      const userPrompt = String(args.prompt);
      const hasOwnStyle = /cinematic|photorealistic|illustration|anime|4k|hdr|painted|studio/i.test(
        userPrompt + " " + styleHint,
      );
      const autoStyle = hasOwnStyle
        ? ""
        : ", cinematic, dramatic lighting, sharp focus, high detail, 4k";
      const prompt = `${userPrompt}${styleHint ? ` — ${styleHint}` : ""}${autoStyle}`;
      const aspectRatio: "16:9" | "9:16" =
        ctx.project.height > ctx.project.width ? "9:16" : "16:9";
      // Pull shotType off the scene if not explicitly passed.
      const sceneShot = ctx.project.scenes[idx].shotType;
      const shotType = (args.shotType as string | undefined) ?? sceneShot;
      try {
        const res = await fetch(`${ctx.origin}/api/media/image`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            modelId: args.model ? String(args.model) : undefined,
            aspectRatio,
            shotType,
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

  taskCreate: {
    schema: {
      name: "taskCreate",
      description:
        "Plan the work. Adds 1 or more tasks to the project's task list. Call this FIRST on any non-trivial objective. Each task is one concrete deliverable (e.g. 'Write 18-line script', 'Generate Pikachu image for scene 5', 'Narrate all scenes'). Mark in_progress before doing the work, completed when done. The agent CANNOT terminate the turn while tasks are still pending or in_progress.",
      input_schema: {
        type: "object",
        properties: {
          tasks: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                notes: { type: "string" },
              },
              required: ["title"],
            },
          },
        },
        required: ["tasks"],
      },
    },
    async execute(args, ctx) {
      const tasksIn = (args.tasks ?? []) as Array<{ title: string; notes?: string }>;
      const list = ctx.project.taskList ?? [];
      let nextId = list.length + 1;
      for (const t of tasksIn) {
        list.push({
          id: `t${nextId++}`,
          title: t.title,
          status: "pending",
          notes: t.notes,
        });
      }
      ctx.project.taskList = list;
      return {
        ok: true,
        message: `Added ${tasksIn.length} task${tasksIn.length === 1 ? "" : "s"}. Now: ${list.length} total (${list.filter((t) => t.status === "pending").length} pending, ${list.filter((t) => t.status === "in_progress").length} in_progress, ${list.filter((t) => t.status === "completed").length} done).`,
      };
    },
  },

  taskUpdate: {
    schema: {
      name: "taskUpdate",
      description:
        "Update a task's status / notes. Status flow: pending → in_progress → completed. Mark in_progress just before doing the work. Mark completed only when the deliverable actually exists (scenes created, images attached, narration generated, etc.).",
      input_schema: {
        type: "object",
        properties: {
          id: { type: "string" },
          status: {
            type: "string",
            enum: ["pending", "in_progress", "completed"],
          },
          notes: { type: "string" },
        },
        required: ["id"],
      },
    },
    async execute(args, ctx) {
      const id = String(args.id);
      const list = ctx.project.taskList ?? [];
      const t = list.find((x) => x.id === id);
      if (!t) {
        const known = list.map((x) => x.id).join(", ") || "(empty)";
        return {
          ok: false,
          message: `no task '${id}'. Known ids: ${known}. Use the t-prefixed id from taskCreate.`,
        };
      }
      if (args.status) t.status = String(args.status) as VideoTask["status"];
      if (typeof args.notes === "string") t.notes = String(args.notes);
      ctx.project.taskList = list;
      const open = list.filter(
        (x) => x.status === "pending" || x.status === "in_progress",
      ).length;
      return {
        ok: true,
        message: `${id} → ${t.status}. ${open} open / ${list.length} total.`,
      };
    },
  },

  taskList: {
    schema: {
      name: "taskList",
      description:
        "List the current task plan. Pending + in_progress tasks block turn termination — the route forces another round if any remain.",
      input_schema: { type: "object", properties: {} },
    },
    async execute(_args, ctx) {
      const list = ctx.project.taskList ?? [];
      if (list.length === 0)
        return {
          ok: true,
          message:
            "Task list is empty. Call taskCreate to plan the work before acting.",
        };
      const lines = list.map((t) => {
        const icon =
          t.status === "completed" ? "✓" : t.status === "in_progress" ? "→" : "·";
        return `${icon} ${t.id}: ${t.title}${t.notes ? ` — ${t.notes}` : ""}`;
      });
      return { ok: true, message: lines.join("\n") };
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
      let prompt = String(args.prompt ?? "");
      // Workflow-aware genre bias: if the agent passed a generic prompt
      // ("background music"), nudge it toward a sound that actually fits
      // the workflow instead of defaulting to a stock orchestra hit.
      const wf = ctx.project.workflowId;
      const looksGeneric = /^\s*(background|backing|music|ambient)\s*$/i.test(prompt) || prompt.length < 8;
      if (looksGeneric) {
        if (wf === "commentary") prompt = "minimal modern lo-fi beats, mellow piano, no drums spike";
        else if (wf === "review") prompt = "uplifting cinematic synth, optimistic build, clean modern";
        else if (wf === "faceless") prompt = "tense cinematic underscore, low pulsing synth, drama";
        else if (wf === "shorts" || wf === "ai-animated") prompt = "punchy upbeat electronic, hype, modern pop";
        else prompt = "modern cinematic underscore, subtle, mood-neutral";
      }
      // Auto-fit the music length to the video unless caller specified.
      // Cap at 47s (model max). Min 15s — short clips loop awkwardly.
      const totalSec = ctx.project.scenes.reduce(
        (acc, s) => acc + (s.duration ?? 2),
        0,
      );
      const autoDuration = Math.max(15, Math.min(47, Math.ceil(totalSec)));
      try {
        const res = await fetch(`${ctx.origin}/api/media/music`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            modelId: args.model ? String(args.model) : undefined,
            durationSec: args.durationSec ? Number(args.durationSec) : autoDuration,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `music failed (${res.status})`);
        ctx.project.music = {
          url: data.url,
          name: prompt.slice(0, 60),
          // Default volume 0.45 sits below narration without burying it.
          // Ducks to 0.12 when voiceover is playing.
          volume: typeof args.volume === "number" ? Number(args.volume) : 0.45,
          duckedVolume: 0.12,
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

  analyzeAssets: {
    schema: {
      name: "analyzeAssets",
      description:
        "Inventory everything currently attached to the project: characters, SFX, library uploads (images / clips / audio / docs), workflow inputs, music, and per-scene voiceover/background. Call this at the start of any non-trivial objective so you know what raw material you have before generating new media.",
      input_schema: { type: "object", properties: {} },
    },
    async execute(_args, ctx) {
      const lines: string[] = [];
      lines.push(
        `Project: "${ctx.project.name}" — ${ctx.project.scenes.length} scenes, ${ctx.project.width}x${ctx.project.height}, workflow=${ctx.project.workflowId ?? "blank"}`,
      );
      if (ctx.project.systemPrompt) {
        lines.push(`User instructions: ${ctx.project.systemPrompt.slice(0, 400)}`);
      }
      lines.push(
        `Music: ${ctx.project.music ? `attached (${ctx.project.music.name})` : "none"}`,
      );
      lines.push(
        `Characters available: ${ctx.characters.length === 0 ? "(none)" : ctx.characters.map((c) => c.id).join(", ")}`,
      );
      lines.push(
        `SFX available: ${ctx.sfx.length === 0 ? "(none)" : ctx.sfx.map((s) => s.id).join(", ")}`,
      );
      // Per-scene roll-up: who has voiceover, video bg, image bg, sfx.
      let withVoice = 0;
      let withImage = 0;
      let withVideo = 0;
      let withSfx = 0;
      for (const s of ctx.project.scenes) {
        if (s.voiceover?.audioUrl) withVoice++;
        if (s.background?.imageUrl) withImage++;
        if (s.background?.videoUrl) withVideo++;
        if (s.sceneSfxUrl || s.sfxId) withSfx++;
      }
      lines.push(
        `Scene coverage: ${withVoice}/${ctx.project.scenes.length} narrated, ${withImage} have image bg, ${withVideo} have video bg, ${withSfx} have SFX.`,
      );
      // Workflow input slots (e.g. uploaded comic panels, podcast files).
      const wi = ctx.project.workflowInputs ?? {};
      const filledSlots = Object.entries(wi)
        .filter(([, v]) => v != null && (Array.isArray(v) ? v.length > 0 : v !== ""))
        .map(([k]) => k);
      if (filledSlots.length > 0) {
        lines.push(`Workflow inputs filled: ${filledSlots.join(", ")}`);
      }
      // Chat-uploaded /uploads/ URLs already attached to scenes.
      const usedUploads = new Set<string>();
      for (const s of ctx.project.scenes) {
        if (s.background?.imageUrl?.startsWith("/uploads/"))
          usedUploads.add(s.background.imageUrl);
        if (s.background?.videoUrl?.startsWith("/uploads/"))
          usedUploads.add(s.background.videoUrl);
      }
      if (usedUploads.size > 0) {
        lines.push(`Chat uploads already placed: ${[...usedUploads].join(", ")}`);
      }
      lines.push(
        "Reminder: any /uploads/<file> URLs in the recent user messages should be set as scene.background.imageUrl/videoUrl directly — never as characterId.",
      );
      return { ok: true, message: lines.join("\n") };
    },
  },

  selfCritique: {
    schema: {
      name: "selfCritique",
      description:
        "Critique the current project against the user's objective. Returns a ranked list of issues (sceneId, severity, what's wrong, suggested fix). Use this after substantial edits, then apply the high+medium findings, then call selfCritique again. Stop when only low findings remain or after 5 critique passes.",
      input_schema: {
        type: "object",
        properties: {
          focus: {
            type: "string",
            description:
              "Optional dimension to focus on: pacing, color variety, audio coverage, narrative flow, polish, etc.",
          },
        },
      },
    },
    async execute(args, ctx) {
      if (ctx.project.scenes.length === 0) {
        return { ok: true, message: "no scenes yet — nothing to critique" };
      }
      const focus = args.focus ? String(args.focus) : "overall quality";

      // Pre-check: catch the structural problems Claude's review prompt
      // sometimes glosses over. These ALWAYS get flagged as high-severity.
      const structural: string[] = [];
      const bare = ctx.project.scenes.filter(
        (s) => !s.background?.imageUrl && !s.background?.videoUrl,
      );
      if (bare.length >= 3) {
        structural.push(
          `[high] ${bare.length} scenes have no image or video background — call generateImageForScene on them: ${bare
            .slice(0, 5)
            .map((s) => s.id)
            .join(", ")}${bare.length > 5 ? "…" : ""}`,
        );
      }
      const unnarrated = ctx.project.scenes.filter(
        (s) =>
          !s.voiceover?.audioUrl &&
          (s.text || s.emphasisText || s.subtitleText),
      );
      if (unnarrated.length >= 2) {
        structural.push(
          `[high] ${unnarrated.length} scenes with text but no voiceover — run narrateAllScenes.`,
        );
      }
      if (!ctx.project.music && ctx.project.scenes.length >= 4) {
        structural.push(
          `[medium] no backing music — call generateMusicForProject with a mood-matched prompt.`,
        );
      }

      try {
        // Sub-agent route — separate context budget, dedicated critic
        // prompt, no editing tools available to it. Returns clean JSON.
        const res = await fetch(`${ctx.origin}/api/agent/critic`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project: ctx.project,
            objective: ctx.project.systemPrompt,
            focus,
          }),
        });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`critic ${res.status}: ${text.slice(0, 200)}`);
        }
        const data = (await res.json()) as {
          findings?: Array<{
            sceneId: string;
            severity: string;
            issue: string;
            suggestion: string;
          }>;
        };
        const findings = data.findings ?? [];
        if (findings.length === 0 && structural.length === 0) {
          return {
            ok: true,
            message: "✓ self-critique pass clean — no issues found.",
          };
        }
        const summary = [
          ...structural,
          ...findings.map(
            (f, i) =>
              `${structural.length + i + 1}. [${f.severity}] scene ${f.sceneId}: ${f.issue} → ${f.suggestion}`,
          ),
        ].join("\n");
        return {
          ok: true,
          message: `${structural.length + findings.length} findings:\n${summary}`,
        };
      } catch (e) {
        return {
          ok: false,
          message: `critique failed: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    },
  },

  extractBRollKeywords: {
    schema: {
      name: "extractBRollKeywords",
      description:
        "For each scene that has narration/text, extract 1-3 visual nouns that would make good B-roll search queries (people, places, objects, actions). Returns a per-scene mapping. Use BEFORE stockSearch / generateImageForScene to ground prompts in the scene's actual content instead of asking generically.",
      input_schema: { type: "object", properties: {} },
    },
    async execute(_args, ctx) {
      const STOPWORDS = new Set([
        "the", "a", "an", "this", "that", "these", "those", "and", "or", "but",
        "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
        "do", "does", "did", "will", "would", "could", "should", "may", "might",
        "you", "your", "i", "me", "my", "we", "our", "they", "them", "their",
        "it", "its", "what", "which", "who", "when", "where", "how", "why",
        "of", "in", "on", "at", "to", "for", "with", "from", "about", "by",
        "so", "if", "then", "than", "as", "very", "really", "just", "also",
      ]);
      const out: Array<{ sceneId: string; keywords: string[] }> = [];
      for (const s of ctx.project.scenes) {
        const text = (s.voiceover?.text ?? s.text ?? s.emphasisText ?? "").trim();
        if (!text) continue;
        // Pull capitalized proper nouns first (they survive any lower-casing).
        const proper = [...text.matchAll(/\b[A-Z][a-zA-Z]{2,}/g)]
          .map((m) => m[0])
          .filter((w, i, arr) => arr.indexOf(w) === i);
        // Then non-stopword multi-letter tokens, ranked by length (longer = more concrete).
        const tokens = text
          .toLowerCase()
          .split(/[^a-z]+/)
          .filter((t) => t.length > 4 && !STOPWORDS.has(t));
        const ranked = [...new Set(tokens)].sort((a, b) => b.length - a.length);
        const keywords = [...proper, ...ranked].slice(0, 3);
        if (keywords.length > 0) out.push({ sceneId: s.id, keywords });
      }
      if (out.length === 0) return { ok: true, message: "no narration/text to extract from" };
      return {
        ok: true,
        message: out.map((o) => `${o.sceneId}: ${o.keywords.join(", ")}`).join("\n"),
      };
    },
  },

  scoreHook: {
    schema: {
      name: "scoreHook",
      description:
        "Heuristic 0-100 score for how strong scene 1 is as a hook. Checks: opens with question/contrarian/promise/numbered/POV/shock/story/quote/stat words, has a real visual asset, has zoomPunch on, and runs 3-4 seconds. Use after creating scene 1 — if score < 60, rewrite the hook before continuing.",
      input_schema: { type: "object", properties: {} },
    },
    async execute(_args, ctx) {
      const first = ctx.project.scenes[0];
      if (!first) return { ok: false, message: "no scenes yet" };
      const text = (first.text ?? first.emphasisText ?? first.voiceover?.text ?? "").trim();
      let score = 0;
      const reasons: string[] = [];
      const lower = text.toLowerCase();
      const hookPatterns: Array<{ name: string; rx: RegExp }> = [
        { name: "question", rx: /^(what|why|how|who|where|when|did|do|are|is|can|could)\b/i },
        { name: "contrarian", rx: /\b(everyone|most people|nobody)\b.*\b(wrong|miss|don't|doesn't)\b/i },
        { name: "promise", rx: /\b(by the end|i'll show|you'll learn|in \d+\s*(min|sec))\b/i },
        { name: "numbered", rx: /^\d+\s+(things|ways|reasons|tips|signs)/i },
        { name: "POV", rx: /^(you('re|'ve| are)|imagine|picture)\b/i },
        { name: "shock", rx: /\b(\$\d|\d+%|\d+x)\b/ },
        { name: "story", rx: /^(last|yesterday|when i|the day|three years ago)/i },
        { name: "quote", rx: /^['"\u2018\u201c]/ },
        { name: "stat", rx: /^\d{2,}/ },
      ];
      const matched = hookPatterns.filter((p) => p.rx.test(lower));
      if (matched.length > 0) {
        score += 35;
        reasons.push(`hook pattern: ${matched.map((m) => m.name).join("/")}`);
      } else {
        reasons.push("no recognized hook pattern in opening text");
      }
      if (first.background?.imageUrl || first.background?.videoUrl) {
        score += 25;
      } else {
        reasons.push("scene 1 has no real visual asset");
      }
      if (first.zoomPunch && first.zoomPunch >= 1.1) score += 15;
      else reasons.push("no zoomPunch — feels flat");
      if (first.duration >= 3 && first.duration <= 4) score += 15;
      else reasons.push(`duration ${first.duration}s out of 3-4s sweet spot`);
      if (text.length > 0 && text.length <= 80) score += 10;
      else reasons.push(`hook text length ${text.length} chars (target ≤80)`);
      const verdict = score >= 80 ? "✓ strong hook" : score >= 60 ? "⚠ usable but could be sharper" : "✗ weak hook — rewrite";
      return {
        ok: true,
        message: `hook score ${score}/100 — ${verdict}\n${reasons.map((r) => `  · ${r}`).join("\n")}`,
      };
    },
  },

  lintScript: {
    schema: {
      name: "lintScript",
      description:
        "Critique the narration text across all scenes for filler words, jargon, weak verbs, and run-ons. Returns a per-scene list of issues + concrete rewrite suggestions. Heuristic only (no model call) — fast, deterministic. Use after generating a script and before narration.",
      input_schema: { type: "object", properties: {} },
    },
    async execute(_args, ctx) {
      // Project-level cadence: long-short-long sentence variance reads
      // as professional copy. Compute std-dev of sentence lengths across
      // ALL narration combined and warn if it's too monotone.
      const allSentences: number[] = [];
      for (const s of ctx.project.scenes) {
        const text = (s.voiceover?.text ?? s.text ?? "").trim();
        if (!text) continue;
        for (const sen of text.split(/[.!?]+/).filter((x) => x.trim())) {
          allSentences.push(sen.split(/\s+/).filter(Boolean).length);
        }
      }
      const projectFindings: string[] = [];
      if (allSentences.length >= 4) {
        const mean = allSentences.reduce((a, b) => a + b, 0) / allSentences.length;
        const variance = allSentences.reduce((a, n) => a + (n - mean) ** 2, 0) / allSentences.length;
        const stddev = Math.sqrt(variance);
        if (stddev < 3) {
          projectFindings.push(
            `cadence: every sentence is ~${mean.toFixed(0)} words (std-dev ${stddev.toFixed(1)}). Mix in some 4-6 word punches.`,
          );
        }
      }
      const FILLER = ["really", "very", "just", "kind of", "sort of", "basically", "actually", "literally", "honestly", "you know", "i mean"];
      const WEAK_VERBS = ["got", "get", "make", "do", "have", "be", "go", "come"];
      const findings: string[] = [];
      for (const s of ctx.project.scenes) {
        const text = (s.voiceover?.text ?? s.text ?? "").trim();
        if (!text) continue;
        const lower = ` ${text.toLowerCase()} `;
        const fillerHits = FILLER.filter((f) => lower.includes(` ${f} `));
        const weakHits = WEAK_VERBS.filter((v) => new RegExp(`\\b${v}\\b`, "i").test(text));
        const wordCount = text.split(/\s+/).filter(Boolean).length;
        const sentences = text.split(/[.!?]+/).filter((x) => x.trim());
        const longRuns = sentences.filter((sen) => sen.split(/\s+/).length > 28);
        const issues: string[] = [];
        if (fillerHits.length > 0) issues.push(`filler: ${fillerHits.join(", ")}`);
        if (weakHits.length > 2) issues.push(`weak verbs: ${weakHits.join(", ")}`);
        if (longRuns.length > 0) issues.push(`${longRuns.length} run-on sentence${longRuns.length === 1 ? "" : "s"} (>28 words)`);
        if (wordCount > 60 && (s.duration ?? 2) < 6) issues.push(`${wordCount} words in ${s.duration}s — too dense, viewer can't keep up`);
        if (wordCount === 0 && s.duration > 1.5) issues.push(`silent ${s.duration}s — add narration or shorten`);
        if (issues.length > 0) findings.push(`${s.id}: ${issues.join("; ")}`);
      }
      const all = [...projectFindings, ...findings];
      if (all.length === 0) return { ok: true, message: "✓ script lint clean — no filler / weak verbs / run-ons / monotone cadence." };
      return { ok: true, message: `${all.length} script issues:\n${all.map((f, i) => `${i + 1}. ${f}`).join("\n")}` };
    },
  },

  videoQualityScore: {
    schema: {
      name: "videoQualityScore",
      description:
        "Compute a single 0-100 score for the current project. Combines: shot variety, audio coverage, pacing variance, hook strength, asset relevance, structural completeness, narrative spine adherence. Use as a hard gate — if score < 75, keep iterating with selfCritique → fixes. Idempotent / read-only.",
      input_schema: { type: "object", properties: {} },
    },
    async execute(_args, ctx) {
      const scenes = ctx.project.scenes;
      if (scenes.length === 0) {
        ctx.project.qualityScore = 0;
        return { ok: true, message: "score: 0 / 100 (empty project)" };
      }

      const totalSec = scenes.reduce((acc, s) => acc + (s.duration ?? 2), 0);
      // Component 1: structural completeness (30 pts)
      const haveVisuals = scenes.filter(
        (s) => s.background?.imageUrl || s.background?.videoUrl,
      ).length;
      const haveNarration = scenes.filter((s) => s.voiceover?.audioUrl).length;
      const visualsRatio = haveVisuals / scenes.length;
      const narrRatio = haveNarration / scenes.length;
      const hasMusic = ctx.project.music ? 1 : 0;
      const structural =
        Math.round(visualsRatio * 12) +
        Math.round(narrRatio * 12) +
        hasMusic * 6;

      // Component 2: pacing variance (15 pts) — std-dev of durations
      const mean = totalSec / scenes.length;
      const variance =
        scenes.reduce((a, s) => a + ((s.duration ?? 2) - mean) ** 2, 0) /
        scenes.length;
      const stddev = Math.sqrt(variance);
      const pacing = Math.min(15, Math.round(stddev * 8));

      // Component 3: scene density (10 pts) — ≥1 cut per 3.5s
      const idealCount = Math.max(6, Math.floor(totalSec / 3.5));
      const density = Math.min(10, Math.round((scenes.length / idealCount) * 10));

      // Component 4: shot-type variety (10 pts) — count unique shotTypes
      // across the actual scenes (preferred) and fall back to shotList.
      const sceneTypes = new Set(scenes.map((s) => s.shotType).filter(Boolean));
      const planTypes = new Set((ctx.project.shotList ?? []).map((p) => p.shotType));
      const types = sceneTypes.size > 0 ? sceneTypes : planTypes;
      const variety = Math.min(10, types.size * 2);

      // Component 5: hook quality (10 pts) — first scene must have visual + short text or zoomPunch
      const first = scenes[0];
      let hook = 0;
      if (first) {
        if (first.background?.imageUrl || first.background?.videoUrl) hook += 4;
        if (first.zoomPunch && first.zoomPunch >= 1.1) hook += 3;
        if (first.duration <= 4 && (first.text?.length ?? 0) <= 60) hook += 3;
      }

      // Component 6: SFX presence (5 pts)
      const sfx = scenes.some((s) => s.sfxId || s.sceneSfxUrl) ? 5 : 0;

      // Component 7: spine commitment (10 pts)
      const spine = ctx.project.spine ? 10 : 0;

      // Component 8: caption coverage (10 pts) — narrated scenes with captions
      const captioned = scenes.filter(
        (s) => s.voiceover?.captions && s.voiceover.captions.length > 0,
      ).length;
      const cap = Math.round((captioned / Math.max(1, scenes.length)) * 10);

      const score = Math.min(
        100,
        structural + pacing + density + variety + hook + sfx + spine + cap,
      );
      ctx.project.qualityScore = score;
      const breakdown = [
        `structural=${structural}/30`,
        `pacing=${pacing}/15`,
        `density=${density}/10`,
        `shot-variety=${variety}/10`,
        `hook=${hook}/10`,
        `sfx=${sfx}/5`,
        `spine=${spine}/10`,
        `captions=${cap}/10`,
      ].join(" · ");
      const verdict =
        score >= 85
          ? "✓ ship-quality"
          : score >= 75
            ? "✓ acceptable — minor polish welcome"
            : score >= 60
              ? "⚠ keep iterating — call selfCritique + fix top issues"
              : "✗ structural gaps — focus on visuals/narration/music first";
      return { ok: true, message: `score: ${score}/100 — ${verdict}\n${breakdown}` };
    },
  },

  listAvailableModels: {
    schema: {
      name: "listAvailableModels",
      description:
        "List the catalog of image / video / voice / music / sfx models. Use when the user asks 'what models can you use' or you want to suggest a swap.",
      input_schema: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["image", "video", "voice", "music", "sfx", "all"],
          },
        },
      },
    },
    async execute(args) {
      const kind = String(args.kind ?? "all");
      const { listMediaModels } = await import(
        "@/lib/server/media-providers/models"
      );
      const { VOICES } = await import("@/lib/server/voice-providers/models");
      const { AUDIO_MODELS } = await import("@/lib/server/audio-providers/models");
      const lines: string[] = [];
      for (const m of listMediaModels()) {
        if (kind === "all" || m.kind === kind) {
          lines.push(`${m.id} [${m.kind}] $${m.estimatedCostUsd} — ${m.tags.join(",")}`);
        }
      }
      if (kind === "all" || kind === "voice") {
        for (const v of VOICES) {
          lines.push(`${v.id} [voice] $${v.costPer1kChars}/1k — ${v.tags.join(",")}`);
        }
      }
      for (const a of AUDIO_MODELS) {
        if (kind === "all" || a.kind === kind) {
          lines.push(`${a.id} [${a.kind}] $${a.estimatedCostUsd} — ${a.tags.join(",")}`);
        }
      }
      return { ok: true, message: lines.join("\n") };
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

  planVideo: {
    schema: {
      name: "planVideo",
      description:
        "Author the structured shot list BEFORE creating any scenes or generating any media. Returns nothing useful — its purpose is to force you to plan in one place. Each shot specifies: act (1/2/3), beat (one-line description), shotType (wide/medium/closeup/ecu/ots/insert/montage/split), cameraMove (still/push_in/pull_out/pan_lr/pan_rl/tilt_up/tilt_down/ken_burns), durationHint (seconds), assetDecision (user_upload/ai_generated/stock/research_url/library), assetTarget (filename/url/prompt). Plan once, then execute. Replan only if the brief changes.",
      input_schema: {
        type: "object",
        properties: {
          shots: {
            type: "array",
            items: {
              type: "object",
              properties: {
                act: { type: "number", enum: [1, 2, 3] },
                beat: { type: "string" },
                shotType: {
                  type: "string",
                  enum: ["wide", "medium", "closeup", "ecu", "ots", "insert", "montage", "split"],
                },
                cameraMove: {
                  type: "string",
                  enum: ["still", "push_in", "pull_out", "pan_lr", "pan_rl", "tilt_up", "tilt_down", "ken_burns"],
                },
                durationHint: { type: "number" },
                assetDecision: {
                  type: "string",
                  enum: ["user_upload", "ai_generated", "stock", "research_url", "library"],
                },
                assetTarget: { type: "string" },
                text: { type: "string" },
              },
              required: ["act", "beat", "shotType", "durationHint", "assetDecision"],
            },
          },
        },
        required: ["shots"],
      },
    },
    async execute(args, ctx) {
      const raw = args.shots as Array<Record<string, unknown>> | undefined;
      if (!raw || raw.length === 0) return { ok: false, message: "shots required" };
      const plan: ShotPlan[] = raw.map((s, i) => ({
        index: i,
        act: (s.act as 1 | 2 | 3) ?? 2,
        beat: String(s.beat ?? ""),
        shotType: (s.shotType as ShotType) ?? "medium",
        cameraMove: (s.cameraMove as CameraMove) ?? "still",
        durationHint: Number(s.durationHint ?? 2.5),
        assetDecision: (s.assetDecision as AssetSource) ?? "ai_generated",
        assetTarget: s.assetTarget ? String(s.assetTarget) : undefined,
        text: s.text ? String(s.text) : undefined,
      }));
      // Sanity-check three-act distribution.
      const total = plan.reduce((acc, p) => acc + p.durationHint, 0);
      const act1 = plan.filter((p) => p.act === 1).reduce((a, p) => a + p.durationHint, 0);
      const act3 = plan.filter((p) => p.act === 3).reduce((a, p) => a + p.durationHint, 0);
      const warn: string[] = [];
      if (total > 0 && act1 / total > 0.3) warn.push("act 1 too long (>30%)");
      if (total > 0 && act3 / total < 0.1) warn.push("act 3 too short (<10%)");
      ctx.project.shotList = plan;
      return {
        ok: true,
        message:
          `shot list saved (${plan.length} shots, ${total.toFixed(1)}s total)` +
          (warn.length > 0 ? `\nwarn: ${warn.join("; ")}` : ""),
      };
    },
  },

  writeNarrativeSpine: {
    schema: {
      name: "writeNarrativeSpine",
      description:
        "Pin a one-line narrative arc to the project: the promise, stakes, and reveal/payoff. Every scene you create afterward MUST advance one of these three. Call this once at the start, before planVideo.",
      input_schema: {
        type: "object",
        properties: {
          promise: { type: "string", description: "What the viewer will get if they keep watching." },
          stakes: { type: "string", description: "Why it matters / what's at risk / what changes." },
          reveal: { type: "string", description: "The payoff or punch the video lands on." },
        },
        required: ["promise", "stakes", "reveal"],
      },
    },
    async execute(args, ctx) {
      const promise = String(args.promise ?? "").trim();
      const stakes = String(args.stakes ?? "").trim();
      const reveal = String(args.reveal ?? "").trim();
      if (!promise || !stakes || !reveal)
        return { ok: false, message: "promise / stakes / reveal all required" };
      ctx.project.spine = `${promise} → ${stakes} → ${reveal}`;
      return { ok: true, message: `spine: ${ctx.project.spine}` };
    },
  },

  spawnSubAgent: {
    schema: {
      name: "spawnSubAgent",
      description:
        "Run a focused sub-task in an ISOLATED Claude context with NO editing tools. Use roles: 'director' (returns a structured shot list given the brief — call this if planVideo feels overwhelming), 'reviewer' (reads the current project state + experiment log and returns a prioritized fix list, more thorough than selfCritique), or 'researcher' (deep web research on a single subject). The sub-agent's output is plain text. Use it for parallel/specialized work that would pollute the main agent's context.",
      input_schema: {
        type: "object",
        properties: {
          role: {
            type: "string",
            enum: ["director", "reviewer", "researcher"],
          },
          brief: {
            type: "string",
            description: "What you want the sub-agent to do, in 1-3 sentences.",
          },
        },
        required: ["role", "brief"],
      },
    },
    async execute(args, ctx) {
      const role = String(args.role ?? "");
      const brief = String(args.brief ?? "").trim();
      if (!brief) return { ok: false, message: "brief required" };

      const promptByRole: Record<string, string> = {
        director:
          "You are a senior video director. Read the brief and return a JSON-style shot list: [{act:1|2|3, beat:string, shotType:string, cameraMove:string, durationHint:number, assetDecision:string, text:string}]. Mix shot types; vary durations; commit to a 3-act structure. Be specific. No prose around the JSON — just the array.",
        reviewer:
          "You are a brutal video reviewer. Read the project state + experiment log + spine. Return a numbered list of the top 5 issues holding the video back, each tagged [high|medium|low] and paired with one concrete fix the agent should call (tool name + args). No fluff.",
        researcher:
          "You are a research analyst. Given a topic, return: 5 concrete visual references (real-world descriptions, not URLs), 3 surprising facts, 1 contrarian angle. Markdown. Under 300 words.",
      };
      const sysPrompt = promptByRole[role];
      if (!sysPrompt) return { ok: false, message: `unknown role "${role}"` };

      const projectSummary = summarizeProject(ctx.project);
      const spine = ctx.project.spine ? `Spine: ${ctx.project.spine}\n` : "";
      const expLog = (ctx.project.experiments ?? []).slice(-10).map(
        (e) => `- ${e.kind} via ${e.decision} ${e.kept ? "kept" : "discarded"}${e.note ? `: ${e.note}` : ""}`,
      ).join("\n");

      const userMsg =
        `Brief: ${brief}\n\n` +
        spine +
        `Current project:\n${projectSummary}\n\n` +
        (expLog ? `Recent experiments:\n${expLog}\n\n` : "") +
        (role === "researcher" || role === "director"
          ? ""
          : `Research notes (excerpt):\n${(ctx.project.researchNotes ?? "").slice(-1500)}\n`);

      try {
        const { callClaude } = await import("@/lib/server/claude-bridge");
        const data = await callClaude(
          {
            model: "claude-sonnet-4-5",
            max_tokens: 1500,
            system: [{ type: "text", text: sysPrompt }],
            messages: [{ role: "user", content: userMsg }],
          },
          `subagent-${role}`,
        );
        const text = data.content.map((b) => b.text ?? "").join("\n").trim();
        return { ok: true, message: `[${role}]\n${text || "(empty response)"}` };
      } catch (e) {
        return {
          ok: false,
          message: `sub-agent failed: ${e instanceof Error ? e.message : String(e)}`,
        };
      }
    },
  },

  watchRenderedVideo: {
    schema: {
      name: "watchRenderedVideo",
      description:
        "After a render completes, sample N frames evenly across the output and run ffprobe for audio levels. Returns a structured per-frame summary (timestamp + filesize) plus audio peak/mean dB so the agent can decide what to fix. Inspired by the claude-video-vision plugin pattern: render, then 'watch' the output before claiming done. Pass the render job id from getRenderStatus or the latest done job is auto-picked.",
      input_schema: {
        type: "object",
        properties: {
          jobId: { type: "string", description: "Render job id. Omit to use the most recent done job." },
          frames: { type: "number", description: "How many frames to sample (3-10). Default 6." },
        },
      },
    },
    async execute(args, ctx) {
      const { spawn } = await import("node:child_process");
      const fs = await import("node:fs");
      const os = await import("node:os");
      const path = await import("node:path");
      const allJobs = listJobs();
      const targetId = args.jobId
        ? String(args.jobId)
        : [...allJobs].reverse().find((j) => j.state === "done")?.id;
      if (!targetId) return { ok: false, message: "no completed render job found — render first." };
      const job = getJob(targetId);
      if (!job) return { ok: false, message: `unknown job ${targetId}` };
      if (!job.outputPath || !fs.existsSync(job.outputPath))
        return { ok: false, message: `output missing for job ${job.id}` };

      const n = Math.max(3, Math.min(10, Number(args.frames ?? 6)));
      // Probe duration first.
      const dur: number = await new Promise((resolve) => {
        const p = spawn("ffprobe", [
          "-v", "error",
          "-show_entries", "format=duration",
          "-of", "default=noprint_wrappers=1:nokey=1",
          job.outputPath!,
        ]);
        let out = "";
        p.stdout.on("data", (c) => (out += c.toString()));
        p.on("close", () => resolve(parseFloat(out.trim()) || 0));
      });
      if (dur <= 0) return { ok: false, message: "ffprobe couldn't read duration" };

      // Sample frame metadata (we don't return base64 images here — too
      // heavy for the SSE channel; we report timing + size so the agent
      // knows roughly where the cuts are. The full frame extraction lands
      // in a follow-up commit if/when we wire vision into the loop).
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `vibeedit-watch-`));
      const frames: Array<{ t: number; size: number; path: string }> = [];
      for (let i = 0; i < n; i++) {
        const t = Number(((i + 0.5) * dur / n).toFixed(2));
        const out = path.join(tmpDir, `f${i}.jpg`);
        await new Promise<void>((resolve) => {
          const p = spawn("ffmpeg", [
            "-y", "-ss", String(t), "-i", job.outputPath!,
            "-frames:v", "1", "-q:v", "4", out,
          ]);
          p.on("close", () => resolve());
        });
        try {
          const stat = fs.statSync(out);
          frames.push({ t, size: stat.size, path: out });
        } catch {
          // frame extraction failed
        }
      }

      // Audio level probe.
      const audio: { peak: number; mean: number } | null = await new Promise(
        (resolve) => {
          const p = spawn("ffmpeg", [
            "-i", job.outputPath!,
            "-af", "volumedetect",
            "-vn", "-sn", "-dn",
            "-f", "null", "-",
          ]);
          let stderr = "";
          p.stderr.on("data", (c) => (stderr += c.toString()));
          p.on("close", () => {
            const peak = parseFloat(stderr.match(/max_volume:\s*(-?\d+(\.\d+)?)/)?.[1] ?? "");
            const mean = parseFloat(stderr.match(/mean_volume:\s*(-?\d+(\.\d+)?)/)?.[1] ?? "");
            if (!isFinite(peak) || !isFinite(mean)) resolve(null);
            else resolve({ peak, mean });
          });
        },
      );

      const audioLine = audio
        ? `audio: peak=${audio.peak}dB, mean=${audio.mean}dB ` +
          (audio.peak > -1 ? "⚠ clipping risk" : audio.mean < -30 ? "⚠ too quiet" : "✓ in range")
        : "audio: probe failed";

      // Persist a record so the agent can readExperimentLog and see this.
      ctx.project.experiments = [
        ...(ctx.project.experiments ?? []),
        {
          ts: Date.now(),
          kind: "image",
          decision: "ai_generated",
          kept: true,
          note: `watch dur=${dur.toFixed(1)}s frames=${frames.length} ${audioLine}`,
        },
      ];

      return {
        ok: true,
        message:
          `watched job ${job.id.slice(0, 8)} — ${dur.toFixed(1)}s, ${frames.length} frames sampled\n` +
          frames.map((f) => `  · t=${f.t}s — ${(f.size / 1024).toFixed(0)}KB`).join("\n") +
          `\n${audioLine}`,
      };
    },
  },

  readExperimentLog: {
    schema: {
      name: "readExperimentLog",
      description:
        "Read the project's append-only log of asset decisions: which images / videos / music / SFX were tried, which won, which got discarded. Use this when you're about to make a similar decision and want to avoid repeating a mistake. Returns at most the last 30 records.",
      input_schema: {
        type: "object",
        properties: {
          kind: {
            type: "string",
            enum: ["image", "video", "music", "sfx", "asset_route"],
            description: "Filter by record kind. Omit to see all.",
          },
        },
      },
    },
    async execute(args, ctx) {
      const log = ctx.project.experiments ?? [];
      const kind = args.kind ? String(args.kind) : null;
      const filtered = kind ? log.filter((r) => r.kind === kind) : log;
      const recent = filtered.slice(-30);
      if (recent.length === 0) {
        return { ok: true, message: "experiment log empty — nothing tried yet." };
      }
      const lines = recent.map((r, i) => {
        const when = new Date(r.ts).toISOString().slice(11, 19);
        const flag = r.kept ? "✓" : "✗";
        return `${i + 1}. [${when}] ${flag} ${r.kind} via ${r.decision}` +
          (r.prompt ? ` — "${r.prompt.slice(0, 60)}${r.prompt.length > 60 ? "…" : ""}"` : "") +
          (r.score !== undefined ? ` (score=${r.score})` : "") +
          (r.note ? ` — ${r.note}` : "");
      });
      return { ok: true, message: lines.join("\n") };
    },
  },

  scoreAssetForScene: {
    schema: {
      name: "scoreAssetForScene",
      description:
        "Quick heuristic relevance score (0-1) for whether a given asset URL or filename fits a scene description. Returns the score plus a one-line rationale. Use BEFORE attaching uploaded assets to scenes — only attach if score ≥ 0.6, otherwise generate fresh. Heuristic-only (token overlap + image-extension check). Cheap, deterministic, runs in <1ms.",
      input_schema: {
        type: "object",
        properties: {
          assetUrl: { type: "string" },
          assetName: { type: "string", description: "Filename or display name." },
          sceneDescription: { type: "string" },
        },
        required: ["sceneDescription"],
      },
    },
    async execute(args) {
      const desc = String(args.sceneDescription ?? "").toLowerCase();
      const url = String(args.assetUrl ?? "").toLowerCase();
      const name = String(args.assetName ?? "").toLowerCase();
      const haystack = `${url} ${name}`;
      if (!desc) return { ok: false, message: "sceneDescription required" };
      const tokens = desc
        .split(/\s+/)
        .map((t) => t.replace(/[^a-z0-9]/g, ""))
        .filter((t) => t.length > 3);
      if (tokens.length === 0) return { ok: true, message: "score=0.5 — description too short to evaluate" };
      const hits = tokens.filter((t) => haystack.includes(t)).length;
      const ratio = hits / tokens.length;
      const isImage = /\.(jpg|jpeg|png|webp|gif|avif)(\?|$)/.test(haystack);
      const isVideo = /\.(mp4|webm|mov)(\?|$)/.test(haystack);
      let score = ratio;
      if (!isImage && !isVideo) score *= 0.7;
      score = Math.max(0, Math.min(1, Number(score.toFixed(2))));
      const verdict =
        score >= 0.6
          ? "use it"
          : score >= 0.3
            ? "maybe — also generate a fresh fallback"
            : "skip — generate fresh";
      return {
        ok: true,
        message: `score=${score} (${hits}/${tokens.length} tokens hit) — ${verdict}`,
      };
    },
  },

  stockSearch: {
    schema: {
      name: "stockSearch",
      description:
        "Search free stock photo libraries (Pexels) for a query. Returns up to 8 candidate URLs you can plug straight into scene.background.imageUrl. Cheaper than AI gen and looks more authentic for real-world subjects (food, places, products, people doing things). Requires PEXELS_API_KEY set on server. Falls back to Pollinations search if missing.",
      input_schema: {
        type: "object",
        properties: {
          query: { type: "string", description: "What to search for. Be specific: 'sunrise over mountains' beats 'nature'." },
          orientation: {
            type: "string",
            enum: ["landscape", "portrait", "square"],
            description: "Match the project orientation. Default landscape.",
          },
          limit: { type: "number", description: "1-8, default 6." },
        },
        required: ["query"],
      },
    },
    async execute(args, ctx) {
      const query = String(args.query ?? "").trim();
      if (!query) return { ok: false, message: "query required" };
      const orientation = String(args.orientation ?? "landscape");
      const limit = Math.max(1, Math.min(8, Number(args.limit ?? 6)));
      const pexelsKey = process.env.PEXELS_API_KEY;
      const results: Array<{ url: string; src: string; w: number; h: number; photographer?: string }> = [];

      if (pexelsKey) {
        try {
          const res = await fetch(
            `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${limit}&orientation=${orientation}`,
            { headers: { Authorization: pexelsKey } },
          );
          if (res.ok) {
            const data = (await res.json()) as {
              photos?: Array<{
                src: { large2x: string; large: string; original: string };
                url: string;
                width: number;
                height: number;
                photographer?: string;
              }>;
            };
            for (const p of data.photos ?? []) {
              results.push({
                url: p.src.large2x ?? p.src.large ?? p.src.original,
                src: p.url,
                w: p.width,
                h: p.height,
                photographer: p.photographer,
              });
            }
          }
        } catch {
          // network — fall through to fallback
        }
      }

      // Fallback: synthesize via Pollinations so the agent always gets
      // something usable. Lower quality than real stock, but keyless.
      if (results.length === 0) {
        const w = orientation === "portrait" ? 1080 : orientation === "square" ? 1024 : 1920;
        const h = orientation === "portrait" ? 1920 : orientation === "square" ? 1024 : 1080;
        for (let i = 0; i < Math.min(limit, 3); i++) {
          const seed = Math.floor(Math.random() * 1_000_000);
          results.push({
            url: `https://image.pollinations.ai/prompt/${encodeURIComponent(query + ", documentary photography, no text, no watermark")}?width=${w}&height=${h}&nologo=true&model=flux&seed=${seed}`,
            src: "pollinations",
            w,
            h,
          });
        }
      }

      // Log so we can see which URLs the agent considered.
      ctx.project.experiments = [
        ...(ctx.project.experiments ?? []),
        ...results.map((r) => ({
          ts: Date.now(),
          kind: "image" as const,
          decision: "stock" as AssetSource,
          prompt: query,
          url: r.url,
          kept: false,
        })),
      ];

      return {
        ok: true,
        message:
          `${results.length} stock results for "${query}":\n` +
          results
            .map((r, i) => `${i + 1}. ${r.url}${r.photographer ? `  — © ${r.photographer}` : ""}`)
            .join("\n"),
      };
    },
  },

  prepareUploadForScene: {
    schema: {
      name: "prepareUploadForScene",
      description:
        "One-shot variant pipeline for an uploaded asset: takes an upload URL + the scene's needs (orientation, role) and produces the right variant. Internally calls smartCropAsset (when AR mismatches) and/or removeBackground (when role='character_portrait'). Returns the final URL the agent should set as scene.background.imageUrl. Saves a round-trip vs calling each tool separately.",
      input_schema: {
        type: "object",
        properties: {
          sourceUrl: { type: "string" },
          role: {
            type: "string",
            enum: ["bg_full", "character_portrait", "product_hero", "insert"],
            description: "What the asset is being used for. Drives which edits run.",
          },
          targetRatio: {
            type: "string",
            enum: ["9:16", "16:9", "1:1"],
            description: "Default = project orientation if omitted.",
          },
        },
        required: ["sourceUrl", "role"],
      },
    },
    async execute(args, ctx) {
      const sourceUrl = String(args.sourceUrl);
      const role = String(args.role);
      const projectRatio: "9:16" | "16:9" =
        ctx.project.height > ctx.project.width ? "9:16" : "16:9";
      const ratio = (args.targetRatio as "9:16" | "16:9" | "1:1") ?? projectRatio;
      let currentUrl = sourceUrl;
      const steps: string[] = [];

      // Step 1: bg removal for character/product hero shots.
      if (role === "character_portrait" || role === "product_hero") {
        try {
          const res = await fetch(`${ctx.origin}/api/uploads/edits/remove-bg`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sourceUrl: currentUrl }),
          });
          const data = await res.json();
          if (res.ok && data.url) {
            currentUrl = data.url;
            steps.push("bg removed");
          } else {
            steps.push(`bg-remove skipped: ${data.error ?? res.status}`);
          }
        } catch (e) {
          steps.push(`bg-remove failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      // Step 2: smart crop to target AR for full-bleed roles.
      if (role === "bg_full" || role === "insert") {
        try {
          const res = await fetch(`${ctx.origin}/api/uploads/edits/crop`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sourceUrl: currentUrl, ratio, strategy: "smart" }),
          });
          const data = await res.json();
          if (res.ok && data.url) {
            currentUrl = data.url;
            steps.push(`cropped ${ratio}`);
          } else {
            steps.push(`crop skipped: ${data.error ?? res.status}`);
          }
        } catch (e) {
          steps.push(`crop failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      ctx.project.experiments = [
        ...(ctx.project.experiments ?? []),
        {
          ts: Date.now(),
          kind: "image",
          decision: "user_upload",
          prompt: `prepare role=${role}`,
          url: currentUrl,
          kept: true,
          note: steps.join(" → "),
        },
      ];

      return {
        ok: true,
        message: `prepared → ${currentUrl}\nsteps: ${steps.length > 0 ? steps.join(" → ") : "(none — source already fits)"}`,
      };
    },
  },

  removeBackground: {
    schema: {
      name: "removeBackground",
      description:
        "Strip the background from a portrait or product image and return a transparent-PNG variant. Uses Replicate cjwbw/rembg (~$0.001 per image). Use on uploaded character portraits before placing them as scene.background.imageUrl with a colored backdrop, or for product hero shots.",
      input_schema: {
        type: "object",
        properties: { sourceUrl: { type: "string" } },
        required: ["sourceUrl"],
      },
    },
    async execute(args, ctx) {
      try {
        const res = await fetch(`${ctx.origin}/api/uploads/edits/remove-bg`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sourceUrl: String(args.sourceUrl) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `remove-bg failed (${res.status})`);
        ctx.project.experiments = [
          ...(ctx.project.experiments ?? []),
          {
            ts: Date.now(),
            kind: "image",
            decision: "user_upload",
            prompt: "remove-bg",
            url: data.url,
            kept: true,
          },
        ];
        return { ok: true, message: `bg removed → ${data.url}` };
      } catch (e) {
        return { ok: false, message: `remove-bg failed: ${e instanceof Error ? e.message : String(e)}` };
      }
    },
  },

  smartCropAsset: {
    schema: {
      name: "smartCropAsset",
      description:
        "Crop an uploaded or remote image to the project's aspect ratio using sharp's attention-based saliency detection. Returns a new URL to the cropped variant. Use when an upload's AR doesn't match the project orientation (e.g. user dropped a 16:9 photo into a 9:16 short).",
      input_schema: {
        type: "object",
        properties: {
          sourceUrl: { type: "string" },
          ratio: { type: "string", enum: ["9:16", "16:9", "1:1"] },
          strategy: { type: "string", enum: ["smart", "center"] },
        },
        required: ["sourceUrl", "ratio"],
      },
    },
    async execute(args, ctx) {
      try {
        const res = await fetch(`${ctx.origin}/api/uploads/edits/crop`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceUrl: String(args.sourceUrl),
            ratio: String(args.ratio),
            strategy: args.strategy ? String(args.strategy) : "smart",
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? `crop failed (${res.status})`);
        ctx.project.experiments = [
          ...(ctx.project.experiments ?? []),
          {
            ts: Date.now(),
            kind: "image",
            decision: "user_upload",
            prompt: `crop ${args.ratio} ${args.strategy ?? "smart"}`,
            url: data.url,
            kept: true,
            note: `${data.width}×${data.height}`,
          },
        ];
        return { ok: true, message: `cropped → ${data.url} (${data.width}×${data.height})` };
      } catch (e) {
        return { ok: false, message: `crop failed: ${e instanceof Error ? e.message : String(e)}` };
      }
    },
  },

  routeAsset: {
    schema: {
      name: "routeAsset",
      description:
        "Decide where the visual for a given scene should come from. Returns a single decision: user_upload (use a file the user already gave us), ai_generated (call generateImageForScene), stock (call stockSearch), research_url (use a URL from researchNotes). Call this BEFORE you start generating images so we don't burn API budget when the user already uploaded the right asset. Does NOT mutate scenes — just decides.",
      input_schema: {
        type: "object",
        properties: {
          sceneDescription: {
            type: "string",
            description: "What this scene is about — semantically, not visually. e.g. 'pikachu using thunderbolt' or 'modern coffee shop interior'.",
          },
          preferUserUpload: {
            type: "boolean",
            description: "If true and the user has uploaded matching content, prefer it. Default true.",
          },
        },
        required: ["sceneDescription"],
      },
    },
    async execute(args, ctx) {
      const desc = String(args.sceneDescription ?? "").trim().toLowerCase();
      if (!desc) return { ok: false, message: "sceneDescription required" };
      const prefer = args.preferUserUpload !== false;

      // 1. Check uploaded characters/sfx-style assets that the route filtered.
      const uploadHits: string[] = [];
      for (const c of ctx.characters) {
        const haystack = `${c.id} ${c.name ?? ""}`.toLowerCase();
        if (
          desc
            .split(/\s+/)
            .filter((t) => t.length > 3)
            .some((tok) => haystack.includes(tok))
        ) {
          uploadHits.push(`${c.id} (${c.name ?? "?"})`);
        }
      }

      // 2. Check researchNotes for URL hits.
      const notes = ctx.project.researchNotes ?? "";
      const urlMatches: string[] = [];
      const urlRe = /https?:\/\/[^\s)]+/g;
      const allUrls = notes.match(urlRe) ?? [];
      // Cheap relevance: any URL whose surrounding 80 chars contains a desc keyword.
      const tokens = desc.split(/\s+/).filter((t) => t.length > 3);
      for (const u of allUrls) {
        const i = notes.indexOf(u);
        const window = notes.slice(Math.max(0, i - 80), i + u.length + 80).toLowerCase();
        if (tokens.some((t) => window.includes(t))) urlMatches.push(u);
      }

      let decision: AssetSource;
      let target = "";
      let reason = "";
      if (prefer && uploadHits.length > 0) {
        decision = "user_upload";
        target = uploadHits[0];
        reason = `matched user-uploaded asset on token overlap`;
      } else if (urlMatches.length > 0) {
        decision = "research_url";
        target = urlMatches[0];
        reason = `found relevant URL in researchNotes`;
      } else {
        decision = "ai_generated";
        target = `cinematic ${desc}, dramatic lighting, sharp focus, high detail, 4k`;
        reason = `no matching upload or research URL — generate fresh`;
      }

      // Log the decision so future debugging can trace why a scene picked X.
      const exp: ExperimentRecord = {
        ts: Date.now(),
        kind: "asset_route",
        decision,
        prompt: target,
        kept: true,
        note: reason,
      };
      ctx.project.experiments = [...(ctx.project.experiments ?? []), exp];

      return {
        ok: true,
        message: `decision: ${decision}\ntarget: ${target}\nreason: ${reason}`,
      };
    },
  },

  researchTopic: {
    schema: {
      name: "researchTopic",
      description:
        "Web-research a topic for VISUAL references before generating images. Returns 5-10 candidate sources (titles + urls + snippets) that describe what the subject actually looks like in the real world. Call this BEFORE generateImageForScene so prompts are grounded in reality, not invented from thin air. Use for: real people, brands, places, products, current events, niche subcultures.",
      input_schema: {
        type: "object",
        properties: {
          topic: {
            type: "string",
            description: "What to research (e.g. 'pokemon trading card art', 'mid-century modern coffee shop interiors').",
          },
          mode: {
            type: "string",
            enum: ["images", "facts", "both"],
            description: "images: visual references. facts: textual context. both: default.",
          },
        },
        required: ["topic"],
      },
    },
    async execute(args, ctx) {
      const topic = String(args.topic ?? "").trim();
      if (!topic) return { ok: false, message: "topic required" };
      const mode = (args.mode as string) ?? "both";
      const queries: string[] = [];
      if (mode === "images" || mode === "both") {
        queries.push(`${topic} visual reference`);
        queries.push(`${topic} photography`);
      }
      if (mode === "facts" || mode === "both") queries.push(`${topic} explained`);

      const allResults: Array<{ q: string; title: string; url: string; snippet: string }> = [];
      for (const q of queries) {
        try {
          const res = await fetch(`${ctx.origin}/api/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: q, limit: 4 }),
          });
          const data = (await res.json()) as {
            results?: Array<{ title: string; url: string; snippet: string }>;
          };
          for (const r of data.results ?? []) allResults.push({ q, ...r });
        } catch {
          // search backend missing — skip silently, agent gets fewer hits
        }
      }
      // Persist a compact summary on project so future turns don't re-search.
      const refs = allResults.slice(0, 12);
      ctx.project.researchNotes = (ctx.project.researchNotes ?? "") +
        `\n\n# ${topic}\n` +
        refs.map((r) => `- ${r.title} — ${r.url}\n  ${r.snippet}`).join("\n");
      return {
        ok: true,
        message:
          refs.length === 0
            ? "no research hits — proceed without references"
            : `${refs.length} references on "${topic}":\n` +
              refs.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`).join("\n\n"),
      };
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
