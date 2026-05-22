"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Hit =
	| {
			kind: "project";
			projectId: string;
			projectName: string;
			updatedAt: number;
	  }
	| {
			kind: "message";
			projectId: string;
			projectName: string;
			snippet: string;
			role: string;
			createdAt: number;
	  };

export function CommandPalette() {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [hits, setHits] = useState<Hit[]>([]);
	const [activeIndex, setActiveIndex] = useState(0);
	const [loading, setLoading] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		function onKey(event: KeyboardEvent) {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setOpen((value) => !value);
				return;
			}
			if (event.key === "Escape" && open) {
				event.preventDefault();
				setOpen(false);
			}
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open]);

	useEffect(() => {
		if (!open) {
			setQuery("");
			setHits([]);
			setActiveIndex(0);
			return;
		}
		setTimeout(() => inputRef.current?.focus(), 0);
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const term = query.trim();
		if (!term) {
			setHits([]);
			return;
		}
		setLoading(true);
		const controller = new AbortController();
		const handle = setTimeout(() => {
			fetch(`/api/search?q=${encodeURIComponent(term)}`, {
				signal: controller.signal,
			})
				.then((response) => (response.ok ? response.json() : { hits: [] }))
				.then((data) => {
					setHits(Array.isArray(data?.hits) ? data.hits : []);
					setActiveIndex(0);
				})
				.catch(() => {
					/* aborted or network */
				})
				.finally(() => setLoading(false));
		}, 140);
		return () => {
			clearTimeout(handle);
			controller.abort();
		};
	}, [query, open]);

	function pick(hit: Hit) {
		setOpen(false);
		router.push(`/app/projects/${hit.projectId}/edit`);
	}

	function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setActiveIndex((i) => Math.min(hits.length - 1, i + 1));
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setActiveIndex((i) => Math.max(0, i - 1));
		} else if (event.key === "Enter") {
			event.preventDefault();
			const hit = hits[activeIndex];
			if (hit) pick(hit);
		}
	}

	if (!open) return null;

	return (
		<div
			onClick={() => setOpen(false)}
			className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm"
		>
			<div
				onClick={(event) => event.stopPropagation()}
				className="w-full max-w-xl overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
			>
				<div className="flex items-center gap-2 border-b border-[var(--color-border)] px-3 py-2">
					<span className="text-sm text-[var(--color-fg-muted)]">⌘K</span>
					<input
						ref={inputRef}
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						onKeyDown={onKeyDown}
						placeholder="Search projects + chats…"
						className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--color-fg-muted)]"
					/>
					{loading && (
						<span className="text-xs text-[var(--color-fg-muted)]">…</span>
					)}
				</div>
				<div className="max-h-[50vh] overflow-y-auto">
					{hits.length === 0 && query.trim() && !loading && (
						<div className="px-4 py-6 text-center text-xs text-[var(--color-fg-muted)]">
							No matches for &quot;{query}&quot;
						</div>
					)}
					{hits.length === 0 && !query.trim() && (
						<div className="px-4 py-6 text-center text-xs text-[var(--color-fg-muted)]">
							Type to search project names and chat history. ↑↓ to move,
							Enter to open.
						</div>
					)}
					<ul>
						{hits.map((hit, index) => (
							<li key={hitKey(hit, index)}>
								<button
									onClick={() => pick(hit)}
									onMouseEnter={() => setActiveIndex(index)}
									className={`flex w-full items-start gap-3 px-3 py-2.5 text-left ${
										index === activeIndex
											? "bg-[var(--color-bg-2)]"
											: "hover:bg-[var(--color-bg-2)]"
									}`}
								>
									<span className="mt-0.5 rounded bg-[var(--color-bg)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-accent)]">
										{hit.kind === "project" ? "PROJ" : "CHAT"}
									</span>
									<span className="min-w-0 flex-1">
										<span className="block truncate text-sm font-medium text-[var(--color-fg)]">
											{hit.projectName}
										</span>
										{hit.kind === "message" && (
											<span className="block truncate text-xs text-[var(--color-fg-muted)]">
												{hit.role}: {hit.snippet}
											</span>
										)}
										{hit.kind === "project" && (
											<span className="block truncate text-xs text-[var(--color-fg-muted)]">
												Updated {timeAgo(hit.updatedAt)}
											</span>
										)}
									</span>
								</button>
							</li>
						))}
					</ul>
				</div>
				<div className="border-t border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1.5 text-[10px] text-[var(--color-fg-muted)]">
					↑↓ navigate · Enter open · Esc close
				</div>
			</div>
		</div>
	);
}

function hitKey(hit: Hit, index: number): string {
	if (hit.kind === "project") return `p:${hit.projectId}:${index}`;
	return `m:${hit.projectId}:${hit.createdAt}:${index}`;
}

function timeAgo(ts: number): string {
	const seconds = Math.max(0, Math.floor((Date.now() - ts) / 1000));
	if (seconds < 60) return `${seconds}s ago`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	return `${Math.floor(hours / 24)}d ago`;
}
