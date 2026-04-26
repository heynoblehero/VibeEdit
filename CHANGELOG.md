# Changelog

## Unreleased — sprint 6: character consistency (8 commits)

The biggest visible quality regression in agent-built videos was that
named people changed face every scene. Sprint 6 closes it.

### Schema
- New `Subject` type: `{id, name, description, referenceImageUrl, kind}`.
  `kind` is "person" / "product" / "other" — drives model routing.
- `project.subjects[]`: registry of recurring subjects.
- `scene.subjectId`: link a scene to a subject; image gen routes
  through identity-preserving model.

### Tools
- `registerSubject(name, description, referenceImageUrl?, kind?)` —
  saves a canonical hero portrait. When `referenceImageUrl` is omitted,
  auto-generates a kind-aware portrait (studio headshot for person,
  clean product shot for product).
- `listSubjects` — returns the registry with usage counts.

### Models
- `instant-id` (zsxkib/instant-id, Replicate, ~$0.005): face-preserving
  generation for person subjects.
- `flux-redux` (black-forest-labs/flux-redux-dev, Replicate, ~$0.005):
  structural img2img for product/object subjects.

### Routing
- `generateImage()` auto-selects instant-id / flux-redux when
  `subjectReferenceUrl` + REPLICATE token are present. Falls back to
  the default model with subject-augmented prompt when not.
- `generateImageForScene` accepts `subjectId`, threads through the
  full chain, sticky-tags the scene, bumps subject `usageCount`.

### Gate
- New force-continue check: scans capitalized proper nouns across all
  scenes, flags any name that appears in 2+ without a registered
  subject. Refuses termination until they're registered.

### Agent
- SYSTEM_PROMPT gains a SUBJECT CONSISTENCY rule.
- Cinematic-short brief inserts a mandatory step 3.5: registerSubject
  for every named recurring person/product before image gen.

## Unreleased — sprint 5: vision + intelligence + finishing toolbox (29 commits)

Pivoted from "more graphics primitives" to "make the agent smarter +
finish the publish flow."

### Vision (Claude vision API)
- New `lib/server/vision.ts` — reusable Claude-vision wrapper. Defaults
  to haiku to keep calls < $0.01.
- `scoreAssetForScene` upgraded: vision-backed 0-10 fitness rating
  with reason. Falls back to filename heuristic when key missing.
- `analyzeUpload` — classifies uploads into kind / subject /
  recommendedEdits / fitRoles via vision JSON.
- `visionCritiqueScene` — render-aware composition critique on key
  scenes (hook / stat / CTA).

### Asset intelligence
- `extractPalette` — sharp-based 5-color palette from any image URL.
- `applyPaletteToProject` — push primary/secondary/neutral across
  emphasisColor / textColor / chartBars / background.color where unset.
  Saves to project.stylePack.
- `suggestTextPlacement` — pick textY by image saliency stddev so text
  lands on the flattest band.
- `prepareUploadForScene` (sprint 3) now pairs with `analyzeUpload`.

### One-shot finishing flow
- `applySceneTemplate` — 5 preset structures (tutorial_intro /
  product_reveal / before_after / 5_tips / explainer).
- `appendEndScreen` — auto-CTA scene with radial pulse + lower-third.
- `awaitRender` — block until render done, returns summary.
- `generatePublishMetadata` — 3 titles + caption + description + 8-12
  hashtags, platform-aware.
- `exportSubtitles` — SRT/VTT generator from word timings.
- `translateScript` — multi-lingual rewrites via Claude.
- `listVoiceClones` — surface ElevenLabs cloned voices.
- `suggestBeatMappedCuts` — snap durations to musical half-bars.
- `snapshotProject` + `restoreSnapshot` — rollback before risky changes.

### New scene types
- `bar_chart` — 2-6 animated vertical bars with auto colors + label fade.

### New effect kinds
- `typewriter` — char-by-char monospace reveal with caret.
- `glitch` — cyberpunk garble→resolve with RGB-split shake.
- `arrow` — animated SVG arrow that draws toward a target.
- `highlight` — fading semi-transparent rect for region pointing.
- `particles` — confetti/spark burst with gravity.
- `progress_bar` — fill toward target percentage.

### Audio
- Music swell on impact beats (stat / big_number / lensFlare): +35%
  triangular envelope over 14 frames.
