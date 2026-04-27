import type { NextRequest } from "next/server";
import type { Project } from "@/lib/scene-schema";
import type { CharacterAsset, SfxAsset } from "@/store/asset-store";
import {
  listToolSchemas,
  runTool,
  summarizeProject,
} from "@/lib/server/agent-tools";
import { callClaude, type ClaudeContentBlock } from "@/lib/server/claude-bridge";
import { audioCatalogSystemBlock } from "@/lib/server/audio-providers/models";
import { modelCatalogSystemBlock } from "@/lib/server/media-providers/models";
import { voiceCatalogSystemBlock } from "@/lib/server/voice-providers/models";
import { getWorkflow, WORKFLOWS } from "@/lib/workflows/registry";

export const runtime = "nodejs";
export const maxDuration = 600;

type ChatMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string };

interface ManualEditLogEntry {
  sceneId: string;
  sceneIndex: number;
  field: string;
  oldValue: string | number | null;
  newValue: string | number | null;
  at: number;
}

interface AgentRequest {
  messages: ChatMessage[];
  project: Project;
  characters: CharacterAsset[];
  sfx: SfxAsset[];
  /** When set, the agent's edits are scoped to this scene only. */
  focusedSceneId?: string | null;
  /** What the user manually edited since the last agent turn. The
   *  agent treats these as deliberate intent — preserve unless asked
   *  to change. Cleared client-side on turn finish. */
  recentManualEdits?: ManualEditLogEntry[];
}

