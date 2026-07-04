import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/Wordmark";

// Shared chrome for a free-tool page: nav, hero, the tool itself, and a
// consistent "built by VibeEdit" upsell. Server component — pages add their own
// metadata and drop a <FileTool> (client) as children.
export function ToolPageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/tools">
            <Wordmark size="md" />
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/tools"
              className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
            >
              ← All tools
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

      <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
          <p className="mx-auto mt-3 max-w-xl text-[var(--color-fg-muted)]">{subtitle}</p>
        </div>

        {children}

        <div className="mt-12 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center">
          <div className="text-sm font-semibold text-[var(--color-fg)]">
            Made by VibeEdit — the AI video editor
          </div>
          <p className="mx-auto mt-1 max-w-md text-xs text-[var(--color-fg-muted)]">
            Turn a sentence into a finished video: edits, captions, b-roll, voiceover — all by
            chatting with AI. These free tools run on the same engine.
          </p>
          <Link
            href="/early"
            className="mt-4 inline-block rounded-lg bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-black hover:opacity-90"
          >
            Try the AI editor free →
          </Link>
        </div>
      </main>
    </div>
  );
}
