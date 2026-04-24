# VibeEdit Studio

AI video editor where you dictate and the agent does the editing. Think Cursor for video.

> **⌘K** — open the chat. Tell it what to make. That's the whole product.

## What it is

- **Chat-first editor.** Press `Cmd/Ctrl+K` to open the agent sidebar and tell it what to make.
  "make me a 60-second TikTok about morning routines" → agent writes the script, generates scenes,
  narrates, captions, renders the MP4. Undoable per turn.
- **10 video workflows.** Faceless (Isaac/Odd1sOut), AI image story, commentary over clips,
  comic dub, podcast clip extractor, movie review, Top-N, recipe reels, true crime, gaming highlights.
  Each workflow has its own slot schema and scene recipe — the agent is aware of the active workflow
  and edits in-character.
- **Self-contained MP4 output.** Remotion-driven render, everything inlined as data URLs — renders
  don't depend on the dev server staying up.

## Quick start

```bash
bun install
cp .env.local.example .env.local   # fill in at least ANTHROPIC_API_KEY + OPENAI_API_KEY
bun run dev
```

Open <http://localhost:3000>. Hit `Cmd+K` and tell the agent what video to make.

## Keyboard shortcuts

Press `?` to see everything. The big ones:

- `Cmd/Ctrl+K` — focus the chat (from anywhere)
- `Cmd/Ctrl+R` — "try again, differently" (regenerate current turn)
- `Cmd/Ctrl+Z` / `Shift+Cmd/Ctrl+Z` — undo / redo
- `Cmd/Ctrl+D` — duplicate selected scene
- `Up/Down` — navigate scene selection
- `Delete` — remove selected scene(s)

## Slash commands in chat

- `/new` — create a new project
- `/reset` — clear scenes + script
- `/render` — render the current project

## Agent tools

16 tools at last count: scene CRUD, `generateScenesFromScript`, `applyStylePreset`,
`applyStylePresetToScene`, `setCaptionStyle`, `setOrientation`, `setProjectName`, `setMusic`,
`switchWorkflow`, `listWorkflows`, `narrateScene`, `narrateAllScenes`, `generateImageForScene`,
`renderProject`, `duplicateScene`, `reorderScenes`, `setSceneDuration`. See
`src/lib/server/agent-tools.ts`.

## Environment

| Var | What it enables |
| --- | --- |
| `ANTHROPIC_API_KEY` | Agent, scene gen, refine, review, workflow-aware everything |
| `OPENAI_API_KEY` | Voiceover (TTS), Whisper captions, DALL-E image gen, podcast viral detection |
| `ELEVENLABS_API_KEY` | Voice cloning (optional) |
| `USE_LOCAL_BRIDGE=true` | Route every Claude call through `.ai-bridge/` file queue instead of api.anthropic.com (see below) |
| `STRIPE_SECRET_KEY` + `STRIPE_PRICE_<WORKFLOW_ID>` | Paid workflow unlocks (optional) |
| `DEMO_UNLOCK=true` | Bypass Stripe for local paid-workflow testing |
| `YT_DLP_BIN` | Override `yt-dlp` path for URL imports |

## Claude Code as the backend (dev mode)

When iterating without burning tokens, set `USE_LOCAL_BRIDGE=true` (or just leave
`ANTHROPIC_API_KEY` blank). Every Claude call in the app then becomes a file
handoff:

1. The app writes the request to `.ai-bridge/pending/<id>.json`.
2. A Claude Code session running alongside picks it up, thinks, writes the
   response to `.ai-bridge/done/<id>.json`.
3. The route long-polls that file and resumes as if api.anthropic.com had
   answered.

Bridge mode keeps full AI quality (it's literally Claude answering), costs zero
API spend, and lets you inspect every prompt the app sends by reading the
pending JSON. The tradeoff: it only works while a Claude Code session is
actively watching. Streaming routes (`generate`, `review`) fake the "scenes
appear one-by-one" feel by staggering their output after the bridge response
arrives.

OpenAI/ElevenLabs routes (TTS, Whisper, DALL-E, voice cloning) aren't bridged —
those need real audio/image synthesis, so keep `OPENAI_API_KEY` set if you want
voiceover and captions.

## Mobile (Capacitor)

VibeEdit ships as a Capacitor-wrapped web app — the native iOS/Android
WebView just loads the running Next.js app.

**Dev loop** (WebView points at your laptop's dev server):

```bash
bun run dev                                             # start Next.js
CAP_DEV_URL=http://<your-lan-ip>:3000 bun run cap:sync  # wire config

# first time only — generates /ios or /android project:
bun run cap:add:ios        # needs macOS + Xcode
bun run cap:add:android    # needs Android Studio

bun run cap:run:ios        # or cap:open:ios and run from Xcode
bun run cap:run:android    # or cap:open:android
```

Code edits on your laptop reflect instantly in the device WebView — no
rebuild, no redeploy. The phone hits every `/api/*` route on your dev
server, including the Claude-Code bridge.

**Production**: point `server.url` (or `webDir`) at a hosted build. The
`ios/` and `android/` dirs are gitignored while scaffolding; commit them
once you're ready to ship to the stores.

## How it's deployed

Production runs on **dokku** on a Linode box at `172.104.41.101`, fronted
by nginx + HTTPS. Two dokku apps:

| App | Role | URL |
|---|---|---|
| `vibeedit` | the Next.js app — this repo | https://vibevideoedit.com |
| `cliproxy` | a CLIProxyAPI container that talks to Claude via OAuth | http://cliproxy.172.104.41.101.sslip.io |

VibeEdit's `ANTHROPIC_BASE_URL` points at the cliproxy URL, so all Claude
traffic is routed through a single Claude Code OAuth session on the
server — zero per-token API spend in dev.

**One-liner deploys:**

```bash
./scripts/deploy.sh               # pushes master → GitHub + dokku
./scripts/deploy.sh --with-proxy  # also redeploys cliproxy from docker/cliproxy/
```

See `docker/cliproxy/README.md` for the OAuth bootstrap steps.

## Architecture

- `src/app/api/*` — route handlers (agent, render queue, TTS, Whisper, image gen, Stripe, auth)
- `src/lib/workflows/` — `WorkflowDefinition` pattern: each workflow is data (slots, recipe,
  autoPipeline, review criteria) plus a scene-generator function
- `src/lib/server/agent-tools.ts` — every tool the agent can call
- `src/remotion/` — Remotion composition + `SceneRenderer`
- `src/store/` — Zustand stores (project, chat, voice, render queue, asset library, saved styles, auth)

## Paywall

Workflows can carry `paid: true`. On render, signed-in users who haven't unlocked the workflow get
HTTP 402. Unlock endpoint tries Stripe Checkout first, falls back to `DEMO_UNLOCK=true` for local dev.

## Credits

Built on top of [Next.js](https://nextjs.org), [Remotion](https://www.remotion.dev),
[Claude](https://claude.ai) (scenes, agent), [OpenAI](https://openai.com) (TTS/Whisper/DALL-E),
[ElevenLabs](https://elevenlabs.io) (voice cloning), [yt-dlp](https://github.com/yt-dlp/yt-dlp)
(URL imports).
