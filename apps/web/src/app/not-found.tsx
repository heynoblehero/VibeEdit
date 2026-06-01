import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <Link href="/" className="mb-10">
        <Wordmark size="md" />
      </Link>
      <div className="mb-2 font-mono text-xs text-[var(--color-fg-muted)]">404</div>
      <h1 className="mb-4 text-3xl font-bold sm:text-5xl">Not here.</h1>
      <p className="mb-8 max-w-md text-[var(--color-fg-muted)]">
        The page you were looking for doesn't exist (or hasn't shipped yet).
      </p>
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <Link
          href="/"
          className="rounded-md bg-[var(--color-accent)] px-5 py-2.5 font-semibold text-black hover:opacity-90"
        >
          Go home
        </Link>
        <Link
          href="/help"
          className="rounded-md border border-[var(--color-border)] px-5 py-2.5 hover:bg-[var(--color-surface)]"
        >
          Browse help
        </Link>
      </div>
    </main>
  );
}