- Sentiment-aware music prompt seasoning (tense / uplifting / playful
  / epic / thoughtful) prepended to the workflow base prompt.

### Quality / loop intelligence
- Plateau detector: track last 6 qualityScore values, force a strategy
  switch when last 3 are within ±2 below threshold.
- Brief generation auto-detects scene template from goal text and
  inserts new tools into the loop sequence.

### Render
- Concurrent frame rendering — half-cores capped at 6, ~2-3× speedup.
- In-memory image-gen LRU cache (200 entries) — same prompt+AR+model
  returns the cached URL within server lifetime.

### Schema
- Project: `qualityScoreHistory[]`, `metadata`.
- Scene: `chartBars[]`, `chartTitle`, `chartUnit`.
- SceneEffect: `subtext`, `fromX`, `fromY`, `to`.

### Project setup
- Auto-pick workflowId from goal text (commentary / review /
  ai-animated / shorts / faceless) on CreateProjectDialog submit.
- Secondary subtle 1.05× zoom when emphasisText reveals (frame 12).

## Unreleased — sprint 4: layout fixes + effects/graphics toolbox (12 commits)

User feedback: text was overlapping in scenes; we needed real graphics +
effect primitives, not just text-on-image.

### Layout
- **Text-collision solver**: SceneRenderer computes Y bands occupied by
  text / emphasisText / subtitleText / big_number / stat and passes them
  to Captions as `reservedZones[]`. Captions overlap-test top-12% vs
  bottom-14% bands and pick whichever has zero conflict.
- Default text Y is now 28% of frame height (was 300px hardcoded), so
  portrait shorts no longer squash all text at the top.
- 6% horizontal safe-area padding on PunchText so words don't kiss the
  TikTok/IG/YT chrome.

### Effects / overlay primitives (`scene.effects[]`)
- `circle_ping` — expanding ring, fades.
- `radial_pulse` — center gradient flash on hooks.
- `scan_line` — vertical sweep, hud feel.
- `bar_wipe` — solid color bar with label reveal, section dividers.
- `corner_brackets` — 4-corner viewfinder.
- `reveal_box` — clockwise animated border around a region.
- `lower_third` — slide-in name+title strap.

### New scene types
- `bullet_list` — staggered checklist with green check-squares.
- `quote` — pull-quote with smart-quote ornament + attribution line.

### Transitions
- `slide_left` / `slide_right` — color panel swipe across the cut.
- `zoom_blur` — radial blur dim on entry.

### Quality
- Animated radial-gradient fallback when scene has no image/video, so
  bare scenes don't read as "render glitched".
- `videoQualityScore` adds a graphics-richness bonus (up to 10 pts) for
  using non-text_only types + populating `effects[]`.

### Agent integration
- All new scene types + effects exposed in `createScene` schema.
- SYSTEM_PROMPT gains a "scene-type toolbox" + "overlay effects"
  reference so the agent picks the right primitive instead of
  defaulting everything to text_only.

## Unreleased — sprint 3: visual + audio polish (25 commits)

Focused on what was still ugly after the autonomous-loop sprint: flat
backgrounds, popped audio cuts, generic image prompts, no asset edit
pipeline, and the agent shipping monotone scripts.

### Visual / motion
- 5 color-grade presets per scene (warm / cool / punchy / bw / neutral)
  via CSS-filter LUT in GradientBg.
- Per-scene `background.blur` (0-30 px) for focus-pull behind big text.
- Lens-flare overlay on emphasis beats — soft radial glow with 24-frame
  attack/decay envelope.
- New scene types:
  - `stat` — hero number + small label, spring-scaled, auto-sized.

### Captions
- Karaoke-style word-by-word reveal at transcription timings (80ms ease).
- PunchText auto-shrinks fontSize when longest word would overflow the
  frame (capped at 28px floor).

### Audio
- 3-frame voiceover fade in/out per scene — no more hard audio cuts.
- Anticipatory music ducking — 6-frame lead-in before narration, 10-frame
  tail-out after, so the narrator's first consonant doesn't clip.
- TTS pre-process: ensure space after commas / periods / semicolons for
  natural breath beats.
- TTS post-process: ffmpeg silenceremove trims ≥0.2s of <-50dB padding
  on both ends; ffprobe reports the actual duration.
- Workflow-aware default voice: onyx for commentary, nova for review,
  fable for faceless, shimmer for shorts, alloy for ai-animated.

