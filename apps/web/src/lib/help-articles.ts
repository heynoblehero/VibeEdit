export type HelpArticle = {
	slug: string;
	title: string;
	summary: string;
	body: string;
};

export const HELP_ARTICLES: HelpArticle[] = [
	{
		slug: "how-prompts-work",
		title: "How prompts work",
		summary:
			"The agent reads your prompt like a creative brief — niche, format, palette, beats.",
		body: `## The agent thinks in compositions, not paragraphs.

When you type "make a 30s anime facts hook with pink and cyan", the agent:

1. **Detects your niche** from keywords (anime → pink/cyan + speed lines + chromatic title).
2. **Plans the composition** as 4–8 scenes with beats and FX. You see this as a Plan card.
3. **Waits for your approval** before writing any code. Click "yes go" or reply with edits.
4. **Writes the HTML composition** using hyperframes contracts.
5. **Lints + auto-fixes** any errors before showing you.
6. **Screenshots key frames** and looks at them. If something is broken visually (text overflow, layout bug), it fixes itself.

### Good prompts include

- Duration ("30 seconds")
- Format ("vertical Short" or "1920x1080 horizontal")
- Niche ("comic facts", "scary story", "finance intro")
- Vibe ("dark and moody", "neon and chaotic")
- Optional: specific FX ("glass crack at the title", "no flashes")

### What the agent won't do

- Reference copyrighted characters or brands by name. Ask for "the hero" instead of "Spider-Man".
- Real-person impersonation by name.
- Sexual content or material that violates platform rules.
`,
	},
	{
		slug: "install-render-worker",
		title: "Install the render worker",
		summary: "How to run renders on your own machine for speed + no queue waits.",
		body: `## Why install a worker?

Free-tier renders run in our cloud, which is slow during peak hours and limited to 30s of total render time per month. Installing the local render worker means:

- Renders run on your CPU/GPU — typically **2–5× faster**.
- No queue waits.
- No worker minutes count against your plan.

### Install (Mac)

1. Download \`vibeedit-worker-darwin-arm64\` (or \`-x64\`) from your account → settings.
2. Run \`xattr -d com.apple.quarantine ~/Downloads/vibeedit-worker-*\` to lift Gatekeeper.
3. Double-click the binary.
4. It registers with your account using a one-time token and starts polling for jobs.

### Install (Windows)

1. Download \`vibeedit-worker-windows-x64.exe\` from settings.
2. Double-click. Windows SmartScreen may warn; click "More info" → "Run anyway" (we are working on Authenticode signing).

### Install (Linux)

1. \`curl -L https://vibeedit.video/worker/linux | sh\`
2. The script downloads the binary to \`~/.local/bin/vibeedit-worker\` and creates a systemd unit if available.

### Status

Once running, you'll see "Worker online" in the editor header. Renders will route to your machine.

> **Note:** The worker binary is coming. The server-side protocol is in place; the installable binary is the final week-2 deliverable.
`,
	},
	{
		slug: "renders-are-slow",
		title: "Why renders are slow",
		summary: "Render time depends on duration, framerate, FX complexity, and queue.",
		body: `### Typical render times

| Composition | Cloud (free tier) | Local worker |
|---|---|---|
| 15s @ 30fps, light FX | ~30s | ~10s |
| 30s @ 30fps, moderate FX | ~75s | ~25s |
| 60s @ 60fps, heavy FX (vfx-shatter etc) | ~5min | ~90s |

### What to do if it's stuck

1. Check the [status page](/status) — degraded service is the most common cause.
2. Open /app/renders — jobs with status "running" >10min are likely stuck.
3. Email support@vibeedit.video with the job ID.

### How to speed it up

- Lower the framerate from 60 → 30fps. Most YouTube + TikTok use 30 anyway.
- Use the "Draft" quality preset for previews.
- Install the local worker (above).
- Avoid heavy 3D / WebGL effects (vfx-shatter, ridged-burn) in long compositions.
`,
	},
	{
		slug: "billing",
		title: "Billing FAQ",
		summary: "How plans work, what happens when you hit limits, how to cancel.",
		body: `### Plans

- **Free** — 3 watermarked renders / month, cloud-only.
- **Creator** ($19/mo) — 50 renders / month, 1080p, no watermark, local worker, all formats.
- **Studio** ($49/mo) — unlimited renders, 4K output, brand kit slots, priority queue.

### Trial

All paid plans start with a 14-day $1 trial. You can cancel before it ends and won't be charged the monthly fee.

### What happens when I hit my limit?

- **Soft warning at 80%** — banner in the editor.
- **Hard block at 100%** — render button is disabled with an upgrade prompt.
- Limits reset on the 1st of each month.

### Cancel

Go to [/app/billing](/app/billing) → "Manage subscription" to open the Stripe Customer Portal. Cancel takes effect at the end of the current period; access continues until then.

### Refunds

See the [refund policy](/legal/refunds).
`,
	},
	{
		slug: "feature-requests",
		title: "Request a feature",
		summary: "Tell us what's missing. We read every request.",
		body: `### How to submit

Email **feedback@vibeedit.video** with:

- What you tried to do.
- What you wished was possible.
- A screen recording (Loom / CleanShot) if relevant.

### What's on the roadmap (committed)

- **TTS narration** — v1.1, ~4–6 weeks after public launch.
- **Auto-captions** — generates from voiceover or chat-supplied script.
- **Brand kit slots** — Studio plan, multiple kits per workspace.
- **Real-time collaboration** — v3.

### What we won't build

- Full timeline NLE — that's not the product. The chat IS the timeline.
- Marketplace for templates — too much moderation overhead for an MVP.
- API for third-party automation — once we have stable users; not before.
`,
	},
	{
		slug: "prompt-cookbook",
		title: "Prompt cookbook for faceless YouTubers",
		summary:
			"Copy-paste prompts for the niches we see most: comic, history, finance, sleep, scary, tech.",
		body: `These prompts are battle-tested against the agent. Tweak the bolded parts.

### Comic / superhero facts (Shorts)

> Make a **30s** vertical Short — 5 comic-style facts about **a flying hero with a cape**. Red + yellow palette, halftone dots, big chromatic title cards, whoosh between facts. End with "follow for more" frame.

### Anime facts (Shorts)

> 25s vertical anime-style facts hook about **legendary ninja clans**. Pink + cyan + speed lines, chromatic title, glitch on every fact reveal, electronic build under the music.

### Historical mystery (long-form intro)

> 45s 16:9 intro for a video titled **"What really happened at Roanoke?"** Sepia tones, slow ken-burns on parchment, candle flicker, low brass drone. Ends on the title held for 3 seconds.

### Finance hook (Shorts)

> 20s vertical finance hook: **3 ways the rich think differently about money**. Black + gold + green palette. Ticker tape strip at the bottom. Each fact pops in with a coin clink.

### Sleep story intro (long-form)

> 60s 16:9 intro for a sleep story about **an ancient forgotten library**. Indigo + soft amber, slow ambient pads, fog drifting, no quick cuts, no flashes. Whisper-quiet narration cue at 0:55.

### Scary story (Shorts)

> 30s vertical horror hook — **"The thing my neighbor saw on his lawn"**. Dark blue + sickly green, vignette, low rumbling, glitch on the title, sudden cut to a frozen frame at the end.

### Tech tutorial intro

> 15s 16:9 intro for **"How I built a $10k app in a weekend"**. Dark UI aesthetic, terminal-green accents, code rain background, animated arrow pointing to a number that ticks up to $10,000.

### Long-form intro + chapters (10-min YouTube)

> 10-minute (600s) 16:9 long-form video about **the unsolved mystery of the Voynich manuscript**. Sepia palette, serif type, slow ken-burns on parchment, 5 chapter title cards spaced ~2 minutes apart with held silence between them, no flashes, low brass drone bed. End with a "subscribe for part 2" frame.

Long-form briefs work best when you specify chapter count and let the agent space them. Compositions can be up to 15 minutes (\`totalDurationSeconds\` cap = 900).

### Tips that always work

- **Specify duration explicitly.** "30s" beats "short". For long-form use "600s" or "10 minutes".
- **Name the palette.** Two or three colors is better than five.
- **Say what you DON'T want.** "No flashes" / "no quick cuts" / "no sound effects on this one" — the agent obeys negative constraints.
- **Reference vibes, not IP.** Say "comic superhero", not the actual character name.
- **Give the title text.** The agent will design around it.
- **For long-form, ask for chapters.** "5 chapter title cards" lets the agent structure pacing properly.
`,
	},
	{
		slug: "worker-troubleshooting",
		title: "Worker troubleshooting",
		summary:
			"The render worker won't start, won't connect, or jobs fail — fixes here.",
		body: `### Symptom: worker won't start (Mac)

\`\`\`
"vibeedit-worker" can't be opened because Apple cannot check it for malicious software.
\`\`\`

We are working on Apple notarisation. Until then:

\`\`\`bash
xattr -d com.apple.quarantine ~/Downloads/vibeedit-worker-darwin-arm64
\`\`\`

Then double-click again, or run it directly: \`./vibeedit-worker-darwin-arm64\`.

### Symptom: "VIBEEDIT_TOKEN required"

The binary needs an auth token to claim render jobs from your account. Get one from **/app/settings → "Local worker"** and paste it:

\`\`\`bash
export VIBEEDIT_TOKEN=mh_wt_xxxxxxxxxxx
./vibeedit-worker-darwin-arm64
\`\`\`

On Windows, set the env var in PowerShell: \`$env:VIBEEDIT_TOKEN="mh_wt_..."\`.

### Symptom: worker connects but never picks up jobs

1. Confirm you see "Worker online" in the editor header. If not, the token may be revoked.
2. Generate a new token in settings.
3. The cloud may be routing your jobs to its own pool — check the render history page. The job dropdown lets you target your local worker explicitly.

### Symptom: renders fail with "hyperframes: command not found"

The worker needs the hyperframes CLI on PATH. The Mac/Linux installer bundles it. If you customised \`VIBEEDIT_HYPERFRAMES_CMD\`, double-check the path resolves:

\`\`\`bash
echo $VIBEEDIT_HYPERFRAMES_CMD
which hyperframes
\`\`\`

### Symptom: renders are slower than the cloud

Likely your machine is on battery / thermally throttled. Plug in. Close other browser tabs. The headless Chrome instance the worker spawns is memory-heavy (~2GB peak for a 60s render).

### Verify a worker job locally

\`\`\`bash
export VIBEEDIT_URL=https://vibeedit.video
export VIBEEDIT_TOKEN=mh_wt_xxxxxxxxxxx
./vibeedit-worker-darwin-arm64 --once
\`\`\`

The \`--once\` flag claims one job, runs it, and exits with a verbose log.

### Still stuck?

Email **support@vibeedit.video** with the worker log and your worker ID (printed on startup).
`,
	},
	{
		slug: "export-your-data",
		title: "Export your data",
		summary:
			"Download everything you've made — projects, chat history, render metadata — in one zip.",
		body: `### Where

Go to **/app/settings/account** → "Export my data". Click the button. We queue a job and email you a download link within ~5 minutes. The link is valid for 48 hours.

### What's in the zip

- \`projects/<id>/composition.html\` — the full HTML composition for every project you own.
- \`projects/<id>/chat.json\` — your full chat history with the agent (prompts, plans, agent replies).
- \`projects/<id>/renders.json\` — metadata for every render (job id, timestamps, status, duration, output URL).
- \`account.json\` — your profile, plan, credit balance, and creation date.

### What's NOT in the zip

- **Rendered MP4 files.** We don't re-bundle the actual video files — they can be tens of GB across your history. The \`renders.json\` includes signed URLs for each one; download what you need separately.
- Other users' data (obvious, but worth saying).
- Internal logs and metrics.

### Doing it programmatically

The export is on-demand only right now. If you need scheduled exports, email **support@vibeedit.video** — we'll help.
`,
	},
	{
		slug: "delete-my-account",
		title: "Delete my account",
		summary:
			"How to permanently delete your account and what gets removed.",
		body: `### Where

**/app/settings/account** → "Delete account" at the bottom. You'll be asked to type your email to confirm. There is no undo.

### What gets deleted

Everything. Foreign keys cascade, so deleting your user row removes:

- All projects and their HTML compositions.
- All chat history with the agent.
- All render rows and their queue entries.
- API keys you created.
- Sessions and credit ledger entries.

Deletion is **immediate**, not soft-delete. We don't keep a hidden \`deletedAt\` flag — the rows are gone from the live database the moment you confirm.

### Backup retention

We take encrypted nightly backups for disaster recovery. Your data may persist in those backups for up to **14 days** before the rolling window purges them. After 14 days, nothing of yours exists in any system we control.

### Active subscription?

Cancel your Stripe subscription **before** deleting. We can't refund a charge to an account that no longer exists in our database. See [refund policy](/legal/refunds).

### Before you go

If you'd rather just take a break, you can sign out and leave the account dormant — we won't auto-delete you.
`,
	},
	{
		slug: "refund-policy",
		title: "Refund policy",
		summary:
			"14-day money-back on the first paid charge. After that, case-by-case.",
		body: `### The 14-day window

Your first paid charge (after the $1 trial converts) is refundable in full for **14 days**, no questions asked. Email **support@vibeedit.video** with your order id from the Stripe receipt.

### After 14 days

We handle refunds case-by-case. We'll refund without much pushback for:

- **Broken renders** you couldn't get working and we couldn't fix.
- **Billing errors** — double-charge, wrong plan, renewal you missed cancelling by a day or two.
- **Service degradation** during your billing period that materially affected use.

We will not refund for:

- "I didn't use it this month." Cancel before the next cycle instead.
- Renders that completed successfully and were downloaded.

### Annual plans

We don't offer annual billing yet. When we do, refunds will be **pro-rated** for the unused months minus a small admin fee. We'll update this page when annual lands.

### Process

1. Email **support@vibeedit.video** from the address on the account.
2. Include the Stripe **order id** (starts with \`ch_\` or \`pi_\`) and a one-line reason.
3. We reply within 2 business days. Approved refunds hit your card in 5–10 days depending on your bank.
`,
	},
	{
		slug: "common-render-failures",
		title: "Common render failures",
		summary:
			"The five render errors we see most, and the one-line fix for each.",
		body: `### 1. Composition references a missing asset

**Signal**: render fails fast with \`asset not found: /uploads/xxx.png\`.

**Fix**: re-upload the asset from the chat ("upload this image again") or remove the broken \`<img src>\` from the composition. Assets deleted from storage stay referenced in the HTML.

### 2. Lint never went green

**Signal**: render rejected before the queue even claims it; error mentions \`linter: <n> errors\`.

**Fix**: ask the agent to "fix the lint errors" — it has the linter output and will patch the composition. Don't hit render again until the lint badge is green.

### 3. Render timed out (>10 min)

**Signal**: job stuck at "running" for 10+ minutes, then transitions to \`failed\` with \`timeout\`.

**Fix**: lower framerate from 60 → 30fps, or split the composition. Heavy WebGL effects (vfx-shatter, ridged-burn) over long durations are the usual culprits.

### 4. hyperframes CLI version mismatch

**Signal**: \`hyperframes: unknown flag\` or schema validation errors in the worker log.

**Fix**: update the worker — \`./vibeedit-worker --update\` or re-download from /app/settings. The cloud always runs the latest CLI; local workers can drift.

### 5. Disk full on the worker

**Signal**: \`ENOSPC: no space left on device\` in the worker log.

**Fix**: clear \`~/.vibeedit/cache\` and \`~/.vibeedit/renders/tmp\`. The worker doesn't auto-prune yet — long sessions accumulate intermediate frames.

### Still failing?

Email **support@vibeedit.video** with the job id from /app/renders.
`,
	},
	{
		slug: "runbook",
		title: "Founder runbook",
		summary: "Internal: every breakable thing + the fix. Pin this on launch day.",
		body: `### Anthropic API outage

**Signal**: chat returns errors like "rate_limit_error" or 5xx from anthropic.com.

**Fix**: temporarily fall back to claude-sonnet-4-6 by setting \`ANTHROPIC_MODEL=claude-sonnet-4-6\` in env. Restart.

### Render queue stuck

**Signal**: jobs sitting at "running" >10min, no progress updates.

**Fix**: \`pkill -f hyperframes\` then \`pkill -f chrome-headless-shell\`. The in-process queue will retry from the DB row.

### Stripe webhook failing

**Signal**: subscriptions don't activate after checkout.

**Fix**: check Stripe dashboard → Developers → Webhook events. Replay failed events. Verify \`STRIPE_WEBHOOK_SECRET\` matches.

### Database lock (SQLite)

**Signal**: API requests hang or return "database is locked".

**Fix**: SQLite WAL is enabled but extreme write bursts can stall. Wait 30s. If persistent, check for stuck SQLite processes.

### Worker offline (when implemented)

**Signal**: user complains renders aren't running on their machine.

**Fix**: their auth token expired (>24h since last poll). Have them restart the worker; it re-authenticates.

### Launch-day on-call hours

- 8:00–12:00 — Twitter + PH comments
- 12:00–14:00 — support inbox
- 14:00–16:00 — bug triage + Loom replies
- 16:00–20:00 — second wave + onboarding interviews
`,
	},
];

export function getHelpArticle(slug: string): HelpArticle | null {
	return HELP_ARTICLES.find((a) => a.slug === slug) || null;
}
