import Link from "next/link";
import type { Metadata } from "next";
import { Wordmark } from "@/components/Wordmark";
import { FREE_TOOLS } from "@/lib/tools/catalog";

export const metadata: Metadata = {
  title: "Free Video Tools — VibeEdit",
  description:
    "Free online video tools — remove AI watermarks, compress, convert, isolate voice, and more. No signup required.",
  alternates: { canonical: "/tools" },
  openGraph: {
    title: "Free Video Tools — VibeEdit",
    description:
      "Free online video tools — remove AI watermarks, compress, convert, and more. No signup required.",
    type: "website",
    url: "/tools",
    siteName: "VibeEdit",
  },
};

export default function ToolsHubPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/">
            <Wordmark size="md" />
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
              ← Home
            </Link>
            <Link
              href="/early"
              className="rounded-md bg-[var(--color-accent)] px-4 py-1.5 font-semibold text-black hover:opacity-90"
            >
              Sign up free
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <h1 className="text-3xl font-bold sm:text-4xl">Free video tools</h1>
        <p className="mt-2 max-w-2xl text-[var(--color-fg-muted)]">
          Fast, free, no signup. Made by VibeEdit — the AI video editor that turns a sentence into a
          finished video.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FREE_TOOLS.map((tool) => {
            const inner = (
              <div
                className={`h-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-colors ${
                  tool.status === "live" ? "hover:border-[var(--color-accent)]" : "opacity-70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[var(--color-fg)]">{tool.name}</h2>
                  {tool.status === "soon" && (
                    <span className="rounded-full bg-[var(--color-bg-2)] px-2 py-0.5 text-[10px] text-[var(--color-fg-subtle)]">
                      soon
                    </span>
                  )}
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--color-fg-muted)]">
                  {tool.tagline}
                </p>
              </div>
            );
            return tool.status === "live" ? (
              <Link key={tool.slug} href={`/tools/${tool.slug}`}>
                {inner}
              </Link>
            ) : (
              <div key={tool.slug}>{inner}</div>
            );
          })}
        </div>

        <div className="mt-12 rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 p-6 text-center">
          <h3 className="text-lg font-semibold">Want the full thing?</h3>
          <p className="mx-auto mt-1 max-w-xl text-sm text-[var(--color-fg-muted)]">
            VibeEdit generates, edits, and renders complete videos from a prompt — voiceover,
            captions, b-roll, and all. These tools are just a taste.
          </p>
          <Link
            href="/early"
            className="mt-4 inline-block rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-black hover:opacity-90"
          >
            Try VibeEdit free →
          </Link>
        </div>
      </main>
    </div>
  );
}
