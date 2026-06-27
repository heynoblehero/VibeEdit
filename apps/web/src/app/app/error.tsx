"use client";

import { useEffect } from "react";
import Link from "next/link";
import { captureException } from "@/lib/observability/sentry";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error, { boundary: "app/app", digest: error.digest });
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <div className="mb-2 font-mono text-xs text-[var(--color-fg-muted)]">Something broke</div>
      <h1 className="mb-3 text-2xl font-bold sm:text-3xl">This view hit an error.</h1>
      <p className="mb-8 max-w-md text-sm text-[var(--color-fg-muted)]">
        It's not you — something on our end failed to load. You can try again, or head back to your
        dashboard.
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
