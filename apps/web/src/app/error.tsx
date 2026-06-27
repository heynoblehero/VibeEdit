"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { captureException } from "@/lib/observability/sentry";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error, { boundary: "app/root", digest: error.digest });
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <Link href="/" className="mb-10">
        <Wordmark size="md" />
      </Link>
      <div className="mb-2 font-mono text-xs text-[var(--color-fg-muted)]">
        Something went wrong
      </div>
      <h1 className="mb-4 text-3xl font-bold sm:text-5xl">Our bad.</h1>
      <p className="mb-8 max-w-md text-[var(--color-fg-muted)]">
        This page hit an unexpected error. Try again, or head back home.
      </p>
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-[var(--color-accent)] px-5 py-2.5 font-semibold text-black hover:opacity-90"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-[var(--color-border)] px-5 py-2.5 hover:bg-[var(--color-surface)]"
        >
          Go home
        </Link>
      </div>
      {error.digest && (
        <p className="mt-6 font-mono text-[10px] text-[var(--color-fg-subtle)]">
          ref: {error.digest}
        </p>
      )}
    </main>
  );
}
