"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Wordmark } from "@/components/Wordmark";

type Template = {
	slug: string;
	name: string;
	niche: string;
	ratio: "16:9" | "9:16";
	durationSeconds: number;
	description: string;
	accent: string;
};

export default function TemplatesPage() {
	const router = useRouter();
	const { data: session, isPending } = useSession();
	const [templates, setTemplates] = useState<Template[]>([]);
	const [creating, setCreating] = useState<string | null>(null);
	const [filter, setFilter] = useState<"all" | "16:9" | "9:16">("all");

	useEffect(() => {
		if (!isPending && !session) router.replace("/app/login");
	}, [isPending, session, router]);

	useEffect(() => {
		fetch("/api/templates")
			.then((r) => r.json())
			.then((j) => setTemplates(j.templates || []));
	}, []);

	async function startFrom(slug: string) {
		setCreating(slug);
		const result = await fetch("/api/projects", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ template: slug }),
		});
		setCreating(null);
		if (!result.ok) return;
		const { id } = (await result.json()) as { id: string };
		router.push(`/app/projects/${id}/edit`);
	}

	if (isPending || !session) {
		return (
			<main className="flex min-h-screen items-center justify-center text-[var(--color-fg-muted)]">
				Loading...
			</main>
		);
	}

	const visible =
		filter === "all" ? templates : templates.filter((t) => t.ratio === filter);

	return (
		<main className="mx-auto max-w-6xl p-4 sm:p-8">
			<header className="mb-8 flex flex-wrap items-center justify-between gap-3 sm:mb-10">
				<Wordmark size="md" />
				<nav className="flex flex-wrap gap-3 text-sm">
					<Link
						href="/app/projects"
						className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
					>
						Projects
					</Link>
					<Link
						href="/app/templates"
						className="text-[var(--color-accent)]"
					>
						Templates
					</Link>
				</nav>
			</header>

			<h1 className="mb-3 text-2xl font-bold sm:text-3xl">Templates</h1>
			<p className="mb-8 max-w-2xl text-[var(--color-fg-muted)]">
				Fork a starter and chat-edit your way to a finished video. Every
				template is a real composition — open it and prompt the agent for
				changes.
			</p>

			<div className="mb-8 flex gap-2 text-sm">
				{(["all", "16:9", "9:16"] as const).map((value) => (
					<button
						key={value}
						onClick={() => setFilter(value)}
						className={`rounded-md px-3 py-1 ${
							filter === value
								? "bg-[var(--color-accent)] text-black"
								: "border border-[var(--color-border)] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface)]"
						}`}
					>
						{value === "all" ? "All formats" : value}
					</button>
				))}
			</div>

			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
				{visible.map((t) => (
					<TemplateCard
						key={t.slug}
						template={t}
						creating={creating === t.slug}
						onStart={() => startFrom(t.slug)}
					/>
				))}
			</div>
		</main>
	);
}

function TemplateCard({
	template,
	creating,
	onStart,
}: {
	template: Template;
	creating: boolean;
	onStart: () => void;
}) {
	const isVertical = template.ratio === "9:16";
	return (
		<div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
			<div
				className={`flex w-full items-center justify-center ${
					isVertical ? "h-72" : "h-44"
				}`}
				style={{
					background: `linear-gradient(135deg, ${template.accent}26 0%, ${template.accent}05 100%)`,
				}}
			>
				<div
					className="font-black uppercase tracking-tight text-[var(--color-fg)]"
					style={{
						fontSize: isVertical ? 48 : 56,
						color: template.accent,
						textShadow: `0 0 24px ${template.accent}55`,
					}}
				>
					{template.ratio}
				</div>
			</div>
			<div className="p-4">
				<div className="mb-1 flex items-center justify-between">
					<h3 className="font-bold">{template.name}</h3>
					<span className="text-xs text-[var(--color-fg-muted)]">
						{template.durationSeconds}s
					</span>
				</div>
				<p className="mb-3 text-xs text-[var(--color-fg-muted)]">
					{template.niche}
				</p>
				<p className="mb-4 line-clamp-3 text-sm text-[var(--color-fg-muted)]">
					{template.description}
				</p>
				<button
					onClick={onStart}
					disabled={creating}
					className="w-full rounded-md bg-[var(--color-accent)] py-2 font-semibold text-black hover:opacity-90 disabled:opacity-50"
				>
					{creating ? "Creating..." : "Start from this"}
				</button>
			</div>
		</div>
	);
}
