import { z } from "zod";
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import {
  listFiles,
  listAssets,
  readProjectText,
  readProjectFile,
  writeProjectFile,
  projectDir,
  personaDir,
} from "../storage/fs";
import { listRegistry, readRegistryBlock } from "./registry";
import { getScene, resolveSceneAtTime, replaceScene, sceneSummary } from "./scene-manifest";
import { getEffect, searchEffects } from "../effects/catalog";
import { effectsDir } from "../storage/fs";
import {
  ensureManifest,
  readManifest,
  writeManifest,
  setUnderstanding,
  summaryLine,
  type AssetManifest,
} from "../storage/manifests";
import { applyEdit, undoEdit, readProjectState, describeState } from "../storage/project-state";
import { readBrandKit } from "../brand-kit";
import { searchStock, type StockKind } from "../stock/registry";
import {
  replicateGenerateImage,
  replicateRemoveBackground,
  replicateImageFromReference,
} from "./providers/replicate";
import { captionImage, describeForRecreation } from "./providers/vision";
import {
  generateImageWithModel,
  generateVideoWithModel,
  generateMusicWithModel,
  ProviderNotConfiguredError,
} from "./providers/dispatch";
import { defaultModelForTask, getModel, type ModelEntry, type ModelTask } from "./models";
import { readModelPreferences, resolveModelForTask } from "./model-prefs";
import { resolveApiKey } from "@/lib/providers/pool";
import { chargeGeneration } from "@/lib/billing/generation-pricing";
import { creditBalance, getCreditCosts, type CreditAction } from "@/lib/billing/credits";
import { nanoid } from "nanoid";
import { safeFetch } from "../net/ssrf-guard";
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { resolve, sep, join } from "node:path";
import {
  resolveProjectPath,
  probeClip,
  trimClip,
  trimAudio,
  concatClips,
  gradeClip,
  chromaKey,
  speedClip,
  overlayClip,
  addTransition,
  mixAudio,
  extractAudio,
  replaceAudioTrack,
  burnCaptions,
  transcribeClip,
  renderEdl,
  validateEdl,
  snapToBoundary,
  buildCaptionsFromWords,
  computeSegmentOffsets,
  autoGradeFilter,
  extractClipFrames,
  extractFramesAt,
  detectFillerWords,
  applyNoiseReduction,
  analyzePacing,
  detectBeats,
  type XfadeType,
  type EditDecisionList,
  type TranscriptWord,
  type EdlSegment,
} from "./ffmpeg-tools";
import { db } from "@/lib/db";
import { creatorInsights } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export type ToolContext = {
  userId: string;
  projectId: string;
  enqueueRender: (opts: { fps?: number; quality?: string }) => Promise<string>;
  // BYOK keys forwarded from the browser's localStorage per chat request.
  // Tools check this map before falling back to process.env (dev-only) and
  // return a friendly error if neither is present.
  apiKeys?: Partial<Record<"replicate" | "elevenlabs" | "anthropic", string>>;
  // Project-level platform context passed from the DB row.
  platform?: string;
  aspectRatio?: string;
};

// Tokenize a reference/name into lowercase word tokens for fuzzy overlap.
function refTokens(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1);
}

// Score how well `ref` plausibly matches a manifest. Returns a number where
// higher = better; 0 means "no plausible match" (excluded from candidates).
// Tiers: exact path/name/alias (>=100) → case-insensitive name (90) →
// substring of name/alias (50+) → token overlap against name/aliases/caption/
// summary (1+ per matched token). This is what lets "beach" find "beach-intro"
// AND "beach-sunset" so the tool can surface the ambiguity instead of guessing.
function scoreAssetMatch(m: AssetManifest, ref: string): number {
  const wanted = ref.trim();
  const lower = wanted.toLowerCase();
  if (m.path === wanted || m.name === wanted) return 120;
  if (m.aliases.includes(wanted)) return 110;
  if (m.name.toLowerCase() === lower) return 100;
  if (m.aliases.some((a) => a.toLowerCase() === lower)) return 95;

  let score = 0;
  const nameLower = m.name.toLowerCase();
  if (nameLower.includes(lower) || lower.includes(nameLower)) score += 50;
  if (m.aliases.some((a) => a.toLowerCase().includes(lower))) score += 40;

  // Token overlap against name + aliases + understanding text.
  const refToks = new Set(refTokens(wanted));
  if (refToks.size) {
    const haystack = [
      m.name,
      ...m.aliases,
      m.understanding?.summary ?? "",
      m.understanding?.caption ?? "",
      ...(m.understanding?.tags ?? []),
    ].join(" ");
    const hayToks = new Set(refTokens(haystack));
    for (const t of refToks) if (hayToks.has(t)) score += 8;
  }
  return score;
}

