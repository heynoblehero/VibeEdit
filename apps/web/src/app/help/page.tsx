import Link from "next/link";
import { HELP_ARTICLES } from "@/lib/help-articles";
import { Wordmark } from "@/components/Wordmark";

export default function HelpIndex() {
  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-8">
      <header className="mb-8 flex items-center justify-between sm:mb-10">
        <Link href="/">
          <Wordmark size="md" />
        </Link>
        <nav className="flex gap-3 text-sm">
          <Link href="/" className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]">
            Home
          </Link>
          <Link
            href="/changelog"
            className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
          >
            Changelog
          </Link>
        </nav>
      </header>
      <h1 className="mb-2 text-2xl font-bold sm:text-3xl">Help</h1>
      <p className="mb-8 break-words text-[var(--color-fg-muted)]">
        Short docs. If something is missing, ask{" "}
        <a
          href="mailto:support@vibeedit.video"
          className="underline hover:text-[var(--color-accent)]"
        >
          support@vibeedit.video
        </a>
        .
      </p>
      <ul className="space-y-2">
        {HELP_ARTICLES.map((a) => (
          <li key={a.slug}>
            <Link
              href={`/help/${a.slug}`}
              className="block rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-fg-muted)]"
            >
              <div className="mb-1 font-semibold">{a.title}</div>
              <div className="text-sm text-[var(--color-fg-muted)]">{a.summary}</div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