### Render
- New `preflight` stage HEADs every URL (image/video/audio/sfx/montage/
  split/music) before bundling. Aggregates failures into one error.
- Post-render ffprobe duration sanity check — emits a warning when the
  output drifts >0.5s from expected.

### Agent tools
- `lintScript` — heuristic critique (filler / weak verbs / run-ons /
  density / silent scenes / monotone-cadence variance check).
- `scoreHook` — 0-100 metric for scene 1 across 9 hook regex patterns
  + visual + zoomPunch + duration + length.
- `extractBRollKeywords` — pulls visual nouns per scene (proper nouns
  first, then non-stopword tokens ranked by length).
- `smartCropAsset` — sharp attention-strategy crop to 9:16/16:9/1:1.
- `removeBackground` — Replicate cjwbw/rembg variant.
- `prepareUploadForScene` — composite pipeline (bg-remove + crop) by role.

### Generation
- Pollinations prompts now respect shotType: appends composition language
  (24mm wide / 50mm medium / 85mm closeup / macro / over-shoulder / insert).
- Scene.shotType + Scene.act persisted on Scene so qualityScore counts
  realized scene variety, not just plan intent.

### Force-continue gate
- Image dedup detector — flags duplicate `imageUrl` on consecutive scenes.
- CTA enforcer — last scene of >20s videos must include a CTA keyword.

### New API routes
- `POST /api/uploads/edits/crop` — sharp smart-crop endpoint.
- `POST /api/uploads/edits/remove-bg` — Replicate rembg endpoint.

## Unreleased — autonomous one-shot sprint (25 commits)

Synthesized learnings from three reference repos into 25 commits that
turn VibeEdit's agent from "make a slideshow when prompted" into "watch
the user's brief, plan, fetch references, decide assets, render, watch
its own output, and iterate to a metric."

### Inspiration
- **codeaashu/claude-code** — tool-based capability system, sub-agent
  spawning, plan-mode separation, skills/packaged workflows.
- **karpathy/autoresearch** — single quantifiable self-eval metric,
  bounded exploration budgets, transparent experiment logging.
- **jordanrendric/claude-video-vision** — frame-extraction + audio probe
  so the agent can "watch" its own output before claiming done.

### New tools
- `researchTopic(topic, mode)` — web-searches visual references and
  persists findings to `project.researchNotes`.
- `writeNarrativeSpine(promise, stakes, reveal)` — pins a one-line arc
  every scene must advance.
- `planVideo(shots[])` — structured shot list with act/beat/shotType/
  cameraMove/durationHint/assetDecision. Mandatory before media gen.
- `routeAsset(sceneDescription, preferUserUpload)` — explicit
  upload-vs-generate-vs-research-url decision. Logs to experiments.
- `scoreAssetForScene(assetUrl, sceneDescription)` — fast heuristic
  0-1 relevance check for uploaded assets.
- `stockSearch(query, orientation, limit)` — Pexels-backed free
  stock photo source w/ Pollinations documentary-style fallback.
- `videoQualityScore()` — 0-100 metric across 8 dimensions
  (structural / pacing / density / variety / hook / sfx / spine / captions).
  Gate refuses termination below 75.
- `watchRenderedVideo(jobId, frames)` — ffmpeg frame sampling +
  ffprobe audio peak/mean detection.
- `readExperimentLog(kind)` — autoresearch-style audit trail of every
  asset decision.
- `spawnSubAgent(role, brief)` — Director/Reviewer/Researcher in
  isolated context with no editing tools.

### New scene primitives (anti-slideshow)
- `scene.type = "montage"` — 3-5 image URLs cut at 0.5s with scale-pop.
- `scene.type = "split"` — left+right halves with VS divider.
- `scene.background.cameraMove` — push_in / pull_out / pan_lr / pan_rl /
  tilt_up / tilt_down / ken_burns. createScene auto-cycles for image bgs.

### Schema additions
- `project.researchNotes` — markdown log from researchTopic/Plan tools.
- `project.spine` — promise → stakes → reveal sentence.
- `project.shotList` — typed `ShotPlan[]` from planVideo.
- `project.experiments` — typed `ExperimentRecord[]` log.
- `project.qualityScore` — last computed score for gating.

### Agent flow / route gates
- **Plan-mode block**: generateImage/Video/Music/Sfx/Avatar all return a
  synthetic [plan-mode] error until spine + plan exist.