// Return ALL plausible matches for a reference, best-first. Exact path/name/alias
// hits short-circuit to a single result; otherwise fuzzy scoring surfaces every
// candidate so callers can disambiguate. This is the no-timeline selection
// mechanism — getting it right is the difference between magic and frustration.
function findAssetCandidates(ctx: ToolContext, ref: string): AssetManifest[] {
  const wanted = ref.trim();
  // Fast path: a literal path/manifest hit is unambiguous.
  const direct = readManifest(ctx.userId, ctx.projectId, wanted);
  if (direct) return [direct];

  const manifests = listAssets(ctx.userId, ctx.projectId)
    .map((rel) => readManifest(ctx.userId, ctx.projectId, rel))
    .filter((m): m is AssetManifest => m !== null);

  const scored = manifests
    .map((m) => ({ m, score: scoreAssetMatch(m, wanted) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  // An exact hit (path/name/alias, score >= 95) wins outright — never treat it
  // as ambiguous against weaker fuzzy matches.
  const top = scored[0];
  if (top && top.score >= 95) return [top.m];
  return scored.map((s) => s.m);
}

// Resolve a user/AI reference to the single best-matching manifest (or null).
// Kept for callers that don't disambiguate; prefer findAssetCandidates when you
// want to surface ambiguity to the user.
function resolveAssetManifest(ctx: ToolContext, ref: string): AssetManifest | null {
  return findAssetCandidates(ctx, ref)[0] ?? null;
}

// Build the user-facing message when a reference matches multiple assets. The
// whole product is accuracy — never silently act on the wrong clip; list the
// candidates and ask which one.
function ambiguousMatchText(ref: string, candidates: AssetManifest[]): string {
  const lines = candidates.map((m) => `  - ${summaryLine(m)}`);
  return `"${ref}" matches ${candidates.length} assets — ask the user which one (do NOT guess):\n${lines.join(
    "\n",
  )}`;
}

// Tool names are surfaced to the agent as `mcp__hyperframes__<name>`.
export const MCP_SERVER_NAME = "hyperframes";

export function buildToolServer(ctx: ToolContext) {
  // ── Multi-model selection ─────────────────────────────────────────────────
  // Resolve which model runs an asset task, honoring the user's Auto/Manual
  // preference. In Manual mode the user's pinned choice wins (or the task
  // default). In Auto mode the agent may pass an explicit `chosenId` per asset
  // (validated against the registry); otherwise we use the task default.
  function resolveTaskModel(task: ModelTask, chosenId?: string): ModelEntry {
    const prefs = readModelPreferences(ctx.userId);
    if (prefs.mode === "manual") {
      return resolveModelForTask(task, prefs) ?? defaultModelForTask(task)!;
    }
    if (chosenId) {
      const m = getModel(chosenId);
      if (m && m.task === task && m.enabled) return m;
    }
    return defaultModelForTask(task)!;
  }

  // Run `fn` with the resolved model; if that model isn't configured, fall back
  // to the task's official default so one missing provider can't break a turn.
  async function withModelFallback<T>(
    task: ModelTask,
    model: ModelEntry,
    fn: (m: ModelEntry) => Promise<T>,
  ): Promise<{ result: T; usedModel: ModelEntry; fellBack: boolean }> {
    try {
      return { result: await fn(model), usedModel: model, fellBack: false };
    } catch (error) {
      if (error instanceof ProviderNotConfiguredError) {
        const fallback = defaultModelForTask(task);
        if (fallback && fallback.id !== model.id) {
          return { result: await fn(fallback), usedModel: fallback, fellBack: true };
        }
      }
      throw error;
    }
  }

  const planCompositionTool = tool(
    "plan_composition",
    "REQUIRED FIRST STEP for any NEW composition (not edits). Emit a structured scene plan — this is a SHOTLIST, not a slide outline: every scene must name the real visual media (photo / b-roll / motion graphic) that anchors it via the `media` field, plus color grade, typography pair, beat-sync, and transitions. After this returns, STOP your turn — say 'Approve this plan and I'll build it' and wait for the user's next message before any write_file call.",
    {
      format: z.enum(["16:9", "9:16", "1:1"]).describe("Output aspect ratio."),
      totalDurationSeconds: z
        .number()
        .int()
        .min(5)
        .max(900)
        .describe(
          "Total composition length, in seconds (max 900 = 15 min). For long-form (>5min) use fewer scenes but longer holds.",
        ),
      niche: z.string().describe("e.g. 'comic facts', 'sleep story', 'finance intro'."),
      palette: z.string().describe("Short color/typography palette description."),
      colorGrade: z
        .enum([
          "warm_golden",
          "cool_cinematic",
          "neon_pop",
          "vintage_film",
          "moody_dark",
          "clean_bright",
        ])
        .describe(
          "Color grade preset applied consistently to every scene background. Pick based on mood.",
        ),
      typographyPair: z
        .enum(["energy", "cinematic", "editorial", "mono_tech", "warm_humanist"])
        .describe("Font pair + animation system used throughout the composition."),
      beatSyncNote: z
        .string()
        .optional()
        .describe(
          "Brief note on beat-sync intent, e.g. '120 BPM, cuts every 4 bars (~8s)'. Leave empty if no music.",
        ),
      scenes: z
        .array(
          z.object({
            index: z.number().int().min(1),
            durationSeconds: z.number(),
            intent: z.string().describe("What this scene communicates in 1 line."),
            media: z
              .string()
              .describe(
                'The REAL visual asset that anchors this scene + how to treat it. This is what makes a video instead of a slideshow. Name what to search_media / download and the treatment, e.g. "photo of Steve Jobs 1984 keynote — remove_background cutout, slow 1.1x push-in", "b-roll: rain on window, full-bleed, subtle ken-burns", "motion-graphic: animated line chart of stock crash". Use "text-on-gradient" ONLY when no real media could possibly fit — that should be rare; most scenes need a photo, clip, or motion graphic.',
              ),
            animation: z
              .string()
              .describe(
                'How the media + text MOVE in this scene — entrance, emphasis, exit. Motion is what separates an edit from a static slide; every scene needs deliberate movement. e.g. "media push-in 1.0→1.12x across the hold; hook text chars stagger in at 0.03s; impact-zoom + glass-crack on the beat at 2.0s; exit whip-pan left into next scene".',
              ),
            beats: z.array(z.string()).describe("2-4 key visual/text beats in this scene."),
            fx: z
              .array(z.string())
              .describe("FX hits (glass-crack, whip-pan, white-flash, shimmer-sweep, none)."),
            layoutArchetype: z
              .enum([
                "full_bleed",
                "split_screen",
                "headline_only",
                "lower_third",
                "data_card",
                "quote_pull",
                "list_reveal",
              ])
              .describe(
                "Visual layout pattern for this scene. No two consecutive scenes may share the same archetype.",
              ),
            sceneRole: z
              .enum(["hook", "setup", "tension", "reveal", "proof", "cta"])
              .describe(
                "Emotional role of this scene in the retention arc. Hook must be scene 1. Tension must come before reveal. CTA must be last.",
              ),
            transitionToNext: z
              .enum(["hard_cut", "crossfade", "whip_pan", "white_flash", "none"])
              .describe(
                "Transition FROM this scene TO the next. Last scene must be 'none'. Use white_flash sparingly — max 2 per composition.",
              ),
          }),
        )
        .min(1)
        .max(12)
        .describe("Scenes in render order."),
    },
    async (plan) => {
      const warnings: string[] = [];
      if (plan.totalDurationSeconds > 600 && plan.scenes.length < 5) {
        warnings.push(
          `WARNING: ${plan.totalDurationSeconds}s with only ${plan.scenes.length} scene${plan.scenes.length === 1 ? "" : "s"} → very long holds per scene. Long-form videos this length usually need 6+ scenes (chapter cards, B-roll cuts, beat changes) to keep retention. Consider revising before the user approves.`,
        );
      }
      const avgSeconds = plan.totalDurationSeconds / plan.scenes.length;
      if (avgSeconds > 90) {
        warnings.push(
          `WARNING: average scene length ${avgSeconds.toFixed(0)}s — viewers fall off without a beat change. Break long scenes into chaptered segments.`,
        );
      }
      // Validate scene 1 hook rules
      const scene1 = plan.scenes.find((s) => s.index === 1);
      if (scene1) {
        if (scene1.durationSeconds > 3.5) {
          warnings.push(
            `WARNING: Scene 1 is ${scene1.durationSeconds}s — exceeds the 3.5s hook limit. Shorten it. The hook must be a punch.`,
          );
        }
        const hookSignals = ["hook", "question", "claim", "stat", "number", "title", "headline"];
        const hasHook = scene1.beats.some((beat) =>
          hookSignals.some((signal) => beat.toLowerCase().includes(signal)),
        );
        if (!hasHook) {
          warnings.push(
            `WARNING: Scene 1 beats don't mention a hook, claim, or stat. Add a large-text hook element — it's the #1 retention driver.`,
          );
        }
      }
      // Validate no consecutive scenes share a layout archetype
      for (let i = 1; i < plan.scenes.length; i++) {
        const prev = plan.scenes[i - 1].layoutArchetype;
        const curr = plan.scenes[i].layoutArchetype;
        if (prev === curr) {
          warnings.push(
            `WARNING: Scene ${plan.scenes[i - 1].index} and ${plan.scenes[i].index} both use "${curr}" layout. Consecutive identical archetypes kill visual rhythm — vary them.`,
          );
        }
      }
      // Validate retention arc order
      const roles = plan.scenes.map((s) => s.sceneRole);
      if (roles[0] !== "hook") {
        warnings.push("WARNING: Scene 1 must have sceneRole='hook'. Reorder or reassign roles.");
      }
      const lastRole = roles[roles.length - 1];
      if (lastRole !== "cta" && lastRole !== "reveal") {
        warnings.push(
          `WARNING: Last scene has role '${lastRole}' — end with 'cta' or 'reveal' for retention.`,
        );
      }
      const tensionIndex = roles.indexOf("tension");
      const revealIndex = roles.indexOf("reveal");
      if (tensionIndex !== -1 && revealIndex !== -1 && tensionIndex > revealIndex) {
        warnings.push("WARNING: 'tension' scene comes after 'reveal' — arc is inverted. Reorder.");
      }
      // Validate white_flash usage
      const flashCount = plan.scenes.filter((s) => s.transitionToNext === "white_flash").length;
      if (flashCount > 2) {
        warnings.push(
          `WARNING: ${flashCount} white_flash transitions — max 2 per video. Overuse kills impact.`,
        );
      }
      // Validate last scene has transition 'none'
      const lastScene = plan.scenes[plan.scenes.length - 1];
      if (lastScene && lastScene.transitionToNext !== "none") {
        warnings.push(
          `WARNING: Last scene transition is '${lastScene.transitionToNext}' — must be 'none' (there is no next scene).`,
        );
      }
      // ── Plan score — rate the shotlist on the levers that drive retention.
      // Deterministic so the agent (and user) see how strong the plan is and
      // exactly what to raise BEFORE building. Media richness is weighted
      // highest — it's the difference between an edited video and a slideshow.
      const sceneCount = plan.scenes.length;
      const isTextOnly = (m: string) =>
        !m || /^\s*(text[-\s]?on[-\s]?gradient|text|none|n\/?a|css)\s*$/i.test(m);
      const mediaScenes = plan.scenes.filter((s) => !isTextOnly(s.media)).length;
      const mediaScore = Math.round((30 * mediaScenes) / Math.max(1, sceneCount));

      let hookScore = 0;
      if (scene1) {
        if (scene1.sceneRole === "hook") hookScore += 5;
        if (scene1.durationSeconds <= 3.5) hookScore += 5;
        const sig = ["hook", "question", "claim", "stat", "number", "title", "headline"];
        if (scene1.beats.some((b) => sig.some((s) => b.toLowerCase().includes(s)))) hookScore += 5;
      }

      let pacingScore = 15;
      if (avgSeconds > 90) pacingScore -= 8;
      else if (avgSeconds > 12 && plan.format !== "16:9") pacingScore -= 4;
      const distinctDurations = new Set(plan.scenes.map((s) => Math.round(s.durationSeconds))).size;
      if (sceneCount >= 3 && distinctDurations === 1) pacingScore -= 3;
      pacingScore = Math.max(0, pacingScore);

      const distinctLayouts = new Set(plan.scenes.map((s) => s.layoutArchetype)).size;
      const distinctTransitions = new Set(plan.scenes.map((s) => s.transitionToNext)).size;
      let varietyScore = Math.min(8, Math.round((8 * distinctLayouts) / Math.min(sceneCount, 5)));
      varietyScore += distinctTransitions >= 2 ? 5 : 2;
      if (flashCount <= 2) varietyScore += 2;
      varietyScore = Math.min(15, varietyScore);

      let arcScore = 15;
      if (roles[0] !== "hook") arcScore -= 6;
      if (lastRole !== "cta" && lastRole !== "reveal") arcScore -= 5;
      if (tensionIndex !== -1 && revealIndex !== -1 && tensionIndex > revealIndex) arcScore -= 4;
      arcScore = Math.max(0, arcScore);

      const beatScore = plan.beatSyncNote ? 10 : 5;

      const score = mediaScore + hookScore + pacingScore + varietyScore + arcScore + beatScore;
      const grade =
        score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";

      // Add arc summary to output
      const arcSummary = plan.scenes.map((s) => `S${s.index}:${s.sceneRole}`).join(" → ");
      const archetypeSummary = plan.scenes
        .map((s) => `S${s.index}:${s.layoutArchetype}`)
        .join(" → ");
      const mediaNote =
        mediaScenes < sceneCount
          ? `⚠ ${sceneCount - mediaScenes}/${sceneCount} scenes have no real media (text-on-gradient). Add a photo / b-roll / motion-graphic to each — this is the biggest score lever.`
          : null;
      const lines = [
        `OK: plan recorded — ${plan.scenes.length} scenes / ${plan.totalDurationSeconds}s / ${plan.format}.`,
        `Grade: ${plan.colorGrade} | Typography: ${plan.typographyPair}${plan.beatSyncNote ? ` | Beat-sync: ${plan.beatSyncNote}` : ""}`,
        `Arc: ${arcSummary}`,
        `Layouts: ${archetypeSummary}`,
        `Plan score: ${score}/100 (${grade}) — media ${mediaScore}/30 · hook ${hookScore}/15 · pacing ${pacingScore}/15 · variety ${varietyScore}/15 · arc ${arcScore}/15 · beat-sync ${beatScore}/10`,
        ...(mediaNote ? [mediaNote] : []),
        ...warnings,
        score < 80
          ? `Plan scored below the 80 bar — raise the weakest dimensions (start with media) and re-call plan_composition BEFORE asking the user to approve. Don't ship a weak plan.`
          : `Strong plan. Show the user the score + arc, then ask them to approve before writing any HTML.`,
      ];
      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    },
  );

  const listFilesTool = tool(
    "list_files",
    "List all files in the current project directory. Returns one relative path per line.",
    {},
    async () => {
      const files = listFiles(ctx.userId, ctx.projectId);
      const text = files.length ? files.join("\n") : "(empty project)";
      return { content: [{ type: "text", text }] };
    },
  );

  const readFileTool = tool(
    "read_file",
    "Read a text file in the project. Returns up to 50KB. Path is relative to the project root.",
    {
      path: z.string().describe("Relative path, e.g. 'index.html' or 'compositions/scene1.html'."),
    },
    async ({ path }) => {
      try {
        const raw = readProjectText(ctx.userId, ctx.projectId, path);
        const text = raw.length > 50_000 ? raw.slice(0, 50_000) + "\n<-- truncated -->" : raw;
        return { content: [{ type: "text", text }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const diffFileTool = tool(
    "diff_file",
    "Make a SURGICAL edit to an existing file by replacing a unique text block. Prefer this over write_file for small edits — it's faster and uses way fewer tokens. The old_text must appear EXACTLY ONCE in the file. For multi-edit changes, call this multiple times.",
    {
      path: z.string().describe("Relative path to the file."),
      old_text: z.string().describe("Exact text to find. Must be unique in the file."),
      new_text: z.string().describe("Text to replace it with. Can be empty to delete."),
    },
    async ({ path, old_text, new_text }) => {
      try {
        const current = readProjectText(ctx.userId, ctx.projectId, path);
        const occurrences = current.split(old_text).length - 1;
        if (occurrences === 0)
          return {
            content: [
              {
                type: "text",
                text: `ERROR: old_text not found in ${path}. Try a more specific snippet.`,
              },
            ],
            isError: true,
          };
        if (occurrences > 1)
          return {
            content: [
              {
                type: "text",
                text: `ERROR: old_text appears ${occurrences} times in ${path}. Need a unique snippet — add surrounding context.`,
              },
            ],
            isError: true,
          };
        const updated = current.replace(old_text, new_text);
        writeProjectFile(ctx.userId, ctx.projectId, path, updated);
        return {
          content: [
            {
              type: "text",
              text: `OK: ${path} updated (${old_text.length}B → ${new_text.length}B).`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const findStockTool = tool(
    "find_stock",
    "Search the curated stock library for SFX, MUSIC beds, and b-roll video. Returns matching assets with their /stock/… URLs. Only assets whose files actually exist are returned — if a search comes back empty, that kind isn't stocked, so do NOT invent or guess a /stock/… path (a made-up path 404s and renders silent/blank). IMPORTANT: download each chosen asset into the project with download_asset (it copies the /stock/ file straight into assets/), then reference it as src=\"assets/<filename>\". Do NOT reference the raw /stock/… path in the composition — assets must live under assets/ to be bundled into the render (music and b-roll video especially, or audio renders silent). For 'music', search by mood keywords (energetic / calm / ominous / playful / mysterious / dark / warm). Every composition should include exactly ONE music track unless the brief says otherwise.",
    {
      query: z
        .string()
        .describe(
          "Keywords. Examples: 'dramatic riser', 'glitch overlay', 'host narrator', or for music: 'calm peaceful sleep' / 'ominous tense' / 'energetic punchy comic'.",
        ),
      kind: z
        .enum(["sfx", "broll", "character", "music"])
        .optional()
        .describe("Restrict to one kind. Omit to search all."),
    },
    async ({ query, kind }) => {
      const results = searchStock(query, kind as StockKind | undefined);
      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No stock assets matched "${query}". Try broader terms (e.g. 'whoosh', 'particles', 'narrator', 'calm', 'punchy').`,
            },
          ],
        };
      }
      const lines = results.slice(0, 10).map((a) => {
        const moodPart = a.mood && a.mood.length ? `, mood: ${a.mood.join("/")}` : "";
        const bpmPart = a.bpm ? `, ${a.bpm}bpm` : "";
        return `[${a.kind}] ${a.slug} — ${a.name} — ${a.url}  (tags: ${a.tags.join(", ")}${a.durationSeconds ? `, ${a.durationSeconds}s` : ""}${moodPart}${bpmPart})`;
      });
      return {
        content: [
          {
            type: "text",
            text: lines.join("\n"),
          },
        ],
      };
    },
  );

  const getBrandKitTool = tool(
    "get_brand_kit",
    "Return the user's saved brand kit (logo, primary color, accent color, font, watermark, channel name, host identity, toneVoice, targetAudience). If hostDescription is set, the composition MUST feature that host consistently. If toneVoice is set, apply it to all on-screen copy and voiceover scripts. If targetAudience is set, calibrate language complexity, references, and pacing for that audience. Ignore null fields.",
    {},
    async () => {
      const kit = await readBrandKit(ctx.userId);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(kit, null, 2),
          },
        ],
      };
    },
  );

  const writeFileTool = tool(
    "write_file",
    "Create or overwrite a file in the project. Write the COMPLETE file contents — partial writes are not supported.",
    {
      path: z.string().describe("Relative path within the project."),
      content: z.string().describe("Full file contents."),
    },
    async ({ path, content }) => {
      try {
        writeProjectFile(ctx.userId, ctx.projectId, path, content);
        return {
          content: [
            {
              type: "text",
              text: `OK: wrote ${content.length} bytes to ${path}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  // --- Scene-scoped editing (index.html) ---------------------------------
  // Scenes are balanced <div data-scene-id=… data-scene-start=… data-scene-duration=…>
  // containers. These tools let the agent read/replace ONE scene instead of the
  // whole (possibly very long) composition, cutting latency + tokens per edit.
  // They no-op gracefully on legacy compositions with no scene markers.
  const listScenesTool = tool(
    "list_scenes",
    "List the addressable scenes in the composition (index.html) — their scene ids, timeline positions (start + duration), and sizes. Call this FIRST when the user asks to change a specific part/moment/scene of an existing composition, so you can read_scene / edit_scene just that scene instead of re-reading the whole file. If it reports no addressable scenes, the composition predates scene markers — fall back to read_file/diff_file.",
    {},
    async () => {
      try {
        const html = readProjectText(ctx.userId, ctx.projectId, "index.html");
        return { content: [{ type: "text", text: sceneSummary(html) }] };
      } catch {
        return {
          content: [{ type: "text", text: "No index.html yet — build the composition first." }],
        };
      }
    },
  );

  const readSceneTool = tool(
    "read_scene",
    "Return the full HTML of ONE scene from the composition, addressed either by scene_id (from list_scenes) or by at_seconds (a time on the timeline — resolves to the scene playing then). Use this instead of read_file when the user wants to change a single scene, so you only pull that scene into context.",
    {
      scene_id: z.string().optional().describe("The scene id, e.g. 'scene-2'."),
      at_seconds: z
        .number()
        .optional()
        .describe("A timeline time in seconds; resolves to the scene playing at that moment."),
    },
    async ({ scene_id, at_seconds }) => {
      if (!scene_id && at_seconds == null)
        return {
          content: [{ type: "text", text: "ERROR: pass either scene_id or at_seconds." }],
          isError: true,
        };
      let html: string;
      try {
        html = readProjectText(ctx.userId, ctx.projectId, "index.html");
      } catch {
        return {
          content: [{ type: "text", text: "No index.html yet — build the composition first." }],
          isError: true,
        };
      }
      const scene = scene_id
        ? getScene(html, scene_id)
        : resolveSceneAtTime(html, at_seconds as number);
      if (!scene)
        return {
          content: [
            {
              type: "text",
              text: `Scene not found. ${sceneSummary(html)}`,
            },
          ],
          isError: true,
        };
      return {
        content: [
          {
            type: "text",
            text: `Scene ${scene.id} (start ${scene.start ?? "?"}s, duration ${scene.duration ?? "?"}s):\n\n${scene.html}`,
          },
        ],
      };
    },
  );

  const editSceneTool = tool(
    "edit_scene",
    'Replace ONE scene in the composition (index.html) with new HTML, leaving every other scene untouched. `content` must be the COMPLETE replacement scene container — a single balanced <div class="scene" data-scene-id="…" data-scene-start="…" data-scene-duration="…">…</div>. Keep the SAME scene_id. Prefer this over write_file for scene changes — it never re-writes the whole file, so it\'s faster and can\'t disturb other scenes. Do NOT change a scene\'s data-scene-duration here unless the user asked to retime it (that shifts the whole timeline — rebuild with write_file for structural retimes). After editing, call lint_composition, then screenshot_at_time at a moment inside the scene.',
    {
      scene_id: z.string().describe("The scene id to replace, e.g. 'scene-2'."),
      content: z
        .string()
        .describe(
          "The full replacement scene container (single balanced <div data-scene-id=…>…</div>).",
        ),
    },
    async ({ scene_id, content }) => {
      const trimmed = content.trim();
      if (!trimmed.startsWith("<div") || !/\bdata-scene-id\s*=/.test(trimmed))
        return {
          content: [
            {
              type: "text",
              text: "ERROR: content must be a single <div …data-scene-id=…>…</div> scene container.",
            },
          ],
          isError: true,
        };
      let html: string;
      try {
        html = readProjectText(ctx.userId, ctx.projectId, "index.html");
      } catch {
        return {
          content: [{ type: "text", text: "No index.html yet — build the composition first." }],
          isError: true,
        };
      }
      const updated = replaceScene(html, scene_id, trimmed);
      if (updated === null)
        return {
          content: [{ type: "text", text: `Scene '${scene_id}' not found. ${sceneSummary(html)}` }],
          isError: true,
        };
      writeProjectFile(ctx.userId, ctx.projectId, "index.html", updated);
      return {
        content: [
          {
            type: "text",
            text: `OK: replaced scene ${scene_id} (index.html now ${updated.length} bytes). Lint + screenshot to verify.`,
          },
        ],
      };
    },
  );

  // --- Effects Store: curated overlays / SFX / backgrounds the agent applies ---
  const searchEffectsTool = tool(
    "search_effects",
    "Search the curated Effects Store for ready-made overlays (film burns, light leaks, bokeh, flashes, flames), animated backgrounds, and SFX to make the video richer. Returns each match's preset_id, what it is, when to use it, and — critically — how to COMPOSITE it (blend mode). Call this while building/editing to add texture, transitions, or sound. Then use apply_effect with a chosen preset_id.",
    {
      query: z
        .string()
        .describe("Keywords, e.g. 'warm film burn transition', 'dreamy bokeh', 'whoosh cut'."),
      category: z
        .enum(["overlay", "transition", "background", "sfx", "grade", "typography", "character"])
        .optional()
        .describe("Restrict to one category. Omit to search all."),
    },
    async ({ query, category }) => {
      const results = searchEffects(query, category as never);
      if (results.length === 0)
        return {
          content: [
            {
              type: "text",
              text: `No effects matched "${query}". Try broader terms (warm, glow, impact, transition, whoosh, riser).`,
            },
          ],
        };
      const lines = results.slice(0, 12).map((effect) => {
        const dur = effect.durationSeconds ? `, ${effect.durationSeconds}s` : "";
        return `[${effect.category}] ${effect.presetId} — ${effect.name}: ${effect.description} (use when: ${effect.useWhen.join(", ")}; blend: ${effect.compositing.blend}${dur})`;
      });
      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  const applyEffectTool = tool(
    "apply_effect",
    "Bring an Effects Store item into the project by its preset_id (from search_effects, or one the user named). Copies the asset into assets/effects/ and returns the EXACT HTML snippet to drop into the composition, already composited correctly (black-screen overlays get mix-blend-mode:screen so they read as light, not a black box; SFX get an <audio> clip). Place the returned snippet inside the target scene's <div> (set data-start/data-duration to when it should play). Then lint + screenshot.",
    {
      preset_id: z.string().describe("The effect's preset_id, e.g. 'light-leak-short-01'."),
      start: z.number().optional().describe("data-start (seconds on the timeline). Default 0."),
      duration: z
        .number()
        .optional()
        .describe("data-duration (seconds it should play). Defaults to the effect's own length."),
    },
    async ({ preset_id, start, duration }) => {
      const effect = getEffect(preset_id);
      if (!effect)
        return {
          content: [
            {
              type: "text",
              text: `No effect '${preset_id}'. Call search_effects to find the right preset_id.`,
            },
          ],
          isError: true,
        };
      const srcPath = join(effectsDir(), `${effect.presetId}.${effect.ext}`);
      if (!existsSync(srcPath))
        return {
          content: [{ type: "text", text: `Effect '${preset_id}' asset is missing on disk.` }],
          isError: true,
        };
      const dest = `assets/effects/${effect.presetId}.${effect.ext}`;
      try {
        writeProjectFile(ctx.userId, ctx.projectId, dest, readFileSync(srcPath));
      } catch (error) {
        return {
          content: [{ type: "text", text: `Copy failed: ${(error as Error).message}` }],
          isError: true,
        };
      }
      const s = start ?? 0;
      const d = duration ?? effect.durationSeconds ?? 2;
      let snippet: string;
      if (effect.kind === "audio") {
        snippet = `<audio class="clip" src="${dest}" data-start="${s}" data-duration="${d}" data-track-index="11" data-volume="0.8"></audio>`;
      } else if (effect.compositing.blend === "screen" || effect.compositing.blend === "add") {
        const op = effect.compositing.defaultOpacity ?? 0.85;
        snippet = `<video muted playsinline loop class="clip" src="${dest}" data-start="${s}" data-duration="${d}" data-track-index="3" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;mix-blend-mode:${effect.compositing.blend};opacity:${op};pointer-events:none"></video>`;
      } else if (effect.category === "background") {
        // A backdrop sits BEHIND scene content — low track index, full opacity.
        snippet = `<video muted playsinline loop class="clip" src="${dest}" data-start="${s}" data-duration="${d}" data-track-index="0" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none"></video>`;
      } else {
        // alpha / normal overlay (e.g. transparent PNG-style or pre-keyed clip).
        snippet = `<video muted playsinline loop class="clip" src="${dest}" data-start="${s}" data-duration="${d}" data-track-index="3" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none"></video>`;
      }
      const where =
        effect.kind === "audio"
          ? "Place it once inside the composition (it plays at data-start)."
          : effect.category === "background"
            ? "Place it as the FIRST child of the target scene (behind everything)."
            : "Place it as the LAST child of the target scene (on top), so it overlays the content.";
      return {
        content: [
          {
            type: "text",
            text: `Copied ${effect.name} → ${dest}.\n${where}\nInsert this exactly:\n${snippet}`,
          },
        ],
      };
    },
  );

  const downloadAssetTool = tool(
    "download_asset",
    'Save an asset into the project\'s assets/ folder. Accepts a public http(s) URL (memes/GIFs/images found via WebSearch/WebFetch) OR a local stock-library path like /stock/music/<x>.mp3 from find_stock (copied straight off disk — no network). The composition then references it as src="assets/<filename>". Sanitizes the filename and guards against path traversal. Returns the saved asset path.',
    {
      url: z.string().describe("Public URL of the image, GIF, or video to download."),
      filename: z
        .string()
        .describe(
          "Filename to save as under assets/. Include the extension (e.g. 'reaction.gif', 'meme.jpg'). No subdirectories.",
        ),
    },
    async ({ url, filename }) => {
      // Strip path separators so the agent can't write outside assets/.
      const safe = filename.replace(/[/\\]/g, "_").replace(/^\.+/, "");
      const dest = `assets/${safe}`;
      try {
        let buffer: Buffer;
        if (url.startsWith("/") && !url.startsWith("//")) {
          // A locally-served path (e.g. the stock library at /stock/music/x.mp3,
          // served from public/). The server can't fetch() a host-less path, so
          // copy it straight off disk into the project's assets/.
          const rel = url.replace(/^\/+/, "").split(/[?#]/)[0];
          const publicRoot = resolve(process.cwd(), "public");
          const absPath = resolve(publicRoot, rel);
          if (absPath !== publicRoot && !absPath.startsWith(publicRoot + sep)) {
            return {
              content: [{ type: "text", text: `ERROR: invalid local path ${url}` }],
              isError: true,
            };
          }
          if (!existsSync(absPath)) {
            return {
              content: [{ type: "text", text: `ERROR: local asset not found: ${url}` }],
              isError: true,
            };
          }
          buffer = readFileSync(absPath);
        } else {
          // safeFetch validates + pins the connection to the vetted public IP (SSRF + DNS-rebind safe).
          const response = await safeFetch(url, {
            headers: { "user-agent": "VibeEdit/1.0 asset-downloader" },
            signal: AbortSignal.timeout(30_000),
          });
          if (!response.ok) {
            return {
              content: [
                {
                  type: "text",
                  text: `ERROR: HTTP ${response.status} fetching ${url}`,
                },
              ],
              isError: true,
            };
          }
          buffer = Buffer.from(await response.arrayBuffer());
        }
        writeProjectFile(ctx.userId, ctx.projectId, dest, buffer);
        return {
          content: [
            {
              type: "text",
              text: `OK: saved ${buffer.length} bytes → ${dest}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const searchMediaTool = tool(
    "search_media",
    'Search the web for real images and video to use in the composition — photos, b-roll, logos, product shots, reference imagery the curated find_stock library doesn\'t cover. Returns candidates with URL, source, and license. After picking one, call download_asset with its URL to copy it into assets/ and reference it as src="assets/<file>". IMPORTANT: only download direct media file URLs (…​.jpg/.png/.webp/.gif/.mp4/.webm). Skip results that are web pages (e.g. youtube.com/watch, a vimeo.com/<id> page) — those are not downloadable media files. Prefer CC-licensed (openverse) results when the video will be published.',
    {
      query: z
        .string()
        .describe(
          "What to find, e.g. 'tokyo street night neon', 'golden retriever puppy', 'circuit board macro'.",
        ),
      kind: z
        .enum(["image", "video"])
        .optional()
        .default("image")
        .describe("image (default) or video. Video search returns mostly direct .mp4/.webm clips."),
    },
    async ({ query, kind }) => {
      const results = await searchMedia(query, kind ?? "image");
      if (results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No media found for "${query}". Try broader terms, or use find_stock / generate_image.`,
            },
          ],
        };
      }
      const lines = results
        .slice(0, 12)
        .map(
          (r) =>
            `[${r.source}${r.license ? `, ${r.license}` : ""}] ${r.title || "(untitled)"} — ${r.url}`,
        );
      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  const prepareSceneMediaTool = tool(
    "prepare_scene_media",
    'Source AND download the real media for MANY scenes AT ONCE, in parallel. Call this ONCE right after the plan is approved, passing one entry per scene that needs real media (from each scene\'s `media` field). It runs all the searches + downloads concurrently and returns a manifest of saved asset paths (or a per-scene error). Reference the returned paths as src="assets/…" in the composition; for cut-out subjects, run remove_background on the saved path afterward. This is the fast path — do NOT call search_media + download_asset one scene at a time when you can batch here.',
    {
      scenes: z
        .array(
          z.object({
            sceneIndex: z.number().int().min(1),
            query: z
              .string()
              .describe("Search terms for this scene's media, e.g. 'steve jobs 1984 keynote'."),
            kind: z.enum(["image", "video"]).optional().default("image"),
            filename: z
              .string()
              .optional()
              .describe(
                "Base filename (no extension), e.g. 'scene1-jobs'. Defaults to scene<index>.",
              ),
          }),
        )
        .min(1)
        .max(12)
        .describe("One entry per scene needing real media."),
    },
    async ({ scenes }) => {
      const results = await Promise.all(
        scenes.map(async (sc) => {
          const kind = sc.kind ?? "image";
          try {
            const found = await searchMedia(sc.query, kind);
            const direct = found.find((r) => isDirectMediaUrl(r.url, kind));
            if (!direct) {
              return `S${sc.sceneIndex}: ✗ no direct ${kind} URL for "${sc.query}" (try search_media manually or a different query)`;
            }
            const base = (sc.filename || `scene${sc.sceneIndex}`)
              .replace(/[^A-Za-z0-9._-]+/g, "_")
              .replace(/\.[^.]*$/, "");
            const dest = `assets/${base}.${extFromUrl(direct.url, kind)}`;
            // safeFetch validates + pins to the vetted public IP (SSRF + DNS-rebind safe).
            const resp = await safeFetch(direct.url, {
              headers: { "user-agent": "VibeEdit/1.0 media-fetch" },
              signal: AbortSignal.timeout(30_000),
            });
            if (!resp.ok) return `S${sc.sceneIndex}: ✗ HTTP ${resp.status} for ${direct.url}`;
            const buffer = Buffer.from(await resp.arrayBuffer());
            writeProjectFile(ctx.userId, ctx.projectId, dest, buffer);
            return `S${sc.sceneIndex}: ✓ ${dest} (${Math.round(buffer.length / 1024)}KB, ${direct.source}${direct.license ? `, ${direct.license}` : ""})`;
          } catch (error) {
            return `S${sc.sceneIndex}: ✗ ${(error as Error).message}`;
          }
        }),
      );
      const ok = results.filter((r) => r.includes("✓")).length;
      return {
        content: [
          {
            type: "text",
            text: `Prepared ${ok}/${scenes.length} scenes in parallel:\n${results.join("\n")}\n\nReference the ✓ paths as src="assets/…". For ✗ scenes, retry with a different query or fall back to a motion-graphic / generate_image.`,
          },
        ],
      };
    },
  );

  const generatePersonaTool = tool(
    "generate_persona",
    "Create the creator's LOCKED persona character — a recurring on-screen host/mascot that stars in every video (the channel's brand, like a CodeBullet doodle). Generates the character once via AI, removes the background, and saves it as the persona's canonical base. After this, ALWAYS reuse it with use_persona — never regenerate the character per video; reusing the same locked asset is what makes the persona consistent. Requires a Replicate API key.",
    {
      name: z.string().describe("Persona name, e.g. 'Pixel the Robot' or 'Professor Quill'."),
      description: z
        .string()
        .describe(
          "What the character looks like + its vibe, e.g. 'a sarcastic blue robot with one big eye and stubby arms' or 'a calm grey-haired professor in a tweed jacket'.",
        ),
      style: z
        .string()
        .optional()
        .describe(
          "Art style, e.g. 'MS-Paint doodle', 'clean flat vector', 'Pixar-style 3D', 'hand-drawn comic'. Defaults to clean flat vector.",
        ),
      voiceId: z
        .string()
        .optional()
        .describe("ElevenLabs voiceId to lock to this persona (used by generate_voiceover)."),
      traits: z
        .array(z.string())
        .optional()
        .describe("Personality traits, e.g. ['sarcastic','nerdy','warm']. Shapes how it talks."),
      speakingStyle: z
        .string()
        .optional()
        .describe(
          "How the character talks, e.g. 'short punchy sentences, dry jokes, talks to camera'.",
        ),
      catchphrases: z.array(z.string()).optional().describe("Signature lines the character uses."),
      sampleScripts: z
        .array(z.string())
        .optional()
        .describe("A few example scripts written in the character's voice (for tone reference)."),
    },
    async ({
      name,
      description,
      style,
      voiceId,
      traits,
      speakingStyle,
      catchphrases,
      sampleScripts,
    }) => {
      const apiKey = resolveApiKey("replicate", "REPLICATE_API_TOKEN", ctx.apiKeys?.replicate);
      if (!apiKey) {
        return {
          content: [
            {
              type: "text",
              text: "ERROR: No Replicate API key. Ask the user to add their Replicate token at /app/settings/api-keys.",
            },
          ],
          isError: true,
        };
      }
      try {
        const styleDesc = style || "clean modern flat vector illustration, bold simple shapes";
        const prompt = `Character mascot / host for a video channel. ${description}. Art style: ${styleDesc}. A SINGLE character, head-and-torso, centered, facing the camera, friendly expressive pose, isolated on a plain flat solid pure-white background, even studio lighting, no text, no logo, no border — a clean repeatable character design.`;
        const raw = await replicateGenerateImage({ apiKey, prompt, aspectRatio: "3:4" });
        const dataUri = `data:image/png;base64,${raw.toString("base64")}`;
        const transparent = await replicateRemoveBackground(apiKey, dataUri);
        const dir = personaDir(ctx.userId);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, "base.png"), transparent);
        const persona = {
          name,
          description,
          style: styleDesc,
          voiceId: voiceId || undefined,
          base: "base.png",
          poses: [] as Array<{ label: string; file: string }>,
          personality: {
            traits: traits || [],
            speakingStyle: speakingStyle || "",
            catchphrases: catchphrases || [],
          },
          sampleScripts: sampleScripts || [],
          createdAt: new Date().toISOString(),
        };
        writeFileSync(join(dir, "persona.json"), JSON.stringify(persona, null, 2));
        return {
          content: [
            {
              type: "text",
              text: `OK: persona "${name}" generated and LOCKED (transparent base.png). From now on bring it into a video with use_persona and reference that path — do NOT regenerate the character; reusing the locked asset is what keeps the persona consistent across videos.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const getPersonaTool = tool(
    "get_persona",
    "Return the creator's locked persona (name, description, art style, locked voiceId, and available poses), or report there is none. Call this early when building so you can feature the persona consistently.",
    {},
    async () => {
      const file = join(personaDir(ctx.userId), "persona.json");
      if (!existsSync(file)) {
        return {
          content: [
            {
              type: "text",
              text: "No persona yet. If the user wants a recurring host/character, call generate_persona to create + lock one.",
            },
          ],
        };
      }
      try {
        const persona = JSON.parse(readFileSync(file, "utf8"));
        return {
          content: [
            {
              type: "text",
              text: `Active persona:\n${JSON.stringify(persona)}\nBring it into this project with use_persona, reference the returned path across scenes, and narrate with its voiceId.`,
            },
          ],
        };
      } catch {
        return {
          content: [{ type: "text", text: "ERROR: persona.json unreadable." }],
          isError: true,
        };
      }
    },
  );

  const usePersonaTool = tool(
    "use_persona",
    "Copy the locked persona character into THIS project's assets/ so the composition can show it. Returns the asset path to reference (e.g. assets/persona.png). Reuse the SAME asset across every scene — that consistency is the whole point. Pass a pose label to fetch a specific pose if one exists.",
    {
      pose: z
        .string()
        .optional()
        .describe("Pose/expression label (omit for the canonical base character)."),
    },
    async ({ pose }) => {
      const dir = personaDir(ctx.userId);
      const file = join(dir, "persona.json");
      if (!existsSync(file)) {
        return {
          content: [{ type: "text", text: "ERROR: no persona. Call generate_persona first." }],
          isError: true,
        };
      }
      try {
        const persona = JSON.parse(readFileSync(file, "utf8")) as {
          base: string;
          poses?: Array<{ label: string; file: string }>;
        };
        let src = persona.base;
        if (pose) {
          const found = persona.poses?.find((p) => p.label === pose);
          if (found) src = found.file;
        }
        const srcPath = join(dir, src);
        if (!existsSync(srcPath)) {
          return {
            content: [{ type: "text", text: `ERROR: persona asset ${src} missing on disk.` }],
            isError: true,
          };
        }
        const dest = `assets/persona${pose ? `-${pose.replace(/[^a-z0-9]/gi, "")}` : ""}.png`;
        writeProjectFile(ctx.userId, ctx.projectId, dest, readFileSync(srcPath));
        return {
          content: [
            {
              type: "text",
              text: `OK: locked persona copied to ${dest}. Reference src="${dest}" and reuse this exact file in every scene the host appears.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const addPersonaPoseTool = tool(
    "add_persona_pose",
    "Generate a NEW pose/expression of the LOCKED persona — the SAME character doing something specific (pointing, shocked, thumbs-up, explaining) — from its base via a character-consistency model, and save it to the persona's pose set. Use when a scene needs the host in a particular pose. Afterwards bring it into a video with use_persona(pose=<label>). Requires a Replicate key.",
    {
      label: z
        .string()
        .regex(/^[a-z0-9-]+$/)
        .describe("Short slug for this pose, e.g. 'pointing', 'shocked', 'thumbs-up'."),
      prompt: z
        .string()
        .describe(
          "What the SAME character is doing — pose, expression, framing. e.g. 'pointing to the right with a surprised open-mouth expression'.",
        ),
    },
    async ({ label, prompt }) => {
      const apiKey = resolveApiKey("replicate", "REPLICATE_API_TOKEN", ctx.apiKeys?.replicate);
      if (!apiKey) {
        return {
          content: [
            {
              type: "text",
              text: "ERROR: No Replicate API key. Ask the user to add their Replicate token at /app/settings/api-keys.",
            },
          ],
          isError: true,
        };
      }
      const dir = personaDir(ctx.userId);
      const file = join(dir, "persona.json");
      if (!existsSync(file)) {
        return {
          content: [{ type: "text", text: "ERROR: no persona. Call generate_persona first." }],
          isError: true,
        };
      }
      try {
        const persona = JSON.parse(readFileSync(file, "utf8")) as {
          name: string;
          description: string;
          style: string;
          base: string;
          poses?: Array<{ label: string; file: string }>;
        };
        const basePath = join(dir, persona.base);
        if (!existsSync(basePath)) {
          return {
            content: [{ type: "text", text: "ERROR: persona base image missing on disk." }],
            isError: true,
          };
        }
        const baseUri = `data:image/png;base64,${readFileSync(basePath).toString("base64")}`;
        const fullPrompt = `${persona.description}. ${prompt}. Art style: ${persona.style}. The exact same character, isolated on a plain solid pure-white background, no text, no logo.`;
        const raw = await replicateImageFromReference({
          apiKey,
          prompt: fullPrompt,
          referenceDataUri: baseUri,
        });
        const transparent = await replicateRemoveBackground(
          apiKey,
          `data:image/png;base64,${raw.toString("base64")}`,
        );
        mkdirSync(join(dir, "poses"), { recursive: true });
        const poseFile = `poses/${label}.png`;
        writeFileSync(join(dir, poseFile), transparent);
        persona.poses = (persona.poses || [])
          .filter((p) => p.label !== label)
          .concat([{ label, file: poseFile }]);
        writeFileSync(file, JSON.stringify(persona, null, 2));
        return {
          content: [
            {
              type: "text",
              text: `OK: pose "${label}" added to persona "${persona.name}". Bring it into a scene with use_persona(pose="${label}").`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const updatePersonaTool = tool(
    "update_persona",
    "Edit the locked persona's identity in place when the user asks ('make Pixel angrier', 'lock this voice', 'give it a catchphrase'). Updates personality / voice / sample scripts on the account-level persona so the change carries into every future project. Does NOT regenerate the base image (use add_persona_pose for new looks). Only pass the fields that change.",
    {
      description: z.string().optional().describe("Replace the visual description."),
      style: z.string().optional().describe("Replace the art style."),
      voiceId: z.string().optional().describe("Lock/replace the ElevenLabs voiceId."),
      traits: z.array(z.string()).optional().describe("Replace the personality traits list."),
      speakingStyle: z.string().optional().describe("Replace how the character talks."),
      catchphrases: z.array(z.string()).optional().describe("Replace the catchphrases list."),
      addSampleScript: z.string().optional().describe("Append one sample script in-voice."),
    },
    async ({
      description,
      style,
      voiceId,
      traits,
      speakingStyle,
      catchphrases,
      addSampleScript,
    }) => {
      const file = join(personaDir(ctx.userId), "persona.json");
      if (!existsSync(file)) {
        return {
          content: [{ type: "text", text: "ERROR: no persona to update. Call generate_persona." }],
          isError: true,
        };
      }
      try {
        const persona = JSON.parse(readFileSync(file, "utf8")) as {
          description?: string;
          style?: string;
          voiceId?: string;
          personality?: { traits?: string[]; speakingStyle?: string; catchphrases?: string[] };
          sampleScripts?: string[];
          [k: string]: unknown;
        };
        if (description) persona.description = description;
        if (style) persona.style = style;
        if (voiceId) persona.voiceId = voiceId;
        persona.personality = persona.personality || {};
        if (traits) persona.personality.traits = traits;
        if (speakingStyle) persona.personality.speakingStyle = speakingStyle;
        if (catchphrases) persona.personality.catchphrases = catchphrases;
        if (addSampleScript)
          persona.sampleScripts = [...(persona.sampleScripts || []), addSampleScript];
        writeFileSync(file, JSON.stringify(persona, null, 2));
        return {
          content: [
            { type: "text", text: `OK: persona updated.\n${JSON.stringify(persona.personality)}` },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const listAssetsSummaryTool = tool(
    "list_assets_summary",
    "List every project asset as ONE compact line each — `name · kind · duration · summary` — using its manifest. Call this FIRST to learn what footage/images/audio exist and what to call them in chat. The `name` is the handle to use when referring to an asset; pull full detail with read_manifest only for the asset you're editing.",
    {},
    async () => {
      const assets = listAssets(ctx.userId, ctx.projectId);
      if (!assets.length) {
        return { content: [{ type: "text", text: "(no assets uploaded)" }] };
      }
      const lines: string[] = [];
      for (const rel of assets) {
        const m =
          readManifest(ctx.userId, ctx.projectId, rel) ??
          (await ensureManifest(ctx.userId, ctx.projectId, rel).catch(() => null));
        lines.push(m ? summaryLine(m) : `${rel} · (no manifest)`);
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  const readManifestTool = tool(
    "read_manifest",
    "Return the FULL JSON manifest for one asset — facts (duration/resolution/fps) plus understanding (transcript, cut candidates, keep segments, caption, etc.) if analyzed. Pass the asset's name OR its path. Use this to reason over an asset's contents before proposing edits, instead of guessing about frames you can't see.",
    {
      asset: z.string().describe("The asset's name (handle) or project-relative path."),
    },
    async ({ asset }) => {
      const candidates = findAssetCandidates(ctx, asset);
      if (candidates.length === 0) {
        return {
          content: [
            { type: "text", text: `No asset matches "${asset}". Call list_assets_summary.` },
          ],
          isError: true,
        };
      }
      if (candidates.length > 1) {
        return { content: [{ type: "text", text: ambiguousMatchText(asset, candidates) }] };
      }
      return { content: [{ type: "text", text: JSON.stringify(candidates[0], null, 2) }] };
    },
  );

  const upsertManifestTool = tool(
    "upsert_manifest",
    "Update an asset's manifest metadata: rename it (change the chat handle), add aliases, or set a one-line summary. Use this to give an asset a clearer name the user referred to, or to record what an asset is. Does NOT touch the analyzed understanding (use the analysis tools for that).",
    {
      asset: z.string().describe("The asset's current name or project-relative path."),
      name: z.string().optional().describe("New chat handle (kebab-case, e.g. 'beach-intro')."),
      addAliases: z.array(z.string()).optional().describe("Extra handles the user might use."),
      summary: z.string().optional().describe("One-line description of what this asset is."),
    },
    async ({ asset, name, addAliases, summary }) => {
      const candidates = findAssetCandidates(ctx, asset);
      if (candidates.length === 0) {
        return {
          content: [
            { type: "text", text: `No asset matches "${asset}". Call list_assets_summary.` },
          ],
          isError: true,
        };
      }
      if (candidates.length > 1) {
        return { content: [{ type: "text", text: ambiguousMatchText(asset, candidates) }] };
      }
      const existing = candidates[0];
      const m = await ensureManifest(ctx.userId, ctx.projectId, existing.path);
      if (name) m.name = name;
      if (addAliases?.length) m.aliases = [...new Set([...m.aliases, ...addAliases])];
      if (summary) m.understanding = { ...m.understanding, summary };
      writeManifest(ctx.userId, ctx.projectId, m);
      return { content: [{ type: "text", text: `OK: ${summaryLine(m)}` }] };
    },
  );

  const getProjectEditTool = tool(
    "get_project_edit",
    "Return the project's current edit-state (the last rendered EDL + how many undo steps are available). Call this to see the current cut before revising it — e.g. the user says 'make it tighter' or 'swap the first two clips'.",
    {},
    async () => {
      const state = readProjectState(ctx.userId, ctx.projectId);
      if (!state) {
        return {
          content: [
            {
              type: "text",
              text: "No edit-state yet — nothing has been rendered with render_edl.",
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `${describeState(state)}\n\nCurrent EDL:\n${JSON.stringify(state.edl, null, 2)}`,
          },
        ],
      };
    },
  );

  const undoProjectEditTool = tool(
    "undo_project_edit",
    "Revert to the PREVIOUS edit-state (conversational undo). Returns the restored EDL — pass it straight to render_edl to re-render the earlier cut. Use when the user says 'undo that', 'go back', or rejects the last change.",
    {},
    async () => {
      const state = undoEdit(ctx.userId, ctx.projectId);
      if (!state) {
        return {
          content: [{ type: "text", text: "Nothing to undo — no earlier edit-state exists." }],
          isError: true,
        };
      }
      return {
        content: [
          {
            type: "text",
            text: `Reverted. ${describeState(state)}\n\nRestored EDL (pass to render_edl):\n${JSON.stringify(state.edl, null, 2)}`,
          },
        ],
      };
    },
  );

  const lintTool = tool(
    "lint_composition",
    "Run the hyperframes linter on the project's index.html. Call this AFTER write_file. If errors are returned, fix them and re-write.",
    {},
    async () => {
      const text = await runLint(ctx.userId, ctx.projectId);
      return { content: [{ type: "text", text }] };
    },
  );

  const listAssetsTool = tool(
    "list_assets",
    "List user-uploaded assets in the project (images, video, audio under assets/).",
    {},
    async () => {
      const assets = listAssets(ctx.userId, ctx.projectId);
      const text = assets.length ? assets.join("\n") : "(no assets uploaded)";
      return { content: [{ type: "text", text }] };
    },
  );

  const listRegistryTool = tool(
    "list_registry_blocks",
    "List reusable hyperframes blocks/components/examples (transitions, VFX, social mocks, etc). This is your palette.",
    {},
    async () => {
      const entries = listRegistry();
      const text = entries.map((e) => `[${e.kind}] ${e.name} — ${e.description}`).join("\n");
      return { content: [{ type: "text", text }] };
    },
  );

  const readRegistryTool = tool(
    "read_registry_block",
    "Read the source of a registry block to study or copy its pattern. Use a name from list_registry_blocks.",
    { name: z.string() },
    async ({ name }) => {
      const content = readRegistryBlock(name);
      if (!content) {
        return {
          content: [{ type: "text", text: `ERROR: block '${name}' not found` }],
          isError: true,
        };
      }
      return { content: [{ type: "text", text: content }] };
    },
  );

  const generateVoiceoverTool = tool(
    "generate_voiceover",
    'Synthesize a narration MP3 from text and save it to assets/. Also saves a .timestamps.json with exact word-level timing — pass that file to generate_captions for perfectly-timed subtitles (no Whisper needed). Use this for long-form videos that need a presenter voice (sleep stories, history docs, finance breakdowns). Once the audio is in the project fold it into the composition as `<audio class="clip" data-start="0" data-duration="<total>" data-track-index="0" data-volume="1">` and time the visuals to the cues from generate_captions.',
    {
      filename: z
        .string()
        .regex(/^[A-Za-z0-9._-]+\.mp3$/)
        .describe("Output filename, e.g. 'narration.mp3'."),
      script: z
        .string()
        .min(2)
        .max(8000)
        .describe(
          "Narration script, ≤8000 chars. Write it EXPRESSIVELY — ElevenLabs gets pacing & emphasis from punctuation/capitalization. End every sentence with . ? or !; use commas for breath pauses, … for dramatic pauses, — for sharp breaks, and CAPITALIZE the 1–2 words per sentence that should land hardest. Use contractions and short, varied sentences. A flat, lightly-punctuated script sounds robotic. No bracketed stage directions like [excited].",
        ),
      voiceId: z
        .string()
        .optional()
        .describe("ElevenLabs voiceId. Defaults to the user's saved brand voice if set."),
      stability: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe(
          "LEAVE UNSET by default (house default 0.45). Only pass a value if the user EXPLICITLY asks to change voice dynamics — and keep it in 0.40–0.50.",
        ),
      style: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe(
          "LEAVE UNSET — house default is 0 (exaggeration OFF). Do not raise it; expressiveness comes from the SCRIPT (CAPS + punctuation), not this. Only change if the user explicitly asks.",
        ),
      similarityBoost: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe(
          "LEAVE UNSET by default (house default 0.75). Only pass a value if the user explicitly asks — keep it in 0.70–0.80.",
        ),
    },
    async ({ filename, script, voiceId, stability, style, similarityBoost }) => {
      // ElevenLabs is the only voice provider — gives exact word timestamps.
      const apiKey = resolveApiKey("elevenlabs", "ELEVENLABS_API_KEY", ctx.apiKeys?.elevenlabs);
      if (!apiKey) {
        return {
          content: [
            {
              type: "text",
              text: `ERROR: No ElevenLabs key configured. Ask the user to paste their ElevenLabs API key at /app/settings/api-keys, then try again.`,
            },
          ],
          isError: true,
        };
      }
      try {
        const { audio, words } = await synthesizeElevenLabsWithTimestamps({
          apiKey,
          script,
          voiceId: voiceId || process.env.ELEVENLABS_DEFAULT_VOICE_ID || "",
          stability,
          style,
          similarityBoost,
        });
        const target = `assets/${filename}`;
        writeProjectFile(ctx.userId, ctx.projectId, target, audio);
        const tsFilename = filename.replace(/\.mp3$/, ".timestamps.json");
        const tsTarget = `assets/${tsFilename}`;
        writeProjectFile(
          ctx.userId,
          ctx.projectId,
          tsTarget,
          Buffer.from(JSON.stringify(words, null, 2), "utf8"),
        );
        const totalDuration = words.length > 0 ? words[words.length - 1].end : 0;
        return {
          content: [
            {
              type: "text",
              text: [
                `OK: wrote ${target} (${audio.length}B, ~${totalDuration.toFixed(1)}s).`,
                `Also wrote ${tsTarget} with ${words.length} word-level timestamps.`,
                `For exact caption timing: generate_captions(timestampsFile="${tsTarget}", maxWordsPerCue=6).`,
                `Reference audio as src="${target}".`,
              ].join("\n"),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const generateImageTool = tool(
    "generate_image",
    'Generate a placeholder background or accent image and save it to the project\'s assets/. Uses the provided palette to compose a noisy gradient — not photorealistic, but a usable filler for scene backgrounds when no real reference is available. Returns the asset path you can reference as `src="assets/..."`.',
    {
      filename: z
        .string()
        .regex(/^[A-Za-z0-9._-]+\.png$/)
        .describe("Output filename, e.g. 'bg-scene1.png'."),
      width: z.number().int().min(64).max(3840).default(1920),
      height: z.number().int().min(64).max(3840).default(1080),
      palette: z
        .array(z.string().regex(/^#[0-9a-fA-F]{6}$/))
        .min(2)
        .max(5)
        .describe("Hex colors. First is base, subsequent are accent stops."),
      direction: z.enum(["radial", "vertical", "diagonal"]).optional().default("radial"),
    },
    async ({ filename, width, height, palette, direction }) => {
      try {
        const buffer = await renderPlaceholderImage({
          width,
          height,
          palette,
          direction: direction || "radial",
        });
        const target = `assets/${filename}`;
        writeProjectFile(ctx.userId, ctx.projectId, target, buffer);
        return {
          content: [
            {
              type: "text",
              text: `OK: wrote ${target} (${width}×${height}, ${buffer.length}B). Reference it in your composition as src="${target}".`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const generateCaptionsTool = tool(
    "generate_captions",
    "Split a script into timed caption cues. If timestampsFile is provided (written by generate_voiceover), uses exact word-level timing from ElevenLabs — no Whisper needed. Otherwise distributes cues evenly across totalDurationSeconds. Returns an array of { text, start, end } in seconds. Use these cues to add a captions track to the composition (overlay <div>s revealed via GSAP timeline). Captions should be ≤6 words per cue for vertical (9:16) and ≤9 for horizontal (16:9).",
    {
      script: z
        .string()
        .describe(
          "Full narration / on-screen script. Sentences are split into shorter cues automatically.",
        ),
      totalDurationSeconds: z
        .number()
        .min(2)
        .max(900)
        .optional()
        .describe(
          "Total composition duration in seconds. Required when timestampsFile is not provided.",
        ),
      maxWordsPerCue: z
        .number()
        .int()
        .min(2)
        .max(20)
        .optional()
        .default(6)
        .describe("Cap on words per caption cue."),
      timestampsFile: z
        .string()
        .optional()
        .describe(
          "Path to a .timestamps.json written by generate_voiceover, e.g. 'assets/narration.timestamps.json'. When present, cues use real word timings instead of even distribution.",
        ),
    },
    async ({ script, totalDurationSeconds, maxWordsPerCue, timestampsFile }) => {
      const cap = maxWordsPerCue ?? 6;
      let cues: CaptionCue[];
      if (timestampsFile) {
        try {
          const raw = readProjectText(ctx.userId, ctx.projectId, timestampsFile);
          const words = JSON.parse(raw) as TranscriptWord[];
          cues = buildCaptionsFromWords(words, [], cap);
        } catch (error) {
          return {
            content: [
              {
                type: "text",
                text: `ERROR reading timestamps file ${timestampsFile}: ${(error as Error).message}`,
              },
            ],
            isError: true,
          };
        }
      } else {
        if (!totalDurationSeconds) {
          return {
            content: [
              {
                type: "text",
                text: "ERROR: totalDurationSeconds is required when timestampsFile is not provided.",
              },
            ],
            isError: true,
          };
        }
        cues = splitScriptIntoCues(script, cap, totalDurationSeconds);
      }
      const totalDur = cues.length > 0 ? cues[cues.length - 1].end : 0;
      return {
        content: [
          {
            type: "text",
            text: [
              `Generated ${cues.length} caption cue(s) across ${totalDur.toFixed(1)}s${timestampsFile ? " (word-level timing from ElevenLabs)" : ""}:`,
              ...cues.map(
                (cue, i) =>
                  `  ${i + 1}. [${cue.start.toFixed(2)}s → ${cue.end.toFixed(2)}s]  ${cue.text}`,
              ),
              "",
              "JSON for direct use in your composition:",
              JSON.stringify(cues),
            ].join("\n"),
          },
        ],
      };
    },
  );

  const analyzeImageTool = tool(
    "analyze_image",
    "Extract a rough color palette (top 5 colors) + average lightness from an image asset in the project. Use this on any reference image the user has dropped in chat to design a matching palette. Path is relative to the project root, usually 'assets/foo.png'.",
    {
      path: z.string().describe("Relative path to an image asset, e.g. 'assets/ref.png'."),
    },
    async ({ path }) => {
      try {
        const file = readProjectFile(ctx.userId, ctx.projectId, path);
        if (!file.mime.startsWith("image/")) {
          return {
            content: [
              {
                type: "text",
                text: `ERROR: ${path} is not an image (${file.mime}).`,
              },
            ],
            isError: true,
          };
        }
        const palette = await extractPalette(file.content);
        const tone =
          palette.avgLightness > 0.6 ? "bright" : palette.avgLightness < 0.3 ? "dark" : "mid";
        const lines = [
          `Palette analysis of ${path}:`,
          `Avg lightness: ${Math.round(palette.avgLightness * 100)}/100 (${tone})`,
          "Top colors (sample → hex):",
          ...palette.colors.map(
            (c, i) => `  ${i + 1}. ${c.hex}  (rgb ${c.r},${c.g},${c.b}, ~${c.percent}%)`,
          ),
        ];
        // Persist the palette as image understanding on the manifest (cached).
        try {
          await setUnderstanding(ctx.userId, ctx.projectId, path, {
            summary: `image · ${tone} tone · palette ${palette.colors
              .slice(0, 3)
              .map((c) => c.hex)
              .join(" ")}`,
            dominantColors: palette.colors.map((c) => c.hex),
          });
        } catch {
          // best-effort
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const captionAssetTool = tool(
    "caption_asset",
    "Generate an AI caption + tags describing what's IN an image asset, saved to its manifest so the AI knows the contents for b-roll selection and references.",
    {
      asset: z.string().describe("The image asset's name (handle) or project-relative path."),
    },
    async ({ asset }) => {
      const m = resolveAssetManifest(ctx, asset);
      if (!m) {
        return {
          content: [
            { type: "text", text: `No asset matches "${asset}". Call list_assets_summary.` },
          ],
          isError: true,
        };
      }
      if (m.kind !== "image") {
        return {
          content: [
            {
              type: "text",
              text: `ERROR: ${m.name} is a ${m.kind}, not an image. caption_asset only works on images.`,
            },
          ],
          isError: true,
        };
      }
      try {
        const file = readProjectFile(ctx.userId, ctx.projectId, m.path);
        const imageDataUri = `data:${file.mime};base64,${file.content.toString("base64")}`;
        // Captioning routes through the Claude vision endpoint (the same proxy
        // the brain uses) — no separate key needed. BYOK anthropic overrides.
        const { caption, tags } = await captionImage({
          apiKey: resolveApiKey("anthropic", "ANTHROPIC_API_KEY", ctx.apiKeys?.anthropic),
          imageDataUri,
        });
        await setUnderstanding(ctx.userId, ctx.projectId, m.path, { caption, tags });
        return {
          content: [
            {
              type: "text",
              text: `Captioned ${m.name}:\n${caption}\nTags: ${tags.join(", ")}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const screenshotTool = tool(
    "screenshot_at_time",
    "Render PNG frame(s) of the current composition at given timestamps. Use this after write_file to visually verify what you built before claiming it's done. The returned images are the actual rendered output — look at them and decide if anything needs fixing.",
    {
      timestamps: z
        .array(z.number().min(0).max(300))
        .min(1)
        .max(4)
        .describe(
          "Up to 4 timestamps in seconds, e.g. [0.5, 2.0, 5.0]. Pick moments that matter (entrance, midpoint, climax, last frame).",
        ),
    },
    async ({ timestamps }) => {
      const result = await runSnapshot(ctx.userId, ctx.projectId, timestamps);
      return { content: result };
    },
  );

  const startRenderTool = tool(
    "start_render",
    "Queue an MP4 render of the current composition. Only call when the user explicitly asks to render. Progress shows in the UI.",
    {
      fps: z.number().int().min(1).max(120).optional().default(30),
      quality: z.enum(["draft", "standard", "high"]).optional().default("standard"),
    },
    async ({ fps, quality }) => {
      try {
        const jobId = await ctx.enqueueRender({ fps, quality });
        return {
          content: [
            {
              type: "text",
              text: `OK: render queued, job id = ${jobId}. The user will see progress in the UI.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const generateImageVariantsTool = tool(
    "generate_image_variants",
    "Generate N candidate images for a scene via the user's Replicate API key, save them to assets/variants/<id>/, and emit a picker block so the user can choose one. Use this when the user explicitly asks for options or for photoreal / model-generated stills (vs. the local placeholder generate_image). After this returns, STOP and wait for the user to pick before referencing any path — the final path will be assets/<sceneSlug>.png after the user clicks a variant.",
    {
      prompt: z
        .string()
        .min(4)
        .max(2000)
        .describe("Image prompt. Include style + subject + key composition cues."),
      sceneSlug: z
        .string()
        .regex(/^[a-z0-9-]+$/)
        .describe(
          "Short slug for the destination asset (e.g. 'hero-bg'). Becomes assets/<sceneSlug>.png once the user picks.",
        ),
      count: z
        .number()
        .int()
        .min(1)
        .max(4)
        .default(4)
        .describe("How many variants to generate. Default 4."),
      aspectRatio: z
        .enum(["1:1", "16:9", "9:16", "4:3", "3:4"])
        .default("16:9")
        .describe("Output aspect ratio."),
      model: z
        .string()
        .optional()
        .describe(
          "Image model id to use (Auto mode only — the user's pinned model wins in Manual mode). E.g. 'flux-schnell' (fast/photoreal), 'flux-pro' (premium), 'ideogram' (clean text/logos), 'midjourney'. Omit to use the default.",
        ),
    },
    async ({ prompt, sceneSlug, count, aspectRatio, model }) => {
      const requested = resolveTaskModel("image", model);
      {
        const credit = chargeGeneration(ctx.userId, requested);
        if (!credit.ok)
          return {
            content: [
              {
                type: "text",
                text: `ERROR: out of generation credits this month (${credit.used}/${credit.limit}). Ask the user to upgrade their plan.`,
              },
            ],
            isError: true,
          };
      }
      const batchId = nanoid(8);
      const dir = `assets/variants/${sceneSlug}-${batchId}`;
      const generated: Array<{ path: string; index: number }> = [];
      const errors: string[] = [];
      // First variant settles which model actually runs (falling back to the
      // official default if the chosen one isn't configured); the rest reuse it.
      let effective = requested;
      let fellBack = false;
      for (let index = 1; index <= (count || 4); index++) {
        try {
          let buffer: Buffer;
          if (index === 1) {
            const r = await withModelFallback("image", requested, (m) =>
              generateImageWithModel({ model: m, apiKeys: ctx.apiKeys, prompt, aspectRatio }),
            );
            buffer = r.result;
            effective = r.usedModel;
            fellBack = r.fellBack;
          } else {
            buffer = await generateImageWithModel({
              model: effective,
              apiKeys: ctx.apiKeys,
              prompt,
              aspectRatio,
            });
          }
          const target = `${dir}/${index}.png`;
          writeProjectFile(ctx.userId, ctx.projectId, target, buffer);
          generated.push({ path: target, index });
        } catch (error) {
          errors.push(`#${index}: ${(error as Error).message}`);
        }
      }
      if (generated.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `ERROR: all variants failed. ${errors.join(" · ")}`,
            },
          ],
          isError: true,
        };
      }
      // The chat UI looks for <variants> ... </variants> JSON tags in
      // tool_result text and renders a picker. The agent should NOT
      // reference any path until the user picks — make that explicit so
      // the model doesn't auto-pick #1 and proceed.
      const marker = JSON.stringify({
        sceneSlug,
        dir,
        targetPath: `assets/${sceneSlug}.png`,
        paths: generated.map((g) => g.path),
      });
      return {
        content: [
          {
            type: "text",
            text: `OK: generated ${generated.length}/${count} variants in ${dir} via ${effective.label}${
              fellBack ? ` (fell back from ${requested.label} — not configured)` : ""
            }. ${
              errors.length ? `Some failed: ${errors.join(" · ")}. ` : ""
            }STOP. Wait for the user to pick one before proceeding — the chat will surface a picker.\n\n<variants>${marker}</variants>`,
          },
        ],
      };
    },
  );

  // -------------------------------------------------------------------------
  // Video clip editing tools (FFmpeg-backed)
  // -------------------------------------------------------------------------

  const planEditTool = tool(
    "plan_edit",
    "REQUIRED FIRST STEP for any footage editing task. Build the complete EDL (Edit Decision List) upfront — segments with grade/speed, overlays, captions — then present a human-readable summary and STOP. On user approval, pass the edl field directly to render_edl. Never call individual FFmpeg tools for something covered by the EDL.",
    {
      // Human-readable summary shown to the user
      summary: z
        .string()
        .describe(
          "Plain-English description of the edit plan. 3–8 bullet points. This is what the user reads and approves.",
        ),
      compositionNeeded: z
        .boolean()
        .describe(
          "True if a Hyperframes index.html will be written around the processed footage after render_edl completes.",
        ),
      // Pre-built EDL — passed directly to render_edl after approval
      edl: z.object({
        version: z.literal(1),
        segments: z
          .array(
            z.object({
              source: z.string().describe("Relative path to source clip."),
              start: z.number().describe("Start time in source (seconds)."),
              end: z.number().describe("End time in source (seconds)."),
              beat: z.string().optional(),
              grade: z
                .union([
                  z.literal("auto").describe("Auto-analyze per clip (recommended default)."),
                  z.literal("none").describe("Skip grading."),
                  z.object({
                    brightness: z.number().min(-1).max(1).optional(),
                    contrast: z.number().min(0).max(2).optional(),
                    saturation: z.number().min(0).max(3).optional(),
                    gamma: z.number().min(0.1).max(10).optional(),
                    temperature: z.enum(["warm", "cool", "neutral"]).optional(),
                  }),
                ])
                .optional(),
              speed: z.number().min(0.25).max(4).optional(),
              background: z
                .object({
                  replaceWith: z.string().describe("Relative asset path to the new background."),
                  chromaKey: z
                    .boolean()
                    .optional()
                    .describe("Greenscreen the source first. Default true."),
                  color: z.string().optional().describe("Key color hex. Default '00FF00' (green)."),
                  similarity: z.number().min(0.01).max(1).optional(),
                  blend: z.number().min(0).max(1).optional(),
                })
                .optional()
                .describe(
                  "Replace this segment's background (greenscreen → composite over replaceWith). For 'put me on a beach' / persona-on-green over a scene.",
                ),
            }),
          )
          .min(1),
        overlays: z
          .array(
            z.object({
              file: z.string(),
              startInOutput: z.number(),
              duration: z.number(),
              x: z.union([z.number(), z.literal("center")]).optional(),
              y: z.union([z.number(), z.literal("center")]).optional(),
              width: z.number().int().optional(),
            }),
          )
          .optional(),
        captions: z
          .array(z.object({ text: z.string(), start: z.number(), end: z.number() }))
          .optional(),
        outputPath: z.string().describe("Relative output path e.g. assets/processed/final.mp4"),
        loudnorm: z
          .boolean()
          .optional()
          .describe("Apply 2-pass -14 LUFS normalization (recommended for social exports)."),
      }),
    },
    async (plan) => {
      const segCount = plan.edl.segments.length;
      const totalDuration = plan.edl.segments
        .reduce((sum, segment) => sum + (segment.end - segment.start) / (segment.speed ?? 1), 0)
        .toFixed(1);
      const overlayCount = plan.edl.overlays?.length ?? 0;
      const captionCount = plan.edl.captions?.length ?? 0;

      const segLines = plan.edl.segments.map((segment, index) => {
        const dur = ((segment.end - segment.start) / (segment.speed ?? 1)).toFixed(1);
        let gradeLabel = "";
        if (segment.grade === "auto") gradeLabel = " · auto-grade";
        else if (segment.grade === "none") gradeLabel = "";
        else if (segment.grade) gradeLabel = ` · ${segment.grade.temperature ?? "grade"}`;
        const speed = segment.speed && segment.speed !== 1 ? ` · ${segment.speed}×` : "";
        return `  ${index + 1}. ${segment.source} [${segment.start}s–${segment.end}s]${gradeLabel}${speed} → ${dur}s${segment.beat ? ` (${segment.beat})` : ""}`;
      });

      const lines = [
        `Edit plan — ${segCount} segment${segCount !== 1 ? "s" : ""}, ~${totalDuration}s output → ${plan.edl.outputPath}`,
        "",
        "Segments:",
        ...segLines,
      ];

      if (overlayCount > 0) {
        lines.push(
          "",
          `Overlays: ${plan.edl.overlays!.map((overlay) => `${overlay.file} at ${overlay.startInOutput}s`).join(", ")}`,
        );
      }
      if (captionCount > 0) {
        lines.push(`Captions: ${captionCount} cues (burned last)`);
      }
      if (plan.compositionNeeded) {
        lines.push("", "After render: write Hyperframes composition around the output.");
      }

      lines.push(
        "",
        "User summary:",
        plan.summary,
        "",
        "EDL is ready. STOP — present this plan to the user and wait for approval before calling render_edl.",
        "On approval: call render_edl with the edl field above exactly as-is.",
      );

      return { content: [{ type: "text", text: lines.join("\n") }] };
    },
  );

  const probeClipTool = tool(
    "probe_clip",
    "Get metadata for a video or audio asset: duration, resolution, fps, has_audio, file size. Call this before any FFmpeg operation that needs clip duration (trim, transition, concat).",
    {
      path: z.string().describe("Relative path to the asset, e.g. 'assets/footage.mp4'."),
    },
    async ({ path }) => {
      try {
        const dir = projectDir(ctx.userId, ctx.projectId);
        const absPath = resolveProjectPath(dir, path);
        const info = await probeClip(absPath);
        return {
          content: [
            {
              type: "text",
              text: [
                `path: ${path}`,
                `duration: ${info.durationSeconds.toFixed(3)}s`,
                `resolution: ${info.width}×${info.height}`,
                `fps: ${info.fps}`,
                `has_audio: ${info.hasAudio}`,
                `size: ${(info.fileSizeBytes / 1024 / 1024).toFixed(2)}MB`,
              ].join("\n"),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const trimClipTool = tool(
    "trim_clip",
    "Cut a video clip to a time range [start, end]. Output is always re-encoded H.264 with correct timestamps. Saves to assets/processed/<output>.",
    {
      input: z.string().describe("Relative path to source clip."),
      output: z.string().describe("Relative output path, e.g. 'assets/processed/trimmed.mp4'."),
      startSeconds: z.number().min(0).describe("Start time in seconds."),
      endSeconds: z
        .number()
        .optional()
        .describe("End time in seconds. Omit to keep to end of clip."),
    },
    async ({ input, output, startSeconds, endSeconds }) => {
      try {
        const dir = projectDir(ctx.userId, ctx.projectId);
        const result = await trimClip({
          inputPath: resolveProjectPath(dir, input),
          outputPath: resolveProjectPath(dir, output),
          startSeconds,
          endSeconds,
        });
        if (!result.ok)
          return { content: [{ type: "text", text: `ERROR: ${result.error}` }], isError: true };
        return {
          content: [
            {
              type: "text",
              text: `OK: trimmed ${input} [${startSeconds}s–${endSeconds ?? "end"}] → ${output}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const trimAudioTool = tool(
    "trim_audio",
    "Cut an audio file (MP3/WAV/AAC) to a time range [start, end] and save as MP3. Use this to remove silence, crop a narration, or extract a section of a music track. Adds 30ms fades at cut boundaries to prevent pops.",
    {
      input: z.string().describe("Relative path to source audio file."),
      output: z
        .string()
        .describe("Relative output path, e.g. 'assets/processed/narration-trimmed.mp3'."),
      startSeconds: z.number().min(0).describe("Start time in seconds."),
      endSeconds: z
        .number()
        .optional()
        .describe("End time in seconds. Omit to keep to end of file."),
    },
    async ({ input, output, startSeconds, endSeconds }) => {
      try {
        const dir = projectDir(ctx.userId, ctx.projectId);
        const result = await trimAudio({
          inputPath: resolveProjectPath(dir, input),
          outputPath: resolveProjectPath(dir, output),
          startSeconds,
          endSeconds,
        });
        if (!result.ok)
          return { content: [{ type: "text", text: `ERROR: ${result.error}` }], isError: true };
        return {
          content: [
            {
              type: "text",
              text: `OK: trimmed audio ${input} [${startSeconds}s–${endSeconds ?? "end"}] → ${output}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const concatClipsTool = tool(
    "concat_clips",
    "Join multiple video clips in order into one output file. Clips are re-encoded for seamless concatenation.",
    {
      inputs: z.array(z.string()).min(2).describe("Ordered list of relative paths to clips."),
      output: z.string().describe("Relative output path, e.g. 'assets/processed/joined.mp4'."),
    },
    async ({ inputs, output }) => {
      try {
        const dir = projectDir(ctx.userId, ctx.projectId);
        const result = await concatClips({
          inputPaths: inputs.map((p) => resolveProjectPath(dir, p)),
          outputPath: resolveProjectPath(dir, output),
        });
        if (!result.ok)
          return { content: [{ type: "text", text: `ERROR: ${result.error}` }], isError: true };
        return {
          content: [{ type: "text", text: `OK: concatenated ${inputs.length} clips → ${output}` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const gradeClipTool = tool(
    "grade_clip",
    "Apply color grading to a video clip: brightness, contrast, saturation, gamma, and a warm/cool temperature shift. Values outside defaults subtly reshape the look.",
    {
      input: z.string().describe("Relative path to source clip."),
      output: z.string().describe("Relative output path."),
      brightness: z
        .number()
        .min(-1)
        .max(1)
        .optional()
        .describe("Brightness offset. 0 = no change. Range -1 to 1."),
      contrast: z
        .number()
        .min(0)
        .max(2)
        .optional()
        .describe("Contrast multiplier. 1.0 = no change."),
      saturation: z
        .number()
        .min(0)
        .max(3)
        .optional()
        .describe("Saturation multiplier. 1.0 = no change. 0 = grayscale."),
      gamma: z.number().min(0.1).max(10).optional().describe("Gamma correction. 1.0 = no change."),
      temperature: z
        .enum(["warm", "cool", "neutral"])
        .optional()
        .describe("Color temperature shift."),
    },
    async ({ input, output, brightness, contrast, saturation, gamma, temperature }) => {
      try {
        const dir = projectDir(ctx.userId, ctx.projectId);
        const result = await gradeClip({
          inputPath: resolveProjectPath(dir, input),
          outputPath: resolveProjectPath(dir, output),
          brightness,
          contrast,
          saturation,
          gamma,
          temperature,
        });
        if (!result.ok)
          return { content: [{ type: "text", text: `ERROR: ${result.error}` }], isError: true };
        return { content: [{ type: "text", text: `OK: graded ${input} → ${output}` }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const chromaKeyTool = tool(
    "chroma_key",
    "Remove a solid color background (green screen / blue screen) from a video clip. Output has the background replaced with transparency (encoded as H.264 — use in composition over another background).",
    {
      input: z.string().describe("Relative path to source clip with solid color background."),
      output: z.string().describe("Relative output path."),
      color: z
        .string()
        .optional()
        .describe(
          "Background hex color without # (e.g. '00FF00' for green, '0000FF' for blue). Default '00FF00'.",
        ),
      similarity: z
        .number()
        .min(0.01)
        .max(1)
        .optional()
        .describe(
          "How broadly to match the color. 0.3 is a good default; increase for uneven lighting.",
        ),
      blend: z.number().min(0).max(1).optional().describe("Edge softness. 0.05 default."),
    },
    async ({ input, output, color, similarity, blend }) => {
      try {
        const dir = projectDir(ctx.userId, ctx.projectId);
        const result = await chromaKey({
          inputPath: resolveProjectPath(dir, input),
          outputPath: resolveProjectPath(dir, output),
          color,
          similarity,
          blend,
        });
        if (!result.ok)
          return { content: [{ type: "text", text: `ERROR: ${result.error}` }], isError: true };
        return { content: [{ type: "text", text: `OK: chroma-keyed ${input} → ${output}` }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const speedClipTool = tool(
    "speed_clip",
    "Change playback speed of a video clip. 2.0 = double speed (shorter), 0.5 = half speed (slow-mo, longer). Audio pitch is adjusted accordingly.",
    {
      input: z.string().describe("Relative path to source clip."),
      output: z.string().describe("Relative output path."),
      factor: z
        .number()
        .min(0.25)
        .max(4)
        .describe(
          "Speed multiplier. 1.0 = normal. 0.5 = slow-mo. 2.0 = fast-forward. Range 0.25–4.0.",
        ),
    },
    async ({ input, output, factor }) => {
      try {
        const dir = projectDir(ctx.userId, ctx.projectId);
        const result = await speedClip({
          inputPath: resolveProjectPath(dir, input),
          outputPath: resolveProjectPath(dir, output),
          factor,
        });
        if (!result.ok)
          return { content: [{ type: "text", text: `ERROR: ${result.error}` }], isError: true };
        return {
          content: [{ type: "text", text: `OK: speed-adjusted ${input} (${factor}×) → ${output}` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const overlayClipTool = tool(
    "overlay_clip",
    "Layer one video clip on top of another (picture-in-picture, watermark, talking-head over footage). The base clip audio is preserved.",
    {
      base: z.string().describe("Relative path to the base (background) clip."),
      overlay: z.string().describe("Relative path to the clip to overlay on top."),
      output: z.string().describe("Relative output path."),
      x: z
        .union([z.number(), z.literal("center")])
        .optional()
        .describe("Horizontal offset in pixels, or 'center'. Default 0."),
      y: z
        .union([z.number(), z.literal("center")])
        .optional()
        .describe("Vertical offset in pixels, or 'center'. Default 0."),
      width: z
        .number()
        .int()
        .optional()
        .describe("Scale overlay to this width in pixels (preserves aspect ratio)."),
      startSeconds: z
        .number()
        .optional()
        .describe(
          "When the overlay appears in the base clip timeline (seconds). Omit for always visible.",
        ),
      durationSeconds: z
        .number()
        .optional()
        .describe("How long the overlay is visible (seconds). Requires startSeconds."),
    },
    async ({ base, overlay, output, x, y, width, startSeconds, durationSeconds }) => {
      try {
        const dir = projectDir(ctx.userId, ctx.projectId);
        const result = await overlayClip({
          basePath: resolveProjectPath(dir, base),
          overlayPath: resolveProjectPath(dir, overlay),
          outputPath: resolveProjectPath(dir, output),
          x,
          y,
          width,
          startSeconds,
          durationSeconds,
        });
        if (!result.ok)
          return { content: [{ type: "text", text: `ERROR: ${result.error}` }], isError: true };
        return {
          content: [{ type: "text", text: `OK: overlaid ${overlay} on ${base} → ${output}` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const addTransitionTool = tool(
    "add_transition",
    "Standalone two-clip xfade for one-off joins OUTSIDE an EDL. For footage edits use the EDL segment's `transitionAfter` instead — this tool shifts the timeline without updating caption offsets. REQUIRED: call probe_clip on clip1 first, then pass its duration as clip1DurationSeconds.",
    {
      clip1: z.string().describe("Relative path to first clip."),
      clip2: z.string().describe("Relative path to second clip."),
      output: z.string().describe("Relative output path."),
      clip1DurationSeconds: z.number().describe("Duration of clip1 in seconds — from probe_clip."),
      type: z
        .enum([
          "fade",
          "fadeblack",
          "fadewhite",
          "wipeleft",
          "wiperight",
          "wipeup",
          "wipedown",
          "slideleft",
          "slideright",
          "circlecrop",
          "dissolve",
        ])
        .optional()
        .describe("Transition type. Default 'fade'."),
      durationSeconds: z
        .number()
        .min(0.1)
        .max(3)
        .optional()
        .describe("Transition duration in seconds. Default 0.5."),
    },
    async ({ clip1, clip2, output, clip1DurationSeconds, type, durationSeconds }) => {
      try {
        const dir = projectDir(ctx.userId, ctx.projectId);
        const result = await addTransition({
          clip1Path: resolveProjectPath(dir, clip1),
          clip2Path: resolveProjectPath(dir, clip2),
          outputPath: resolveProjectPath(dir, output),
          clip1DurationSeconds,
          type: type as XfadeType | undefined,
          durationSeconds,
        });
        if (!result.ok)
          return { content: [{ type: "text", text: `ERROR: ${result.error}` }], isError: true };
        return {
          content: [
            {
              type: "text",
              text: `OK: transition (${type ?? "fade"}, ${durationSeconds ?? 0.5}s) ${clip1} → ${clip2} → ${output}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const mixAudioTool = tool(
    "mix_audio",
    "Combine multiple audio or video files into one mixed audio output. Each input can have its own volume level and start offset. Useful for adding background music to voiceover, or layering SFX.",
    {
      inputs: z
        .array(
          z.object({
            path: z.string().describe("Relative path to audio or video file."),
            volume: z
              .number()
              .min(0)
              .max(2)
              .optional()
              .describe("Volume multiplier. 1.0 = normal. 0.5 = half volume."),
            startSeconds: z
              .number()
              .optional()
              .describe("Delay this track by N seconds in the output mix."),
          }),
        )
        .min(2)
        .describe("Tracks to mix. Minimum 2."),
      output: z
        .string()
        .describe("Relative output path for the mixed audio, e.g. 'assets/processed/mix.mp3'."),
      totalDurationSeconds: z
        .number()
        .optional()
        .describe("Trim output to this duration. Omit to use longest track."),
    },
    async ({ inputs, output, totalDurationSeconds }) => {
      try {
        const dir = projectDir(ctx.userId, ctx.projectId);
        const result = await mixAudio({
          inputs: inputs.map((track) => ({
            path: resolveProjectPath(dir, track.path),
            volume: track.volume,
            startSeconds: track.startSeconds,
          })),
          outputPath: resolveProjectPath(dir, output),
          totalDurationSeconds,
        });
        if (!result.ok)
          return { content: [{ type: "text", text: `ERROR: ${result.error}` }], isError: true };
        return {
          content: [{ type: "text", text: `OK: mixed ${inputs.length} tracks → ${output}` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const extractAudioTool = tool(
    "extract_audio",
    "Rip the audio track from a video file and save it as an MP3. Useful when you need to transcribe speech, remix audio, or use the audio separately from the video.",
    {
      input: z.string().describe("Relative path to source video."),
      output: z
        .string()
        .describe("Relative output path for the audio, e.g. 'assets/processed/audio.mp3'."),
    },
    async ({ input, output }) => {
      try {
        const dir = projectDir(ctx.userId, ctx.projectId);
        const result = await extractAudio({
          inputPath: resolveProjectPath(dir, input),
          outputPath: resolveProjectPath(dir, output),
        });
        if (!result.ok)
          return { content: [{ type: "text", text: `ERROR: ${result.error}` }], isError: true };
        return {
          content: [{ type: "text", text: `OK: extracted audio from ${input} → ${output}` }],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const burnCaptionsTool = tool(
    "burn_captions",
    "Permanently bake caption/subtitle cues into a video clip. The text is rendered directly on the pixels — no separate subtitle track. Pass cues from generate_captions or transcribe_clip.",
    {
      input: z.string().describe("Relative path to source video."),
      output: z.string().describe("Relative output path."),
      cues: z
        .array(
          z.object({
            text: z.string(),
            start: z.number().describe("Start time in seconds."),
            end: z.number().describe("End time in seconds."),
          }),
        )
        .min(1)
        .describe("Caption cues with timing."),
      fontSize: z
        .number()
        .int()
        .min(10)
        .max(80)
        .optional()
        .describe("Font size in points. Default 24."),
      position: z
        .enum(["bottom", "center", "top"])
        .optional()
        .describe("Where captions appear. Default 'bottom'."),
      fontColor: z
        .string()
        .optional()
        .describe("Font color as hex without # (e.g. 'FFFFFF' for white). Default 'FFFFFF'."),
    },
    async ({ input, output, cues, fontSize, position, fontColor }) => {
      try {
        const dir = projectDir(ctx.userId, ctx.projectId);
        const result = await burnCaptions({
          inputPath: resolveProjectPath(dir, input),
          outputPath: resolveProjectPath(dir, output),
          cues,
          fontSize,
          position,
          fontColor,
        });
        if (!result.ok)
          return { content: [{ type: "text", text: `ERROR: ${result.error}` }], isError: true };
        return {
          content: [
            {
              type: "text",
              text: `OK: burned ${cues.length} caption cues into ${input} → ${output}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const transcribeClipTool = tool(
    "transcribe_clip",
    "Transcribe speech in a video or audio file using ElevenLabs Scribe. Returns the full transcript text AND word-level timestamps you can pass directly to generate_captions or burn_captions. Requires a BYOK ElevenLabs key.",
    {
      path: z.string().describe("Relative path to video or audio asset."),
      language: z
        .string()
        .optional()
        .describe("ISO 639-1 language code (e.g. 'en', 'es', 'fr'). Omit for auto-detect."),
    },
    async ({ path, language }) => {
      const apiKey = resolveApiKey("elevenlabs", "ELEVENLABS_API_KEY", ctx.apiKeys?.elevenlabs);
      if (!apiKey) {
        return {
          content: [
            {
              type: "text",
              text: "ERROR: No ElevenLabs key configured. Ask the user to paste their ElevenLabs API key at /app/settings/api-keys, then try again.",
            },
          ],
          isError: true,
        };
      }
      try {
        const dir = projectDir(ctx.userId, ctx.projectId);
        const result = await transcribeClip({
          filePath: resolveProjectPath(dir, path),
          apiKey,
          language,
          // Cache at assets/processed/transcripts/<stem>.json — Hard Rule 9.
          cacheDir: resolveProjectPath(dir, "assets/processed/transcripts"),
        });
        if (!result.ok)
          return { content: [{ type: "text", text: `ERROR: ${result.error}` }], isError: true };

        const wordSummary = result.words?.length
          ? `\n\nWord timestamps (${result.words.length} words):\n${JSON.stringify(result.words)}`
          : "";

        return {
          content: [
            {
              type: "text",
              text: `Transcript:\n${result.transcript}${wordSummary}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const packFootageTool = tool(
    "pack_footage",
    "TEXT-FIRST footage pack — call this FIRST when editing raw footage, before anything else. Transcribes the clip once, then packs the whole timeline into ONE compact text context: duration/resolution/pacing, a timestamped transcript, every filler word + dead pause as CUT candidates, and a ready-to-refine list of KEEP segments (output as EDL-ready JSON). Reason over this text instead of guessing about frames you can't see; tweak the KEEP segments, then feed them straight to render_edl. Requires a BYOK ElevenLabs key (for transcription).",
    {
      path: z
        .string()
        .describe("Relative path to the raw video/audio asset, e.g. 'assets/recording.mp4'."),
      language: z.string().optional().describe("ISO 639-1 code (e.g. 'en'). Omit for auto-detect."),
      minPauseToCut: z
        .number()
        .optional()
        .default(0.6)
        .describe("Silence ≥ this many seconds is flagged as dead space to cut. Default 0.6."),
    },
    async ({ path, language, minPauseToCut }) => {
      const apiKey = resolveApiKey("elevenlabs", "ELEVENLABS_API_KEY", ctx.apiKeys?.elevenlabs);
      if (!apiKey) {
        return {
          content: [
            {
              type: "text",
              text: "ERROR: No ElevenLabs key configured (needed to transcribe). Ask the user to paste their ElevenLabs API key at /app/settings/api-keys.",
            },
          ],
          isError: true,
        };
      }
      try {
        const dir = projectDir(ctx.userId, ctx.projectId);
        const filePath = resolveProjectPath(dir, path);
        const info = await probeClip(filePath);
        const tr = await transcribeClip({
          filePath,
          apiKey,
          language,
          cacheDir: resolveProjectPath(dir, "assets/processed/transcripts"),
        });
        if (!tr.ok || !tr.words || tr.words.length === 0) {
          return {
            content: [{ type: "text", text: `ERROR: ${tr.error || "no speech detected"}` }],
            isError: true,
          };
        }
        const words = tr.words;
        const duration = info.durationSeconds || words[words.length - 1].end;
        const pacing = analyzePacing(words, duration);
        const threshold = minPauseToCut ?? 0.6;
        const fillers = detectFillerWords(words).filter((f) => f.reason === "filler_word");
        const deadPauses = pacing.longPauses.filter((p) => p.duration >= threshold);

        // Cut intervals = filler words + dead pauses, merged. Both come from word
        // boundaries, so the KEEP complement is already word-aligned (no mid-word cuts).
        type Cut = { start: number; end: number; label: string };
        const cuts: Cut[] = [
          ...fillers.map((f) => ({
            start: f.start,
            end: f.end,
            label: `filler "${f.word.trim()}"`,
          })),
          ...deadPauses.map((p) => ({
            start: p.start,
            end: p.end,
            label: `pause ${p.duration.toFixed(1)}s`,
          })),
        ].sort((a, b) => a.start - b.start);
        const merged: Cut[] = [];
        for (const c of cuts) {
          const last = merged[merged.length - 1];
          if (last && c.start <= last.end + 0.05) {
            last.end = Math.max(last.end, c.end);
            last.label += `, ${c.label}`;
          } else merged.push({ ...c });
        }
        const keeps: Array<{ source: string; start: number; end: number }> = [];
        let cursor = 0;
        for (const c of merged) {
          if (c.start - cursor > 0.15)
            keeps.push({ source: path, start: round2(cursor), end: round2(c.start) });
          cursor = Math.max(cursor, c.end);
        }
        if (duration - cursor > 0.15)
          keeps.push({ source: path, start: round2(cursor), end: round2(duration) });

        // Timestamped transcript, line-broken on dead pauses / every ~12 words.
        const tcLines: string[] = [];
        let line: string[] = [];
        let lineStart = words[0].start;
        for (let i = 0; i < words.length; i++) {
          if (line.length === 0) lineStart = words[i].start;
          line.push(words[i].word.trim());
          const gapNext = i + 1 < words.length ? words[i + 1].start - words[i].end : 0;
          if (line.length >= 12 || gapNext >= threshold || i === words.length - 1) {
            tcLines.push(`[${fmtTc(lineStart)}] ${line.join(" ")}`);
            line = [];
          }
        }

        const cutTime = merged.reduce((s, c) => s + (c.end - c.start), 0);
        const keptTime = keeps.reduce((s, k) => s + (k.end - k.start), 0);
        const header = [
          `# Footage pack — ${path}`,
          `Duration ${duration.toFixed(1)}s${info.width ? ` · ${info.width}x${info.height}` : ""}${info.fps ? ` @ ${info.fps}fps` : ""} · audio ${info.hasAudio ? "yes" : "no"}`,
          `Pacing: ${pacing.recommendation}`,
          `Tightening: ${merged.length} cut candidates remove ~${cutTime.toFixed(1)}s → final ~${keptTime.toFixed(1)}s.`,
          ``,
          `## Cut candidates (fillers + dead space)`,
          merged.length
            ? merged.map((c) => `- ${fmtTc(c.start)}–${fmtTc(c.end)} (${c.label})`).join("\n")
            : "- none — footage is already tight.",
          ``,
          `## KEEP segments — EDL-ready (refine, then pass to render_edl)`,
          "```json",
          JSON.stringify(keeps),
          "```",
          ``,
          `## Timestamped transcript`,
        ].join("\n");
        const fullPack = `${header}\n${tcLines.join("\n")}\n`;

        // Persist the pack alongside the footage (text-first session memory).
        const stem =
          path
            .split("/")
            .pop()
            ?.replace(/\.[^.]+$/, "") || "clip";
        const packPath = `edit/${stem}.pack.md`;
        writeProjectFile(ctx.userId, ctx.projectId, packPath, fullPack);

        // Persist the understanding onto the asset's manifest (cached, reused by
        // read_manifest / list_assets_summary across the whole edit session).
        try {
          const transcriptText = words.map((w) => w.word.trim()).join(" ");
          await setUnderstanding(ctx.userId, ctx.projectId, path, {
            summary: `${duration.toFixed(0)}s clip — ${transcriptText.split(" ").slice(0, 16).join(" ")}…`,
            transcript: words,
            transcriptText,
            cuts: merged.map((c) => ({ start: c.start, end: c.end, label: c.label })),
            keepSegments: keeps.map((k) => ({ start: k.start, end: k.end })),
            pacing: pacing.recommendation,
          });
        } catch {
          // best-effort — manifest write must not fail the pack
        }

        // Keep the returned context bounded; the full transcript is on disk.
        const returned =
          fullPack.length > 24_000
            ? `${header}\n(${tcLines.length} transcript lines — full pack saved to ${packPath}; read_file it for the words.)\n`
            : `${fullPack}\n(Saved to ${packPath}.)`;
        return { content: [{ type: "text", text: returned }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const buildCaptionsFromWordsTool = tool(
    "build_captions_from_words",
    "Convert Whisper word-level timestamps into output-timeline caption cues for an EDL. ALWAYS call this after transcribe_clip — never hand-compute caption offsets. Handles segment snipping, speed adjustment, and output-timeline remapping (Hard Rule 5).",
    {
      words: z
        .array(
          z.object({
            word: z.string(),
            start: z.number().describe("Word start in SOURCE clip (seconds from transcribe_clip)."),
            end: z.number().describe("Word end in SOURCE clip (seconds from transcribe_clip)."),
          }),
        )
        .min(1)
        .describe("Word timestamps from transcribe_clip."),
      segments: z
        .array(
          z.object({
            source: z.string(),
            start: z.number(),
            end: z.number(),
            speed: z.number().optional(),
          }),
        )
        .min(1)
        .describe("The exact same segments that will go into render_edl."),
      chunkSize: z
        .number()
        .int()
        .min(1)
        .max(6)
        .optional()
        .default(2)
        .describe(
          "Words per caption line. 2 = bold-overlay style (default). 4-7 = natural-sentence style.",
        ),
    },
    async ({ words, segments, chunkSize }) => {
      try {
        const cues = buildCaptionsFromWords(
          words as TranscriptWord[],
          segments as EdlSegment[],
          chunkSize ?? 2,
        );
        return {
          content: [
            {
              type: "text",
              text: `OK: ${cues.length} caption cues (output-timeline):\n${JSON.stringify(cues)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const snapToBoundaryTool = tool(
    "snap_to_boundary",
    "Snap a raw timestamp to the nearest word boundary from a Whisper transcript. Use this when building EDL segments to avoid mid-phoneme cuts (Hard Rules 6+7). Direction 'before' = snap to end of last word before target (use for segment end). Direction 'after' = snap to start of next word after target (use for segment start).",
    {
      targetSeconds: z.number().describe("Raw timestamp to snap (seconds)."),
      words: z
        .array(
          z.object({
            word: z.string(),
            start: z.number(),
            end: z.number(),
          }),
        )
        .min(1),
      direction: z
        .enum(["before", "after"])
        .describe("'before' for segment end, 'after' for segment start."),
      padSeconds: z
        .number()
        .optional()
        .describe(
          "Extra silence pad after snapping. Default: 0.08s for 'before', 0.05s for 'after'.",
        ),
    },
    async ({ targetSeconds, words, direction, padSeconds }) => {
      try {
        const snapped = snapToBoundary({
          targetSeconds,
          words: words as TranscriptWord[],
          direction,
          padSeconds,
        });
        return {
          content: [
            {
              type: "text",
              text: `Snapped: ${targetSeconds.toFixed(3)}s → ${snapped.toFixed(3)}s (${direction}, pad ${padSeconds ?? (direction === "before" ? 0.08 : 0.05)}s)`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const autoGradeFilterTool = tool(
    "auto_grade_filter",
    "Analyze a clip's luma and saturation (signalstats) and return the ffmpeg filter string that would correct it subtly. Informational — render_edl applies this automatically when grade='auto'. Call this if you want to preview or override the auto correction.",
    {
      path: z.string().describe("Relative path to the clip to analyze."),
    },
    async ({ path }) => {
      try {
        const dir = projectDir(ctx.userId, ctx.projectId);
        const filterStr = await autoGradeFilter(resolveProjectPath(dir, path));
        return {
          content: [
            {
              type: "text",
              text: filterStr
                ? `Auto-grade filter for ${path}:\n${filterStr}`
                : `${path} is already balanced — no correction needed.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const computeSegmentOffsetsTool = tool(
    "compute_segment_offsets",
    "Return the cumulative output-timeline start time for each EDL segment. Useful for manually verifying that overlays or captions will land at the right time.",
    {
      segments: z
        .array(
          z.object({
            source: z.string(),
            start: z.number(),
            end: z.number(),
            speed: z.number().optional(),
          }),
        )
        .min(1),
    },
    async ({ segments }) => {
      try {
        const offsets = computeSegmentOffsets(segments as EdlSegment[]);
        const lines = segments.map((seg, i) => {
          const dur = (seg.end - seg.start) / (seg.speed ?? 1);
          return `  seg ${i + 1}: starts at ${(offsets[i] ?? 0).toFixed(3)}s → ends at ${((offsets[i] ?? 0) + dur).toFixed(3)}s`;
        });
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const validateEdlTool = tool(
    "validate_edl",
    "REQUIRED before render_edl. Deterministically lints an EDL against the quality bar — scene durations (1.5–3.5s ideal), 6+ varied scenes, narrative-arc beat labels, grade variety, duplicate cuts, captions inside the output timeline, and (if you pass words) mid-word cuts. Returns errors (must fix) and warnings (should fix). Fix issues here BEFORE rendering instead of rendering and visually re-inspecting.",
    {
      segments: z
        .array(
          z.object({
            source: z.string(),
            start: z.number(),
            end: z.number(),
            beat: z.string().optional(),
            grade: z.unknown().optional(),
            speed: z.number().optional(),
            transitionAfter: z
              .object({ duration: z.number() })
              .optional()
              .describe("Cross-fade into the next segment (duration in seconds)."),
          }),
        )
        .min(1)
        .describe("The exact segments that will go into render_edl."),
      captions: z
        .array(z.object({ text: z.string(), start: z.number(), end: z.number() }))
        .optional()
        .describe("Output-timeline caption cues, if any."),
      words: z
        .array(z.object({ word: z.string(), start: z.number(), end: z.number() }))
        .optional()
        .describe("Transcript words for the segments' source — enables mid-word-cut detection."),
      beats: z
        .array(z.number())
        .optional()
        .describe(
          "Beat times from detect_beats — enables off-beat cut detection when using music.",
        ),
    },
    async ({ segments, captions, words, beats }) => {
      try {
        const { ok, issues } = validateEdl(
          {
            segments: segments as EdlSegment[],
            captions: captions as CaptionCue[] | undefined,
          },
          { words: words as TranscriptWord[] | undefined, beats: beats as number[] | undefined },
        );
        if (issues.length === 0) {
          return {
            content: [{ type: "text", text: "✓ EDL passes all checks — safe to render_edl." }],
          };
        }
        const lines = issues.map(
          (issue) =>
            `${issue.level === "error" ? "✗ ERROR" : "⚠ WARN"} [${issue.code}] ${issue.message}`,
        );
        const header = ok
          ? "EDL is renderable but has warnings — address these for a stronger edit:"
          : "EDL has ERRORS — fix them before render_edl:";
        return { content: [{ type: "text", text: `${header}\n${lines.join("\n")}` }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  const estimateCreditsTool = tool(
    "estimate_credits",
    "Estimate the credit cost of a planned set of actions and compare it to the user's balance BEFORE doing them. Use this whenever you're about to render or generate assets so you can tell the user the rough cost first. Costs: edit (per request), render_30s (units = number of 30s blocks of final output, so a 90s render = 3 units; drafts are free — don't count them), image (each), broll (each — most expensive), voiceover_30s (units = 30s blocks), music (each). Captions/transcription are free.",
    {
      actions: z
        .array(
          z.object({
            action: z.enum(["edit", "render_30s", "image", "broll", "voiceover_30s", "music"]),
            units: z
              .number()
              .min(1)
              .default(1)
              .describe(
                "Quantity, e.g. 3 for three images. For render_30s / voiceover_30s this is the number of 30-second blocks (ceil).",
              ),
          }),
        )
        .min(1)
        .describe("The actions you plan to perform."),
    },
    async ({ actions }) => {
      const costs = getCreditCosts();
      let total = 0;
      const lines = actions.map((item) => {
        const units = Math.max(1, Math.ceil(item.units ?? 1));
        const each = costs[item.action as CreditAction] ?? 0;
        const subtotal = each * units;
        total += subtotal;
        return `- ${item.action} ×${units}: ${subtotal} cr`;
      });
      const balance = creditBalance(ctx.userId);
      const balanceText =
        balance.total === -1 ? "unlimited" : `${balance.total.toLocaleString()} credits`;
      const warning =
        balance.total !== -1 && total > balance.total
          ? "\n⚠ This exceeds the user's balance — tell them and suggest a top-up or upgrade before proceeding."
          : "";
      return {
        content: [
          {
            type: "text",
            text: `Estimated cost: ${total} credits\n${lines.join("\n")}\nUser balance: ${balanceText}.${warning}\n\nTell the user this rough cost before you proceed.`,
          },
        ],
      };
    },
  );

  const xfadeEnum = z.enum([
    "fade",
    "fadeblack",
    "fadewhite",
    "wipeleft",
    "wiperight",
    "wipeup",
    "wipedown",
    "slideleft",
    "slideright",
    "slideup",
    "slidedown",
    "circlecrop",
    "circleopen",
    "circleclose",
    "dissolve",
    "smoothleft",
    "smoothright",
    "smoothup",
    "smoothdown",
    "radial",
    "zoomin",
    "pixelize",
    "hlwind",
    "diagtl",
    "diagbr",
  ]);

  const transitionAfterSchema = z
    .object({
      type: xfadeEnum.describe("Cross-fade style into the next segment."),
      duration: z
        .number()
        .min(0.1)
        .max(2)
        .describe("Overlap length in seconds. Keep short (0.3–0.5s) and motivated."),
    })
    .optional()
    .describe(
      "Cross-fade from this segment into the next instead of a hard cut. Default to hard cuts; use 1–2 motivated transitions per video. The output shortens by `duration` and caption timing is adjusted automatically.",
    );

  const gradeFieldSchema = z
    .union([
      z.literal("auto").describe("Auto-analyze per clip — recommended default for footage."),
      z.literal("none").describe("Skip grading."),
      z.object({
        look: z
          .enum(["teal-orange", "film-warm", "moody-cool", "bw-contrast", "vibrant"])
          .optional()
          .describe(
            "Named cinematic look, applied before manual tweaks. teal-orange = blockbuster; film-warm = nostalgic; moody-cool = thriller; bw-contrast = high-contrast B&W; vibrant = punchy product/hype.",
          ),
        brightness: z.number().min(-1).max(1).optional(),
        contrast: z.number().min(0).max(2).optional(),
        saturation: z.number().min(0).max(3).optional(),
        gamma: z.number().min(0.1).max(10).optional(),
        temperature: z.enum(["warm", "cool", "neutral"]).optional(),
      }),
    ])
    .optional()
    .describe(
      "Per-segment color grade. Use 'auto' for natural correction, or an object with a `look` for a cinematic style. Keep the look consistent across a video unless a scene calls for contrast.",
    );

  const renderEdlTool = tool(
    "render_edl",
    "Execute a complete edit: per-segment extract with auto-grade + automatic 30ms audio fades (no pops), lossless concat, overlays with correct PTS shift, captions burned LAST, and optional -14 LUFS loudness normalization. Preferred for any multi-segment edit — one call instead of chaining tools.",
    {
      edl: z
        .object({
          version: z.literal(1),
          segments: z
            .array(
              z.object({
                source: z.string().describe("Relative path to source clip."),
                start: z
                  .number()
                  .describe(
                    "Start time in source (seconds). Snap to word.start - 0.05 after transcription.",
                  ),
                end: z
                  .number()
                  .describe(
                    "End time in source (seconds). Snap to word.end + 0.08 after transcription.",
                  ),
                beat: z.string().optional().describe("Label e.g. HOOK, PROBLEM, CTA."),
                grade: gradeFieldSchema,
                transform: z
                  .object({
                    startScale: z
                      .number()
                      .min(1)
                      .max(3)
                      .optional()
                      .describe("Zoom at start. 1 = none."),
                    endScale: z
                      .number()
                      .min(1)
                      .max(3)
                      .optional()
                      .describe("Zoom at end. Differ from startScale for a moving push."),
                    panX: z.number().min(-1).max(1).optional().describe("Horizontal drift, -1..1."),
                    panY: z.number().min(-1).max(1).optional().describe("Vertical drift, -1..1."),
                  })
                  .optional()
                  .describe(
                    "Keyframed camera move on real footage. Punch-in: startScale 1 → endScale ~1.15 for emphasis on a hook/reaction. Ken Burns: a slow push (e.g. 1 → 1.12) with a small pan on a static shot or photo. Use sparingly — 1–3 per video on beats that deserve emphasis.",
                  ),
                speed: z
                  .number()
                  .min(0.25)
                  .max(4)
                  .optional()
                  .describe("Speed multiplier. Default 1.0."),
                background: z
                  .object({
                    replaceWith: z
                      .string()
                      .describe("Relative asset path to the new background (image or video)."),
                    chromaKey: z
                      .boolean()
                      .optional()
                      .describe("Key out a solid color first (greenscreen). Default true."),
                    color: z
                      .string()
                      .optional()
                      .describe(
                        "Key color hex, e.g. '00FF00' (green) or '0000FF' (blue). Default green.",
                      ),
                    similarity: z
                      .number()
                      .min(0.01)
                      .max(1)
                      .optional()
                      .describe(
                        "Chroma similarity 0.01–1.0. Raise if green remains; lower if edges erode. Default 0.30.",
                      ),
                    blend: z
                      .number()
                      .min(0)
                      .max(1)
                      .optional()
                      .describe("Edge blend 0.0–1.0. Default 0.10."),
                  })
                  .optional()
                  .describe(
                    "Replace this segment's background: greenscreen the source and composite over replaceWith. Use for 'put me on a beach', 'change my background', or compositing a persona shot on green over any scene. One conversational, undoable edit.",
                  ),
                transitionAfter: transitionAfterSchema,
              }),
            )
            .min(1)
            .describe("Segments in playback order."),
          overlays: z
            .array(
              z.object({
                file: z.string().describe("Relative path to overlay clip or animation render."),
                startInOutput: z
                  .number()
                  .describe("When overlay appears in output timeline (seconds)."),
                duration: z.number().describe("How long overlay is visible (seconds)."),
                x: z.union([z.number(), z.literal("center")]).optional(),
                y: z.union([z.number(), z.literal("center")]).optional(),
                width: z.number().int().optional().describe("Scale overlay to this pixel width."),
              }),
            )
            .optional()
            .describe("Animation/clip overlays. PTS is shifted automatically."),
          captions: z
            .array(
              z.object({
                text: z.string(),
                start: z
                  .number()
                  .describe(
                    "Output-timeline start (NOT source timestamp). Use build_captions_from_words.",
                  ),
                end: z
                  .number()
                  .describe(
                    "Output-timeline end (NOT source timestamp). Use build_captions_from_words.",
                  ),
                style: z
                  .enum(["clean", "bold", "karaoke", "minimal", "documentary"])
                  .optional()
                  .describe("Override captionStyle for this one cue (e.g. emphasise a hook word)."),
              }),
            )
            .optional()
            .describe(
              "Caption cues in OUTPUT timeline. Applied LAST after all overlays. Build with build_captions_from_words after transcription.",
            ),
          captionStyle: z
            .enum(["clean", "bold", "karaoke", "minimal", "documentary"])
            .optional()
            .describe(
              "Caption look for the whole video (default 'clean'). 'bold'/'karaoke' = big animated word-pop (use build_captions_from_words with chunkSize 1 so each word pops); 'minimal' = small/subtle; 'documentary' = serif lower-third. Persist the user's pick via save_insight.",
            ),
          music: z
            .object({
              file: z.string().describe("Relative asset path to the music track."),
              gainDb: z
                .number()
                .optional()
                .describe("Music level before ducking, dB. Default -12 (background bed)."),
              duck: z
                .boolean()
                .optional()
                .describe(
                  "Side-chain duck the music under the voice (default true) so it drops while anyone talks and swells in the gaps. Set false for pure-music / no-narration edits.",
                ),
            })
            .optional()
            .describe(
              "Background music bed mixed under the whole edit, auto-ducked under voice. One field instead of manual mix_audio keyframing.",
            ),
          outputPath: z
            .string()
            .describe("Relative output path, e.g. 'assets/processed/final.mp4'."),
          loudnorm: z
            .boolean()
            .optional()
            .describe(
              "2-pass -14 LUFS normalization. Set true for social exports (Reels, Shorts, TikTok).",
            ),
          quality: z
            .enum(["draft", "final"])
            .optional()
            .describe(
              "'draft' = 480p/ultrafast/crf28 for a fast look at the cut (use during review iterations). 'final' (default) = 1080p/crf18. Render 'draft' first, then 'final' once approved.",
            ),
        })
        .describe("Edit Decision List."),
      intent: z
        .string()
        .optional()
        .describe(
          "Short note on what this edit does, e.g. 'remove filler', 'tighten + captions'. Recorded as a revision so the user can undo it conversationally.",
        ),
    },
    async ({ edl, intent }) => {
      try {
        const dir = projectDir(ctx.userId, ctx.projectId);
        const result = await renderEdl({
          edl: edl as EditDecisionList,
          projectRootDir: dir,
        });
        if (!result.ok) {
          return { content: [{ type: "text", text: `ERROR: ${result.error}` }], isError: true };
        }
        // Persist the rendered EDL as the project's edit-state (enables undo).
        let undoNote = "";
        try {
          const state = applyEdit(
            ctx.userId,
            ctx.projectId,
            edl as EditDecisionList,
            intent || "edit",
            { mode: "edit" },
          );
          undoNote = ` · ${state.revisions.length} undo step(s) available`;
        } catch {
          // best-effort — persistence must not fail the render
        }
        const segCount = edl.segments.length;
        const overlayCount = edl.overlays?.length ?? 0;
        const captionCount = edl.captions?.length ?? 0;
        const bgCount = edl.segments.filter((s) => s.background?.replaceWith).length;
        return {
          content: [
            {
              type: "text",
              text: `OK: rendered EDL → ${edl.outputPath} (${segCount} segment${segCount !== 1 ? "s" : ""}${bgCount ? `, ${bgCount} background-replaced` : ""}${overlayCount ? `, ${overlayCount} overlay${overlayCount !== 1 ? "s" : ""}` : ""}${captionCount ? `, ${captionCount} captions` : ""})${undoNote}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  // --- Feature 1: analyze_clip (give the agent eyes) ---
  const analyzeClipTool = tool(
    "analyze_clip",
    "Extract evenly-spaced frames from a video clip and return them as images so you can visually inspect the footage before making editing decisions. Call this before plan_edit when the user uploads new footage. Frames are JPEG at 360px wide — enough to understand composition, colour, and content.",
    {
      filePath: z.string().describe("Relative path to the clip, e.g. 'assets/raw.mp4'."),
      frameCount: z
        .number()
        .int()
        .min(1)
        .max(4)
        .optional()
        .describe("Number of frames to extract (default 3, max 4). Capped to keep payload small."),
    },
    async ({ filePath, frameCount }) => {
      try {
        const dir = projectDir(ctx.userId, ctx.projectId);
        const abs = resolveProjectPath(dir, filePath);
        const { frames, error } = await extractClipFrames(abs, frameCount ?? 3);
        if (error && frames.length === 0) {
          return { content: [{ type: "text", text: `ERROR: ${error}` }], isError: true };
        }
        const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> = [
          {
            type: "text",
            text: `Extracted ${frames.length} frame${frames.length !== 1 ? "s" : ""} from ${filePath}:`,
          },
        ];
        for (const frame of frames) {
          content.push({ type: "image", data: frame, mimeType: "image/jpeg" });
        }
        return { content };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  // Recreate-from-reference: turn a reference clip into a structured style brief
  // (grade / pacing / typography / effects) the model maps onto registry blocks
  // and grade/typography presets when building an ORIGINAL composition. Used by
  // PATH R in the system prompt.
  const planRecreationTool = tool(
    "plan_recreation",
    "Analyze a reference clip the user wants to RECREATE THE STYLE of (an imported clip, source='import') and return a structured brief: color grade, cut pacing, typography, named effects/transitions, and a one-paragraph plan. Use this before plan_composition when the user asks to recreate/copy the vibe of a reference video. You then rebuild it as an ORIGINAL composition using registry blocks + grade/typography presets — never re-host the source footage.",
    {
      filePath: z
        .string()
        .describe("Relative path to the reference clip, e.g. 'assets/reference.mp4'."),
      frameCount: z
        .number()
        .int()
        .min(1)
        .max(4)
        .optional()
        .describe("Frames to sample for the analysis (default 4, max 4)."),
    },
    async ({ filePath, frameCount }) => {
      try {
        const dir = projectDir(ctx.userId, ctx.projectId);
        const abs = resolveProjectPath(dir, filePath);
        const { frames, error } = await extractClipFrames(abs, frameCount ?? 4);
        if (frames.length === 0) {
          return {
            content: [{ type: "text", text: `ERROR: ${error ?? "no frames extracted"}` }],
            isError: true,
          };
        }
        const brief = await describeForRecreation({
          frames: frames.map((frame) => `data:image/jpeg;base64,${frame}`),
        });
        const text = [
          "RECREATION BRIEF (rebuild as an original composition — do not reuse the source footage):",
          `• Grade: ${brief.grade || "—"}`,
          `• Pacing: ${brief.pacing || "—"}`,
          `• Typography: ${brief.typography || "—"}`,
          `• Effects: ${brief.effects.length ? brief.effects.join(", ") : "—"}`,
          `• Layout: ${brief.layout || "—"}`,
          "",
          brief.summary,
        ].join("\n");
        return { content: [{ type: "text", text }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  // --- Feature 2: review_render (self-correction loop) ---
  const reviewRenderTool = tool(
    "review_render",
    "After the final render_edl, call this ONCE as a verification pass. BEST PRACTICE: pass `cutBoundaries` (the output-timeline cut times from compute_segment_offsets) so it samples the frame right AFTER each cut. validate_edl already gated pacing/captions and render_edl conforms every segment to one format, so this confirms the result rather than driving a retry loop. If a real defect appears, fix its root cause (re-snap the boundary, adjust the EDL) and re-render — don't blindly re-roll.",
    {
      outputPath: z
        .string()
        .describe(
          "Relative output path from the render_edl call, e.g. 'assets/processed/final.mp4'.",
        ),
      cutBoundaries: z
        .array(z.number())
        .optional()
        .describe(
          "Output-timeline seconds where cuts occur (the cumulative kept-segment offsets from compute_segment_offsets, excluding 0 and the final end). Each is inspected just after the cut. Up to 4 checked per call — call again with the rest if there are more.",
        ),
      frameCount: z
        .number()
        .int()
        .min(1)
        .max(4)
        .optional()
        .describe("Even-spaced frames to sample when cutBoundaries is omitted (default 3, max 4)."),
    },
    async ({ outputPath, cutBoundaries, frameCount }) => {
      try {
        const dir = projectDir(ctx.userId, ctx.projectId);
        const abs = resolveProjectPath(dir, outputPath);

        if (cutBoundaries && cutBoundaries.length > 0) {
          // Sample just after each cut, where seam defects appear.
          const probes = cutBoundaries.map((b) => b + 0.06);
          const { frames, usedTimestamps, error } = await extractFramesAt(abs, probes);
          if (error && frames.length === 0) {
            return { content: [{ type: "text", text: `ERROR: ${error}` }], isError: true };
          }
          const more =
            cutBoundaries.length > usedTimestamps.length
              ? ` (showing the first ${usedTimestamps.length} of ${cutBoundaries.length} cuts — call again with the rest.)`
              : "";
          const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> =
            [
              {
                type: "text",
                text: `Cut-boundary review — frames sampled just after cuts at ${usedTimestamps
                  .map((t) => `${t.toFixed(2)}s`)
                  .join(
                    ", ",
                  )} in ${outputPath}.${more}\nFor EACH frame check: (1) not black or frozen, (2) no mid-action / mid-word jump, (3) captions present and aligned, (4) no color/exposure pop vs the previous segment. If a cut fails: re-snap that boundary with snap_to_boundary or add a short crossfade, then re-render and re-review. Repeat up to 3×.`,
              },
            ];
          for (const frame of frames) {
            content.push({ type: "image", data: frame, mimeType: "image/jpeg" });
          }
          return { content };
        }

        const { frames, error } = await extractClipFrames(abs, frameCount ?? 3);
        if (error && frames.length === 0) {
          return { content: [{ type: "text", text: `ERROR: ${error}` }], isError: true };
        }
        const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> = [
          {
            type: "text",
            text: `Render review — ${frames.length} frame${frames.length !== 1 ? "s" : ""} from ${outputPath}. Check for: abrupt cuts, incorrect colors, missing/misaligned captions, black frames. For a per-cut check, call again with cutBoundaries.`,
          },
        ];
        for (const frame of frames) {
          content.push({ type: "image", data: frame, mimeType: "image/jpeg" });
        }
        return { content };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  // --- Feature 3a: detect_filler_words ---
  const detectFillerWordsTool = tool(
    "detect_filler_words",
    "Analyze transcript words to find filler words (um, uh, like, you know, etc.) and hesitation pauses (>300ms silence before a word). Returns timestamped list of words to consider removing when building the EDL.",
    {
      words: z
        .array(
          z.object({
            word: z.string(),
            start: z.number(),
            end: z.number(),
          }),
        )
        .describe("TranscriptWord array from transcribe_clip."),
      pauseThresholdSeconds: z
        .number()
        .optional()
        .describe("Min silence gap to flag as hesitation (default 0.3s)."),
    },
    async ({ words, pauseThresholdSeconds }) => {
      const fillers = detectFillerWords(words as TranscriptWord[], { pauseThresholdSeconds });
      if (fillers.length === 0) {
        return {
          content: [{ type: "text", text: "No filler words or hesitation pauses detected." }],
        };
      }
      const lines = fillers.map(
        (filler) =>
          `${filler.start.toFixed(2)}s–${filler.end.toFixed(2)}s  "${filler.word}"  (${filler.reason})`,
      );
      return {
        content: [
          {
            type: "text",
            text: `Found ${fillers.length} filler${fillers.length !== 1 ? "s" : ""}:\n${lines.join("\n")}\n\nExclude these words when building EDL segments to tighten the edit.`,
          },
        ],
      };
    },
  );

  // --- Feature 3b: apply_noise_reduction ---
  const applyNoiseReductionTool = tool(
    "apply_noise_reduction",
    "Apply background noise reduction (anlmdn filter) to a clip's audio. Use before including in EDL to clean up room noise, hiss, or hum. Strength 0–1 (default 0.5).",
    {
      inputPath: z.string().describe("Relative path to source clip."),
      outputPath: z.string().describe("Relative output path, e.g. 'assets/processed/clean.mp4'."),
      strength: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Noise reduction strength 0–1. Default 0.5."),
    },
    async ({ inputPath, outputPath, strength }) => {
      try {
        const dir = projectDir(ctx.userId, ctx.projectId);
        const absIn = resolveProjectPath(dir, inputPath);
        const absOut = resolveProjectPath(dir, outputPath);
        const result = await applyNoiseReduction({
          inputPath: absIn,
          outputPath: absOut,
          strength,
        });
        if (!result.ok) {
          return { content: [{ type: "text", text: `ERROR: ${result.error}` }], isError: true };
        }
        return {
          content: [
            {
              type: "text",
              text: `OK: noise reduction applied (strength=${strength ?? 0.5}) → ${outputPath}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  // --- remove_background_noise (AI voice isolation, anlmdn fallback) ---
  const removeBackgroundNoiseTool = tool(
    "remove_background_noise",
    "Remove background noise from a clip's audio and isolate the voice. Default uses ElevenLabs AI voice isolation (best for real-world noise: traffic, wind, hum, keyboard, room). Falls back to the fast anlmdn filter when AI is unavailable or method='filter'. Works on audio OR video (video keeps its picture, only the audio is cleaned). Use this on noisy uploaded footage/voiceovers before cutting.",
    {
      inputPath: z.string().describe("Relative path to the source clip (audio or video)."),
      outputPath: z
        .string()
        .describe("Relative output path, e.g. 'assets/processed/clean.mp4' or '.mp3'."),
      method: z
        .enum(["ai", "filter"])
        .optional()
        .default("ai")
        .describe(
          "'ai' = ElevenLabs voice isolation (best). 'filter' = fast local anlmdn denoise. Default 'ai'.",
        ),
      strength: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe("Only for method='filter': denoise strength 0–1. Default 0.5."),
    },
    async ({ inputPath, outputPath, method, strength }) => {
      const dir = projectDir(ctx.userId, ctx.projectId);
      const absIn = resolveProjectPath(dir, inputPath);
      const absOut = resolveProjectPath(dir, outputPath);
      const apiKey = resolveApiKey("elevenlabs", "ELEVENLABS_API_KEY", ctx.apiKeys?.elevenlabs);
      const wantAi = (method ?? "ai") === "ai";

      if (wantAi && apiKey) {
        const stem = nanoid(8);
        const srcRel = `assets/processed/.iso-src-${stem}.mp3`;
        const cleanRel = `assets/processed/.iso-clean-${stem}.mp3`;
        const srcAbs = resolveProjectPath(dir, srcRel);
        const cleanAbs = resolveProjectPath(dir, cleanRel);
        const cleanup = () => {
          for (const p of [srcAbs, cleanAbs]) {
            try {
              if (existsSync(p)) unlinkSync(p);
            } catch {
              /* ignore */
            }
          }
        };
        try {
          const info = await probeClip(absIn);
          const isVideo = info.width > 0 && info.height > 0;
          let audioBytes: Buffer;
          if (isVideo) {
            const ex = await extractAudio({ inputPath: absIn, outputPath: srcAbs });
            if (!ex.ok) throw new Error(ex.error || "audio extract failed");
            audioBytes = readFileSync(srcAbs);
          } else {
            audioBytes = readFileSync(absIn);
          }
          const cleaned = await elevenLabsIsolate(apiKey, audioBytes);
          if (isVideo) {
            writeProjectFile(ctx.userId, ctx.projectId, cleanRel, cleaned);
            const remux = await replaceAudioTrack({
              videoPath: absIn,
              audioPath: cleanAbs,
              outputPath: absOut,
            });
            if (!remux.ok) throw new Error(remux.error || "remux failed");
          } else {
            writeProjectFile(ctx.userId, ctx.projectId, outputPath, cleaned);
          }
          cleanup();
          return {
            content: [
              {
                type: "text",
                text: `OK: voice isolated (ElevenLabs AI) → ${outputPath}. Background noise removed.`,
              },
            ],
          };
        } catch (error) {
          cleanup();
          // Fall through to the local filter rather than failing outright.
          const fb = await applyNoiseReduction({ inputPath: absIn, outputPath: absOut, strength });
          if (!fb.ok) {
            return {
              content: [
                {
                  type: "text",
                  text: `ERROR: AI isolation failed (${(error as Error).message}) and filter fallback failed (${fb.error}).`,
                },
              ],
              isError: true,
            };
          }
          return {
            content: [
              {
                type: "text",
                text: `OK: AI isolation unavailable (${(error as Error).message}); applied anlmdn filter instead → ${outputPath}.`,
              },
            ],
          };
        }
      }

      // method='filter', or no ElevenLabs key configured.
      const result = await applyNoiseReduction({ inputPath: absIn, outputPath: absOut, strength });
      if (!result.ok) {
        return { content: [{ type: "text", text: `ERROR: ${result.error}` }], isError: true };
      }
      const note = wantAi && !apiKey ? " (no ElevenLabs key — used the local filter)" : "";
      return {
        content: [
          { type: "text", text: `OK: background noise reduced (filter)${note} → ${outputPath}` },
        ],
      };
    },
  );

  // --- Feature 4: analyze_pacing ---
  const analyzePacingTool = tool(
    "analyze_pacing",
    "Analyze transcript pacing: words per minute, pause locations, and cut-density recommendation. Call after transcribe_clip to decide where natural cuts fall and how fast to pace the edit.",
    {
      words: z
        .array(
          z.object({
            word: z.string(),
            start: z.number(),
            end: z.number(),
          }),
        )
        .describe("TranscriptWord array from transcribe_clip."),
      totalDuration: z.number().describe("Total clip duration in seconds (from probe_clip)."),
    },
    async ({ words, totalDuration }) => {
      const report = analyzePacing(words as TranscriptWord[], totalDuration);
      return {
        content: [
          {
            type: "text",
            text: [
              `Pacing: ${report.recommendation}`,
              `WPM: ${report.wordsPerMinute}  avg word: ${report.avgWordDuration}s  pauses: ${report.pauseCount}  avg pause: ${report.avgPauseDuration}s`,
              report.longPauses.length > 0
                ? `Long pauses (≥0.5s): ${report.longPauses.map((p) => `${p.start.toFixed(2)}s–${p.end.toFixed(2)}s (${p.duration.toFixed(2)}s)`).join("  ")}`
                : "",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ],
      };
    },
  );

  const detectBeatsTool = tool(
    "detect_beats",
    "Detect approximate beat positions in a music/audio file by analyzing momentary loudness peaks. Returns an array of beat timestamps and estimated BPM. Use this before finalizing scene durations so cuts land on musical beats rather than arbitrary time points.",
    {
      path: z.string().describe("Relative path to the audio file, e.g. 'assets/music.mp3'."),
      minIntervalSeconds: z
        .number()
        .min(0.1)
        .max(2)
        .optional()
        .describe(
          "Minimum gap between detected beats in seconds (default 0.35). Lower = more beats detected.",
        ),
    },
    async ({ path, minIntervalSeconds }) => {
      try {
        const dir = projectDir(ctx.userId, ctx.projectId);
        const result = await detectBeats({
          filePath: resolveProjectPath(dir, path),
          minIntervalSeconds,
        });
        const bpmLine = result.bpm !== null ? `BPM: ~${result.bpm}` : "BPM: unknown";
        const beatInterval =
          result.bpm !== null ? ` (beat every ~${(60 / result.bpm).toFixed(2)}s)` : "";
        return {
          content: [
            {
              type: "text",
              text: [
                `${bpmLine}${beatInterval}`,
                `Beats detected: ${result.beats.length}`,
                `Timestamps (s): ${result.beats.join(", ")}`,
                ``,
                `Tip: align scene boundaries to every 4th or 8th beat for 30s videos. ` +
                  `4-bar groups = ${result.bpm ? (4 * (60 / result.bpm)).toFixed(1) : "?"}s each.`,
              ].join("\n"),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  // --- Word-highlight animated captions ---
  const buildWordHighlightCaptionsTool = tool(
    "build_word_highlight_captions",
    "Generate an animated word-highlight caption overlay for a composition. Takes word timestamps from transcribe_clip and returns HTML markup + GSAP JS snippet. Each word pops white as it is spoken — the top visual signal of professional short-form editing. Returns two blocks: HTML to embed in <body>, and JS to add inside the existing timeline script.",
    {
      words: z
        .array(z.object({ word: z.string(), start: z.number(), end: z.number() }))
        .describe("Word timestamps from transcribe_clip."),
      voiceoverStartInComposition: z
        .number()
        .min(0)
        .optional()
        .describe("Seconds offset where the voiceover begins in the composition (default 0)."),
      fontFamily: z
        .string()
        .optional()
        .describe("Font family string, e.g. 'Anton' or 'Inter'. Matches your typography pair."),
      fontSize: z
        .string()
        .optional()
        .describe("CSS font-size, e.g. '52px' or '5vw'. Default '5vw'."),
      wordsPerLine: z
        .number()
        .int()
        .min(1)
        .max(8)
        .optional()
        .describe("Words shown per caption line. Default 4."),
      position: z
        .enum(["bottom", "middle", "top"])
        .optional()
        .describe("Vertical position. Default 'bottom'."),
      activeColor: z
        .string()
        .optional()
        .describe("Color of the currently spoken word. Default '#ffffff'."),
      inactiveColor: z
        .string()
        .optional()
        .describe("Color of non-active words. Default 'rgba(255,255,255,0.4)'."),
    },
    async ({
      words,
      voiceoverStartInComposition = 0,
      fontFamily = "Inter",
      fontSize = "5vw",
      wordsPerLine = 4,
      position = "bottom",
      activeColor = "#ffffff",
      inactiveColor = "rgba(255,255,255,0.4)",
    }) => {
      if (!words.length) {
        return {
          content: [{ type: "text", text: "ERROR: no words provided" }],
          isError: true,
        };
      }

      const positionStyle =
        position === "bottom"
          ? "bottom: 10%; top: auto;"
          : position === "top"
            ? "top: 8%; bottom: auto;"
            : "top: 50%; transform: translateX(-50%) translateY(-50%);";

      // Split words into lines
      const lines: Array<{ words: typeof words; lineStart: number; lineEnd: number }> = [];
      for (let i = 0; i < words.length; i += wordsPerLine) {
        const chunk = words.slice(i, i + wordsPerLine);
        lines.push({
          words: chunk,
          lineStart: chunk[0].start + voiceoverStartInComposition,
          lineEnd: chunk[chunk.length - 1].end + voiceoverStartInComposition,
        });
      }

      // Build HTML
      const lineHtml = lines
        .map((line, lineIndex) => {
          const wordSpans = line.words
            .map(
              (w) =>
                `<span class="cap-w" data-s="${(w.start + voiceoverStartInComposition).toFixed(3)}" data-e="${(w.end + voiceoverStartInComposition).toFixed(3)}" style="color:${inactiveColor};display:inline-block;margin:0 0.18em;">${w.word}</span>`,
            )
            .join("");
          return `  <div class="cap-line" id="cap-line-${lineIndex}" style="opacity:0;position:absolute;left:0;right:0;${position === "middle" ? "" : ""}text-align:center;">${wordSpans}</div>`;
        })
        .join("\n");

      const html = `<!-- Word-highlight caption overlay -->
<div id="cap-overlay" style="position:absolute;${positionStyle}left:50%;transform:translateX(-50%);width:88%;font-family:'${fontFamily}',sans-serif;font-size:${fontSize};font-weight:700;line-height:1.25;text-shadow:0 2px 8px rgba(0,0,0,0.8);">
${lineHtml}
</div>`;

      // Build JS snippet (to insert inside existing timeline script, after other tl.to() calls)
      const jsLines = lines.map((line, lineIndex) => {
        const wordTweens = line.words
          .map((w) => {
            const ws = (w.start + voiceoverStartInComposition).toFixed(3);
            const we = (w.end + voiceoverStartInComposition).toFixed(3);
            return `tl.to(document.querySelector('[data-s="${ws}"]'),{color:"${activeColor}",scale:1.06,duration:0.06,ease:"power1.out"},${ws});tl.to(document.querySelector('[data-s="${ws}"]'),{color:"${inactiveColor}",scale:1,duration:0.1},${we});`;
          })
          .join("\n");
        return `// Caption line ${lineIndex + 1}
tl.to(document.getElementById("cap-line-${lineIndex}"),{opacity:1,duration:0.12,ease:"power2.out"},${line.lineStart.toFixed(3)});
${wordTweens}
tl.to(document.getElementById("cap-line-${lineIndex}"),{opacity:0,duration:0.08},${(line.lineEnd + 0.08).toFixed(3)});`;
      });

      const js = `// --- word-highlight captions (${words.length} words, ${lines.length} lines) ---
${jsLines.join("\n")}`;

      return {
        content: [
          {
            type: "text",
            text: `OK: generated ${lines.length} caption lines for ${words.length} words.\n\n=== HTML (embed in <body> before closing </div> of composition) ===\n${html}\n\n=== JS (paste inside existing gsap.timeline script, before the closing semicolon of tl definition) ===\n${js}`,
          },
        ],
      };
    },
  );

  // --- Composition quality checklist ---
  const qualityCheckTool = tool(
    "quality_check",
    "Run a structured quality checklist on the current index.html. Checks determinism, color grade, audio balance, timeline registration, layout rules, and visual hierarchy. Call this after screenshot_at_time and BEFORE declaring the composition done. Fix any FAILs before reporting to the user.",
    {},
    async () => {
      let html: string;
      try {
        html = readProjectText(ctx.userId, ctx.projectId, "index.html");
      } catch {
        return {
          content: [{ type: "text", text: "ERROR: no index.html found" }],
          isError: true,
        };
      }

      const issues: string[] = [];
      const passes: string[] = [];

      // Determinism
      if (/\bMath\.random\b/.test(html))
        issues.push("FAIL [determinism] Math.random() found — replace with seeded formula");
      else passes.push("PASS: no Math.random");

      if (/\bDate\.now\(\)\b|\bnew Date\(\)/.test(html))
        issues.push(
          "FAIL [determinism] Date.now()/new Date() found — breaks frame-exact rendering",
        );
      else passes.push("PASS: no Date usage");

      if (/\bsetInterval\b|\bsetTimeout\b/.test(html))
        issues.push(
          "FAIL [determinism] setTimeout/setInterval found — use GSAP timeline positioning instead",
        );
      else passes.push("PASS: no setTimeout/setInterval");

      // Timeline registration
      if (!html.includes("window.__timelines"))
        issues.push("FAIL [timeline] window.__timelines not registered");
      else passes.push("PASS: timeline registered");

      if (html.includes("window.__timelines") && !html.includes("paused: true"))
        issues.push(
          "FAIL [timeline] missing paused: true — timeline will auto-play and break player",
        );
      else if (html.includes("paused: true")) passes.push("PASS: timeline paused");

      // Color grade
      const hasFilter = /filter\s*:\s*(brightness|contrast|saturate|sepia|hue-rotate)/i.test(html);
      if (!hasFilter)
        issues.push(
          "WARN [grade] no CSS filter found on scene backgrounds — apply a color grade preset",
        );
      else passes.push("PASS: color grade filter applied");

      // Audio volume balance
      const trackIndexVol = [
        ...html.matchAll(/data-track-index=["'](\d+)["'][^>]*data-volume=["']([^"']+)["']/g),
        ...html.matchAll(/data-volume=["']([^"']+)["'][^>]*data-track-index=["'](\d+)["']/g),
      ].map((match) => ({
        track: parseInt(match[1] || match[2]),
        vol: parseFloat(match[2] || match[1]),
      }));
      const hasVoiceover = trackIndexVol.some((t) => t.track === 0);
      const musicTracks = trackIndexVol.filter((t) => t.track === 10);
      for (const m of musicTracks) {
        if (hasVoiceover && m.vol > 0.3) {
          issues.push(
            `FAIL [audio] music volume ${m.vol} too loud (max 0.3 with voiceover; target 0.15)`,
          );
        }
      }
      if (musicTracks.length > 0 && !issues.some((i) => i.includes("music volume")))
        passes.push(`PASS: music volume OK (${musicTracks.map((m) => m.vol).join(", ")})`);

      // data-duration on root
      if (!html.includes("data-duration="))
        issues.push(
          "WARN [root] no data-duration on root element — player cannot determine length",
        );
      else passes.push("PASS: data-duration set");

      // Google Fonts loading quality (preview/render parity)
      const hasGoogleFonts = html.includes("fonts.googleapis.com");
      if (hasGoogleFonts) {
        const hasDisplaySwap = html.includes("display=swap");
        const hasPreconnect =
          html.includes('rel="preconnect"') && html.includes("fonts.googleapis.com");
        if (!hasDisplaySwap) {
          issues.push(
            "WARN [fonts] Google Fonts missing display=swap — text may flash invisible during render. Add &display=swap to the URL.",
          );
        } else {
          passes.push("PASS: Google Fonts uses display=swap");
        }
        if (!hasPreconnect) {
          issues.push(
            "WARN [fonts] Missing <link rel='preconnect'> for Google Fonts — add preconnect tags before the font URL for render parity.",
          );
        } else {
          passes.push("PASS: Google Fonts preconnect set");
        }
      }

      // Visual hierarchy: check at least one element with prominent font size
      const hasBigText = /font-size\s*:\s*(1[0-9]{2,}px|[1-9]\d*vw|[8-9][0-9]px)/i.test(html);
      if (!hasBigText) {
        issues.push(
          "WARN [hierarchy] No element with font-size ≥80px or ≥4vw found — add a dominant text element so viewers know what to focus on.",
        );
      } else {
        passes.push("PASS: dominant text element present");
      }

      // Check max 3 distinct font-size classes in any one scene div — catches "busy" layouts
      // (approximation: count unique vw/px font-size values)
      const fontSizes = [...html.matchAll(/font-size\s*:\s*([\d.]+(?:vw|px|em|rem))/gi)].map(
        (m) => m[1],
      );
      const uniqueSizes = new Set(fontSizes);
      if (uniqueSizes.size > 6) {
        issues.push(
          `WARN [hierarchy] ${uniqueSizes.size} distinct font sizes — simplify to ≤4 sizes for cleaner hierarchy.`,
        );
      } else if (fontSizes.length > 0) {
        passes.push(`PASS: font size variety OK (${uniqueSizes.size} distinct sizes)`);
      }

      // Text readability: headlines need text-shadow or backdrop-filter
      const hasTextShadow = /text-shadow\s*:/i.test(html);
      const hasBackdropFilter = /backdrop-filter\s*:/i.test(html);
      const hasLargeText = /font-size\s*:\s*(\d{2,}px|[4-9]\d*vw|1\d+vw)/i.test(html);
      if (hasLargeText && !hasTextShadow && !hasBackdropFilter) {
        issues.push(
          "WARN [readability] No text-shadow or backdrop-filter on large text — unreadable on " +
            "busy backgrounds. Add text-shadow: 0 2px 12px rgba(0,0,0,0.9) to headlines.",
        );
      } else if (hasLargeText) {
        passes.push("PASS: text readability (shadow or backdrop present)");
      }

      // Font continuity: catch accidental font mixing from registry block copy-paste
      const fontMatches = [
        ...html.matchAll(/font-family\s*:\s*['"]?([A-Za-z][^;,'"]{1,40})/gi),
      ].map((m) => m[1].split(",")[0].trim().replace(/['"]/g, "").trim());
      const genericFonts = new Set(["inherit", "sans-serif", "serif", "monospace", "cursive"]);
      const uniqueFonts = [...new Set(fontMatches)].filter(
        (f) => f.length > 0 && !genericFonts.has(f),
      );
      if (uniqueFonts.length > 3) {
        issues.push(
          `WARN [continuity] ${uniqueFonts.length} distinct font families ` +
            `(${uniqueFonts.slice(0, 4).join(", ")}…) — ` +
            "pair should be ≤2 fonts. Registry block copy-paste may have introduced extras.",
        );
      } else if (uniqueFonts.length > 0) {
        passes.push(`PASS: font continuity (${uniqueFonts.join(", ")})`);
      }

      // Pattern interrupt density: warn when avg gap between tl beats exceeds 4.5s
      const durationAttrMatch = html.match(/data-duration=["']([\d.]+)["']/);
      const compositionDuration = durationAttrMatch ? parseFloat(durationAttrMatch[1]) : 0;
      const tlBeatCount = (html.match(/\btl\.(from|to|fromTo|add|call)\b/g) || []).length;
      if (compositionDuration > 8 && tlBeatCount > 0) {
        const avgGap = compositionDuration / tlBeatCount;
        if (avgGap > 4.5) {
          issues.push(
            `WARN [pattern-interrupt] ${tlBeatCount} timeline beats over ${compositionDuration.toFixed(0)}s` +
              ` → avg gap ${avgGap.toFixed(1)}s. Add a visual change every 3.5s max` +
              ` (text swap, scale pulse, color shift, emoji pop).`,
          );
        } else {
          passes.push(
            `PASS: pattern interrupt density (${tlBeatCount} beats, avg ${avgGap.toFixed(1)}s gap)`,
          );
        }
      }

      // Exit animations — every scene except the last needs an opacity:0 exit tween
      const exitTweenCount = (html.match(/\.to\s*\([^,)]+,\s*\{[^}]*opacity\s*:\s*0/g) || [])
        .length;
      const sceneDivCount = (html.match(/class=["'][^"']*\bscene\b[^"']*["']/g) || []).length;
      if (sceneDivCount > 1 && exitTweenCount < sceneDivCount - 1) {
        issues.push(
          `WARN [exits] ${exitTweenCount} exit tweens for ${sceneDivCount} scenes — ` +
            `every scene except the last needs elements animated out before the transition. ` +
            `Pattern: tl.to(els, { opacity:0, y:-12, duration:0.25, ease:"expo.in" }, sceneEnd-0.28). ` +
            `Cuts without exits look like a slideshow.`,
        );
      } else if (sceneDivCount > 1) {
        passes.push(`PASS: exit tweens (${exitTweenCount} exits, ${sceneDivCount} scenes)`);
      }

      // Grain overlay — cinematic texture is mandatory
      const hasGrain = /grain|noise|feTurbulence|film.?grain/i.test(html);
      if (!hasGrain) {
        issues.push(
          `WARN [grain] No grain/noise overlay found — add the grain-overlay registry block or an ` +
            `inline SVG feTurbulence div (opacity:0.045, mix-blend-mode:overlay). ` +
            `It's the single fastest way to make a composition look cinematic rather than digital.`,
        );
      } else {
        passes.push("PASS: grain overlay present");
      }

      // Background depth — flat solid colors look amateur
      const hasGradientBg = /radial-gradient|linear-gradient|conic-gradient/i.test(html);
      if (!hasGradientBg) {
        issues.push(
          `WARN [background] No gradient backgrounds found — solid colors look flat on video. ` +
            `Use radial-gradient(ellipse at 20% 80%, <accent>40 0%, <base> 60%) on every scene background.`,
        );
      } else {
        passes.push("PASS: gradient backgrounds present");
      }

      // Scene pacing — avg scene duration > 5.5s tanks retention
      if (compositionDuration > 0 && sceneDivCount > 1) {
        const avgSceneDur = compositionDuration / sceneDivCount;
        if (avgSceneDur > 5.5) {
          const targetScenes = Math.ceil(compositionDuration / 4.5);
          issues.push(
            `WARN [pacing] Avg scene duration ${avgSceneDur.toFixed(1)}s ` +
              `(${sceneDivCount} scenes / ${compositionDuration.toFixed(0)}s total) — ` +
              `target ≤5s/scene. Add ${targetScenes - sceneDivCount} more scene breaks ` +
              `(shorter intents, not more text per scene).`,
          );
        } else {
          passes.push(
            `PASS: scene pacing OK (avg ${(compositionDuration / sceneDivCount).toFixed(1)}s/scene)`,
          );
        }
      }

      // Safe-zone check for 9:16 compositions
      const isVertical = html.includes('data-width="1080"') && html.includes('data-height="1920"');
      if (isVertical) {
        const hasSafeZone =
          /padding[^:]*:\s*\d+%[^;]*\d+%/i.test(html) ||
          /padding-bottom\s*:\s*(1[5-9]|[2-9]\d)%/i.test(html);
        if (!hasSafeZone) {
          issues.push(
            `WARN [safe-zone] 9:16 composition — text containers need padding-top ≥8% and ` +
              `padding-bottom ≥15% to clear platform crop zones (TikTok/Reels cut the bottom 15%).`,
          );
        } else {
          passes.push("PASS: safe-zone padding present");
        }
      }

      const failCount = issues.filter((i) => i.startsWith("FAIL")).length;
      const warnCount = issues.filter((i) => i.startsWith("WARN")).length;
      const summary =
        failCount === 0 && warnCount === 0
          ? "✓ All quality checks passed — composition is clean."
          : `${failCount} FAIL(s), ${warnCount} WARN(s) — fix before declaring done.`;

      return {
        content: [
          {
            type: "text",
            text: [summary, "", ...issues, "", `Passed: ${passes.length}`, ...passes].join("\n"),
          },
        ],
      };
    },
  );

  // --- draft_script: validate pacing + platform limits before building ---
  const draftScriptTool = tool(
    "draft_script",
    "Validate a composition script for pacing (150 WPM), platform duration limits, hook quality, and CTA presence. Call this after plan_composition is approved and BEFORE generate_voiceover + write_file. Returns per-section PASS/WARN/FAIL with adjusted word counts and recommended voice settings.",
    {
      platform: z
        .enum(["youtube_short", "tiktok", "instagram_reel", "youtube_long", "linkedin", "twitter"])
        .describe("Target platform. Determines aspect ratio, max duration, and safe zone rules."),
      niche: z
        .string()
        .describe(
          "Content niche, e.g. 'sleep story', 'finance', 'comic facts'. Used to suggest voice settings.",
        ),
      hook: z.object({
        text: z.string().describe("On-screen hook text (what the viewer reads in scene 1)."),
        voiceoverText: z
          .string()
          .optional()
          .describe("Hook voiceover line, if different from on-screen text."),
        durationSeconds: z.number().describe("Scene 1 duration in seconds. Must be 1.5–3.5."),
      }),
      acts: z
        .array(
          z.object({
            name: z.string().describe("Act label, e.g. 'Problem', 'Story', 'Reveal', 'Value'."),
            voiceoverText: z
              .string()
              .describe(
                "Full voiceover script for this act. Write it for the EAR, expressively punctuated so ElevenLabs doesn't read it flat: full stops/?/!, commas for pauses, … for dramatic beats, CAPS on the key word, contractions, short varied sentences.",
              ),
            durationSeconds: z.number().describe("Planned duration for this act in seconds."),
            intent: z.string().optional().describe("What this act accomplishes."),
          }),
        )
        .min(1)
        .max(8),
      cta: z
        .object({
          text: z.string().describe("CTA line, e.g. 'Follow for more'."),
          durationSeconds: z.number().describe("Duration of CTA scene in seconds."),
        })
        .optional()
        .describe("Call to action (final scene). Highly recommended for short-form."),
    },
    async ({ platform, hook, acts, cta }) => {
      const PLATFORM_LIMITS: Record<
        string,
        { maxSeconds: number; minSeconds?: number; aspectRatio: string; shortForm: boolean }
      > = {
        youtube_short: { maxSeconds: 60, aspectRatio: "9:16", shortForm: true },
        tiktok: { maxSeconds: 180, aspectRatio: "9:16", shortForm: true },
        instagram_reel: { maxSeconds: 90, aspectRatio: "9:16", shortForm: true },
        youtube_long: {
          maxSeconds: 54000,
          minSeconds: 120,
          aspectRatio: "16:9",
          shortForm: false,
        },
        linkedin: { maxSeconds: 600, aspectRatio: "16:9", shortForm: false },
        twitter: { maxSeconds: 140, aspectRatio: "16:9", shortForm: true },
      };
      const limits = PLATFORM_LIMITS[platform];
      const WPM = 150;
      const lines: string[] = [];

      const totalSeconds =
        hook.durationSeconds +
        acts.reduce((sum, act) => sum + act.durationSeconds, 0) +
        (cta?.durationSeconds ?? 0);

      lines.push(
        `Platform: ${platform} | Aspect: ${limits.aspectRatio} | Max: ${limits.maxSeconds}s`,
      );
      lines.push(`Total planned: ${totalSeconds.toFixed(1)}s`);
      lines.push("");

      if (totalSeconds > limits.maxSeconds) {
        lines.push(
          `FAIL [duration] ${totalSeconds.toFixed(1)}s exceeds ${platform} limit of ${limits.maxSeconds}s — cut ${(totalSeconds - limits.maxSeconds).toFixed(1)}s`,
        );
      } else if (limits.minSeconds && totalSeconds < limits.minSeconds) {
        lines.push(
          `WARN [duration] ${totalSeconds.toFixed(1)}s is below ${platform} minimum of ${limits.minSeconds}s`,
        );
      } else {
        lines.push(`PASS [duration] ${totalSeconds.toFixed(1)}s fits ${platform}`);
      }

      // Optimal length advisory (sweet-spot check, separate from hard max)
      const OPTIMAL_RANGES: Record<string, { min: number; max: number }> = {
        youtube_short: { min: 50, max: 55 },
        tiktok: { min: 21, max: 34 },
        instagram_reel: { min: 15, max: 28 },
        linkedin: { min: 45, max: 75 },
        twitter: { min: 30, max: 45 },
        youtube_long: { min: 420, max: 720 },
      };
      const optRange = OPTIMAL_RANGES[platform];
      if (optRange && totalSeconds >= 1 && totalSeconds <= limits.maxSeconds) {
        if (totalSeconds < optRange.min || totalSeconds > optRange.max) {
          lines.push(
            `ADVISORY [optimal-length] ${totalSeconds.toFixed(0)}s — ${platform} retention` +
              ` sweet spot is ${optRange.min}–${optRange.max}s.` +
              ` ${totalSeconds < optRange.min ? "Extend to maximise watch-time." : "Consider trimming for peak retention."}`,
          );
        } else {
          lines.push(
            `PASS [optimal-length] ${totalSeconds.toFixed(0)}s is in the ${platform} sweet spot ✓`,
          );
        }
      }
      lines.push("");

      // Hook checks
      lines.push(`=== HOOK (${hook.durationSeconds}s) ===`);
      if (hook.durationSeconds > 3.5) {
        lines.push(`FAIL [hook-duration] ${hook.durationSeconds}s exceeds 3.5s limit`);
      } else if (hook.durationSeconds < 1.5) {
        lines.push(`WARN [hook-duration] ${hook.durationSeconds}s is very short — aim for 2–3.5s`);
      } else {
        lines.push(`PASS [hook-duration] ${hook.durationSeconds}s ✓`);
      }
      const onScreenWords = hook.text.split(/\s+/).filter(Boolean);
      if (onScreenWords.length > 20) {
        lines.push(
          `WARN [hook-text] ${onScreenWords.length} words on screen — keep ≤20 for immediate readability`,
        );
      } else {
        lines.push(`PASS [hook-text] ${onScreenWords.length} words on screen ✓`);
      }
      if (hook.voiceoverText) {
        const voiceWords = hook.voiceoverText.split(/\s+/).filter(Boolean);
        const actualWpm = (voiceWords.length / hook.durationSeconds) * 60;
        const maxWords = Math.floor((hook.durationSeconds / 60) * WPM);
        if (actualWpm > 200) {
          lines.push(
            `FAIL [hook-pacing] ${voiceWords.length} words in ${hook.durationSeconds}s = ${actualWpm.toFixed(0)} WPM. Cut to ≤${maxWords} words.`,
          );
        } else {
          lines.push(
            `PASS [hook-pacing] ${voiceWords.length} words at ~${actualWpm.toFixed(0)} WPM ✓`,
          );
        }
      }
      lines.push("");

      // Act checks
      for (const act of acts) {
        const words = act.voiceoverText.split(/\s+/).filter(Boolean);
        const expectedSeconds = (words.length / WPM) * 60;
        const actualWpm = (words.length / act.durationSeconds) * 60;
        const maxWords = Math.floor((act.durationSeconds / 60) * WPM);

        lines.push(`=== ${act.name} (${act.durationSeconds}s) ===`);
        lines.push(`${words.length} words → expected ${expectedSeconds.toFixed(1)}s at ${WPM} WPM`);

        if (actualWpm > 200) {
          lines.push(
            `FAIL [pacing] ${actualWpm.toFixed(0)} WPM is too fast. Cut ${words.length - maxWords} words or extend to ${expectedSeconds.toFixed(1)}s.`,
          );
        } else if (actualWpm > 175) {
          lines.push(
            `WARN [pacing] ${actualWpm.toFixed(0)} WPM — slightly rushed. Target ≤${WPM} WPM.`,
          );
        } else if (words.length > 0 && actualWpm < 80) {
          lines.push(
            `WARN [pacing] ${actualWpm.toFixed(0)} WPM — very slow. Trim scene duration or add narration.`,
          );
        } else {
          lines.push(`PASS [pacing] ${actualWpm.toFixed(0)} WPM in ${act.durationSeconds}s ✓`);
        }
        lines.push("");
      }

      // CTA check
      if (!cta) {
        lines.push(
          `WARN [cta] No CTA defined — short-form videos without a CTA lose ~30% of potential follows. Add a 1.5–2s CTA scene.`,
        );
      } else {
        lines.push(`=== CTA (${cta.durationSeconds}s) ===`);
        if (cta.durationSeconds < 1 || cta.durationSeconds > 4) {
          lines.push(`WARN [cta] ${cta.durationSeconds}s — aim for 1.5–3s for a CTA scene.`);
        } else {
          lines.push(`PASS [cta] "${cta.text}" at ${cta.durationSeconds}s ✓`);
        }
        lines.push("");
      }

      // Voice settings — fixed house defaults for EVERY niche. Expressiveness
      // comes from the SCRIPT (CAPS + punctuation), never from tweaking dials.
      lines.push(
        `Voice: call generate_voiceover WITHOUT stability/style/similarityBoost — house defaults (stability 0.45, style 0/off, similarity 0.75) apply automatically. Put emotion in the SCRIPT: CAPS the 1–2 words per sentence to stress; commas + … + — for pacing and drama; ! for punch; ? only for genuine questions. Do NOT change the voice dials unless the user explicitly asks.`,
      );

      const failCount = lines.filter((l) => l.startsWith("FAIL")).length;
      const warnCount = lines.filter((l) => l.startsWith("WARN")).length;
      const summary =
        failCount === 0 && warnCount === 0
          ? "✓ Script passes all checks — proceed to generate_voiceover."
          : `${failCount} FAIL(s), ${warnCount} WARN(s) — fix FAILs before writing HTML.`;

      return {
        content: [{ type: "text", text: [summary, "", ...lines].join("\n") }],
      };
    },
  );

  // --- Feature 5a: save_insight ---
  const saveInsightTool = tool(
    "save_insight",
    "Save a learned preference about this creator to persistent memory. Call after the user approves an edit to record their style (e.g. caption_style, color_grade_preference, cut_pacing, preferred_music_mood). This is loaded at the start of future conversations to personalize edits without asking.",
    {
      key: z
        .string()
        .describe("Stable slug, e.g. 'caption_style', 'color_grade', 'pacing', 'music_mood'."),
      value: z.string().describe("JSON-serializable value. Can be a string, object, or array."),
      confidence: z
        .number()
        .min(0)
        .max(1)
        .optional()
        .describe(
          "Confidence 0–1 (default 0.7). Bump to 0.9+ when the user explicitly confirms a preference.",
        ),
    },
    async ({ key, value, confidence }) => {
      try {
        const existing = db
          .select()
          .from(creatorInsights)
          .where(and(eq(creatorInsights.userId, ctx.userId), eq(creatorInsights.key, key)))
          .get();

        if (existing) {
          db.update(creatorInsights)
            .set({ value, confidence: confidence ?? 0.7, updatedAt: new Date() })
            .where(eq(creatorInsights.id, existing.id))
            .run();
        } else {
          const { nanoid: nano } = await import("nanoid");
          db.insert(creatorInsights)
            .values({
              id: nano(10),
              userId: ctx.userId,
              key,
              value,
              confidence: confidence ?? 0.7,
              updatedAt: new Date(),
            })
            .run();
        }
        return { content: [{ type: "text", text: `OK: insight saved — ${key} = ${value}` }] };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  // --- Feature 5b: load_insights ---
  const loadInsightsTool = tool(
    "load_insights",
    "Load all saved preferences for this creator. Call at the start of each conversation to personalize the edit (captions, grade, pacing, music mood, etc.) without asking the user to repeat themselves.",
    {},
    async () => {
      try {
        const rows = db
          .select()
          .from(creatorInsights)
          .where(eq(creatorInsights.userId, ctx.userId))
          .all();

        if (rows.length === 0) {
          return {
            content: [
              { type: "text", text: "No saved preferences yet. This creator is a blank slate." },
            ],
          };
        }

        const lines = rows
          .sort((a, b) => b.confidence - a.confidence)
          .map((row) => `${row.key} (confidence ${row.confidence.toFixed(2)}): ${row.value}`);

        return {
          content: [
            {
              type: "text",
              text: `Creator preferences (${rows.length}):\n${lines.join("\n")}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // AI B-roll generation (Replicate — Kling text-to-video)
  // -------------------------------------------------------------------------

  const generateBrollTool = tool(
    "generate_broll",
    "Generate a short AI video clip from a text prompt via Replicate (Kling text-to-video). Takes 30–120s to complete. Use when the user has no real footage — environment shots, product visuals, action scenes, abstract backgrounds. Returns the saved asset path. Requires a Replicate API key at /app/settings/api-keys.",
    {
      prompt: z
        .string()
        .min(4)
        .max(1000)
        .describe(
          "Detailed video prompt — include subject, action, camera movement, lighting, style. Example: 'Aerial drone shot over a busy city at night, neon reflections on wet streets, slow pull-back, cinematic 4K'.",
        ),
      filename: z
        .string()
        .regex(/^[A-Za-z0-9._-]+\.mp4$/)
        .describe("Output filename, e.g. 'broll-city.mp4'."),
      duration: z.enum(["5", "10"]).default("5").describe("Clip length — '5' or '10' seconds."),
      aspectRatio: z
        .enum(["16:9", "9:16", "1:1"])
        .default("16:9")
        .describe("Output aspect ratio — match the composition format."),
      model: z
        .string()
        .optional()
        .describe(
          "Video model id to use (Auto mode only — the user's pinned model wins in Manual mode). E.g. 'kling', 'luma' (cinematic), 'runway', 'pika'. Omit to use the default.",
        ),
    },
    async ({ prompt, filename, duration, aspectRatio, model }) => {
      const requested = resolveTaskModel("video", model);
      {
        const credit = chargeGeneration(ctx.userId, requested);
        if (!credit.ok)
          return {
            content: [
              {
                type: "text",
                text: `ERROR: out of generation credits this month (${credit.used}/${credit.limit}). Ask the user to upgrade their plan.`,
              },
            ],
            isError: true,
          };
      }
      const safe = filename.replace(/[/\\]/g, "_").replace(/^\.+/, "");
      const dest = `assets/${safe}`;
      try {
        const {
          result: buffer,
          usedModel,
          fellBack,
        } = await withModelFallback("video", requested, (m) =>
          generateVideoWithModel({
            model: m,
            apiKeys: ctx.apiKeys,
            prompt,
            duration,
            aspectRatio,
          }),
        );
        writeProjectFile(ctx.userId, ctx.projectId, dest, buffer);
        return {
          content: [
            {
              type: "text",
              text: [
                `OK: saved ${buffer.length}B → ${dest} (${duration}s, ${aspectRatio}) via ${usedModel.label}${
                  fellBack ? ` (fell back from ${requested.label} — not configured)` : ""
                }.`,
                `Reference in composition: <video muted playsinline class="clip" src="${dest}" data-start="X" data-duration="${duration}" data-track-index="2">`,
              ].join("\n"),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Music generation (Suno / Udio / Riffusion)
  // -------------------------------------------------------------------------

  const generateMusicTool = tool(
    "generate_music",
    "Generate an original music track from a text prompt and save it to assets/. Use for a custom score/song when stock music (find_stock) doesn't fit. Returns the saved asset path. The model depends on the user's preference (Auto picks the default; Manual uses their pinned music model). Suno/Udio are unofficial and require a configured proxy; Riffusion runs on Replicate.",
    {
      prompt: z
        .string()
        .min(4)
        .max(1000)
        .describe(
          "Music description — genre, mood, instruments, tempo, energy. E.g. 'dark cinematic tension, low strings, slow build, 80bpm'.",
        ),
      filename: z
        .string()
        .regex(/^[A-Za-z0-9._-]+\.mp3$/)
        .describe("Output filename, e.g. 'score.mp3'."),
      instrumental: z
        .boolean()
        .default(true)
        .describe("True for an instrumental bed (no vocals) — usually what a video score wants."),
      model: z
        .string()
        .optional()
        .describe(
          "Music model id (Auto mode only). 'suno', 'udio', or 'riffusion'. Omit to use the default.",
        ),
    },
    async ({ prompt, filename, instrumental, model }) => {
      const requested = resolveTaskModel("music", model);
      {
        const credit = chargeGeneration(ctx.userId, requested);
        if (!credit.ok)
          return {
            content: [
              {
                type: "text",
                text: `ERROR: out of generation credits this month (${credit.used}/${credit.limit}). Ask the user to upgrade their plan.`,
              },
            ],
            isError: true,
          };
      }
      const safe = filename.replace(/[/\\]/g, "_").replace(/^\.+/, "");
      const dest = `assets/${safe}`;
      try {
        const {
          result: buffer,
          usedModel,
          fellBack,
        } = await withModelFallback("music", requested, (m) =>
          generateMusicWithModel({ model: m, apiKeys: ctx.apiKeys, prompt, instrumental }),
        );
        writeProjectFile(ctx.userId, ctx.projectId, dest, buffer);
        return {
          content: [
            {
              type: "text",
              text: [
                `OK: saved ${buffer.length}B → ${dest} via ${usedModel.label}${
                  fellBack ? ` (fell back from ${requested.label} — not configured)` : ""
                }.`,
                `Reference as <audio class="clip" src="${dest}" data-start="0" data-duration="<total>" data-track-index="10" data-volume="0.15">.`,
              ].join("\n"),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Next-step suggestions (one-tap follow-ups shown in the chat)
  // -------------------------------------------------------------------------

  const suggestNextStepsTool = tool(
    "suggest_next_steps",
    "ALWAYS call this as the very LAST step of every turn, once the work is done. Provide 3–4 short, specific follow-up edits the user is likely to want next, tailored to what was just built (e.g. 'Make the title red', 'Add a glow to the logo', 'Tighten the cuts', 'Add captions'). Each must be ≤6 words, imperative, and directly usable as the next instruction. These render as one-tap chips under your reply.",
    {
      suggestions: z
        .array(z.string().min(2).max(60))
        .min(2)
        .max(4)
        .describe("3–4 short next-step edits, each ≤6 words, specific to the current composition."),
    },
    async ({ suggestions }) => {
      return {
        content: [{ type: "text", text: `OK: ${suggestions.length} next steps suggested.` }],
      };
    },
  );

  // -------------------------------------------------------------------------
  // Thumbnail designer
  // -------------------------------------------------------------------------

  const designThumbnailTool = tool(
    "design_thumbnail",
    "Write thumbnail.html — a standalone 1280×720 still frame optimised for click-through rate. Separate from index.html (this is a static image, not a playback composition). After writing, tell the user to open thumbnail.html in the project preview. Set hasHostImage=true to leave the right 40% clear for a face/host overlay added externally.",
    {
      title: z
        .string()
        .max(40)
        .describe("Main headline — 5 words max, all-caps, punchy. Top CTR driver."),
      subtitle: z
        .string()
        .optional()
        .describe("Secondary line, e.g. '(True Story)' or a supporting stat."),
      palette: z
        .array(z.string().regex(/^#[0-9a-fA-F]{6}$/))
        .min(2)
        .max(4)
        .describe("Background gradient colors — match the composition's color grade."),
      accentColor: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/)
        .describe("Title text color — must pop against the gradient."),
      hasHostImage: z
        .boolean()
        .optional()
        .default(false)
        .describe("Reserve right 40% clear for a face/host overlay."),
      emojiAccent: z
        .string()
        .optional()
        .describe("1–2 emoji near the title for visual punch, e.g. '🔥' or '💀'."),
    },
    async ({ title, subtitle, palette, accentColor, hasHostImage, emojiAccent }) => {
      const bgGradient =
        palette.length >= 2 ? `linear-gradient(135deg, ${palette.join(", ")})` : palette[0];
      const titleWidth = hasHostImage ? "56%" : "90%";
      const titleFontSize = title.length > 18 ? "96px" : title.length > 12 ? "120px" : "152px";

      const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@700;900&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { width: 1280px; height: 720px; overflow: hidden; }
#root {
	width: 1280px;
	height: 720px;
	background: ${bgGradient};
	position: relative;
	display: flex;
	align-items: center;
	padding-left: 72px;
}
.content {
	width: ${titleWidth};
	display: flex;
	flex-direction: column;
	gap: 20px;
}
.emoji { font-size: 72px; line-height: 1; filter: drop-shadow(0 4px 16px rgba(0,0,0,0.6)); }
.title {
	font-family: 'Anton', sans-serif;
	font-size: ${titleFontSize};
	line-height: 0.9;
	color: ${accentColor};
	text-transform: uppercase;
	letter-spacing: -1px;
	text-shadow: 0 4px 24px rgba(0,0,0,0.8), 0 0 60px ${accentColor}55;
}
.subtitle {
	font-family: 'Inter', sans-serif;
	font-size: 54px;
	font-weight: 900;
	color: #ffffff;
	text-shadow: 0 2px 12px rgba(0,0,0,0.9);
}
</style>
</head>
<body>
<div id="root"
     data-composition-id="thumbnail"
     data-width="1280"
     data-height="720"
     data-start="0"
     data-duration="1">
	<div class="content">
		${emojiAccent ? `<div class="emoji">${emojiAccent}</div>` : ""}
		<div class="title">${title}</div>
		${subtitle ? `<div class="subtitle">${subtitle}</div>` : ""}
	</div>
</div>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<script>
window.__timelines = window.__timelines || {};
const tl = gsap.timeline({ paused: true });
window.__timelines["thumbnail"] = tl;
tl.from(".title", { opacity: 0, duration: 0.01 }, 0);
</script>
</body>
</html>`;

      try {
        writeProjectFile(ctx.userId, ctx.projectId, "thumbnail.html", html);
        return {
          content: [
            {
              type: "text",
              text: [
                `OK: wrote thumbnail.html (1280×720, Anton/${accentColor}).`,
                `Title: "${title}"${subtitle ? ` | Sub: "${subtitle}"` : ""}`,
                hasHostImage
                  ? `Right 40% clear for host overlay — paste face image externally (Canva, Photoshop).`
                  : `Full-width layout.`,
                `Open thumbnail.html in the project preview to inspect.`,
                `To A/B test: call design_thumbnail again with a different title/palette.`,
              ].join("\n"),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Live data fetcher (bake-at-build-time)
  // -------------------------------------------------------------------------

  const fetchDataSourceTool = tool(
    "fetch_data_source",
    "Fetch structured JSON from a public API and return it for baking into a composition. Use for live data: crypto/stock prices, sports scores, weather, leaderboards. Compositions are deterministic — data is fetched NOW at build time and hardcoded as constants. No runtime fetching in the composition.",
    {
      url: z.string().describe("Public HTTPS JSON API endpoint. No auth required."),
      extractPath: z
        .string()
        .optional()
        .describe(
          "Dot-notation path into the JSON, e.g. 'data.price' or 'results[0].score'. Omit to return the full response.",
        ),
      label: z.string().optional().describe("Human label, e.g. 'BTC/USD price', 'Lakers score'."),
    },
    async ({ url, extractPath, label }) => {
      if (!url.startsWith("https://")) {
        return {
          content: [{ type: "text", text: "ERROR: Only HTTPS URLs are supported." }],
          isError: true,
        };
      }
      try {
        // safeFetch validates + pins to the vetted public IP (SSRF + DNS-rebind safe).
        const res = await safeFetch(url, {
          headers: { "User-Agent": "VibeEdit/1.0 data-fetcher", Accept: "application/json" },
          signal: AbortSignal.timeout(15_000),
        });
        if (!res.ok) {
          return {
            content: [{ type: "text", text: `ERROR: HTTP ${res.status} from ${url}` }],
            isError: true,
          };
        }
        const raw = (await res.json()) as unknown;
        let data: unknown = raw;
        if (extractPath) {
          const parts = extractPath.replace(/\[(\d+)\]/g, ".$1").split(".");
          for (const part of parts) {
            if (data == null || typeof data !== "object") {
              data = null;
              break;
            }
            data = (data as Record<string, unknown>)[part];
          }
        }
        const preview = JSON.stringify(data, null, 2).slice(0, 2000);
        return {
          content: [
            {
              type: "text",
              text: [
                `${label ? `[${label}] ` : ""}Fetched from ${url}:`,
                extractPath ? `(path: ${extractPath})` : "(full response, truncated at 2000 chars)",
                "",
                preview,
                "",
                "Bake as hardcoded constants in the composition — e.g.:",
                `const VALUE = ${JSON.stringify(data)};`,
                "Then animate with gsap counter: gsap.to(el, { innerText: VALUE, snap: { innerText: 1 }, duration: 1.5 })",
              ].join("\n"),
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Aspect ratio reformatter
  // -------------------------------------------------------------------------

  const reformatCompositionTool = tool(
    "reformat_composition",
    "Mechanically reformat index.html from its current aspect ratio to a new one. Handles: root dimension attributes, proportional px font scaling, canvas-matching px width/height in CSS. Reports what it changed and warns about layouts needing manual review. Always call screenshot_at_time after to visually verify.",
    {
      targetFormat: z.enum(["16:9", "9:16", "1:1"]).describe("Target aspect ratio."),
      targetWidth: z
        .number()
        .int()
        .optional()
        .describe("Override width px. Defaults: 16:9→1920, 9:16→1080, 1:1→1080."),
      targetHeight: z
        .number()
        .int()
        .optional()
        .describe("Override height px. Defaults: 16:9→1080, 9:16→1920, 1:1→1080."),
    },
    async ({ targetFormat, targetWidth, targetHeight }) => {
      let html: string;
      try {
        html = readProjectText(ctx.userId, ctx.projectId, "index.html");
      } catch {
        return {
          content: [{ type: "text", text: "ERROR: no index.html found." }],
          isError: true,
        };
      }

      const DEFAULTS: Record<string, { w: number; h: number }> = {
        "16:9": { w: 1920, h: 1080 },
        "9:16": { w: 1080, h: 1920 },
        "1:1": { w: 1080, h: 1080 },
      };
      const tgt = DEFAULTS[targetFormat];
      const newW = targetWidth ?? tgt.w;
      const newH = targetHeight ?? tgt.h;

      const wMatch = html.match(/data-width=["'](\d+)["']/);
      const hMatch = html.match(/data-height=["'](\d+)["']/);
      const curW = wMatch ? parseInt(wMatch[1]) : 1920;
      const curH = hMatch ? parseInt(hMatch[1]) : 1080;

      if (curW === newW && curH === newH) {
        return {
          content: [{ type: "text", text: `Already ${newW}×${newH} — no changes needed.` }],
        };
      }

      const fontScale = Math.min(newW / curW, newH / curH);
      const changes: string[] = [];
      const warnings: string[] = [];

      let updated = html
        .replace(/data-width=["']\d+["']/, `data-width="${newW}"`)
        .replace(/data-height=["']\d+["']/, `data-height="${newH}"`);
      changes.push(`Root: ${curW}×${curH} → ${newW}×${newH}`);

      updated = updated.replace(
        /\b(width|min-width)\s*:\s*(\d+)px/g,
        (match: string, prop: string, val: string) => {
          if (parseInt(val) === curW) {
            changes.push(`${prop}: ${val}px → ${newW}px`);
            return `${prop}: ${newW}px`;
          }
          return match;
        },
      );
      updated = updated.replace(
        /\b(height|min-height)\s*:\s*(\d+)px/g,
        (match: string, prop: string, val: string) => {
          if (parseInt(val) === curH) {
            changes.push(`${prop}: ${val}px → ${newH}px`);
            return `${prop}: ${newH}px`;
          }
          return match;
        },
      );

      updated = updated.replace(/font-size\s*:\s*(\d+)px/g, (match: string, val: string) => {
        const scaled = Math.round(parseInt(val) * fontScale);
        if (scaled !== parseInt(val)) changes.push(`font-size: ${val}px → ${scaled}px`);
        return `font-size: ${scaled}px`;
      });

      if (html.includes("grid-template-columns") && targetFormat === "9:16") {
        warnings.push(
          "WARN: grid-template-columns found — split_screen layouts may need manual conversion to grid-template-rows for 9:16.",
        );
      }
      if ((html.match(/position\s*:\s*absolute/g) || []).length > 2) {
        warnings.push(
          "WARN: multiple absolute-positioned elements — review left/top values after reformat.",
        );
      }
      if (targetFormat === "9:16" && !updated.includes("padding: 18%")) {
        warnings.push(
          "ADVISORY: Add safe-zone padding: padding: 18% 5% 26% on text containers (Shorts/Reels/TikTok UI overlaps edges).",
        );
      }

      writeProjectFile(ctx.userId, ctx.projectId, "index.html", updated);

      const curLabel = curW > curH ? "16:9" : curW === curH ? "1:1" : "9:16";
      return {
        content: [
          {
            type: "text",
            text: [
              `Reformatted ${curW}×${curH} (${curLabel}) → ${newW}×${newH} (${targetFormat}).`,
              "",
              `${changes.length} mechanical change(s):`,
              ...changes.map((c) => `  • ${c}`),
              ...(warnings.length ? ["", ...warnings] : []),
              "",
              "Call screenshot_at_time to verify — manually fix any layout issues.",
            ].join("\n"),
          },
        ],
      };
    },
  );

  // -------------------------------------------------------------------------
  // Visual critique — pixel-level analysis of last-captured snapshots
  // -------------------------------------------------------------------------

  const visualCritiqueTool = tool(
    "visual_critique",
    "Pixel-level analysis of the last-captured composition screenshots using brightness, contrast, and color statistics. Returns the frames + quantitative stats for structured critique. Call after screenshot_at_time. Score all 6 dimensions; fix anything below 7/10 before declaring done. Repeat up to 3 iterations.",
    {
      maxFrames: z
        .number()
        .int()
        .min(1)
        .max(4)
        .optional()
        .default(4)
        .describe("How many snapshot frames to analyze (default 4 = all)."),
    },
    async ({ maxFrames }) => {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const sharp = (await import("sharp")).default;
      const dir = projectDir(ctx.userId, ctx.projectId);
      const snapshotsDir = path.join(dir, "snapshots");

      if (!fs.existsSync(snapshotsDir)) {
        return {
          content: [
            {
              type: "text",
              text: "ERROR: no snapshots found. Call screenshot_at_time first.",
            },
          ],
          isError: true,
        };
      }

      const files = fs
        .readdirSync(snapshotsDir)
        .filter((f: string) => f.toLowerCase().endsWith(".png"))
        .sort()
        .slice(0, maxFrames ?? 4);

      if (files.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "ERROR: no PNG files in snapshots/. Call screenshot_at_time first.",
            },
          ],
          isError: true,
        };
      }

      const content: Array<{
        type: string;
        text?: string;
        mimeType?: string;
        data?: string;
      }> = [];

      content.push({
        type: "text",
        text:
          "## Visual critique — score each frame on 6 dimensions (1–10). Fix ALL below 7/10.\n\n" +
          "1. **Text readability** — hero text visible at a glance, has shadow/contrast, not clipped\n" +
          "2. **Visual hierarchy** — clear hero/label/body distinction, one dominant element per frame\n" +
          "3. **Color grade** — consistent filter applied, has depth and mood (not flat/grey)\n" +
          "4. **Background depth** — radial gradient visible, not a plain solid color\n" +
          "5. **Layout balance** — no elements touching edges, nothing cut off, no two elements overlapping/colliding (text over text, caption over logo), good breathing room\n" +
          "6. **Production polish** — grain overlay visible, text shadows, professional finish\n\n" +
          "For each dimension below 7/10: write the exact CSS/GSAP change, apply it, re-screenshot.\n\n" +
          "Pixel analysis per frame:",
      });

      for (const file of files) {
        const fullPath = path.join(snapshotsDir, file);
        try {
          const stats = await sharp(fullPath).stats();
          const r = stats.channels[0].mean;
          const g = stats.channels[1].mean;
          const b = stats.channels[2].mean;
          const brightness = (r + g + b) / 3;
          const contrast =
            (stats.channels[0].stdev + stats.channels[1].stdev + stats.channels[2].stdev) / 3;
          const colorSpread = Math.max(r, g, b) - Math.min(r, g, b);

          const brightnessNote =
            brightness < 30
              ? "VERY DARK — text may be invisible against background"
              : brightness < 60
                ? "DARK — verify text has sufficient contrast"
                : brightness > 220
                  ? "VERY BRIGHT — check text is readable"
                  : brightness > 180
                    ? "BRIGHT — verify dark text has contrast"
                    : "OK";
          const contrastNote =
            contrast < 20
              ? "LOW CONTRAST — frame looks flat, check color grade"
              : contrast < 40
                ? "MODERATE — consider richer gradients"
                : "OK";
          const colorNote =
            colorSpread < 15
              ? "NEAR MONOCHROME — color grade may not be applied"
              : colorSpread < 40
                ? "LOW SATURATION — grade may be too subtle"
                : "OK";

          const downscaled = await sharp(fullPath)
            .resize({ width: 720, height: 720, fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 75 })
            .toBuffer();

          content.push({
            type: "text",
            text:
              `\n**${file.replace(/\.png$/i, "")}** — ` +
              `brightness: ${brightness.toFixed(0)}/255 (${brightnessNote}) | ` +
              `contrast stdev: ${contrast.toFixed(0)} (${contrastNote}) | ` +
              `color spread: ${colorSpread.toFixed(0)} (${colorNote})`,
          });
          content.push({
            type: "image",
            mimeType: "image/jpeg",
            data: downscaled.toString("base64"),
          });
        } catch (error) {
          content.push({
            type: "text",
            text: `ERROR reading ${file}: ${(error as Error).message}`,
          });
        }
      }

      content.push({
        type: "text",
        text:
          "\nScore all 6 dimensions. Write specific fixes for every score below 7/10. " +
          "Then call write_file → screenshot_at_time → visual_critique again. " +
          "Stop after 3 iterations or when all dimensions reach 7/10.",
      });

      return { content };
    },
  );

  // -------------------------------------------------------------------------
  // Remove background — AI-powered transparent PNG via Replicate rembg
  // -------------------------------------------------------------------------

  const removeBackgroundTool = tool(
    "remove_background",
    "Remove the background from a project image using AI (Replicate 851-labs/background-remover). Saves a transparent PNG to assets/. Use for host portraits, product shots, or any asset that needs to float over a video or gradient background. Requires a Replicate API key.",
    {
      imagePath: z
        .string()
        .describe("Source image relative path, e.g. 'assets/host.jpg'. Must exist in the project."),
      outputFilename: z
        .string()
        .regex(/^[A-Za-z0-9._-]+\.png$/)
        .describe("Output filename saved to assets/, e.g. 'host-nobg.png'."),
    },
    async ({ imagePath, outputFilename }) => {
      const apiKey = resolveApiKey("replicate", "REPLICATE_API_TOKEN", ctx.apiKeys?.replicate);
      if (!apiKey) {
        return {
          content: [
            {
              type: "text",
              text: "ERROR: No Replicate API key. Ask the user to add their Replicate token at /app/settings/api-keys.",
            },
          ],
          isError: true,
        };
      }

      let imageBuffer: Buffer;
      try {
        imageBuffer = readProjectFile(ctx.userId, ctx.projectId, imagePath).content;
      } catch {
        return {
          content: [
            {
              type: "text",
              text: `ERROR: file not found: ${imagePath}. Verify the path with list_assets.`,
            },
          ],
          isError: true,
        };
      }

      const ext = imagePath.split(".").pop()?.toLowerCase() ?? "jpeg";
      const mime = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
      const dataUri = `data:${mime};base64,${imageBuffer.toString("base64")}`;

      try {
        const startRes = await fetch(
          "https://api.replicate.com/v1/models/851-labs/background-remover/predictions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
              Prefer: "wait=30",
            },
            body: JSON.stringify({ input: { image: dataUri } }),
            signal: AbortSignal.timeout(40_000),
          },
        );

        if (!startRes.ok) {
          return {
            content: [
              {
                type: "text",
                text: `ERROR: Replicate API failed: HTTP ${startRes.status} — ${await startRes.text()}`,
              },
            ],
            isError: true,
          };
        }

        let prediction = (await startRes.json()) as {
          id: string;
          status: string;
          output?: string;
          error?: string;
        };

        const startedAt = Date.now();
        while (prediction.status === "starting" || prediction.status === "processing") {
          if (Date.now() - startedAt > 60_000) break;
          await new Promise<void>((resolve) => setTimeout(resolve, 1_500));
          const poll = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
            headers: { Authorization: `Bearer ${apiKey}` },
            signal: AbortSignal.timeout(15_000),
          });
          if (poll.ok) prediction = (await poll.json()) as typeof prediction;
        }

        if (prediction.status !== "succeeded" || !prediction.output) {
          return {
            content: [
              {
                type: "text",
                text: `ERROR: background removal failed: ${prediction.error ?? prediction.status}`,
              },
            ],
            isError: true,
          };
        }

        const imgRes = await fetch(prediction.output, { signal: AbortSignal.timeout(30_000) });
        if (!imgRes.ok) {
          return {
            content: [
              { type: "text", text: `ERROR: failed to download result: HTTP ${imgRes.status}` },
            ],
            isError: true,
          };
        }
        const outputBuffer = Buffer.from(await imgRes.arrayBuffer());
        const safe = outputFilename.replace(/[/\\]/g, "_").replace(/^\.+/, "");
        writeProjectFile(ctx.userId, ctx.projectId, `assets/${safe}`, outputBuffer);

        return {
          content: [
            {
              type: "text",
              text:
                `OK: background removed → assets/${safe} (${(outputBuffer.length / 1024).toFixed(0)} KB, transparent PNG). ` +
                `Reference as <img src="assets/${safe}"> in your composition.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Crop/resize image — Sharp-based, no API key required
  // -------------------------------------------------------------------------

  const cropImageTool = tool(
    "crop_image",
    "Crop and/or resize a project image with Sharp. Use to trim dead space around portraits, normalize upload dimensions, or fit an asset to a specific canvas size before compositing. No API key required.",
    {
      imagePath: z.string().describe("Source image relative path, e.g. 'assets/host.jpg'."),
      outputFilename: z
        .string()
        .regex(/^[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp)$/)
        .describe("Output filename saved to assets/, e.g. 'host-cropped.jpg'."),
      width: z.number().int().min(1).max(4096).optional().describe("Target width in pixels."),
      height: z.number().int().min(1).max(4096).optional().describe("Target height in pixels."),
      fit: z
        .enum(["cover", "contain", "fill", "inside", "outside"])
        .optional()
        .default("inside")
        .describe(
          "Resize fit: 'cover' crops to fill; 'contain' letterboxes; 'inside' shrinks to fit without crop.",
        ),
      cropLeft: z.number().int().min(0).optional().describe("Crop start x (pixels)."),
      cropTop: z.number().int().min(0).optional().describe("Crop start y (pixels)."),
      cropWidth: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("Crop region width (pixels, before resize)."),
      cropHeight: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("Crop region height (pixels, before resize)."),
    },
    async ({
      imagePath,
      outputFilename,
      width,
      height,
      fit,
      cropLeft,
      cropTop,
      cropWidth,
      cropHeight,
    }) => {
      let imageBuffer: Buffer;
      try {
        imageBuffer = readProjectFile(ctx.userId, ctx.projectId, imagePath).content;
      } catch {
        return {
          content: [
            {
              type: "text",
              text: `ERROR: file not found: ${imagePath}. Verify the path with list_assets.`,
            },
          ],
          isError: true,
        };
      }

      try {
        const sharp = (await import("sharp")).default;
        let pipeline = sharp(imageBuffer);

        if (
          cropLeft !== undefined ||
          cropTop !== undefined ||
          cropWidth !== undefined ||
          cropHeight !== undefined
        ) {
          const meta = await pipeline.metadata();
          pipeline = pipeline.extract({
            left: cropLeft ?? 0,
            top: cropTop ?? 0,
            width: cropWidth ?? (meta.width ?? 9999) - (cropLeft ?? 0),
            height: cropHeight ?? (meta.height ?? 9999) - (cropTop ?? 0),
          });
        }

        if (width ?? height) {
          pipeline = pipeline.resize({
            width: width ?? undefined,
            height: height ?? undefined,
            fit: fit ?? "inside",
            withoutEnlargement: true,
          });
        }

        const safe = outputFilename.replace(/[/\\]/g, "_").replace(/^\.+/, "");
        const fileExt = safe.split(".").pop()?.toLowerCase();
        let outputBuffer: Buffer;
        if (fileExt === "png") {
          outputBuffer = await pipeline.png().toBuffer();
        } else if (fileExt === "webp") {
          outputBuffer = await pipeline.webp({ quality: 90 }).toBuffer();
        } else {
          outputBuffer = await pipeline.jpeg({ quality: 90 }).toBuffer();
        }

        writeProjectFile(ctx.userId, ctx.projectId, `assets/${safe}`, outputBuffer);
        const outMeta = await sharp(outputBuffer).metadata();

        return {
          content: [
            {
              type: "text",
              text: `OK: saved assets/${safe} (${outMeta.width}×${outMeta.height}, ${(outputBuffer.length / 1024).toFixed(0)} KB).`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [{ type: "text", text: `ERROR: ${(error as Error).message}` }],
          isError: true,
        };
      }
    },
  );

  // -------------------------------------------------------------------------
  // Style lock — CSS variables from brand kit for brand-consistent compositions
  // -------------------------------------------------------------------------

  const getStyleLockTool = tool(
    "get_style_lock",
    "Generate a CSS :root variables block and Google Fonts import from the user's brand kit. Paste into every composition's <head> and <style> to lock colors, fonts, and type scale — preventing brand drift across videos. Call this once at the start of every new composition, immediately after get_brand_kit.",
    {},
    async () => {
      const kit = await readBrandKit(ctx.userId);

      const primary = kit.primaryColor ?? "#0a0a0a";
      const accent = kit.accentColor ?? "#ffffff";
      const fontFamily = kit.fontFamily ?? "Inter";

      const hexToRgb = (hex: string): [number, number, number] => {
        const m = hex.replace("#", "").match(/.{2}/g);
        if (!m || m.length < 3) return [0, 0, 0];
        return [parseInt(m[0], 16), parseInt(m[1], 16), parseInt(m[2], 16)];
      };

      const darken = (hex: string, amount: number): string => {
        const [r, g, b] = hexToRgb(hex);
        const d = (v: number) =>
          Math.max(0, Math.round(v * (1 - amount)))
            .toString(16)
            .padStart(2, "0");
        return `#${d(r)}${d(g)}${d(b)}`;
      };

      const fontSlug = fontFamily.replace(/\s+/g, "+");
      const fontsImport = [
        `<link rel="preconnect" href="https://fonts.googleapis.com">`,
        `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`,
        `<link href="https://fonts.googleapis.com/css2?family=${fontSlug}:wght@400;600;700;900&display=swap" rel="stylesheet">`,
      ].join("\n");

      const cssVars = [
        `:root {`,
        `  --brand-primary:     ${primary};`,
        `  --brand-accent:      ${accent};`,
        `  --brand-font:        '${fontFamily}', sans-serif;`,
        `  --brand-bg-deep:     ${darken(primary, 0.15)};`,
        `  --brand-bg-gradient: radial-gradient(ellipse at 20% 80%, ${primary} 0%, ${darken(primary, 0.45)} 60%);`,
        `  --brand-text-hero:   clamp(64px, 10vw, 160px);`,
        `  --brand-text-label:  clamp(20px, 3.5vw, 48px);`,
        `  --brand-text-body:   clamp(16px, 2.2vw, 32px);`,
        `  --brand-shadow:      0 2px 12px rgba(0,0,0,0.9);`,
        `}`,
      ].join("\n");

      const lines: string[] = [
        "Paste the fonts block into <head> and the CSS block into <style>.",
        "Use var(--brand-accent) for highlights, var(--brand-bg-gradient) on scene backgrounds.",
        "Never hard-code hex values that exist in this kit — always use the vars.",
        "",
        "--- FONTS (paste in <head>) ---",
        fontsImport,
        "",
        "--- CSS VARS (paste in <style>) ---",
        cssVars,
      ];

      if (kit.logoPath)
        lines.push(
          "",
          `Logo: ${kit.logoPath} — add as:`,
          `<img src="${kit.logoPath}" style="position:absolute;top:24px;right:24px;max-height:60px;opacity:0.9;z-index:100;">`,
        );
      if (kit.watermarkPath)
        lines.push(
          "",
          `Watermark: ${kit.watermarkPath} — add at 50% opacity, bottom-right corner.`,
        );

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    },
  );

  return createSdkMcpServer({
    name: MCP_SERVER_NAME,
    version: "1.0.0",
    tools: [
      planCompositionTool,
      listFilesTool,
      readFileTool,
      writeFileTool,
      diffFileTool,
      lintTool,
      screenshotTool,
      getBrandKitTool,
      findStockTool,
      listAssetsTool,
      listRegistryTool,
      readRegistryTool,
      analyzeImageTool,
      captionAssetTool,
      generateCaptionsTool,
      generateImageTool,
      generateImageVariantsTool,
      generateVoiceoverTool,
      startRenderTool,
      planEditTool,
      buildCaptionsFromWordsTool,
      snapToBoundaryTool,
      autoGradeFilterTool,
      computeSegmentOffsetsTool,
      validateEdlTool,
      estimateCreditsTool,
      renderEdlTool,
      probeClipTool,
      trimClipTool,
      trimAudioTool,
      concatClipsTool,
      gradeClipTool,
      chromaKeyTool,
      speedClipTool,
      overlayClipTool,
      addTransitionTool,
      mixAudioTool,
      extractAudioTool,
      burnCaptionsTool,
      transcribeClipTool,
      packFootageTool,
      analyzeClipTool,
      planRecreationTool,
      reviewRenderTool,
      detectFillerWordsTool,
      applyNoiseReductionTool,
      removeBackgroundNoiseTool,
      analyzePacingTool,
      detectBeatsTool,
      buildWordHighlightCaptionsTool,
      qualityCheckTool,
      draftScriptTool,
      saveInsightTool,
      loadInsightsTool,
      downloadAssetTool,
      generateBrollTool,
      generateMusicTool,
      suggestNextStepsTool,
      designThumbnailTool,
      fetchDataSourceTool,
      reformatCompositionTool,
      visualCritiqueTool,
      removeBackgroundTool,
      cropImageTool,
      getStyleLockTool,
      searchMediaTool,
      prepareSceneMediaTool,
      generatePersonaTool,
      getPersonaTool,
      usePersonaTool,
      addPersonaPoseTool,
      updatePersonaTool,
      listAssetsSummaryTool,
      readManifestTool,
      upsertManifestTool,
      getProjectEditTool,
      undoProjectEditTool,
      listScenesTool,
      readSceneTool,
      editSceneTool,
      searchEffectsTool,
      applyEffectTool,
    ],
  });
}

export const ALLOWED_TOOL_NAMES = [
  "plan_composition",
  "list_files",
  "read_file",
  "write_file",
  "diff_file",
  "lint_composition",
  "screenshot_at_time",
  "get_brand_kit",
  "find_stock",
  "list_assets",
  "list_registry_blocks",
  "read_registry_block",
  "analyze_image",
  "caption_asset",
  "generate_captions",
  "generate_image",
  "generate_image_variants",
  "generate_voiceover",
  "start_render",
  "plan_edit",
  "build_captions_from_words",
  "snap_to_boundary",
  "auto_grade_filter",
  "compute_segment_offsets",
  "validate_edl",
  "estimate_credits",
  "render_edl",
  "probe_clip",
  "trim_clip",
  "concat_clips",
  "grade_clip",
  "chroma_key",
  "speed_clip",
  "overlay_clip",
  "add_transition",
  "mix_audio",
  "extract_audio",
  "burn_captions",
  "transcribe_clip",
  "pack_footage",
  "analyze_clip",
  "plan_recreation",
  "review_render",
  "detect_filler_words",
  "apply_noise_reduction",
  "remove_background_noise",
  "analyze_pacing",
  "detect_beats",
  "build_word_highlight_captions",
  "quality_check",
  "draft_script",
  "save_insight",
  "load_insights",
  "trim_audio",
  "download_asset",
  "generate_broll",
  "generate_music",
  "design_thumbnail",
  "fetch_data_source",
  "reformat_composition",
  "visual_critique",
  "remove_background",
  "crop_image",
  "get_style_lock",
  "search_media",
  "prepare_scene_media",
  "generate_persona",
  "get_persona",
  "use_persona",
  "add_persona_pose",
  "update_persona",
  "list_assets_summary",
  "read_manifest",
  "upsert_manifest",
  "get_project_edit",
  "undo_project_edit",
  "list_scenes",
  "read_scene",
  "edit_scene",
  "search_effects",
  "apply_effect",
].map((n) => `mcp__${MCP_SERVER_NAME}__${n}`);

type MediaResult = { url: string; source: string; license?: string; title?: string };

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Format seconds as m:ss for compact transcript timecodes. */
function fmtTc(seconds: number): string {
  const s = Math.max(0, seconds);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

const DIRECT_IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif|bmp)(?:[?#]|$)/i;
const DIRECT_VIDEO_EXT = /\.(mp4|webm|mov|m4v)(?:[?#]|$)/i;

/** A directly-downloadable media file URL (not a youtube/vimeo/page link). */
function isDirectMediaUrl(url: string, kind: "image" | "video"): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  return kind === "video" ? DIRECT_VIDEO_EXT.test(url) : DIRECT_IMAGE_EXT.test(url);
}

/** Best-guess file extension for a media URL, defaulting per kind. */
function extFromUrl(url: string, kind: "image" | "video"): string {
  const m = url.match(kind === "video" ? DIRECT_VIDEO_EXT : DIRECT_IMAGE_EXT);
  return (m?.[1] || (kind === "video" ? "mp4" : "jpg")).toLowerCase();
}

/**
 * Web media search backing `search_media`. Two keyless/self-hosted backends:
 *  - Openverse (api.openverse.org): Creative-Commons images, no API key.
 *  - SearXNG (self-hosted, via SEARXNG_URL): broader image + video discovery.
 * Either may be absent/unreachable; results are merged and de-duped, and an
 * empty array just tells the agent to try find_stock / generate_image instead.
 */
async function searchMedia(query: string, kind: "image" | "video"): Promise<MediaResult[]> {
  const out: MediaResult[] = [];

  // Openverse — CC-licensed images only (no video endpoint).
  if (kind === "image") {
    try {
      const r = await fetch(
        `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=10`,
        {
          headers: { "user-agent": "VibeEdit/1.0 media-search" },
          signal: AbortSignal.timeout(12_000),
        },
      );
      if (r.ok) {
        const data = (await r.json()) as {
          results?: Array<{ url?: string; title?: string; license?: string; source?: string }>;
        };
        for (const it of data.results ?? []) {
          if (it.url) {
            out.push({
              url: it.url,
              source: it.source ? `openverse/${it.source}` : "openverse",
              license: it.license ? it.license.toUpperCase() : undefined,
              title: it.title,
            });
          }
        }
      }
    } catch {
      /* backend unreachable — fall through */
    }
  }

  // SearXNG — self-hosted metasearch; broader images + video. Opt-in via env.
  const sx = process.env.SEARXNG_URL;
  if (sx) {
    try {
      const cat = kind === "video" ? "videos" : "images";
      const r = await fetch(
        `${sx.replace(/\/$/, "")}/search?q=${encodeURIComponent(query)}&format=json&categories=${cat}&safesearch=1`,
        {
          headers: { "user-agent": "VibeEdit/1.0 media-search" },
          signal: AbortSignal.timeout(12_000),
        },
      );
      if (r.ok) {
        const data = (await r.json()) as {
          results?: Array<{ url?: string; img_src?: string; title?: string; engine?: string }>;
        };
        for (const it of data.results ?? []) {
          const mediaUrl = kind === "image" ? it.img_src || it.url : it.url;
          if (mediaUrl) {
            out.push({
              url: mediaUrl,
              source: it.engine ? `searxng/${it.engine}` : "searxng",
              title: it.title,
            });
          }
        }
      }
    } catch {
      /* backend unreachable — fall through */
    }
  }

  const seen = new Set<string>();
  return out.filter((r) => (seen.has(r.url) ? false : (seen.add(r.url), true)));
}

type SnapshotContent =
  | { type: "text"; text: string }
  | {
      type: "image";
      data: string;
      mimeType: "image/png" | "image/jpeg";
    };

/**
 * Encode every PNG in a snapshots/ dir into downscaled JPEG image content
 * for the model. Shared by both the warm in-process path and the CLI fallback.
 */
async function encodeSnapshotsDir(
  snapshotsDir: string,
  timestamps: number[],
): Promise<SnapshotContent[]> {
  const fs = await import("node:fs");
  const path = await import("node:path");
  if (!fs.existsSync(snapshotsDir)) {
    return [{ type: "text", text: "ERROR: snapshots dir was not produced." }];
  }
  const files = fs
    .readdirSync(snapshotsDir)
    .filter((f) => f.toLowerCase().endsWith(".png"))
    .sort();
  if (files.length === 0) {
    return [{ type: "text", text: "ERROR: no PNGs found in snapshots/." }];
  }

  const sharp = (await import("sharp")).default;
  const content: SnapshotContent[] = [
    {
      type: "text",
      text: `Captured ${files.length} frame(s) at ${timestamps
        .map((t) => `${t}s`)
        .join(", ")}. Inspect them and decide what to fix.`,
    },
  ];
  for (const file of files) {
    try {
      const fullPath = path.join(snapshotsDir, file);
      const downscaled = await sharp(fullPath)
        .resize({
          width: 720,
          height: 720,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: 75 })
        .toBuffer();
      content.push({
        type: "image",
        mimeType: "image/jpeg",
        data: downscaled.toString("base64"),
      });
      content.push({
        type: "text",
        text: `↑ ${file.replace(/\.png$/i, "")}`,
      });
    } catch (error) {
      content.push({
        type: "text",
        text: `(failed to encode ${file}: ${(error as Error).message})`,
      });
    }
  }
  return content;
}

async function runSnapshot(
  userId: string,
  projectId: string,
  timestamps: number[],
): Promise<SnapshotContent[]> {
  const path = await import("node:path");
  const dir = projectDir(userId, projectId);
  const snapshotsDir = path.join(dir, "snapshots");

  // Preferred path: capture against the warm browser pool. This skips the cold
  // Chromium launch the CLI fallback pays on every call — the dominant cost in
  // the agent's visual-critique loop.
  //
  // capture.ts imports @hyperframes/core/compiler + @hyperframes/engine, whose
  // package `exports` point subpaths at TS SOURCE (./src/*.ts). Node (next
  // start) can't require that and webpack (next build) can't bundle it, so we
  // must NOT import capture.ts into the Next bundle. Instead we spawn `bun`
  // (present in the container, runs .ts natively) on a thin wrapper script that
  // owns the heavy import. It reads (projectDir, JSON timestamps) and prints a
  // JSON array of project-relative frame paths to stdout.
  try {
    const { spawn } = await import("node:child_process");
    const capture = await new Promise<{ code: number; out: string; err: string }>((resolveP) => {
      const child = spawn("bun", ["scripts/capture-frames.ts", dir, JSON.stringify(timestamps)], {
        // The Next server runs from /app/apps/web (Dockerfile CMD: cd apps/web
        // && bun run start), so scripts/ resolves relative to cwd and bun comes
        // from PATH.
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"],
        env: process.env,
      });
      let out = "";
      let err = "";
      const timer = setTimeout(() => child.kill("SIGTERM"), 60_000);
      child.stdout?.on("data", (chunk: Buffer) => {
        out += chunk.toString();
        if (out.length > 200_000) out = out.slice(-200_000);
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        err += chunk.toString();
        if (err.length > 4000) err = err.slice(-4000);
      });
      child.on("error", () => {
        clearTimeout(timer);
        resolveP({ code: 1, out, err: err || "bun spawn failed" });
      });
      child.on("exit", (code) => {
        clearTimeout(timer);
        resolveP({ code: code ?? 1, out, err });
      });
    });

    if (capture.code !== 0) {
      throw new Error(`bun capture exited ${capture.code}: ${capture.err.slice(-800)}`);
    }
    const paths = JSON.parse(capture.out.trim() || "[]") as string[];
    if (paths.length > 0) {
      return encodeSnapshotsDir(snapshotsDir, timestamps);
    }
    // No frames produced — fall through to the CLI as a sanity fallback.
  } catch (warmErr) {
    console.warn(
      `[snapshot] warm capture failed, falling back to CLI: ${(warmErr as Error).message}`,
    );
  }

  // Fallback: spawn the hyperframes CLI (cold Chromium per call).
  const { spawn } = await import("node:child_process");
  const fs = await import("node:fs");
  try {
    fs.rmSync(snapshotsDir, { recursive: true, force: true });
  } catch {
    /* */
  }
  const atArg = timestamps.map((t) => String(t)).join(",");
  const PATH = process.env.PATH || "";
  const extraBin = process.cwd() + "/node_modules/.bin";
  const cliOut = await new Promise<{ code: number; err: string }>((resolveP) => {
    const child = spawn("hyperframes", ["snapshot", dir, "--at", atArg], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PATH: `${extraBin}:${PATH}` },
    });
    let err = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      err += chunk.toString();
      if (err.length > 4000) err = err.slice(-4000);
    });
    child.on("error", () => resolveP({ code: 1, err: err || "spawn failed" }));
    child.on("exit", (code) => resolveP({ code: code ?? 1, err }));
  });

  if (cliOut.code !== 0) {
    return [
      {
        type: "text",
        text: `ERROR: snapshot CLI exited ${cliOut.code}: ${cliOut.err.slice(-800)}`,
      },
    ];
  }

  return encodeSnapshotsDir(snapshotsDir, timestamps);
}

async function runLint(userId: string, projectId: string): Promise<string> {
  const dir = projectDir(userId, projectId);

  // Preferred path: lint in-process via core (no CLI spawn). Mirrors
  // `hyperframes lint --json` non-verbose output (info-level filtered out).
  try {
    const { lintProject } = await import("@hyperframes/core/lint");
    const result = lintProject(dir);
    const findings = result.results
      .flatMap((r) => r.result.findings)
      .filter((f) => f.severity !== "info");
    if (findings.length === 0) return "OK: 0 issues";
    return findings.map((f) => `${f.severity} [${f.code}] ${f.message}`).join("\n");
  } catch (err) {
    console.warn(`[lint] in-process lint failed, falling back to CLI: ${(err as Error).message}`);
  }

  // Fallback: spawn the hyperframes CLI.
  const { spawn } = await import("node:child_process");
  const PATH = process.env.PATH || "";
  const extraBin = process.cwd() + "/node_modules/.bin";
  return new Promise<string>((resolveP) => {
    const child = spawn("hyperframes", ["lint", "--json", dir], {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, PATH: `${extraBin}:${PATH}` },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("error", (error) => resolveP(`(lint failed: ${error.message})`));
    child.on("exit", () => {
      const text = stdout.trim();
      try {
        const parsed = JSON.parse(text) as unknown;
        const issues = Array.isArray(parsed)
          ? parsed
          : (parsed as { issues?: unknown[]; findings?: unknown[] }).issues ||
            (parsed as { findings?: unknown[] }).findings ||
            [];
        if (!issues.length) return resolveP("OK: 0 issues");
        resolveP(
          issues
            .map((issue) => {
              const i = issue as Record<string, unknown>;
              return `${i.severity || "warn"} [${i.code || i.rule || "?"}] ${i.message || ""}`;
            })
            .join("\n"),
        );
      } catch {
        resolveP(text || stderr.slice(-2000) || "(lint produced no output)");
      }
    });
  });
}

type PaletteColor = {
  hex: string;
  r: number;
  g: number;
  b: number;
  percent: number;
};

async function extractPalette(
  buffer: Buffer,
): Promise<{ colors: PaletteColor[]; avgLightness: number }> {
  const sharp = (await import("sharp")).default;
  // Downscale + decode raw pixels, then quantize colors into a small bucket
  // space and count occurrences. Cheap, deterministic, no extra deps.
  const decoded = await sharp(buffer)
    .resize(64, 64, { fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = decoded.data;
  const total = pixels.length / 3;
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>();
  let lightnessSum = 0;
  for (let i = 0; i < pixels.length; i += 3) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    lightnessSum += (Math.max(r, g, b) + Math.min(r, g, b)) / 510;
    const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
      existing.r += r;
      existing.g += g;
      existing.b += b;
    } else {
      buckets.set(key, { count: 1, r, g, b });
    }
  }
  const top = [...buckets.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map((bucket) => {
      const r = Math.round(bucket.r / bucket.count);
      const g = Math.round(bucket.g / bucket.count);
      const b = Math.round(bucket.b / bucket.count);
      return {
        r,
        g,
        b,
        percent: Math.round((bucket.count / total) * 100),
        hex: `#${toHex(r)}${toHex(g)}${toHex(b)}`,
      };
    });
  return { colors: top, avgLightness: lightnessSum / total };
}

function toHex(value: number): string {
  return value.toString(16).padStart(2, "0");
}

// ElevenLabs Audio Isolation — strips background noise and returns clean voice
// audio (mp3 bytes). https://elevenlabs.io/docs (audio-isolation endpoint).
async function elevenLabsIsolate(apiKey: string, audio: Buffer): Promise<Buffer> {
  const form = new FormData();
  form.append("audio", new Blob([new Uint8Array(audio)], { type: "audio/mpeg" }), "audio.mp3");
  const res = await fetch("https://api.elevenlabs.io/v1/audio-isolation", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form,
  });
  if (!res.ok) {
    throw new Error(`ElevenLabs isolation ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const out = Buffer.from(await res.arrayBuffer());
  if (out.length === 0) throw new Error("ElevenLabs isolation returned empty audio");
  return out;
}

async function synthesizeElevenLabsWithTimestamps(opts: {
  apiKey: string;
  script: string;
  voiceId: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}): Promise<{ audio: Buffer; words: TranscriptWord[] }> {
  if (!opts.voiceId) {
    throw new Error("no voiceId — pass one or set ELEVENLABS_DEFAULT_VOICE_ID env var");
  }
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(opts.voiceId)}/with-timestamps?output_format=mp3_44100_128`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": opts.apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      text: opts.script,
      model_id: "eleven_turbo_v2_5",
      // Fixed house defaults — expressiveness comes from the SCRIPT (caps +
      // punctuation), NOT from cranking these. stability 0.45 (natural, not
      // robotic), similarity 0.75, style 0 (exaggeration off — avoids artifacts).
      // Only overridden when the user explicitly asks to change voice dynamics.
      voice_settings: {
        stability: opts.stability ?? 0.45,
        similarity_boost: opts.similarityBoost ?? 0.75,
        style: opts.style ?? 0,
        use_speaker_boost: opts.useSpeakerBoost ?? true,
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`ElevenLabs ${response.status}: ${(await response.text()).slice(0, 400)}`);
  }
  type ElevenLabsTimestampResponse = {
    audio_base64: string;
    alignment: {
      characters: string[];
      character_start_times_seconds: number[];
      character_end_times_seconds: number[];
    };
  };
  const data = (await response.json()) as ElevenLabsTimestampResponse;
  const audio = Buffer.from(data.audio_base64, "base64");
  // Convert character-level alignment to word-level by grouping on spaces/punctuation.
  const words: TranscriptWord[] = [];
  const chars = data.alignment.characters;
  const starts = data.alignment.character_start_times_seconds;
  const ends = data.alignment.character_end_times_seconds;
  let wordChars = "";
  let wordStart = 0;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (/\s/.test(ch)) {
      if (wordChars.trim()) {
        words.push({ word: wordChars.trim(), start: wordStart, end: ends[i - 1] ?? ends[i] });
      }
      wordChars = "";
    } else {
      if (!wordChars) wordStart = starts[i];
      wordChars += ch;
    }
  }
  if (wordChars.trim()) {
    words.push({ word: wordChars.trim(), start: wordStart, end: ends[chars.length - 1] });
  }
  return { audio, words };
}

async function renderPlaceholderImage(opts: {
  width: number;
  height: number;
  palette: string[];
  direction: "radial" | "vertical" | "diagonal";
}): Promise<Buffer> {
  const sharp = (await import("sharp")).default;
  const [base, ...accents] = opts.palette;
  const stops = accents
    .map(
      (color, index) =>
        `<stop offset="${Math.round(((index + 1) / (accents.length + 1)) * 100)}%" stop-color="${color}"/>`,
    )
    .join("");
  const gradient =
    opts.direction === "radial"
      ? `<radialGradient id="g" cx="50%" cy="50%" r="65%"><stop offset="0%" stop-color="${base}"/>${stops}<stop offset="100%" stop-color="${accents[accents.length - 1] || base}"/></radialGradient>`
      : opts.direction === "vertical"
        ? `<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${base}"/>${stops}<stop offset="100%" stop-color="${accents[accents.length - 1] || base}"/></linearGradient>`
        : `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${base}"/>${stops}<stop offset="100%" stop-color="${accents[accents.length - 1] || base}"/></linearGradient>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.width}" height="${opts.height}">
<defs>${gradient}
<filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.18 0"/></filter>
</defs>
<rect width="100%" height="100%" fill="url(#g)"/>
<rect width="100%" height="100%" filter="url(#noise)"/>
</svg>`;
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

type CaptionCue = { text: string; start: number; end: number };

function splitScriptIntoCues(
  script: string,
  maxWords: number,
  totalDurationSeconds: number,
): CaptionCue[] {
  // Split into sentences first, then chunk each sentence by maxWords. Time
  // each cue by share of total word count so longer cues hold longer.
  const sentences = script
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
  const cues: { text: string; words: number }[] = [];
  for (const sentence of sentences) {
    const words = sentence.split(/\s+/).filter(Boolean);
    for (let i = 0; i < words.length; i += maxWords) {
      const chunk = words.slice(i, i + maxWords);
      cues.push({ text: chunk.join(" "), words: chunk.length });
    }
  }
  if (cues.length === 0) return [];
  const totalWords = cues.reduce((sum, cue) => sum + cue.words, 0) || 1;
  const result: CaptionCue[] = [];
  let cursor = 0;
  for (const cue of cues) {
    const share = (cue.words / totalWords) * totalDurationSeconds;
    const start = cursor;
    const end = Math.min(totalDurationSeconds, cursor + share);
    result.push({
      text: cue.text,
      start: Number(start.toFixed(3)),
      end: Number(end.toFixed(3)),
    });
    cursor = end;
  }
  // Snap last cue to exact duration to avoid floating-point drift.
  if (result.length) result[result.length - 1].end = totalDurationSeconds;
  return result;
}
