"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";

type Created = { id: string; label: string; seedPrompt: string };

export default function BatchPage() {
	const router = useRouter();
	const { data: session, isPending } = useSession();
	const [basePrompt, setBasePrompt] = useState("");
	const [variants, setVariants] = useState(3);

	useEffect(() => {
		if (!isPending && !session) router.replace("/app/login");
	}, [isPending, session, router]);

	if (isPending || !session) return null;
	const [busy, setBusy] = useState(false);
	const [created, setCreated] = useState<Created[]>([]);
	const [error, setError] = useState<string | null>(null);

	async function generate() {
		if (!basePrompt.trim() || busy) return;
		setBusy(true);
		setError(null);
		setCreated([]);
		try {
			const response = await fetch("/api/projects/batch", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ basePrompt, variants }),
			});
			if (!response.ok) {
				setError(await response.text());
				return;
			}
			const data = (await response.json()) as { projects: Created[] };
			setCreated(data.projects || []);
		} catch (caught) {
			setError((caught as Error).message);
		} finally {
			setBusy(false);
		}
	}

	return (
		<main className="mx-auto max-w-3xl px-4 py-10">
			<header className="mb-8">
				<div className="mb-1 text-xs uppercase tracking-wider text-[var(--color-fg-muted)]">
					Channel batch mode
				</div>
				<h1 className="text-2xl font-bold sm:text-3xl">Generate variants in parallel</h1>
				<p className="mt-2 max-w-xl text-sm text-[var(--color-fg-muted)]">
					Write one brief. We fork it into 2–5 differently-styled projects
					(punchy, cinematic, maximalist, minimal, alt palette). Open each,
					approve the plan, render the winners.
				</p>
			</header>

			<section className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
				<label className="block">
					<div className="mb-1 text-sm font-medium">Base prompt</div>
					<textarea
						value={basePrompt}
						onChange={(event) => setBasePrompt(event.target.value)}
						rows={5}
						placeholder="e.g. 30s vertical comic-facts Short about a flying hero with a cape. Red + yellow palette, glass-crack on the title beat."
						className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-3 text-sm outline-none focus:border-[var(--color-accent)]"
					/>
				</label>

				<div className="flex flex-wrap items-end justify-between gap-4">
					<label className="block">
						<div className="mb-1 text-sm font-medium">Variants</div>
						<select
							value={variants}
							onChange={(event) => setVariants(Number(event.target.value))}
							className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1.5 text-sm"
						>
							{[2, 3, 4, 5].map((n) => (
								<option key={n} value={n}>
									{n}
								</option>
							))}
						</select>
					</label>
					<button
						onClick={generate}
						disabled={busy || !basePrompt.trim()}
						className="rounded-md bg-[var(--color-accent)] px-5 py-2 font-semibold text-black hover:opacity-90 disabled:opacity-50"
					>
						{busy ? "Generating…" : `Generate ${variants} variants`}
					</button>
				</div>

				{error && (
					<div className="rounded-md border border-[var(--color-danger)] bg-[var(--color-bg)] p-3 text-xs text-[var(--color-danger)]">
						{error}
					</div>
				)}
			</section>

			{created.length > 0 && (
				<section className="mt-8 space-y-3">
					<h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
						Created
					</h2>
					{created.map((project) => (
						<Link
							key={project.id}
							href={`/app/projects/${project.id}/edit`}
							className="block rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-accent)]"
						>
							<div className="mb-1 flex items-center justify-between">
								<span className="font-semibold">{project.label}</span>
								<span className="text-xs text-[var(--color-fg-muted)]">
									Open →
								</span>
							</div>
							<p className="line-clamp-2 text-xs text-[var(--color-fg-muted)]">
								{project.seedPrompt}
							</p>
						</Link>
					))}
				</section>
			)}
		</main>
	);
}