- **Per-turn budgets**: webSearch=5, researchTopic=3, stockSearch=4,
  generateImageForScene=12, generateVideoForScene=3, generateMusicFor
  Project=2, generateSfxForScene=6.
- **Force-continue gate** now checks: missing spine, missing
  qualityScore, score < 75, dead-air windows > 8s, talking-head runs
  of 3+ same characterId, scene density vs runtime, SFX presence.
- **Goal-anchor**: every 3 rounds, re-inject spine + last score + plan
  size so the agent doesn't drift mid-loop.

### SYSTEM_PROMPT additions
- Phase 1.5 (Commit to a Spine): writeNarrativeSpine + planVideo before
  any media gen. Hard rule.
- Shot-type vocabulary (8 named types) with anti-slideshow framing.
- Camera-move vocabulary (4 named directions) for image backgrounds.
- 10 hook templates (question/contrarian/promise/cold-open/numbered/
  POV/shock/story/quote/stat).
- Three-act runtime distribution rule (10-20% / 60-70% / 15-20%).
- 8-second pattern-interrupt cadence rule.
- Mandatory SFX beats.

### UX
- `/cinematic-short <topic>` — packaged autonomous one-shot slash
  command. Pre-loads the chat with the full agentic loop and submits.

## polish pass #9 — video-quality sprint #1 (25 commits)

A focused pass on making finished videos look + sound better — render
knobs, caption legibility, agent behavior, image/TTS defaults, and
structural-gap guardrails. Every item ships in its own commit.

### Render output
- CRF 18 + slow x264 preset + 192k audio bitrate + jpegQuality 95 so
  finals stay crisp through TikTok/IG re-encode.
- Music bed fades in / out over ~0.6s instead of popping at boundaries.
- Subtle animated film-grain overlay (SVG feTurbulence, opacity 0.18)
  for perceived production value. Toggle via `filmGrain` prop.
- Soft 4-frame opacity ramp on every scene entry — cuts breathe.

### Captions
- 8-direction stroke + wider drop shadow → never lost on bright backgrounds.
- Heavier font (Inter 950 / SF Pro Display) with condensed tracking for
  the shorts-native look.
- Emphasized word scales 1.08x in addition to color highlight.
- Greedy chunker that breaks at punctuation, not mid-clause.

### Agent behavior
- Scene 1 must be a hook (question / contrarian / promise / cold-open),
  never "Hi I'm X today we'll talk about…".
- Sound-effect requirement (1-2 SFX per video minimum).
- Force-continue gate adds two new structural checks:
  · target ≥ 1 cut per 3.5s of runtime,
  · at least one SFX once the project has 6+ scenes.
- Auto-zoomPunch on text_only ALL-CAPS punch scenes and emphasis beats.
- WCAG-relative contrast guardrail on AI-picked textColor — auto-flips
  to white/black when the agent picks a low-contrast pair.
- Workflow-aware fallback music prompts (lo-fi for commentary, cinematic
  uplift for review, tense for faceless, punchy electronic for shorts).
- Music auto-fits video duration (15-47s clamp).

### Image / TTS quality
- Pollinations: native canvas res + flux model + random seed + inline
  exclusionary phrasing (no text/watermark/distorted faces/extra fingers).
- Image gen auto-appends cinematic style boosters when prompt lacks its own.
- TTS speed default 1.05 → 1.0 (natural cadence).
- Narration scene-duration padding 0.3s → 0.6s (no clipping).

### Defaults
- New projects default to 9:16 portrait.
- Vignette 0.5 → 0.35; Ken-Burns auto-on when scene has image bg.
- Music volume 0.45 / ducked 0.12 (sits below narration cleanly).
- enterFrom + transition cycle by scene index (no more swooping in from
  the left every cut).

### Earlier in this session
- self-loopback fix (localhost not public URL) so dokku container fetches
  succeed.
- Persistent runtime storage at `VIBEEDIT_DATA_DIR=/data` with dynamic
  `/uploads/[name]` and `/voiceovers/[name]` routes.
- Settings dialog at `/api/keys` writing to `/data/keys.json`.
- Render preflight HEADs every scene's media URL before render starts.
- Active scene highlight via `playingSceneId` in editor-store.
- Critic sub-agent + per-turn task list + force-continue gate +
  Pollinations free fallback so the agent doesn't give up on missing keys.

