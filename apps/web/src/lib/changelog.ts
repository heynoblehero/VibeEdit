export type ChangelogEntry = {
  date: string;
  version: string;
  highlights: string[];
};

export const CHANGELOG: ChangelogEntry[] = [
  {
    date: "2026-05-17",
    version: "0.7.0",
    highlights: [
      "Local render worker: standalone binary (Mac arm64 / Mac x64 / Linux x64 / Windows x64) polls our queue and renders on your hardware — 2–5× faster than cloud.",
      "Launch demo: real `public/demo.mp4` rendered from the comic-facts template — landing page autoplays it instead of the placeholder.",
      "Welcome email fires once when onboarding completes; trial-ending email cron runs daily and sends T-3 / T-1 / T-0 reminders (idempotent via usage log).",
      "`bun run preflight` — single-command launch readiness check covering env, DB tables, CLI, templates, lint, storage, and marketing assets.",
    ],
  },
  {
    date: "2026-05-17",
    version: "0.6.0",
    highlights: [
      "Brand kit: upload logo, watermark, channel name, primary + accent colors. Agent auto-applies via `get_brand_kit`.",
      "Stock library: SFX, B-roll, character archetypes searchable via `find_stock`.",
      "Legal pages, account deletion, status page, help docs, in-app changelog.",
      "`diff_file` tool — surgical edits with up to 70% token savings on follow-ups.",
    ],
  },
  {
    date: "2026-05-16",
    version: "0.5.0",
    highlights: [
      "`screenshot_at_time` tool — agent renders pixels and visually critiques its own output.",
      "`plan_composition` tool — agent plans first, asks before any code is written.",
      "Onboarding survey + guided 3-step editor tour.",
      "Render presets: Draft, YouTube 1080p, Shorts 30fps, High 60fps.",
      "Stripe billing scaffolding + $1 trial flow + usage meter.",
    ],
  },
  {
    date: "2026-05-15",
    version: "0.4.0",
    highlights: [
      "Project list polish: rename, duplicate, delete, search.",
      "Templates gallery with 8 IP-free starter templates (Comic, Anime, Sci-fi, History, Finance, Sleep, Scary, Tech).",
      "Editor UX: preview state indicator, keyboard shortcuts (⌘R, ⌘P, ⌘/), variable controls, asset thumbnails.",
      "`/app/renders` global render history page.",
    ],
  },
  {
    date: "2026-05-14",
    version: "0.3.0",
    highlights: [
      "VibeEdit Video brand applied; marketing landing at `/`, app at `/app/*`.",
      "Agent system prompt v2 — terser persona, curated palette, niche profiles.",
      "Sample prompt cards on empty editor.",
      "Inline `write_file` diff bubbles in chat.",
      "Claude Agent SDK integration (no API key required — uses your Claude Code OAuth).",
    ],
  },
];
