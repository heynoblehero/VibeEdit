"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Wordmark } from "@/components/Wordmark";

type Snippet = {
	id: string;
	label: string;
	sourceProjectId: string | null;
	createdAt: string;
	size: number;
};

export default function SnippetsPage() {
	const router = useRouter();
	const { data: session, isPending } = useSession();
	const [snippets, setSnippets] = useState<Snippet[]>([]);
	const [busy, setBusy] = useState<string | null>(null);

	useEffect(() => {
		if (!isPending && !session) router.replace("/app/login");
	}, [isPending, session, router]);

	async function refresh() {
		const response = await fetch("/api/snippets");
		if (!response.ok) return;
		const data = (await response.json()) as { snippets: Snippet[] };
		setSnippets(data.snippets || []);
	}

	useEffect(() => {
		if (session) refresh();
	}, [session]);

	async function fork(snippet: Snippet) {
		if (busy) return;
		setBusy(snippet.id);
		try {
			const response = await fetch(`/api/snippets/${snippet.id}/fork`, {
				method: "POST",
			});
			if (!response.ok) return;
			const data = (await response.json()) as { id: string };
			router.push(`/app/projects/${data.id}/edit`);
		} finally {
			setBusy(null);
		}
	}

	async function remove(snippet: Snippet) {
		if (!confirm(`Delete snippet "${snippet.label}"?`)) return;
		await fetch(`/api/snippets?id=${snippet.id}`, { method: "DELETE" });
		refresh();
	}

	if (isPending || !session) return null;

	return (
		<main className="mx-auto max-w-4xl p-4 sm:p-8">
			<header className="mb-8 flex flex-wrap items-center justify-between gap-3 sm:mb-10">
				<Link href="/app/projects">
					<Wordmark size="md" />
				</Link>
				<nav className="flex flex-wrap gap-3 text-sm">
					<Link
						href="/app/projects"
						className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
					>
						Projects
					</Link>
					<Link
						href="/app/snippets"
						className="text-[var(--color-accent)]"
					>
						Snippets
					</Link>
					<Link
						href="/app/templates"
						className="hidden text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] sm:inline"
					>
						Templates
					</Link>
				</nav>
			</header>

			<h1 className="mb-2 text-2xl font-bold sm:text-3xl">My snippets</h1>
			<p className="mb-8 max-w-2xl text-[var(--color-fg-muted)]">
				Save any project's composition as a personal starter. Fork it into a
				fresh project anytime — useful for outros, brand intros, or hook
				structures you reuse weekly.
			</p>

			{snippets.length === 0 ? (
				<div className="rounded-lg border border-dashed border-[var(--color-border)] p-8 text-center text-[var(--color-fg-muted)]">
					No snippets yet. Open a project and click <em>★ Save as snippet</em>.
				</div>
			) : (
				<ul className="space-y-3">
					{snippets.map((snippet) => (
						<li
							key={snippet.id}
							className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:flex-nowrap sm:gap-4"
						>
							<div className="min-w-0 flex-1">
								<div className="truncate font-semibold">
									{snippet.label}
								</div>
								<div className="text-xs text-[var(--color-fg-muted)]">
									{new Date(snippet.createdAt).toLocaleString()} ·{" "}
									{Math.round(snippet.size / 1024)}KB
								</div>
							</div>
							<button
								onClick={() => fork(snippet)}
								disabled={busy === snippet.id}
								className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
							>
								{busy === snippet.id ? "forking…" : "Fork into project"}
							</button>
							<button
								onClick={() => remove(snippet)}
								className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-danger)]"
							>
								delete
							</button>
						</li>
					))}
				</ul>
			)}
		</main>
	);
}