## polish pass #8 — unified AI providers

Three parallel adapters (`media-providers`, `voice-providers`,
`audio-providers`) follow the same shape: catalog + facade + agent tool.
Agent picks the right model from intent without the user pinning one.

### Catalogs
- 4 image models (gpt-image-1, flux-1.1-pro-ultra, flux-schnell,
  ideogram-v3-turbo).
- 4 video models (seedance-1-pro default, kling-v2.0 for i2v, veo-3
  with audio, ltx-video for cheap b-roll).
- 9 voices (6 OpenAI TTS + 3 ElevenLabs presets).
- 5 audio models (musicgen, musicgen-melody, stable-audio, elevenlabs-sfx,
  audiogen).

### Routes
- POST /api/media/image, /api/media/video, /api/media/music,
  /api/media/sfx — uniform shape, 501 on missing provider config.
- GET /api/media/models, /api/media/voices — cached 60s.

### Agent tools
- generateImageForScene, generateVideoForScene now take a `model` arg.
- generateMusicForProject, generateSfxForScene (new).
- listAvailableModels for introspection.
- /models slash command surfaces the catalog as a toast.

### UI
- MediaModelPicker dropdown in the SceneEditor background panel.
- VoicePicker component for per-scene voice override.
- Catalog descriptions injected into the agent's system prompt.

### Misc
- Cmd/Ctrl+1…9 jumps to scene N.
- ConfigTabs remembers last-active tab.
- Reset-on-load script honors `?persist=1` URL param.
- README documents the three-adapter architecture + one-liner
  prod config:set.

## Unreleased — polish pass #7 — templates banished

The template dropdown is off the primary surface entirely. Projects
default to a "blank" workflow so the agent does whatever you ask,
guided by the (optional) project-level system prompt you wrote in the
Create Project dialog.

### Templates
- Removed WorkflowBadge from the header.
- Removed WorkflowInputs / ClipTrimPanel / 'Advanced inputs' toggle
  from the left column.
- Blank workflow is the default for new projects.
- Agent prompt updated: "don't evangelize templates".
- `/template` (alias `/workflow`) slash command still opens the picker
  for power users who want a structured format.

### Create flow
- ProjectSwitcher "New project" opens the CreateProjectDialog (name,
  format, instructions, asset upload) instead of silent-create.
- Dialog auto-fills project name from first 6 words of the goal if
  blank. Cmd/Ctrl+Enter submits; Esc closes. 'Drop to attach' overlay
  when dragging files over.
- Cmd/Ctrl+Shift+N opens the dialog from anywhere.
- Auto-created empty 'Draft' project hidden from ProjectHome list.

### Testing mode
- Inline script in <head> clears vibeedit-project / vibeedit-chat /
  vibeedit-broll / vibeedit-render-queue on every page load. UI prefs
  (theme, chat-width, chat-open) are preserved.
- Flip the ENABLE constant in layout.tsx's script to turn persistence
  back on.

### Layout memory
- Chat sidebar open/closed state persists.
- Left / right panel collapsed state persists.

### Auth
- AuthBar promoted out of overflow menu — now always visible in the
  main header.
- auth.ts + scheduler.ts read VIBEEDIT_DATA_DIR env, set to /data on
  the dokku app so users/sessions survive container restarts.

### Misc
- Chat: click sidebar body to focus input.
- Chat empty state: dropped the 'browse all 10 video types' link.
- Header: dropped redundant 'N scenes · Xs' count.
- Favicon: emerald sparkle.
- bun run deploy / deploy:proxy aliases.

## Unreleased — polish pass #6

Simplification + shortcuts sweep. ProjectHome, timeline drag-resize/reorder,
avatar scaffold landed earlier in the session; this pass is UX debt.

- ProjectHome: 🎲 surprise me, drop a .vibeedit file to import, filter box
  after 5+ projects.
- Cmd/Ctrl+K now toggles the chat (was open-only). Click the VibeEdit logo
  to go back to ProjectHome; double-click for shortcuts.
- Shortcuts: `N` = new blank scene, `g` / `Shift+G` = first / last scene.
- Chat: empty-state footer hint, streaming indicator names the running
  tool, textarea grows 1-8 rows to match input.
- Scene editor: quick-pick accent palette + "apply to all" + right-click
  swatch to copy hex + × close button.
