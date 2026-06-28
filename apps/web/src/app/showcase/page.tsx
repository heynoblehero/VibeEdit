import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { MarketingNav } from "@/components/MarketingNav";
import { DemoCard } from "@/components/DemoCard";

export const dynamic = "force-dynamic";

const OG_IMAGE =
  "/og?title=" +
  encodeURIComponent("Real videos. Real creators.") +
  "&subtitle=" +
  encodeURIComponent("Every video made with VibeEdit — from a single chat prompt.") +
  "&badge=" +
  encodeURIComponent("Creator showcase");

export const metadata: Metadata = {
  title: "Showcase — Real videos made with VibeEdit",
  description:
    "Browse real videos creators made with VibeEdit from a single chat prompt — Shorts, Reels, and long-form. No timeline, no editor.",
  alternates: { canonical: "/showcase" },
  openGraph: {
    title: "VibeEdit Showcase — Real videos. Real creators.",
    description: "Every video here was made from a single chat prompt with VibeEdit.",
    type: "website",
    url: "/showcase",
    siteName: "VibeEdit",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: "VibeEdit creator showcase" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "VibeEdit Showcase — Real videos. Real creators.",
    description: "Every video here was made from a single chat prompt with VibeEdit.",
    images: [OG_IMAGE],
  },
};

type ShowcaseEntry = {
  slug: string;
  projectName: string | null;
  platform: string;
  aspectRatio: string;
  channelName: string | null;
  finishedAt: string | null;
  videoUrl: string;
  thumbUrl: string | null;
  seed?: boolean;
  demoFile?: string;
};

type SeedEntry = {
  demoFile: string;
  projectName: string;
  platform: string;
  aspectRatio: "9:16" | "16:9";
  channelName: string;
};

// Seed entries — live animated Hyperframes compositions, shown until real user
// videos fill the grid. Each demoFile is a self-contained HTML composition in /public/demos/.
const SEED_ENTRIES: SeedEntry[] = [
  {
    demoFile: "finance-hook.html",
    projectName: "How $47K vanished in 48 hours",
    platform: "youtube",
    aspectRatio: "9:16",
    channelName: "Finance Unlocked",
  },
  {
    demoFile: "comic-facts.html",
    projectName: "The villain who broke the rules",
    platform: "youtube",
    aspectRatio: "9:16",
    channelName: "Comic Vault",
  },
  {
    demoFile: "anime-hook.html",
    projectName: "The jutsu they never showed you",
    platform: "tiktok",
    aspectRatio: "9:16",
    channelName: "Anime Decoded",
  },
  {
    demoFile: "scary-story.html",
    projectName: "The Basement Tape — Ep. 04",
    platform: "tiktok",
    aspectRatio: "9:16",
    channelName: "Midnight Archives",
  },
  {
    demoFile: "history-mystery.html",
    projectName: "The pyramid no one is allowed to enter",
    platform: "youtube",
    aspectRatio: "16:9",
    channelName: "Lost Histories",
  },
  {
    demoFile: "sleep-story.html",
    projectName: "Ancient Stars — a sleep story",
    platform: "youtube",
    aspectRatio: "16:9",
    channelName: "Deep Drift",
  },
  {
    demoFile: "tech-dark.html",
    projectName: "The algorithm that broke everything",
    platform: "youtube",
    aspectRatio: "16:9",
    channelName: "Block Report",
  },
];

const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  linkedin: "LinkedIn",
};

async function fetchEntries(platform?: string): Promise<ShowcaseEntry[]> {
  const base = process.env.BETTER_AUTH_URL || "http://localhost:3000";
  const url = new URL("/api/showcase", base);
  url.searchParams.set("limit", "24");
  if (platform) url.searchParams.set("platform", platform);
  try {
    const r = await fetch(url.toString(), { next: { revalidate: 60 } });
    if (!r.ok) return [];
    const data = (await r.json()) as { entries: ShowcaseEntry[] };
    return data.entries;
  } catch {
    return [];
  }
}