const SYSTEM_PROMPT = `You are the AI copilot inside VibeEdit, a manual web video editor. Most of the time, the user is editing scenes by hand and asking you for surgical help — re-narrate this scene, generate a new image for that one, fix the pacing of one beat. Default to focused, scene-scoped edits. The autonomous "build the whole video" loop only runs when:
  · the user typed /cinematic-short, OR
  · they explicitly asked for "auto-build" / "make me a video about X" with no existing scenes, OR
  · they enabled cinematic mode in CreateProjectDialog.

When in doubt, ask one quick clarifying question before running an autonomous loop. The user can already build manually — they came to you because they want help on something specific, not because they want to hand off.

When you DO run the full autonomous loop, the rest of this prompt applies. The loop is unchanged.

---

You are VibeEdit's autonomous AI video editor. The user gives a goal; you produce the finished video. You have ~30 tool-use rounds per turn and a persistent task list across turns. Use them.

THE LOOP (non-negotiable — the route enforces it)

  PLAN     →  taskCreate every concrete deliverable up-front
  EXECUTE  →  per task: taskUpdate in_progress → do the work → taskUpdate completed
  CRITIQUE →  selfCritique returns findings; fix high+medium with tool calls
  REPORT   →  1-3 sentence summary + 1-2 yes/no questions, only after everything's done

The route refuses to terminate the turn while ANY of:
  - tasks are pending or in_progress
  - 3+ scenes have no visual
  - 2+ scenes with text have no voiceover
  - 4+ scenes and no music

If you stop early, the route injects "you're not done — fix these" and forces you back in.

INFER THE OBJECTIVE
- Every user turn is treated as a directive. There is no /objective command — the request itself IS the objective.
- Read the latest message + recent context, decide the implicit goal, then act.
- Only ask a clarifying question if you literally can't proceed without it — and ask ONE question, not three. Examples that warrant a question: "they said 'make a video' but no topic, no orientation, no length given"; "they uploaded 30 files with no instruction." Examples that DON'T: anything you could pick a sensible default for (orientation, length, voice, palette).
- After clarifying, when the user replies, never ask the same question again — proceed.

CORE LOOP (do this every meaningful turn):

1. UNDERSTAND
   - Restate the inferred objective to yourself (in your private reasoning, not the chat).
   - If files are uploaded or the project already has content, call analyzeAssets first.
   - Ask one question only if truly blocked. Otherwise pick defaults and start.

1.4. SHORTCUT FOR KNOWN FORMATS
   - If the user's brief matches a recognized format (e.g. "5 things…", "before vs after…", "how to…", "introducing…", "why does…"), call **applySceneTemplate** to stamp 5-7 placeholder scenes with the right type/shotType/act/duration mix already filled in. Then fill placeholders and skip planVideo's structural-design step. You still need writeNarrativeSpine.

1.5. COMMIT TO A SPINE
   - Before any media generation, call **writeNarrativeSpine(promise, stakes, reveal)**. One sentence each, no fluff.
     · *promise*: what does the viewer get if they watch to the end?
     · *stakes*: why does it matter / what's at risk / what changes?
     · *reveal*: what's the payoff or punchline the video lands on?
   - Then call **planVideo** with the structured shot list (act, beat, shotType, cameraMove, durationHint, assetDecision). NO scene creation, no image gen, no narration before the plan exists.
   - Every later scene you build must advance one of (promise / stakes / reveal). selfCritique will compare against the spine.

2. ACT — and actually MAKE THE VIDEO LOOK LIKE A VIDEO
   - Stable ids only: never guess a scene id.
   - Colors hex. Durations seconds. Positions canvas pixels (0-1920 X, 0-1080 Y landscape; 0-1080 X, 0-1920 Y portrait).
   - Batch tool calls when possible (parallel createScene, parallel generateImageForScene, etc.).
   - **PACING & RHYTHM: vary scene durations**. Sweet spot 1.8-3.2s for normal scenes. Hooks (scene 1) 3-4s, reveals/punchlines 1.5-2s, CTA 2.5-3.5s. NEVER set every scene to the same duration — kills rhythm.
   - **EMPHASIS BEATS: every 3-4 scenes drop a text_only ALL-CAPS punch** with zoomPunch 1.15 + a contrasting accent color. Makes cuts feel intentional.
   - **SHOT-TYPE VARIETY (anti-slideshow).** Stop making slideshows. Every project should mix at least 4 of these shot types: wide (establishing), medium (talking-head distance), closeup (face-tight), ecu (eye/object detail), ots (over-the-shoulder), insert (b-roll cutaway), montage (3-5 quick cuts), split (compare/contrast). Long stretches of the same shot type = dead air. Plan in planVideo with explicit shotType per shot.
   - **CAMERA MOVES instead of static frames.** When you set background.kenBurns=true, also pick a direction. Push-in for reveals, pull-out for context, pan for landscapes/lists, tilt for vertical objects. A motionless image background for 3+ seconds reads as boring.
   - **SCENE-TYPE TOOLBOX.** Pick the right primitive for the beat — don't default everything to text_only:
     · *bullet_list* (scene.bulletItems): "5 things", "what you'll learn", "checklist". 2-6 items, 0.4s each animates in.
     · *quote* (scene.quoteText + quoteAttribution): testimonials, expert authority, "X said: ...".
     · *stat* (scene.statValue + statLabel): single hero number ("73%" / "of viewers drop in 3 seconds"). Pair with backgroundBlur=8 + lensFlare for shock beats.
     · *montage* (scene.montageUrls): compress a sequence/list of items into 0.5s cuts.
     · *split* (scene.splitLeftUrl + splitRightUrl): before/after, vs, compare/contrast.
     · *big_number*: animated counter (numberFrom→numberTo). Use for revenue, growth, time-saved beats.
     · *text_only*: only when the punch IS the text — short ALL-CAPS hits.
     · *three_text*: extruded 3D rotating text — brand-reveal / logo-style hooks. Set scene.threeText. Costs nothing extra (renders inline).
     · *three_card*: image floats on a rotating 3D card — product reveals, hero portrait shots. Set scene.threeCardImageUrl.
     · *three_particles*: drifting 3D particle field — abstract intros, interlude beats, transitions between acts. Set scene.threeParticleCount (default 200).
   - **WHEN TO REACH FOR 3D.** Use 3D scene types on the hook (three_text), an act-2 product reveal (three_card), or as a brief 1.5-2.5s interlude between dense scenes (three_particles). Don't use 3D back-to-back — single beats inside an otherwise 2D timeline are what give 3D its punch.
   - **OVERLAY EFFECTS via scene.effects[].** Stack these on top of any scene:
     · *circle_ping*: impact ring on hard cuts.
     · *radial_pulse*: white center flash on hooks/reveals.
     · *scan_line*: vertical sweep, tech/hud feel.
     · *bar_wipe*: solid color bar wiping in with a label — section titles ("STEP 2", "THE CATCH").
     · *corner_brackets*: 4-corner viewfinder, gaming overlay.
     · *reveal_box*: clockwise animated border around an emphasized region.
     · *lower_third*: slide-in name+title strap (text + subtext), use on the speaker's first appearance.
     Stagger effects with startFrame to build a beat sequence inside one scene.
   - **TRANSITIONS.** Match the cut treatment to the beat: beat_flash for default rhythm; slide_left/slide_right for chapter starts; zoom_blur for dramatic reveals. Don't use beat_flash on every single cut.
   - **CUTS BETWEEN SCENES (sprint 8 — required for any narrative video).** For every scene boundary in a >4-scene project, call **setCut(fromSceneId, toSceneId, kind, durationFrames)** so the cut isn't a flat hard cut. Choose:
     · *fade* (durationFrames 8-15): default soft transition between act beats.
     · *dip_to_black* (24-30 frames, color "#000"): time jumps, "later that day".
     · *dip_to_white* (18-24 frames): bright reveals, surprise.
     · *whip_pan* (10-12 frames): energetic pivot to a new topic / location.
     · *iris* / *clock_wipe* / *flip*: stylized chapter dividers, use sparingly.
     · *jump_cut* (3-6 frames): vlog continuity feel, time skipped on same subject.
     · *smash_cut* + smash to color "#000": quiet → loud beats, dramatic reveals.
     · *match_cut* (0 frames): when two consecutive scenes share a visual anchor (circle → moon, hand → object). Use after suggestMatchCuts() returns a positive.
     · *J cut*: pass audioLeadFrames=8-15 so the next scene's voiceover starts BEFORE the visual cut. Sells dialogue continuity. Use on most narration→narration transitions.
     · *L cut*: audioTrailFrames > 0 keeps outgoing voice playing past the cut. Use when a thought completes after the visual cuts away.
   - **MOTION PRESETS (sprint 8 — apply per-element so scenes aren't static).** For every scene with text, call **setMotionPreset(sceneId, "text", preset)**. Pick:
     · *drift_up* — hero text on a flat color bg.
     · *bounce_in* — emphasis text on big_number / stat scenes.
     · *pulse* — emphasis on shock-stat reveals.
     · *shake* — tense / urgent / "warning" beats.
     · *ken_burns_in* on bg — slow zoom on a hero image so it doesn't read as a static slideshow.
     · *parallax_slow* on bg — horizontal drift, looks live without distraction.
     · *fade_in_out* — interlude / quote scenes.
     Use **listMotionPresets()** to discover. When presets aren't enough, call **addKeyframe** for explicit per-property animation.
   - **BRAND COLOR UNITY.** When the user uploaded a hero image, call extractPalette → applyPaletteToProject so emphasis/text/chart colors all reference the same identity instead of random greens.
   - **VISION-BASED ASSET CHECKS.** When you have an upload to potentially place, run analyzeUpload first (returns kind + recommendedEdits + fitRoles). When deciding between two candidate images, run scoreAssetForScene on each — the tool now uses Claude vision when available, not just filename matching.
   - **SUBJECT CONSISTENCY (people / products).** If a named person, character, or specific product appears in 2+ scenes, you MUST call **registerSubject(name, description)** BEFORE generating any of those scenes. Then pass **subjectId** on every generateImageForScene that depicts that subject — instant-id (people) or flux-redux (products) anchors the look so 'Sarah' looks like 'Sarah' across all 6 scenes instead of 6 different people. Without this, the gate will refuse termination.
   - **POST-RENDER LOOP.** After renderProject, immediately call awaitRender to block until done, then watchRenderedVideo to verify. If audio peaks clipping or scenes look wrong, fix and re-render. Don't ship blind.
   - **PUBLISH METADATA.** Before saying you're done, call generatePublishMetadata so the user gets titles + caption + hashtags ready to copy/paste.
   - **SCENE 1 IS A HOOK, NOT AN INTRO.** First scene MUST be one of these 10 patterns. Pick one explicitly when you call planVideo (set the first shot's beat field to "hook: <pattern>"):
     1. *question* — "What if I told you…"
     2. *contrarian* — "Everyone gets this wrong."
     3. *promise* — "By the end of this you'll know how to…"
     4. *cold-open* — striking image + 3-5 word punch overlay, no setup
     5. *numbered* — "5 ways to…" with countdown text
     6. *POV* — "You're 27, broke, and…"
     7. *shock* — counter-intuitive stat with a big_number scene
     8. *story* — "Last Tuesday at 3am…"
     9. *quote* — short attributed line over portrait
     10. *stat* — single number in massive type, then "and here's why"
     NEVER open with "Hi I'm X, today we'll talk about…" — guaranteed scroll-past. Use 3-4s, big text, zoomPunch on, real visual asset.
   - **THREE-ACT STRUCTURE.** Distribute runtime as: act 1 = 10-20% (hook + premise), act 2 = 60-70% (core content / proof / examples), act 3 = 15-20% (payoff / reveal / CTA). Tag every shot in planVideo with its act. videoQualityScore enforces the spine commitment.
   - **PATTERN INTERRUPT every ~8 seconds.** Within any 8-second window of the timeline there should be ONE of: a SFX hit, a zoomPunch beat, a hard cut to a new shot type, a text-pop/emphasisText reveal, or a camera-move start. Without this rhythm the viewer drops in their FYP scroll. selfCritique flags long stretches of dead air.
   - **SCENE TYPE DEFAULTS:**
     · For BLANK / general workflows: scene.type = "text_only" or "big_number". Do NOT set characterId — the asset library characters (Isaac/Odd1sOut) only fit the FACELESS workflow. Putting a stick-figure character on a Pokemon story is wrong.
     · ONLY set characterId when project.workflowId === "faceless" AND the user clearly wants that style.
   - **CHAT-UPLOADED FILES: When the user has dropped images / clips into the chat, those URLs (e.g. /uploads/abc.jpg) appear in earlier user messages. Use them DIRECTLY as scene.background.imageUrl or scene.background.videoUrl — DON'T regenerate or treat them as 'characters'.** Distribute uploaded images across scenes that match their content semantically.
   - **MANDATORY VISUALS: Every scene must have a real visual asset.** A scene with just text on a solid color is a FAILURE. Specifically:
     · If the user uploaded images / clips: USE THEM via scene.background.imageUrl. Place each one on the most relevant scene.
     · If you've used all uploaded images and need more: call generateImageForScene with a prompt that matches the scene's text and the overall topic. Pollinations is the free fallback if no Replicate / OpenAI key is set.
     · For motion-heavy beats (hooks, transitions, reveals): call generateVideoForScene — seedance-1-pro for cheap b-roll, kling-v2.0 if you have a still to animate, veo-3 for the hero opener.
   - **MANDATORY AUDIO: every scene with text needs narration.** Call narrateAllScenes after creating scenes. Pick a voice from the catalog that fits the tone (deep/onyx for serious, shimmer for hype, fable for storytelling).
   - **MANDATORY MUSIC: full videos need a backing track.** If the objective is "make a video" and there's no music, call generateMusicForProject with a mood-matched prompt. Default volume 0.5-0.6.
   - **SFX BEATS: at least 1-2 sound effects per video.** A whoosh on a hard cut, an impact on a reveal, a UI tick on a counter — these sell the editing. Use the sfx library (whoosh, pop, impact, riser, glitch) via scene.sfxId on transition scenes. A video with zero SFX feels amateur.
   - **WEB SEARCH for current / external info.** When the topic involves real people, brands, current events, or things that benefit from references — call webSearch FIRST and feed results into your scene scripts. Don't hallucinate facts.
   - **CHECK THE LIBRARY FIRST.** Before generating images, ALWAYS call analyzeAssets. If the user uploaded relevant material, use that — don't generate duplicates.

3. SELF-CRITIQUE
   - After any substantial change (3+ scene edits, music attach, etc.), call selfCritique. It returns a ranked list of issues with the current project.
   - selfCritique will flag scenes missing visuals or audio. Treat those as severity=high — fix them by calling generateImageForScene / narrateScene / etc.
   - For each high+medium finding, take ONE corrective action — updateScene, regenerate media, swap voice, etc.
   - Re-run selfCritique. Repeat until findings are empty or only "low" severity, or you've hit 5 critique passes.

4. REPORT
   - Tell the user what you did in 1-3 sentences plain language ("Built 18 scenes, fixed 3 pacing issues, added music").
   - End with 1-2 yes/no next-action questions (≤15 words).

GENERAL RULES:
- Act. Don't ask permission for non-destructive ops.
- Destructive ops (mass remove / generateScenesFromScript) need clear intent like "start over" or "remake everything".
- Narrate briefly in plain language — "Adding 5 scenes..." — not tool args.
- Don't evangelize templates. Users start in "blank" by default — only call switchWorkflow when explicitly asked.
- If the project name is still "Draft", call setProjectName once with a Title Case topic name (4-8 words).
- Treat every meaningful turn as autonomous: do the full loop, don't stop after the first batch of edits.`;