- Scene cards: 🎙 / 🎬 pills when voiceover / video bg is attached.
- SceneList: click the count header to select all.
- Bridge: /api/bridge/status probes the upstream (1.5s) so the header
  indicator turns red+pulsing when the proxy is unreachable. /status
  command flags it inline.
- Undo/Redo tooltips report step count.

## Unreleased — polish pass #5

Live-in-production sweep. vibevideoedit.com now runs on dokku with a
sidecar `cliproxy` dokku app routing Claude traffic through a Claude
Code Max OAuth session (zero per-token API spend).

### Backend plumbing
- `ANTHROPIC_BASE_URL` env support in `claude-bridge.ts` — points every
  Claude call at a custom endpoint (e.g. CLIProxyAPI).
- `/api/bridge/status` reports the active backend (`bridge` / `proxied` /
  direct API) + base URL + key presence.
- New `docker/cliproxy/` folder with Dockerfile, config.yaml, deploy.sh,
  and README — replaces the throwaway `/tmp/cliproxy-wrapper`.
- `scripts/deploy.sh` — one-shot GitHub + dokku push; `--with-proxy`
  also redeploys cliproxy.

### Header
- `DEV` pill when viewing over localhost / LAN.
- `BridgeIndicator` dot turns sky-blue and reads "via Claude Max" when
  `ANTHROPIC_BASE_URL` is set. Click copies full status JSON.
- `WorkflowBadge` shows an amber `PRO` pill for paid workflows.

### Chat
- Copy-conversation-to-Markdown button in header.
- Hover copy button on long (140+ char) assistant messages.
- Tool-call rows fade in, hover shows `fn(args)` JSON tooltip.
- Expanded tool summary shows `N failed` / `N in-flight` breakdown.
- Slash commands: `/undo`, `/save`, `/status`, `/tips`.
- Relative timestamps (`2m ago`) on each turn.
- Bridge/proxy timeout errors include inline remediation hints.

### Editor & shortcuts
- `,` / `.` navigate prev/next scene (no modifier).
- Scene card hover shows full text + type + duration in tooltip.
- Scene editor: char counts + amber "may wrap" warning on text fields.
- Scene list total-duration color-coded to hint short-form sweet spot
  (red < 10s, green 10-90s, amber > 90s).
- Render button label shows total seconds instead of preset id.

### Tooling
- `bun run typecheck` / `bun run check` aliases.
- README "How it's deployed" walkthrough.

## Unreleased — mobile

- Added Capacitor (`@capacitor/core` + `@capacitor/cli` + `ios` + `android`).
- `capacitor.config.ts` — `server.url` is taken from `CAP_DEV_URL` so the
  native WebView can live-load the running Next.js dev server during
  development. No rebuild needed on code edits.
- New `cap:add:*`, `cap:sync`, `cap:open:*`, `cap:run:*` scripts in
  package.json.
- `/ios` and `/android` gitignored; regenerate with `bun run cap:add:*`
  then commit when ready to ship.

## Unreleased — polish pass #4

Quality-of-life sweep built on top of the Claude-Code bridge. Bridge fails
fast now, the header shows a live bridge/save indicator, more shortcuts, a
right-click context menu, nicer empty states.

### Bridge
- `BRIDGE_TIMEOUT_MS` default lowered from 600s → 120s.
- Timeout error names the real fix path.
- `/api/bridge/status` endpoint + `BridgeIndicator` dot in the header
  (green = real API, amber = bridge, pulsing amber = pending requests).

### Shortcuts
- `Cmd/Ctrl+A` selects all scenes.
- `Shift+↑/↓` extends the multi-selection during keyboard nav.
- `E` jumps from the scene list into the scene editor.
- `Space` toggles preview play/pause.
- `Escape` (during streaming) cancels the agent turn.
- `/tips` slash command in chat.
- Right-click a scene card → context menu (edit / dup / copy / delete).

### Chat polish
- Four click-to-send example prompts in the empty state.
- Drop a `.txt` / `.md` into chat → treated as a script.
- Paste a URL → pre-fills an "Import from this URL" nudge.
- Tool-call rows fade in instead of pop in.

### Visual polish
- Scene card shows an accent-color dot.
- Scene duration color-coded (red <1.5s, amber >4s, neutral otherwise).
- Header flashes a "saved" indicator when zustand persist flushes.
- Toasts expand on hover, up to 5 visible.
- Empty preview gets a 🎲 Surprise me button.
- Scene editor shows (and lets you copy) the stable scene id.
- Render button tooltip shows scene count, total seconds, and ETA.

