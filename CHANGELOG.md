# Changelog

## Unreleased — sprint 17 batch C (3 more commits)

- ✂ orange warning when scene is shorter than its VO.
- Persist zen mode across reloads.
- 'Apply transition to all cuts' context-menu action.

## Unreleased — sprint 17 batch B (10 more commits)

- 'Move to overlay track' context menu (auto-creates overlay).
- ProjectStats: track count + upload count chips.
- TracksPanel: muted/locked counts in header.
- 'Reverse' + 'Shuffle' scene order bulks.
- BulkActionsBar: total selection duration.
- Click TrackStrip block → select scene.
- Persist composition guides (thirds/safe-area/letterbox).
- ⌘Enter play from selected scene.
- ⌘, opens Settings.
- S solos selection.

## Unreleased — sprint 17 (10 commits)

QoL part 2.

- '?' button in header (always-visible shortcut entry).
- '+ Black scene' / '+ White scene' quick adds in TracksPanel.
- Playhead readout shows seconds + absolute frame + sub-frame.
- Home / End seek to start / last frame.
- SceneList card opacity 40% when muted (timeline parity).
- 'Reverse scene order' + 'Shuffle order' bulks in TracksPanel.
- BulkActionsBar shows total duration of selection.
- ⌘\` cycles to previously-edited project.
- Render progress chip + loop / marker chips in the toolbar.

## Unreleased — sprint 16 batch C — 6 more commits

- 'Remove muted scenes' / 'Lock all' / 'Mute all' bulks in TracksPanel.
- 'Insert blank before/after' in scene context menu.
- Cheat sheet updated with all sprint-16 keys.

## Unreleased — sprint 16: usability sprint B — 17 commits

Continuation of the QoL pass.

### Keyboard / shortcuts
- ⌘⇧↑ / ⌘⇧↓ trim selected scene's duration ±0.25s.
- ⌘M opens master-mix popover.
- L locks/unlocks selection.

### IO / clipboard
- Paste any clipboard image → uploads + adds as scene.

### UX polish
- Auto-pause preview when tab loses focus.
- Unsaved-changes dot in document.title.
- Trackpad pinch (⌃+wheel) zooms timeline.
- Persist active LeftSidebar tab in localStorage.
- Persist timelineZoom across reloads.
- Cut tool draws an amber ring on the track when active.

### Tracks panel
- Per-track Solo button (mute all others, click again to clear).
- 'Fit total to N seconds' proportional-scale bulk action.

### Scene context menu
- 'Move to start' / 'Move to end' actions.

## Sprint 16: usability sprint A — 22 commits

Aggressive QoL pass. Each item is small but the cumulative effect
should make the editor feel substantially more competent.

### Scenes / context menu
- Solo (mute all others, click again to clear).
- Reset all effects (wipes fx/grade/keys/speed/fades but keeps media).
- Letterbox 2.39:1 cinemascope overlay (▭ in preview cluster).
- Empty-scene ⚠ icon when a scene has no media/text/VO.
- 'Fit duration to VO' single-click button in EffectsPanel.
- 'Fit all durations to VO' bulk button in TracksPanel.
- 'Surprise me ✨' randomizes a Look across the whole project.

### Looks / actions
- 6 more Looks: Polaroid, Sunset, Cyberpunk, Anime, Documentary,
  Moonlight (now 12 total).

### Keyboard
- ⌘⇧M toggle mute on selection.
- ⌘C / ⌘V copy + paste scenes via clipboard JSON.
- ⌘⇧S export project as JSON file.
- ⌘P opens project switcher.
- ⌘⇧N new blank project.
- ⌘↑ / ⌘↓ also reorder selected scene.
- L toggle lock on selection.
- Z toggle zen mode (chrome-hidden preview).
- ⌘F open scene search modal.

### Timeline
- Friendlier empty-state drop hint.
- Drag markers to reposition them.

### IO
- Drop a `.vibeedit.json` file onto the window to import.

### Layout
- PageTitleSync — `document.title` follows project name.

## Unreleased — sprint 15: multi-track timeline (M1–M4) — 6 commits

The structural follow-on to sprint 12. Closes the last open item
from the original editor-pivot plan.

### Schema (M1)
- `Project.tracks?: Track[]` (optional — undefined = legacy single-
  track behaviour, bit-exact unchanged).
- `Track { id, kind, name, sceneIds[], muted?, locked?, opacity?,
  blendMode?, startOffsetSec? }`. `TrackKind = "video" | "overlay" |
  "audio"`.
- Helpers: `defaultTracksFromScenes`, `resolveTracks`,
  `projectTotalFrames` (track-aware).
- Store actions: `addTrack` / `removeTrack` / `updateTrack` /
  `moveSceneToTrack`. addTrack auto-migrates legacy projects to
  capture the existing scene order as 'V1' on first call.

### Renderer (M2)
- `MultiTrackRender` component dispatched from `VideoComposition`
  when `project.tracks` is defined. Each track is its own
  TransitionSeries inside a Sequence at startOffsetSec * fps.
  Tracks render in array order — track[0] is the bottom layer.
- Overlay tracks honour opacity + mix-blend-mode via an
  AbsoluteFill wrapper. Audio-only tracks skip visual but still
  emit voiceover/sfx Audio rails.
- Music ducking + swell drive off the first non-empty video
  track ('driver') so competing tracks can't double-duck.
- Root.tsx + Preview.tsx + render-jobs.ts now pass
  `project.tracks` and use `projectTotalFrames` so durations
  are right-sized.

### Timeline UI (M3)
- New 'Tracks' tab in the LeftSidebar (between Actions and AI).
  Each track row has editable name, kind icon, scene count,
  duration, mute / lock toggles, opacity slider (overlay), blend
  dropdown (overlay), startOffsetSec input (overlay + audio),
  remove (forbidden on the implicit V1).
- Add-track buttons: Video / Overlay / Audio.
- `TrackStrip` renders a compact 'All tracks' visual below the
  main timeline showing each track as a one-line row with
  scene blocks at their global positions, color-coded by kind.
  Hidden for single-track projects.

### Drag between tracks (M4)
- Timeline scene blocks now expose `vibeedit/scene-id` on
  dragStart. Both TracksPanel rows and TrackStrip rows accept
  this MIME type and call `moveSceneToTrack` to relocate.
- Locked tracks reject drops; the implicit-V1 row can't be
  removed but accepts drops in.

## Unreleased — sprint 14: pro-NLE quality of life (10 commits)

A focused follow-up that unlocks the moves people learn in Premiere
in the first week. Smaller in scope than sprint 13 but each item is
visibly useful.

- **Drop files from Finder/Explorer onto the timeline**. Bypasses
  the Uploads panel — uploads + inserts as a scene in one drag.
- **Loop range** (`[`, `]`, `\\`) — set in/out at playhead, cyan
  band on the ruler, Preview wraps the player every 50ms.
- **Rule-of-thirds + safe-area overlays** on the preview canvas,
  toggled from a tiny bottom-right cluster (⌗ / ▣).
- **SRT subtitle export** from voiceover captions. Walks scenes,
  shifts ms by global frame offset, groups into 3-word cues. Muted
  scenes excluded so SRT matches the rendered video.
- **⌘J / ⌘⇧J** jump playhead to next / prev marker (wraps).
- **'Apply look to all scenes'** button in BackgroundPanel — copies
  color grade + keys to every other scene.
- **⌘⇧E** opens the thumbnail / poster export dialog.
- **Upload tile metadata**: byte size visible on each tile + richer
  tooltip (MIME, upload time).
- ShortcutHelp dialog updated with the new bindings.

## Unreleased — sprint 13: editor depth pass — 21 commits

A focused 'real video editor' sprint with a single goal: every common
NLE move should have an obvious answer in VibeEdit. Drag-drop fixes,
zoom, markers, mute/lock/tag, fades, keying, master mix, all wired.

### Drag-and-drop fixes
- Empty-timeline drop zone — Timeline used to return null at
  scenes.length === 0 so drops on a fresh project did nothing. Now
  shows a dashed-border target with the same outer onDrop.
- Scene-block drops bubble outer-track payloads — drops of upload-url
  / scene-type / title onto an existing block now bubble to the
  track-level handler instead of being eaten.
- Shift+drag upload onto scene → swap that scene's bg media in place.
- Track-wide emerald glow during a valid drag-over so the drop is
  visibly accepted.

### Uploads
- Hover '+' button on each tile inserts the upload as a new scene
  in one click (alternative to drag).

### Timeline
- ⌘= / ⌘− / ⌘0 horizontal zoom (0.5×–8×). Track wraps in a
  scrollable container at zoom > 1; selected scene auto-scrolls into
  view; shift-wheel scrolls horizontally.
- M drops a marker at the playhead. Markers render as colored dashed
  lines on the ruler; alt-click to remove.
- Magnetic snap to playhead when resizing scene right-edge (within
  ±0.15s; alt to bypass).
- Scene blocks gain colorTag bar, label override, type-abbrev,
  effect/look/key/speed badges, lock icon.
- Double-click a block to rename.
- Ripple-delete bridges cuts (already in sprint 12, retained).

### Scenes
- Mute toggle (skipped on render, dimmed in timeline).
- 6-color tag system.
- Lock toggle (read-only — block move/resize/delete).
- Per-scene fadeInFrames / fadeOutFrames for visual fades.

### Background
- Chroma + luma key (sprint 12.5, retained).
- Flip H / Flip V / rotate 90° toggles in BackgroundPanel.

### Audio
- speedFactor → playbackRate on voiceover/sfx Audio (sprint 12.5).
- Master mix popover (sprint 12.5) — header Sliders icon → 0–200%
  music/voice/sfx gains.

### Header
- Live scene-count + total-duration chip (deducts muted scenes).
- Aspect-ratio quick-switcher (16:9 / 9:16).
- Persistent autosave indicator with relative-time pill.

### Keyboard
- ⌘R quick-render with the active preset.
- ⌘[ / ⌘] reorder selected scene up/down.
- ←/→ frame-step playhead (Shift = 10).
- ? opens a 5-section keyboard cheat-sheet dialog.

### Actions panel
- 'Recent' tray showing the last 6 used effects/looks/transitions/
  titles, draggable like the section cards.

### Preview
- 0.5× / 1× / 1.5× / 2× playback-rate selector overlay (live preview
  only — render speed unchanged).

### Safety
- Confirm before deleting >3 selected scenes.

## Unreleased — sprint 12.5: speed-warp audio, master mix, keying (4 commits)

Closes the gaps the previous sprint deferred: speed warp now retimes
audio (not just visuals), the master mixer ships as a header popover,
and both chroma and luma keying land for scene backgrounds. Multi-
track is the only sprint-12 deferral that remains outstanding.

### Speed warp audio wiring (S1 follow-up)
- Composition.tsx now passes `playbackRate={scene.speedFactor}` to
  voiceover + sfx Audio elements. 0.5× → slow-mo dialogue, 2× →
  chipmunk audio. Pitch shift is intentional (matches every NLE).
  Visual animations were already scene-locked via durationFrames-
  scaled springs/interpolates, so audio was the only remaining gap.

### Master mix popover (A2)
- `Project.audioMix?: { music?, voice?, sfx? }` schema field — each a
  0–2× multiplier, default 1. Renderer multiplies it through every
  audio rail (voiceover envelope, sfx, music ducking).
- Header `<Sliders>` icon opens a 3-slider popover (0–200% each) with
  reset button + dirty indicator dot. Double-click any slider → 100%.

### Chroma + luma key (K1 + K2)
- `SceneBackground.chromaKey?: { color, tolerance, softness }` and
  `lumaKey?: { threshold, softness, invert }`. Both optional — old
  scenes render identically.
- GradientBg emits a per-scene `<svg><defs><filter>` that's chained
  onto the bg image/video's CSS filter alongside the color-grade
  chain. Filter ids use `chroma-${scene.id}` / `luma-${scene.id}` so
  multiple keyed scenes don't collide.
- Chroma matrix is dominant-channel-based — greenscreen / bluescreen
  / redscreen all work. tolerance shifts the cutoff; softness widens
  a feathered alpha tableValues band.
- Luma uses `feColorMatrix type=luminanceToAlpha` plus a 16-step
  feFuncA ramp. Invert flag flips which side of the threshold gets
  culled (useful for dark logos on bright frames).
- BackgroundPanel ships a "Keying" section with checkboxes to toggle
  each key + sliders for tolerance / softness / threshold.

### Outstanding
- Multi-track (M1-M4): structural; ~10-12 commits. Deferred to a
  dedicated sprint.

## Sprint 12: editor depth — speed / volume / looks / titles / export presets (5 commits)

Five focused additions toward "real editor for the 80% case" — each is
a few commits and ships as a self-contained polish layer. Multi-track,
chroma/luma key, and master mixer deferred to a focused follow-up.

### Per-scene timing + audio (S1 + A1)
- `Scene.speedFactor`: 0.25× → 4× per scene (slow-mo / fast-mo).
  Schema-only in this sprint — visual playback respect lands when we
  rewire SceneRenderer's frame counter to scale per-scene.
- `Scene.audioGain`: 0 → 2.0. Multiplies voiceover + sfx volume in
  Composition. Renderer side fully wired today.
- SceneEditor EffectsPanel gains a "Speed & audio" section with both
  sliders + live label.

### Platform export presets (E1)
- 4 new RenderPreset ids: `tiktok` (8 Mbps), `reels` (5 Mbps),
  `yt_shorts` (12 Mbps), `yt_16x9` (12 Mbps). Each carries
  `videoBitrateKbps` + `audioBitrateKbps` + `expectedRatio`. Hits
  each platform's preferred input bitrate so re-encode quality holds.
- `render-jobs.ts` reads `preset.audioBitrateKbps` / `videoBitrateKbps`,
  falls through to existing defaults for the generic quality tiers.

### "Looks" section in ActionsPanel (F1)
- New CardKind `look` + MIME type `vibeedit/look`. 6 draggable preset
  bundles: Cinematic / Punchy / Noir B&W / Dreamy / Vintage / Neon.
  Each is a bundle of `colorGrade + brightness + contrast + saturation
  + temperature + blur` values that flow through GradientBg's existing
  CSS filter chain.
- Drop on a scene block → wipes the prior look's keys cleanly + merges
  the new bundle (so a second drop fully replaces, not stacks).

### "Titles" section in ActionsPanel (T1)
- New CardKind `title` + MIME type `vibeedit/title`. 6 templates:
  Bold opener · Minimalist · Kinetic typography · Lower-third name ·
  Quote card · Chapter card.
- Each carries a deep bundle (type, duration, text, sizes, colors,
  textMotion, emphasisMotion, effects[], transition, background) that
  Timeline's outer onDrop merges over a base scene shape and inserts
  via `insertSceneAt`.
- Distinct from `vibeedit/scene-type` because titles pre-fill content
  + motion + effects, not just the bare type field.

## Unreleased — sprint 11: left sidebar with Uploads / Actions / AI tabs (1 commit)

UI restructure that moves all the "what can I drop here?" surfaces off
the topbar into a persistent left sidebar — Premiere/AE pattern. Three
tabs share the same drag-onto-timeline / drag-onto-scene drop targets.

### LeftSidebar.tsx
Vertical 12px tab bar + 60px content panel. Three tabs:
- 📁 **Uploads** — existing UploadsPanel, refactored with an `inline`
  prop so the same component now renders both inside the sidebar
  (chrome-less) and as a fixed drawer (legacy callers).
- ⚡ **Actions** — three sections of draggable cards:
  · **Transitions** (12 cards): fade / dip-to-black / dip-to-white /
    iris / clock_wipe / flip / slide_left / whip_pan / smash_cut /
    glitch / zoom_blur / jump_cut. Each carries a default
    durationFrames (and color where relevant).
  · **Effects** (11 cards): circle_ping / radial_pulse / scan_line /
    bar_wipe / corner_brackets / reveal_box / lower_third / typewriter
    / glitch / particles / progress_bar.
  · **Scene types** (8 cards): text_only / stat / big_number /
    bullet_list / quote / split / montage / bar_chart, each with
    sensible defaults so the dropped scene isn't blank.
- ✨ **AI** — two sections:
  · **Project-wide** click-to-run cards: Auto-build / Review /
    Score / Generate publish metadata / Find match cuts / Export
    subtitles. Each opens chat + auto-submits the prefab prompt.
  · **Drop on a scene** drag cards: Improve / Re-narrate /
    New background image / Match style to next / Critique this
    scene. Drop on a scene block → focusedSceneId set + chat
    opens + prompt submits.

### MIME types + drop handlers
- `vibeedit/upload-url` (existing) → Timeline outer onDrop creates a
  scene with the upload as bg.
- `vibeedit/scene-type` (new) → Timeline outer onDrop creates a scene
  with that type pre-set + sensible content defaults.
- `vibeedit/effect` (new) → per-scene-block onDrop pushes onto
  scene.effects.
- `vibeedit/transition` (new) → per-scene-block onDrop upserts the cut
  going INTO this scene from its predecessor.
- `vibeedit/ai-action` (new) → per-scene-block onDrop sets
  focusedSceneId + opens chat + submits the prefab.

The per-scene-block handler stopPropagation()s so it never falls
through to the Timeline outer handler. Reorder dragging still works
(no MIME type → falls through to the existing dragIndex logic).

### Page restructure
- Header buttons removed: ✨ AI quick-action + Uploads icon (with the
  count badge). Both moved into LeftSidebar tabs. Render queue +
  Settings stay in the header.
- Right-side UploadsPanel drawer retired in favor of the inline tab.
- Chat sidebar (Cmd+K) unchanged — still slides in from the right.

## Unreleased — sprint 10: pivot to AI-augmented manual editor (13 commits)

Strategic pivot: lead with the editor, demote the AI to a copilot.
Previous direction (AI-first autonomous video generation) puts us in
the Pika / Runway lane; "web video editor with AI woven through the
primitives" is more defensible since most editors bolt AI on as a
marketing feature. Existing autonomous-loop investment becomes the
moat instead of being thrown out.

### Reposition
- ProjectHome subhead: "AI video editor. Describe it, the agent
  builds it." → "Web video editor with an AI in your corner."
- CreateProjectDialog cinematic-mode default flips true → false. New
  bordered toggle card with active/inactive copy. Submit label still
  reflects mode ("Create project" vs "Create + auto-build video").
- Empty-project Preview reorders: leads with "+ Add a blank scene"
  primary green button, "Drop files in Uploads" secondary, AI prompts
  + Cmd+K hint demoted below a divider as "Or have AI build the
  whole thing".

### Default surface
- Chat sidebar starts collapsed for new/empty projects (no saved
  preference + scenes.length === 0). Returning users keep their last
  layout via the existing `vibeedit:chat-open` localStorage key.
- New always-visible ✨ AI button in the page header (between Get-the-
  app and the Uploads icon). Click → toggles chat via the same Cmd+K
  event the keyboard shortcut uses.

### Editor depth
- C/V keyboard shortcuts in the central registry: C toggles cut tool,
  V switches to selection. Toast feedback. Gated against text inputs.
- cutMode lives on useEditorStore so the keyboard handler can toggle
  it from anywhere.
- Ripple delete: removeScene now retargets cuts when a scene is
  deleted from the middle of the timeline. prev → next gets a fresh
  hard cut so the cuts graph stays consistent. removeScenes (bulk)
  drops every cut touching a deleted scene without bridging.
- ✨ AI suggestions submenu in the right-click scene menu. 5 prefab
  actions ("Improve this scene", "Re-narrate", "Generate new image",
  "Match style to next scene", "Run selfCritique here") that set
  focusedSceneId and submit the chat with a focused-scope prompt.
- Manual color-grading sliders: scene.background.brightness /
  contrast / saturation / temperature. Compose on top of the
  colorGrade preset in GradientBg's CSS filter chain. SceneEditor
  BackgroundPanel gets a "Color grade" section after vignette.
- Wider trim hit-area on the right edge of timeline scene blocks
  (4 → 8 px) with a thinner visible bar revealed on hover.
- Snap-to-grid (0.25 s steps) on cut + trim. Hold Alt to bypass.
  Resize cap raised 10s → 20s.
- Audio waveform inside every voiceover-bearing scene block on the
  timeline. New AudioWaveform.tsx decodes once via Web Audio API
  decodeAudioData, pre-buckets to 1024 min/max envelope, caches in a
  module-level Map. ResizeObserver + DPR-aware canvas. Reuses the
  AudioContext pattern from src/lib/silence-detect.ts.

### SYSTEM_PROMPT
- Phase-0 reframing block at the top: "AI copilot inside VibeEdit, a
  manual web video editor. Default to focused, scene-scoped edits.
  The autonomous loop only runs when explicitly invoked." Existing
  autonomous-loop instructions stay below verbatim.

### Deferred to follow-up
- Left trim handle (needs Scene.offsetSec + renderer wiring).
- [ ] / J / K / L keyboard shortcuts (need playhead-frame plumbing).

## Unreleased — sprint 8: cuts, focus mode, motion presets, keyframe graph (29 commits)

The largest single sprint to date. Closes three structural gaps the
agent + UI couldn't reach before: cuts were baked-in flashes, the
agent operated project-wide, and motion was on/off per element.

### New schema
- `Cut` (project-level): {fromSceneId, toSceneId, kind, durationFrames,
  easing, color?, audioLeadFrames?, audioTrailFrames?}.
- `CutKind`: 18 kinds (existing 6 + fade / dip_to_black / dip_to_white
  / iris / clock_wipe / flip / wipe / jump_cut / smash_cut / whip_pan
  / glitch_cut / match_cut + explicit `hard`).
- `Easing`: 10 named curves shared by Cuts + Keyframes.
- `Keyframe`: {frame, value, easing?, bezierIn?, bezierOut?}.
- `KeyframeProperty`: 12 animatable channels.
- `MotionPreset`: 12 element-motion shorthands.

### Renderer (TransitionSeries migration)
- Composition.tsx flows visuals through @remotion/transitions
  TransitionSeries. 17/18 cut kinds wire to a TransitionPresentation;
  bespoke ones for whip_pan / smash_cut / glitch_cut / dip-to-color /
  beat_flash / zoom_blur / jump_cut.
- Per-scene voiceover + sfx audio extracted from SceneRenderer
  (renderAudio prop) and rendered at composition level so J cuts
  shift audio earlier than the visual cut, L cuts later.
- SceneRenderer reads textMotion / emphasisMotion / characterMotion
  via `motionValue(preset, property)` → expands preset to keyframes,
  evaluates per frame.
- New helpers in lib/anim.ts: `evaluateKeyframes` + `resolveEasing`.
- New lib/motion-presets.ts catalog with 12 keyframe generators.

### Cut-marker UI
- CutMarker + CutEditPopover components, mounted in both Timeline.tsx
  (horizontal) and SceneList.tsx (vertical). Click a diamond to edit
  kind / duration / easing / color / J/L offsets.
- Auto-creates `hard` cuts on every addScene so the UI always has
  something to render at every boundary.

### Scene focus mode
- useEditorStore.focusedSceneId. FocusChip in ChatSidebar + Target
  button on SceneCard.
- Route splices a FOCUSED SCOPE system block: bans cross-scene tools,
  narrows selfCritique + videoQualityScore to one scene.
- resolveSceneId helper migrates 10+ tools to default sceneId-less
  calls to ctx.focusedSceneId.

### Motion presets
- 12 presets: drift_up/down, pulse, shake, ken_burns_in/out,
  parallax_slow/fast, bounce_in, fade_in_out, wobble, none.
- MotionPresetField dropdown in SceneEditor's TextPanel for textMotion
  + emphasisMotion.

### Keyframe graph editor
- KeyframeGraph.tsx: SVG canvas, click-to-add / drag-to-move /
  right-click-to-remove. Curve sampled every 4px via
  evaluateKeyframes so the line matches the renderer.
- Per-keyframe easing dropdown for the active keyframe.
- AnimatePanel in SceneEditor mounts under a new editTarget="keyframes"
  tab. Property dropdown + sticky "Recent" chips.
- proKeyframes flag in useEditorStore reserved for the bezier-handle
  follow-up.

### Agent tools
- setCut, listCuts, setMotionPreset, addKeyframe, clearKeyframes,
  listMotionPresets.

### SYSTEM_PROMPT
- FOCUSED SCOPE (when focusedSceneId is set).
- CUTS BETWEEN SCENES — per-kind use cases + J/L cut guidance.
- MOTION PRESETS — per-preset element guidance.

### Deps
- @remotion/transitions@4.0.370.

## Unreleased — sprint 7: 3D scene primitives via @remotion/three

Three.js renders inline alongside the rest of the Remotion timeline —
no Blender install, no extra render-farm, no per-gen API cost. Three
new scene types:

- `three_text` — extruded rotating 3D text columns ("logo reveal" feel).
  Set `scene.threeText`. Procedural so no font file at render time.
- `three_card` — image floats on a rotating 3D card. Set
  `scene.threeCardImageUrl` to any URL (uploaded asset, generated image,
  or stock).
- `three_particles` — 3D particle field that drifts toward the camera.
  Set `scene.threeParticleCount` (default 200). Wraps for infinite feel.

Schema additions on Scene: `threeText`, `threeCardImageUrl`,
`threeAccentColor`, `threeParticleCount`.

Agent: createScene exposes the new types + fields. SYSTEM_PROMPT teaches
when to reach for 3D (hook, product reveal, act-interlude — never
back-to-back).

Deps: @remotion/three, three, @react-three/fiber, @react-three/drei,
@types/three.

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
