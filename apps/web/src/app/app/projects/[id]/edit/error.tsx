"use client";

import { useEffect } from "react";
import Link from "next/link";
import { captureException } from "@/lib/observability/sentry";

export default function EditorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error, { boundary: "app/app/projects/[id]/edit", digest: error.digest });
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--color-bg)] px-4 py-16 text-center sm:px-6">
      <div className="mb-2 font-mono text-xs text-[var(--color-fg-muted)]">Editor error</div>
      <h1 className="mb-3 text-2xl font-bold sm:text-3xl">The editor couldn't load.</h1>
      <p className="mb-8 max-w-md text-sm text-[var(--color-fg-muted)]">
        Your project is safe — its files and render history are stored on our servers. Reload the
        editor to pick up where you left off.
      </p>
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-[var(--color-accent)] px-5 py-2.5 font-semibold text-black hover:opacity-90"
        >
          Reload editor
        </button>
        <Link
          href="/app"
          className="rounded-md border border-[var(--color-border)] px-5 py-2.5 hover:bg-[var(--color-surface)]"
        >
          Back to dashboard
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