export default async function ShowcasePage({
  searchParams,
}: {
  searchParams: Promise<{ platform?: string }>;
}) {
  const { platform } = await searchParams;
  const realEntries = await fetchEntries(platform);

  const filteredSeeds = SEED_ENTRIES.filter((s) => !platform || s.platform === platform);
  const seedsNeeded = Math.max(0, 6 - realEntries.length);
  const seedsToShow = realEntries.length >= 6 ? [] : filteredSeeds.slice(0, seedsNeeded);

  const entries = realEntries;

  return (
    <div className="min-h-screen">
      <MarketingNav />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-10 pb-10 text-center sm:px-6 sm:pt-16 sm:pb-12">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-fg-muted)]">
          <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-accent)]" />
          Creator showcase
        </div>
        <h1 className="mx-auto max-w-4xl text-4xl font-black leading-tight tracking-tight sm:text-5xl md:text-7xl">
          Real videos. <br />
          <span className="text-[var(--color-accent)]">Real creators.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-base text-[var(--color-fg-muted)] sm:text-lg">
          Every video below was made with VibeEdit — from a single chat prompt, no timeline, no
          editor.
        </p>
      </section>

      {/* Platform filter */}
      <div className="mx-auto mb-10 flex max-w-6xl flex-wrap justify-center gap-2 px-4 sm:px-6">
        {[undefined, "youtube", "tiktok", "instagram"].map((p) => (
          <Link
            key={p ?? "all"}
            href={p ? `/showcase?platform=${p}` : "/showcase"}
            aria-current={(platform ?? undefined) === p ? "page" : undefined}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)] ${
              (platform ?? undefined) === p
                ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-black"
                : "border-[var(--color-border)] text-[var(--color-fg-muted)] hover:border-[var(--color-accent)]/50 hover:text-[var(--color-fg)]"
            }`}
          >
            {p ? PLATFORM_LABELS[p] : "All"}
          </Link>
        ))}
      </div>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        {/* 9:16 — Shorts & Reels */}
        {(() => {
          const realV = entries.filter((e) => e.aspectRatio === "9:16");
          const seedV = seedsToShow.filter((s) => s.aspectRatio === "9:16");
          if (realV.length + seedV.length === 0) return null;
          return (
            <div className="mb-12">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-[var(--color-fg-subtle)]">
                Shorts &amp; Reels · 9:16
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {realV.map((entry) => (
                  <ShowcaseCard key={entry.slug} entry={entry} />
                ))}
                {seedV.map((seed) => (
                  <DemoCard
                    key={seed.demoFile}
                    demoFile={seed.demoFile}
                    projectName={seed.projectName}
                    channelName={seed.channelName}
                    platform={seed.platform}
                    aspectRatio={seed.aspectRatio}
                  />
                ))}
              </div>
            </div>
          );
        })()}

        {/* 16:9 — Long-form */}
        {(() => {
          const realH = entries.filter((e) => e.aspectRatio !== "9:16");
          const seedH = seedsToShow.filter((s) => s.aspectRatio === "16:9");
          if (realH.length + seedH.length === 0) return null;
          return (
            <div>
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-[var(--color-fg-subtle)]">
                Long-form · 16:9
              </h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {realH.map((entry) => (
                  <ShowcaseCard key={entry.slug} entry={entry} />
                ))}
                {seedH.map((seed) => (
                  <DemoCard
                    key={seed.demoFile}
                    demoFile={seed.demoFile}
                    projectName={seed.projectName}
                    channelName={seed.channelName}
                    platform={seed.platform}
                    aspectRatio={seed.aspectRatio}
                  />
                ))}
              </div>
            </div>
          );
        })()}
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-3xl px-4 pb-24 pt-8 text-center sm:px-6 sm:pb-32 sm:pt-12">
        <h2 className="mb-4 text-2xl font-bold sm:text-3xl md:text-5xl">Your channel, next.</h2>
        <p className="mx-auto mt-4 max-w-xl text-[var(--color-fg-muted)]">
          Pick a niche, write a prompt, ship a video tonight.
        </p>
        <Link
          href="/app/signup"
          className="mt-8 inline-block rounded-xl bg-[var(--color-accent)] px-6 py-3 text-base font-semibold text-black hover:opacity-90 sm:px-8 sm:py-4 sm:text-lg"
        >
          Start your first video
        </Link>
        <p className="mt-4 text-xs text-[var(--color-fg-muted)]">
          Want your video featured here?{" "}
          <Link href="/app/renders" className="text-[var(--color-accent)] hover:underline">
            Open Renders → Feature
          </Link>
        </p>
      </section>

      <footer className="border-t border-[var(--color-border)] px-4 py-10 text-sm text-[var(--color-fg-muted)] sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <Wordmark size="sm" />
          <span>© 2026 VibeEdit. Made for creators.</span>
        </div>
      </footer>
    </div>
  );
}

function ShowcaseCard({ entry }: { entry: ShowcaseEntry }) {
  const isVertical = entry.aspectRatio === "9:16";
  const platform = PLATFORM_LABELS[entry.platform] ?? entry.platform;
  const href = entry.seed ? null : `/share/${entry.slug}`;

  const inner = (
    <>
      {/* Video / thumbnail */}
      <div
        className={`relative overflow-hidden ${isVertical ? "aspect-[9/16]" : "aspect-video"}`}
        style={{ background: "#0a0a0a" }}
      >
        {/* Static poster — shown until hover */}
        {entry.thumbUrl && (
          <img
            src={entry.thumbUrl}
            alt={`Thumbnail for ${entry.projectName || "an untitled video"} made with VibeEdit`}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-300 group-hover:opacity-0"
            loading="lazy"
          />
        )}

        {/* Video — plays on hover */}
        <video
          src={entry.videoUrl}
          aria-label={`Preview of ${entry.projectName || "an untitled video"}`}
          muted
          loop
          playsInline
          preload="none"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${
            entry.thumbUrl
              ? "opacity-0 group-hover:opacity-100"
              : "opacity-60 group-hover:opacity-90"
          }`}
          onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
          onMouseLeave={(e) => {
            const v = e.currentTarget as HTMLVideoElement;
            v.pause();
            v.currentTime = 0;
          }}
        />

        {/* Bottom gradient for text legibility */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

        {/* Platform badge */}
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
          {platform}
        </span>

        {/* Play hint on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="white" aria-hidden="true">
              <polygon points="3,1 13,7 3,13" />
            </svg>
          </div>
        </div>

        {/* Project name overlaid at bottom for vertical cards */}
        {isVertical && (
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <p className="line-clamp-2 text-xs font-semibold leading-snug text-white drop-shadow-sm">
              {entry.projectName || "Untitled"}
            </p>
            {entry.channelName && (
              <p className="mt-0.5 truncate text-[10px] text-white/60">{entry.channelName}</p>
            )}
          </div>
        )}
      </div>

      {/* Meta row — only for landscape cards */}
      {!isVertical && (
        <div className="p-3">
          <p className="truncate text-xs font-semibold text-[var(--color-fg)] group-hover:text-[var(--color-accent)]">
            {entry.projectName || "Untitled"}
          </p>
          {entry.channelName && (
            <p className="mt-0.5 truncate text-[10px] text-[var(--color-fg-subtle)]">
              {entry.channelName}
            </p>
          )}
        </div>
      )}
    </>
  );

  const cls =
    "group block overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-all hover:border-[var(--color-accent)]/40 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]";

  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