// Server-enforced "you're not done yet" check. The agent's system prompt
// MANDATES visuals/audio/music — but Claude can ignore wording. This
// inspects project state directly and returns a list of structural gaps
// the route uses to refuse termination.
function computeStructuralGaps(project: Project): string[] {
  const gaps: string[] = [];

  // Open tasks beat structural checks — Claude Code-style: agents can't
  // claim done while their own task list still has items. This forces
  // explicit completion of every planned step.
  const openTasks = (project.taskList ?? []).filter(
    (t) => t.status === "pending" || t.status === "in_progress",
  );
  if (openTasks.length > 0) {
    gaps.push(
      `- ${openTasks.length} task${openTasks.length === 1 ? "" : "s"} still open in the task list:\n${openTasks
        .map((t) => `  · ${t.id} [${t.status}] ${t.title}`)
        .join("\n")}\n  Either complete them (taskUpdate status=completed) or remove them. Never abandon open tasks.`,
    );
  }

  if (project.scenes.length === 0) return gaps;

  const bare = project.scenes.filter(
    (s) => !s.background?.imageUrl && !s.background?.videoUrl,
  );
  if (bare.length >= 3) {
    gaps.push(
      `- ${bare.length} scenes have no visual (color-only background). Generate images for them: ${bare
        .slice(0, 5)
        .map((s) => s.id)
        .join(", ")}${bare.length > 5 ? "…" : ""}`,
    );
  }

  const unnarrated = project.scenes.filter(
    (s) =>
      !s.voiceover?.audioUrl && (s.text || s.emphasisText || s.subtitleText),
  );
  if (unnarrated.length >= 2) {
    gaps.push(
      `- ${unnarrated.length} scenes with text but no voiceover. Run narrateAllScenes.`,
    );
  }

  if (!project.music && project.scenes.length >= 4) {
    gaps.push(`- No backing music. Call generateMusicForProject.`);
  }

  // Scene-density guardrail: shorts platforms reward fast cuts. A 30s
  // video with only 4 scenes feels like a slideshow. Require ~1 cut per
  // 3-3.5s of runtime.
  const totalSec = project.scenes.reduce((acc, s) => acc + (s.duration ?? 2), 0);
  const targetMinScenes = Math.max(6, Math.floor(totalSec / 3.5));
  if (project.scenes.length < targetMinScenes && totalSec >= 18) {
    gaps.push(
      `- Only ${project.scenes.length} scenes for ${totalSec.toFixed(0)}s of runtime — too few cuts. Add more scenes (target ≥ ${targetMinScenes}). Break long beats into hook/setup/payoff.`,
    );
  }

  // SFX presence: sells the editing. Skip if total runtime is tiny.
  const hasAnySfx = project.scenes.some((s) => s.sfxId || s.sceneSfxUrl);
  if (!hasAnySfx && project.scenes.length >= 6) {
    gaps.push(
      `- No sound effects anywhere. Add 1-2 SFX beats (whoosh on a transition, impact on a reveal). Set scene.sfxId or call generateSfxForScene.`,
    );
  }

  // CTA check: last scene should hint at a call-to-action when the video
  // is long enough to warrant one (>20s). Look for keywords in the
  // text/emphasisText/voiceover.text of the last scene.
  if (project.scenes.length >= 6) {
    const totalSec = project.scenes.reduce((acc, s) => acc + (s.duration ?? 2), 0);
    if (totalSec >= 20) {
      const last = project.scenes[project.scenes.length - 1];
      const lastText = `${last.text ?? ""} ${last.emphasisText ?? ""} ${last.voiceover?.text ?? ""}`.toLowerCase();
      const ctaSignals = [
        "follow", "subscribe", "comment", "share", "like", "save",
        "click", "link", "join", "sign up", "try", "book", "buy",
        "watch", "next", "tap", "swipe", "dm", "message",
      ];
      const hasCta = ctaSignals.some((c) => lastText.includes(c));
      if (!hasCta) {
        gaps.push(
          `- Last scene has no call-to-action. ${totalSec.toFixed(0)}s of video deserves a CTA (follow, save, comment, or "watch part 2"). Update the last scene's text or emphasisText.`,
        );
      }
    }
  }

  // Subject consistency: scan all narration / text / emphasisText for
  // proper nouns that appear in 2+ scenes. If any of those names doesn't
  // match a registered subject, the agent will produce a different face
  // every time — flag it and demand registerSubject.
  const properNounCounts = new Map<string, number>();
  // Skip these — common ALL-CAPS hooks or brand-y words that don't refer
  // to a recurring person/product.
  const SKIP = new Set([
    "I", "Im", "Ill", "AI", "USA", "UK", "EU", "TV", "DM", "LOL", "OK",
    "WHY", "HOW", "WHAT", "WHEN", "WHERE", "WHO", "STEP", "TIP", "TIPS",
    "NEW", "BIG", "TOP", "THE", "AND", "BUT", "FOR", "YOU",
  ]);
  for (const s of project.scenes) {
    const text = `${s.text ?? ""} ${s.emphasisText ?? ""} ${s.voiceover?.text ?? ""}`;
    const matches = text.match(/\b[A-Z][a-zA-Z]{2,}/g) ?? [];
    const seenInScene = new Set<string>();
    for (const m of matches) {
      if (SKIP.has(m)) continue;
      if (seenInScene.has(m)) continue;
      seenInScene.add(m);
      properNounCounts.set(m, (properNounCounts.get(m) ?? 0) + 1);
    }
  }
  const registeredNames = new Set(
    (project.subjects ?? []).map((s) => s.name.toLowerCase()),
  );
  const repeatedUnregistered = [...properNounCounts.entries()]
    .filter(([name, count]) => count >= 2 && !registeredNames.has(name.toLowerCase()))
    .slice(0, 3);
  if (repeatedUnregistered.length > 0 && project.scenes.length >= 4) {
    const list = repeatedUnregistered
      .map(([name, count]) => `"${name}" (${count} scenes)`)
      .join(", ");
    gaps.push(
      `- These names appear in 2+ scenes but aren't registered subjects: ${list}. Each generation will draw a different face. Call registerSubject(name, description) for each, then re-run generateImageForScene with subjectId so they look consistent.`,
    );
  }

  // Image dedup: same imageUrl repeated on consecutive scenes reads as
  // a stuck slideshow. Flag the first repeat so the agent regenerates
  // or routes to a different asset for the second occurrence.
  for (let i = 1; i < project.scenes.length; i++) {
    const prev = project.scenes[i - 1].background?.imageUrl;
    const cur = project.scenes[i].background?.imageUrl;
    if (prev && cur && prev === cur) {
      gaps.push(
        `- Scene ${project.scenes[i].id} reuses the same imageUrl as scene ${project.scenes[i - 1].id}. Generate a fresh image or pick a different uploaded asset.`,
      );
      break;
    }
  }

  // Talking-head monotony check: 3+ consecutive scenes with the same
  // characterId or the same first-3-scene background.imageUrl host means
  // we've stalled on a single subject. Force a B-roll insert.
  let runChar: string | null = null;
  let runCount = 0;
  let needsBroll = false;
  for (const s of project.scenes) {
    const key = s.characterId ?? "_none";
    if (key === runChar && key !== "_none") {
      runCount++;
      if (runCount >= 3) {
        needsBroll = true;
        break;
      }
    } else {
      runChar = key;
      runCount = 1;
    }
  }
  if (needsBroll) {
    gaps.push(
      `- 3+ consecutive scenes share the same character — break the talking-head with a B-roll insert (insert/montage shotType, generated or stock image of what's being discussed). Slot it between the runs.`,
    );
  }

  // Spine: agent should commit to a narrative arc before generating media.
  // We only enforce this once there's enough scene work to justify it.
  if (!project.spine && project.scenes.length >= 4) {
    gaps.push(
      `- No narrative spine. Call writeNarrativeSpine(promise, stakes, reveal) so the video has a thesis, not just a sequence of slides.`,
    );
  }

  // Pattern-interrupt cadence: scan timeline for any 8s window with no
  // beat (sfx / zoomPunch / strong text / camera-move). Flag the first
  // dead window we find — agent should add at least one beat there.
  if (project.scenes.length >= 4) {
    let cursor = 0; // seconds
    let lastBeatAt = 0;
    let deadWindow: { from: number; to: number } | null = null;
    for (const s of project.scenes) {
      const dur = s.duration ?? 2;
      const hasBeat =
        !!(s.sfxId || s.sceneSfxUrl) ||
        (s.zoomPunch !== undefined && s.zoomPunch >= 1.1) ||
        !!s.emphasisText ||
        (s.background?.cameraMove && s.background.cameraMove !== "still") ||
        s.shakeIntensity !== undefined ||
        s.transition !== "none";
      if (hasBeat) lastBeatAt = cursor + dur / 2;
      else if (cursor - lastBeatAt > 8) {
        deadWindow = { from: lastBeatAt, to: cursor + dur };
        break;
      }
      cursor += dur;
    }
    if (deadWindow) {
      gaps.push(
        `- Dead air from ${deadWindow.from.toFixed(1)}s → ${deadWindow.to.toFixed(1)}s (no SFX/zoomPunch/emphasis/camera-move/shake). Add a beat in this window so viewers don't bounce.`,
      );
    }
  }

  // Quality score gate: single autoresearch-style metric. Below 75 means
  // the agent should keep iterating (selfCritique → fixes → re-score).
  const score = project.qualityScore;
  if (typeof score === "number" && score < 75 && project.scenes.length >= 4) {
    // Stall detector: if the last 3 scores are within ±2 of each other and
    // still below threshold, the agent is doing the same thing and not
    // improving. Demand a *different* strategy this turn.
    const hist = project.qualityScoreHistory ?? [];
    const recent = hist.slice(-3);
    const stalled =
      recent.length === 3 &&
      Math.max(...recent) - Math.min(...recent) <= 2;
    if (stalled) {
      gaps.push(
        `- qualityScore plateaued at ~${score}/100 across the last 3 passes. STOP doing the same thing. Try a *different* strategy: spawnSubAgent role=reviewer for fresh eyes, swap one shot's assetDecision (generate→stock or vice versa), or replan a weak scene with planVideo. Don't repeat the previous fix attempt.`,
      );
    } else {
      gaps.push(
        `- videoQualityScore is ${score}/100 (need ≥75). Run selfCritique, fix the top findings, then videoQualityScore again. Don't claim done.`,
      );
    }
  } else if (typeof score !== "number" && project.scenes.length >= 4) {
    gaps.push(
      `- Never computed videoQualityScore on this project. Call it now so we know what's weak.`,
    );
  }

  return gaps;
}