## Unreleased — Claude-Code-as-backend

- New `src/lib/server/claude-bridge.ts` — a single `callClaude()` helper every
  Claude-hitting API route now shares.
- `USE_LOCAL_BRIDGE=true` (or an unset `ANTHROPIC_API_KEY`) routes every
  request through `.ai-bridge/pending/*.json` and long-polls
  `.ai-bridge/done/*.json`. A Claude Code session picks up requests and writes
  responses — zero API spend while iterating.
- All 12 Claude routes migrated: agent, script, generate, refine, review,
  classify-assets, comic-dub/extract, export-metadata, pose-suggest,
  style-extract, broll/suggest, podcast/detect-moments.
- Streaming routes (`generate`, `review`) synthesize SSE from the bridged
  response with a staggered delay so the scene-by-scene animation still
  feels live.
- Dropped the now-unused `partial-scenes.ts` (was only for streaming-JSON
  partial extraction).

## Unreleased — vibe-editing era

The editor is now chat-first. An agent with 16 tools does the actual editing;
the old slot-based UI is tucked behind "Advanced inputs". Most chrome
collapsed into an overflow menu. Power-user keyboard shortcuts surface via `?`.

### Chat as the primary surface

- Left-side ChatSidebar with streaming tool calls, per-turn undo, quick-reply
  chips on questions, and persistence across reloads.
- `Cmd/Ctrl+K` focuses chat from anywhere. `Cmd/Ctrl+R` tells the agent to
  try again. `?` shows all shortcuts.
- Slash commands: `/new`, `/reset`, `/render`, `/voice <id>`, `/preset <id>`.
- Drag or paste files into chat → uploaded + handed to the agent.
- Empty state shows workflow cards + a 🎲 Surprise me button.

### Agent improvements

- 16 tools: scene CRUD, duplicate, reorder, setSceneDuration,
  applyStylePresetToScene, generateScenesFromScript, narrate (one / all),
  generateImage, setMusic, setCaptionStyle, setOrientation, setProjectName,
  switchWorkflow, listWorkflows, renderProject.
- System prompt injects the active workflow's review criteria + slot shape,
  so the agent edits in-character for the workflow.
- Auto-rename "Draft" to a topic-shaped project name on first move.
- Self-review pass after 5+ scenes.
- Ends each batch with 1-2 yes/no next-action questions.

### UI simplification

- Orientation toggle removed (workflow sets it, chat can change it).
- Auto-video button retired (chat does this).
- OnboardingTour retired (chat empty state is the onboarding).
- 6 config panels collapsed into a tab strip (Music / Voice / Captions /
  Style / Library / Assets).
- Secondary header buttons moved into an overflow menu.
- Scene editor hidden until a scene is selected.
- Scene cards compact: thumbnail + one-line label + duration.

### Defaults

- Default project name: "Draft".
- Default voice: nova (warmer than alloy).
- Chat closed by default on narrow screens.
- Auto-caption every voiceover.

### Infra

- `/api/agent` streams Claude tool-use, up to 16 rounds per turn.
- Throttled localStorage writes (300ms).
- Chat history persists across refresh.

## Polish pass #3

- Stop button during agent streaming (AbortController).
- `/help`, `/stop`, `/export`, `/voice`, `/preset` slash commands + autocomplete popover.
- `Cmd+Shift+C` copies selected scene's text.
- "API key missing" banner in chat when agent returns 503.
- Agent bails after 4 consecutive tool failures (no runaway loops).
- Agent can read render queue via `getRenderStatus` tool.
- Agent tool set now includes `duplicateScene`, `reorderScenes`, `setSceneDuration`, `applyStylePresetToScene`.
- Active voice pill in chat header.
- Workflow badge sparkle pulses while agent is streaming.
- Multi-line paste in chat auto-prefixes "Make scenes from this script".
- Compact single-line tool-call summary when collapsed.
- Active scene scrolls into view on keyboard navigation.
- ShortcutsOverlay auto-closes on any next keystroke.
- Chat input grows from 1 row to 3 when multiline, text bumped to 13px.
- Message timestamps on hover.
- Consolidated agent system prompt (dropped duplicate rules).
- Paste image in chat → upload + agent routes.
