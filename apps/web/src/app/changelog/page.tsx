import Link from "next/link";
import { CHANGELOG } from "@/lib/changelog";
import { Wordmark } from "@/components/Wordmark";

export default function ChangelogPage() {
	return (
		<main className="mx-auto max-w-3xl p-4 sm:p-8">
			<header className="mb-8 flex items-center justify-between sm:mb-10">
				<Link href="/">
					<Wordmark size="md" />
				</Link>
				<nav className="flex gap-3 text-sm">
					<Link
						href="/help"
						className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
					>
						Help
					</Link>
					<Link
						href="/status"
						className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
					>
						Status
					</Link>
				</nav>
			</header>
			<h1 className="mb-2 text-2xl font-bold sm:text-3xl">Changelog</h1>
			<p className="mb-8 text-[var(--color-fg-muted)] sm:mb-10">
				What's shipped, in reverse chronological order.
			</p>
			<ol className="space-y-6 sm:space-y-8">
				{CHANGELOG.map((entry) => (
					<li
						key={entry.version}
						className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6"
					>
						<div className="mb-3 flex items-center gap-3">
							<span className="rounded bg-[var(--color-accent)] px-2 py-0.5 text-xs font-semibold text-black">
								v{entry.version}
							</span>
							<span className="text-xs text-[var(--color-fg-muted)]">
								{entry.date}
							</span>
						</div>
						<ul className="space-y-2 text-sm">
							{entry.highlights.map((h, i) => (
								<li key={i} className="flex gap-2">
									<span className="text-[var(--color-accent)]">→</span>
									<span>{h}</span>
								</li>
							))}
						</ul>
					</li>
				))}
			</ol>
		</main>
	);
}