function workflowContext(project: Project): string {
  const wf = getWorkflow(project.workflowId);
  const catalogLine = WORKFLOWS.map(
    (w) => `- ${w.id}${w.enabled ? "" : " (coming soon)"}: ${w.name} — ${w.tagline}`,
  ).join("\n");
  if (!project.workflowId || project.workflowId === "blank") {
    return [
      `Project has no specific template ('blank' workflow). Act on what the user asks directly — don't push them toward a template unless they explicitly want one. Templates exist as library data for switchWorkflow if useful, but blank is the default and stays fine for most sessions.`,
      project.systemPrompt
        ? `The user's project-specific instructions are above in another system block; honour those over generic defaults.`
        : "",
      `Available templates (only switch if the user asks):\n${catalogLine}`,
    ]
      .filter(Boolean)
      .join("\n\n");
  }
  const slots = wf.slots
    .map(
      (s) =>
        `  - ${s.id} (${s.type}${s.required ? ", required" : ""}): ${s.label}${
          s.description ? ` — ${s.description}` : ""
        }`,
    )
    .join("\n");
  return [
    `Active workflow: ${wf.name} — ${wf.tagline}`,
    `Shape guidance:\n${wf.reviewCriteria ?? "(no specific guidance)"}`,
    `Workflow slots (fields on project.workflowInputs):\n${slots || "  (no slots)"}`,
    `Default orientation: ${wf.defaultOrientation}. Accent color: ${wf.accentColor}.`,
    wf.autoPipeline
      ? `Auto-pipeline exists: topic slot "${wf.autoPipeline.topicSlotId}" → ${wf.autoPipeline.steps.map((s) => s.label).join(" → ")}.`
      : "",
    `Other workflows the user could switch to:\n${catalogLine}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function sseLine(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

type AnthropicContent = ClaudeContentBlock;

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContent[];
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as AgentRequest;
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: "messages required" }, { status: 400 });
  }
  if (!body.project) {
    return Response.json({ error: "project required" }, { status: 400 });
  }

  // Self-loopback: when an agent tool calls /api/foo via fetch(`${origin}/api/foo`),
  // we MUST hit ourselves on localhost — going out to the public hostname
  // and back through nginx fails inside dokku containers. Production logs
  // showed every generateImageForScene + narrateScene returning
  // "fetch failed" because of this.
  const port = process.env.PORT ?? "3000";
  const origin = `http://localhost:${port}`;
  // Deep-copy the project so we can mutate safely per-request.
  const project: Project = JSON.parse(JSON.stringify(body.project));

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(sseLine(data)));
        } catch {
          // already closed
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      // Pull every /uploads/ URL out of the conversation so the agent has
      // a clean inventory of what the user dropped — separate from the
      // chat fluff. These are the assets it should attach to scenes.
      const uploadedUrls: string[] = [];
      for (const m of body.messages) {
        if (m.role !== "user" || typeof m.content !== "string") continue;
        const matches = m.content.match(/\/uploads\/[A-Za-z0-9_.-]+/g);
        if (matches) {
          for (const u of matches) {
            if (!uploadedUrls.includes(u)) uploadedUrls.push(u);
          }
        }
      }

      // Conversation we grow across tool-use loops. Start from the user's
      // history; each loop may append assistant + tool_result messages.
      const conversation: AnthropicMessage[] = [
        // Preamble: give the agent current project state as the first "user"
        // message so it knows what exists. Subsequent turns carry real history.
        { role: "user", content: `Current project state:\n${summarizeProject(project)}` },
        { role: "assistant", content: "Got it. Ready." },
      ];
      if (uploadedUrls.length > 0) {
        conversation.push({
          role: "user",
          content: `Files the user uploaded into chat (use these as scene.background.imageUrl / videoUrl — don't regenerate):\n${uploadedUrls.map((u) => `- ${u}`).join("\n")}`,
        });
        conversation.push({ role: "assistant", content: "Logged the uploads." });
      }
      conversation.push(
        ...body.messages.map((m) => ({ role: m.role, content: m.content }) as AnthropicMessage),
      );

      const tools = listToolSchemas();
      // Filter out the bundled Isaac/Odd1sOut characters when this project
      // isn't on the faceless workflow — the agent kept reaching for
      // 'isaac-celebrate' on a Pokemon project just because they were in
      // ctx.characters. Built-in characters live in /public/characters/
      // and have ids 'watch', 'point', 'celebrate', 'frustrated', etc.
      const FACELESS_BUILTIN_IDS = new Set([
        "watch", "point", "celebrate", "frustrated",
        "tablet", "shrug", "hero", "wide", "closeup",
      ]);
      const isFaceless = project.workflowId === "faceless";
      const filteredCharacters = (body.characters ?? []).filter(
        (c) => isFaceless || !FACELESS_BUILTIN_IDS.has(c.id),
      );
      const ctx = {
        project,
        characters: filteredCharacters,
        sfx: body.sfx ?? [],
        origin,
        focusedSceneId: body.focusedSceneId ?? null,
      };

      let consecutiveErrors = 0;
      let forcedContinues = 0;
      const MAX_FORCED_CONTINUES = 3;

      // Per-turn budgets: bound exploration so the agent doesn't burn $$
      // making the same call 20x. Inspired by autoresearch's fixed-budget
      // training loop. When a budget is exceeded the tool returns a
      // synthetic "budget exhausted" result instead of running the call.
      const budgets = {
        webSearch: 5,
        researchTopic: 3,
        stockSearch: 4,
        generateImageForScene: 12,
        generateVideoForScene: 3,
        generateMusicForProject: 2,
        generateSfxForScene: 6,
      };
      const used: Record<string, number> = {};
      try {
        // Up to 32 rounds: enough headroom for the agent to act, run a
        // self-critique pass via selfCritique, apply fixes, and loop a few
        // more times before claiming done.
        for (let round = 0; round < 32; round++) {
          let data;
          try {
            const systemBlocks: Array<{
              type: "text";
              text: string;
              cache_control?: { type: "ephemeral" };
            }> = [
              {
                type: "text",
                // SYSTEM_PROMPT_OVERRIDE: harness escape hatch for the
                // eval/iterate/ab-test loop. Lets the eval harness swap
                // in a candidate prompt without code changes; production
                // never sets this env var.
                text: process.env.SYSTEM_PROMPT_OVERRIDE ?? SYSTEM_PROMPT,
                cache_control: { type: "ephemeral" },
              },
              ...(process.env.SEARCH_PROVIDER && process.env.SEARCH_PROVIDER !== "none"
                ? [
                    {
                      type: "text" as const,
                      text: `webSearch tool is wired (provider: ${process.env.SEARCH_PROVIDER}). Use it when the user asks for current info, links, references, or external context.`,
                    },
                  ]
                : []),
              { type: "text", text: modelCatalogSystemBlock() },
              { type: "text", text: voiceCatalogSystemBlock() },
              { type: "text", text: audioCatalogSystemBlock() },
              { type: "text", text: workflowContext(project) },
            ];
            // FOCUSED SCOPE: the user has scoped this turn to one scene.
            // Splice a constraint block that overrides the default
            // global-optimization mindset of the SYSTEM_PROMPT.
            if (body.focusedSceneId) {
              const focusedScene = project.scenes.find(
                (s) => s.id === body.focusedSceneId,
              );
              if (focusedScene) {
                const idx = project.scenes.findIndex(
                  (s) => s.id === body.focusedSceneId,
                );
                systemBlocks.push({
                  type: "text",
                  text:
                    `FOCUSED SCOPE — IMPORTANT.\n` +
                    `The user has scoped this turn to scene ${idx + 1} (id ${focusedScene.id}).\n` +
                    `Modifications must apply ONLY to this scene. All tool calls without an explicit sceneId default to "${focusedScene.id}".\n` +
                    `DO NOT call: planVideo, applySceneTemplate, applyPaletteToProject, switchWorkflow, appendEndScreen, generateMusicForProject, or any other tool that mutates other scenes.\n` +
                    `selfCritique should focus on this scene only.\n` +
                    `videoQualityScore is already running in per-scene mode.\n` +
                    `If the user's request implies a multi-scene change, ask them to exit focus mode first; do not silently widen scope.`,
                });
              }
            }
            // Goal-anchor: every 3 rounds re-pin the spine + score so the
            // agent doesn't drift mid-loop. autoresearch's "transparent
            // experiment log" pattern, but for self-orientation.
            if (round > 0 && round % 3 === 0) {
              const anchor: string[] = [];
              if (project.spine) anchor.push(`Spine: ${project.spine}`);
              if (typeof project.qualityScore === "number")
                anchor.push(`Last qualityScore: ${project.qualityScore}/100 (target ≥ 75)`);
              if ((project.shotList?.length ?? 0) > 0)
                anchor.push(`Plan has ${project.shotList!.length} shots — execute them, don't replan.`);
              if (anchor.length > 0) {
                systemBlocks.push({
                  type: "text",
                  text: `Round ${round} reminder:\n${anchor.join("\n")}`,
                });
              }
            }
            // Locked-scene awareness: surface any user-locked scenes so
            // the agent plans around them. Tools targeting these scenes
            // are rejected by the LOCK GATE below; this block lets the
            // agent reroute proactively instead of failing first.
            const lockedScenes = project.scenes.filter((s) => s.locked);
            if (lockedScenes.length > 0) {
              const lines = lockedScenes.map((s, i) => {
                const idx = project.scenes.findIndex((x) => x.id === s.id);
                return `· scene ${idx + 1} (${s.id})${s.label ? ` — ${s.label}` : ""}`;
              });
              systemBlocks.push({
                type: "text",
                text:
                  `LOCKED SCENES — read-only by user request. DO NOT modify these scenes. ` +
                  `Tools that target them will fail. If the user's request implies changing one, ` +
                  `ask them to unlock it first; never silently work around the lock by deleting + recreating.\n\n${lines.join("\n")}`,
              });
            }

            // Manual-edit awareness: if the user touched specific fields
            // by hand since the last agent turn, surface them so the
            // agent treats those as locked intent rather than something
            // to overwrite.
            if (
              body.recentManualEdits &&
              body.recentManualEdits.length > 0
            ) {
              const truncate = (v: unknown) => {
                const s = String(v ?? "");
                return s.length > 60 ? `${s.slice(0, 57)}…` : s;
              };
              const lines = body.recentManualEdits.map(
                (e) =>
                  `· scene ${e.sceneIndex + 1} (${e.sceneId}) · ${e.field}: "${truncate(e.oldValue)}" → "${truncate(e.newValue)}"`,
              );
              systemBlocks.push({
                type: "text",
                text:
                  `RECENT MANUAL EDITS — preserve unless the user explicitly asks you to change them. ` +
                  `These are fields the user just edited by hand; treat them as deliberate intent. ` +
                  `Don't revert, rewrite, or normalize them as a side effect of unrelated work.\n\n${lines.join("\n")}`,
              });
            }
            // Per-project override appended at the end so it takes priority.
            if (project.systemPrompt?.trim()) {
              systemBlocks.push({
                type: "text",
                text: `User's project-specific instructions (honour these):\n${project.systemPrompt.trim()}`,
              });
            }
            data = await callClaude(
              {
                model: "claude-sonnet-4-5",
                max_tokens: 8192,
                system: systemBlocks,
                tools,
                messages: conversation,
              },
              "agent",
            );
          } catch (err) {
            send({
              type: "error",
              error: err instanceof Error ? err.message : String(err),
            });
            break;
          }
          const contentBlocks = (data.content ?? []) as AnthropicContent[];

          // Surface any text the assistant emitted this round.
          for (const block of contentBlocks) {
            if (block.type === "text" && block.text) {
              send({ type: "text", text: block.text });
            }
          }

          const toolUses = contentBlocks.filter((b) => b.type === "tool_use");
          if (toolUses.length === 0) {
            // Claude wants to stop. Verify structural completeness before
            // letting it. If gaps remain, inject a synthetic user message
            // that demands they be fixed and force another round. Capped to
            // 3 forced-continue cycles to avoid infinite loops on
            // un-fixable issues (e.g. provider env vars unset).
            const gaps = computeStructuralGaps(project);
            if (gaps.length > 0 && forcedContinues < MAX_FORCED_CONTINUES) {
              forcedContinues++;
              const block = `You said you're done, but the project still has these issues:\n\n${gaps.join("\n")}\n\nFix every one of them now using tools (analyzeAssets, generateImageForScene, narrateAllScenes, generateMusicForProject, etc.). Don't stop again until they're all resolved.`;
              send({
                type: "text",
                text: `\n[force-continue ${forcedContinues}/${MAX_FORCED_CONTINUES}: ${gaps.length} structural issue${gaps.length === 1 ? "" : "s"} remaining]\n`,
              });
              // Conversation requires the assistant turn before the next user.
              conversation.push({ role: "assistant", content: contentBlocks });
              conversation.push({ role: "user", content: block });
              continue;
            }
            // Truly done.
            break;
          }

          // Append the assistant turn to the conversation as-is (preserves ids).
          conversation.push({ role: "assistant", content: contentBlocks });

          // Execute each tool and build Anthropic-shaped tool_result blocks.
          const toolResultBlocks: Array<{
            type: "tool_result";
            tool_use_id: string;
            content: Array<{ type: "text"; text: string }>;
            is_error?: boolean;
          }> = [];
          for (const tu of toolUses) {
            const args = (tu.input ?? {}) as Record<string, unknown>;
            send({ type: "tool_start", id: tu.id, name: tu.name, args });
            const toolName = tu.name ?? "";

            // LOCK GATE: scenes the user has marked locked are read-only.
            // Excalidraw's pattern — guard at the chokepoint, not at every
            // tool. The user uses this to pin a scene they've polished by
            // hand and don't want the agent touching as a side effect of
            // a vague request like "make the video punchier".
            const sceneMutatingTools = new Set([
              "updateScene",
              "removeScene",
              "duplicateScene",
              "setSceneDuration",
              "generateImageForScene",
              "generateVideoForScene",
              "generateSfxForScene",
              "generateAvatarForScene",
              "narrateScene",
              "applyStylePresetToScene",
              "addKeyframe",
              "clearKeyframes",
              "prepareUploadForScene",
            ]);
            if (sceneMutatingTools.has(toolName)) {
              const sceneIdArg =
                (args.sceneId as string | undefined) ??
                (args.id as string | undefined);
              if (typeof sceneIdArg === "string") {
                const target = ctx.project.scenes.find((s) => s.id === sceneIdArg);
                if (target?.locked) {
                  const synthetic = `[locked] scene ${sceneIdArg} is locked — the user marked it read-only. Skip this scene or ask the user to unlock it before proceeding. DO NOT call ${toolName} on it again this turn.`;
                  send({
                    type: "tool_result",
                    id: tu.id,
                    name: toolName,
                    ok: false,
                    message: synthetic,
                  });
                  toolResultBlocks.push({
                    type: "tool_result",
                    tool_use_id: tu.id ?? "",
                    content: [{ type: "text", text: synthetic }],
                    is_error: true,
                  });
                  continue;
                }
              }
            }

            // PLAN-MODE GATE: block expensive media tools until the agent
            // has committed to a spine + a plan. Forces the autoresearch/
            // claude-code phase separation: think first, spend later.
            const expensiveMediaTools = new Set([
              "generateImageForScene",
              "generateVideoForScene",
              "generateMusicForProject",
              "generateSfxForScene",
              "generateAvatarForScene",
            ]);
            const planExists = !!ctx.project.spine && (ctx.project.shotList?.length ?? 0) > 0;
            if (expensiveMediaTools.has(toolName) && !planExists) {
              const synthetic = `[plan-mode] ${toolName} blocked — call writeNarrativeSpine + planVideo FIRST so we know what we're building. No money spent on media until the plan exists.`;
              send({
                type: "tool_result",
                id: tu.id,
                name: toolName,
                ok: false,
                message: synthetic,
              });
              toolResultBlocks.push({
                type: "tool_result",
                tool_use_id: tu.id ?? "",
                content: [{ type: "text", text: synthetic }],
                is_error: true,
              });
              continue;
            }

            const cap = budgets[toolName as keyof typeof budgets];
            if (cap !== undefined) {
              used[toolName] = (used[toolName] ?? 0) + 1;
              if (used[toolName] > cap) {
                const synthetic = `[budget] ${toolName} hit per-turn cap of ${cap}. Stop calling it this turn — work with what you already have, or ask the user for clarification.`;
                send({
                  type: "tool_result",
                  id: tu.id,
                  name: toolName,
                  ok: false,
                  message: synthetic,
                });
                toolResultBlocks.push({
                  type: "tool_result",
                  tool_use_id: tu.id ?? "",
                  content: [{ type: "text", text: synthetic }],
                  is_error: true,
                });
                continue;
              }
            }
            const result = await runTool(toolName, args, ctx);
            // "Provider not configured" failures (501-style) don't count
            // toward the consecutive-error cap — those are signals to try a
            // different tool, not stop the whole turn.
            const isConfigFailure =
              !result.ok &&
              /not set|not configured|API_KEY|API_TOKEN|503|501/i.test(result.message);
            if (result.ok || isConfigFailure) {
              consecutiveErrors = 0;
            } else {
              consecutiveErrors++;
            }
            send({
              type: "tool_result",
              id: tu.id,
              name: tu.name,
              ok: result.ok,
              message: result.message,
            });
            toolResultBlocks.push({
              type: "tool_result",
              tool_use_id: tu.id ?? "",
              content: [{ type: "text", text: result.message }],
              is_error: !result.ok,
            });
          }
          conversation.push({
            role: "user",
            // Cast: our local AnthropicContent is a subset of Anthropic's real
            // content block union, which allows tool_result.
            content: toolResultBlocks as unknown as AnthropicContent[],
          });

          // Bail if the same kind of failure keeps repeating — prevents a
          // runaway loop where the agent can't find a way forward. Bumped
          // 4 → 10 because a normal turn now hits config-failures (which
          // we tolerate) and real failures get a much longer rope.
          if (consecutiveErrors >= 10) {
            send({
              type: "error",
              error:
                "Too many consecutive tool failures — stopping. Try rephrasing or check API keys.",
            });
            break;
          }
        }
      } catch (err) {
        send({ type: "error", error: err instanceof Error ? err.message : String(err) });
      } finally {
        send({ type: "done", project });
        close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
