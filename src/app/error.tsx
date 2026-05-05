"use client";

import Link from "next/link";
import { useEffect } from "react";

interface Props {
	error: Error & { digest?: string };
	reset: () => void;
}

/**
 * Top-level uncaught-error boundary for the App Router. Catches
 * anything not handled by the per-workspace boundary so the user
 * still sees a recoverable surface instead of a blank screen.
 *
 * Posts to /api/log/client-error best-effort so we can correlate
 * silent crashes with sessions; failures here are swallowed.
 */
export default function GlobalError({ error, reset }: Props) {
	useEffect(() => {
		// Best-effort report; never block the UI on this.
		fetch("/api/log/client-error", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				message: error.message,
				stack: error.stack,
				digest: error.digest,
				url: typeof window !== "undefined" ? window.location.href : null,
			}),
		}).catch(() => {});
	}, [error]);

	return (
		<main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100 px-6">
			<div className="max-w-md w-full rounded-xl border border-red-500/30 bg-neutral-900/80 p-5 space-y-3">
				<h1 className="text-lg font-semibold text-red-300">Something broke</h1>
				<p className="text-[13px] text-neutral-300 leading-relaxed">
					An unhandled error reached the top of the app. Your project is safe in
					localStorage — try the recovery options below.
				</p>
				<details className="text-[11px] text-neutral-500 font-mono">
					<summary className="cursor-pointer hover:text-neutral-300">
						Stack trace
					</summary>
					<pre className="mt-2 p-2 rounded bg-neutral-950 border border-neutral-800 overflow-auto max-h-48 whitespace-pre-wrap break-all">
						{error.message}
						{"\n\n"}
						{error.stack}
					</pre>
				</details>
				<div className="flex items-center gap-2 pt-1">
					<button
						type="button"
						onClick={reset}
						className="px-3 py-1.5 rounded bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-[13px] font-semibold"
					>
						Try again
					</button>
					<Link
						href="/dashboard"
						className="px-3 py-1.5 rounded text-neutral-300 hover:bg-neutral-800 text-[13px]"
					>
						Back to dashboard
					</Link>
				</div>
			</div>
		</main>
	);
}
