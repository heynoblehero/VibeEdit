# Changelog

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
