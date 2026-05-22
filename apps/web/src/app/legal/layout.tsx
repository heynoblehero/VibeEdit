import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
	return (
		<>
			<header className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 p-4 sm:p-6">
				<Link href="/">
					<Wordmark size="md" />
				</Link>
				<nav className="flex flex-wrap gap-3 text-sm">
					<Link
						href="/legal/terms"
						className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
					>
						Terms
					</Link>
					<Link
						href="/legal/privacy"
						className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
					>
						Privacy
					</Link>
					<Link
						href="/legal/refunds"
						className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
					>
						Refunds
					</Link>
				</nav>
			</header>
			<main className="mx-auto max-w-3xl px-4 py-8 leading-relaxed text-[var(--color-fg)] sm:px-6 sm:py-12">
				<article className="prose prose-invert max-w-none break-words">{children}</article>
			</main>
		</>
	);
}
