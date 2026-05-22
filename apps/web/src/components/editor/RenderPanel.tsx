"use client";

import { useEffect, useRef, useState } from "react";
import { getMe, type PlanId } from "@/lib/billing/me-client";

type Job = {
	id: string;
	status: "queued" | "running" | "done" | "failed";
	progress: number;
	outputPath: string | null;
	error: string | null;
	createdAt: string;
	startedAt?: string | null;
};

type Preset = {
	label: string;
	sublabel: string;
	fps: number;
	quality: "draft" | "standard" | "high";
	requiresPlan?: "creator" | "studio";
};

// Ordered so the most common pick (YouTube 1080p) is the default.
const PRESETS: Preset[] = [
	{
		label: "YouTube",
		sublabel: "1080p · 30fps · MP4",
		fps: 30,
		quality: "standard",
	},
	{
		label: "Shorts / TikTok / Reels",
		sublabel: "1080×1920 · 30fps",
		fps: 30,
		quality: "standard",
	},
	{
		label: "Draft",
		sublabel: "fast, low quality",
		fps: 24,
		quality: "draft",
	},
	{
		label: "High quality",
		sublabel: "60fps",
		fps: 60,
		quality: "high",
	},
	{
		label: "4K",
		sublabel: "30fps — Studio plan",
		fps: 30,
		quality: "high",
		requiresPlan: "studio",
	},
];

export function RenderPanel({ projectId }: { projectId: string }) {
	const [jobs, setJobs] = useState<Job[]>([]);
	const [submitting, setSubmitting] = useState(false);
	const [presetIndex, setPresetIndex] = useState(0);
	const [planId, setPlanId] = useState<PlanId>("free");
	const [menuOpen, setMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		let cancelled = false;
		getMe().then((data) => {
			if (cancelled || !data) return;
			setPlanId(data.plan.id);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	async function refresh() {
		const r = await fetch(`/api/render?projectId=${projectId}`);
		if (!r.ok) return;
		const j = (await r.json()) as { jobs: Job[] };
		setJobs(j.jobs);
	}

	useEffect(() => {
		refresh();
	}, [projectId]);

	const activeJobId = jobs.find(
		(j) => j.status === "queued" || j.status === "running",
	)?.id;

	useEffect(() => {
		if (!activeJobId) return;
		const source = new EventSource(`/api/render/${activeJobId}/stream`);
		source.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data) as Partial<Job>;
				setJobs((prev) =>
					prev.map((j) => (j.id === activeJobId ? { ...j, ...data } : j)),
				);
				if (data.status === "done" || data.status === "failed") {
					source.close();
					refresh();
				}
			} catch {
				/* */
			}
		};
		source.onerror = () => source.close();
		return () => source.close();
	}, [activeJobId]);

	// Close the dropdown on outside click / ESC.
	useEffect(() => {
		if (!menuOpen) return;
		function onPointer(event: MouseEvent) {
			if (!menuRef.current?.contains(event.target as Node))
				setMenuOpen(false);
		}
		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") setMenuOpen(false);
		}
		window.addEventListener("mousedown", onPointer);
		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener("mousedown", onPointer);
			window.removeEventListener("keydown", onKey);
		};
	}, [menuOpen]);

	async function startRender(index = presetIndex) {
		const preset = PRESETS[index];
		setSubmitting(true);
		await fetch("/api/render", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				projectId,
				fps: preset.fps,
				quality: preset.quality,
			}),
		});
		setSubmitting(false);
		setMenuOpen(false);
		refresh();
	}

	// Cmd+R global shortcut
	useEffect(() => {
		function onRender() {
			if (!submitting) startRender(presetIndex);
		}
		window.addEventListener("vibeedit:render", onRender);
		return () => window.removeEventListener("vibeedit:render", onRender);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [submitting, presetIndex, projectId]);

	function planMeets(
		current: "free" | "creator" | "studio",
		required: "creator" | "studio",
	): boolean {
		const order = { free: 0, creator: 1, studio: 2 } as const;
		return order[current] >= order[required];
	}

	const latest = jobs[0];
	const activePreset = PRESETS[presetIndex];

	return (
		<div className="flex flex-wrap items-center gap-2 text-sm">
			{/* Live job status. Sits BEFORE the render button so the progress bar
			    grows out of the action area. */}
			{latest && latest.status === "running" && (
				<div className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-2.5 py-1.5">
					<span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-accent)]" />
					<span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
						rendering
					</span>
					<div
						className="relative h-1.5 w-28 overflow-hidden rounded-full bg-[var(--color-border)]"
						role="progressbar"
						aria-valuemin={0}
						aria-valuemax={100}
						aria-valuenow={Math.round(latest.progress * 100)}
					>
						<div
							className="h-full rounded-full bg-[var(--color-accent)] transition-[width] duration-300"
							style={{
								width: `${Math.max(2, Math.round(latest.progress * 100))}%`,
							}}
						/>
					</div>
					<span className="font-mono text-[10px] tabular-nums text-[var(--color-fg-muted)]">
						{Math.round(latest.progress * 100)}%
					</span>
					<EtaInline job={latest} />
				</div>
			)}
			{latest && latest.status === "queued" && (
				<span className="text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">
					queued…
				</span>
			)}
			{latest && latest.status === "done" && latest.outputPath && (
				<a
					href={`/api/render/${latest.id}/download`}
					className="rounded-md border border-[var(--color-success)] bg-[var(--color-success)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--color-success)] hover:bg-[var(--color-success)]/20"
				>
					↓ Download .mp4
				</a>
			)}
			{latest && latest.status === "failed" && (
				<span
					className="max-w-[14ch] truncate text-xs text-[var(--color-danger)]"
					title={latest.error || ""}
				>
					✕ {latest.error}
				</span>
			)}

			{/* Render button — split into "Render" + caret to show presets. */}
			<div ref={menuRef} className="relative inline-flex">
				<button
					onClick={() => startRender(presetIndex)}
					disabled={submitting}
					className="flex items-center gap-2 rounded-l-md bg-[var(--color-accent)] px-3 py-1.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
					title={`Render with ${activePreset.label} (⌘R)`}
				>
					{submitting ? (
						<>Queuing…</>
					) : (
						<>
							▶ Render
							<span className="hidden text-[10px] font-normal opacity-70 sm:inline">
								· {activePreset.label}
							</span>
						</>
					)}
				</button>
				<button
					onClick={() => setMenuOpen((v) => !v)}
					disabled={submitting}
					aria-label="Choose render preset"
					className="rounded-r-md border-l border-black/15 bg-[var(--color-accent)] px-2 py-1.5 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
				>
					▾
				</button>
				{menuOpen && (
					<div className="absolute right-0 top-full z-40 mt-1 w-72 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
						<div className="border-b border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--color-fg-muted)]">
							Render preset
						</div>
						<ul className="py-1">
							{PRESETS.map((preset, index) => {
								const locked =
									preset.requiresPlan && !planMeets(planId, preset.requiresPlan);
								const isActive = presetIndex === index;
								return (
									<li key={preset.label}>
										<button
											onClick={() => {
												if (locked) return;
												setPresetIndex(index);
												startRender(index);
											}}
											disabled={!!locked}
											className={`flex w-full items-start justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--color-bg-2)] disabled:cursor-not-allowed disabled:opacity-50 ${
												isActive ? "bg-[var(--color-bg-2)]" : ""
											}`}
										>
											<div className="min-w-0">
												<div className="flex items-center gap-1.5 font-medium text-[var(--color-fg)]">
													{isActive && (
														<span className="text-[var(--color-accent)]">
															●
														</span>
													)}
													{preset.label}
													{locked && (
														<span className="rounded bg-[var(--color-border)] px-1.5 py-0.5 text-[9px] uppercase text-[var(--color-fg-muted)]">
															Upgrade
														</span>
													)}
												</div>
												<div className="mt-0.5 text-[11px] text-[var(--color-fg-muted)]">
													{preset.sublabel}
												</div>
											</div>
										</button>
									</li>
								);
							})}
						</ul>
					</div>
				)}
			</div>
		</div>
	);
}

function EtaInline({ job }: { job: Job }) {
	const [, tick] = useState(0);
	useEffect(() => {
		const id = setInterval(() => tick((n) => n + 1), 1000);
		return () => clearInterval(id);
	}, []);
	if (job.progress <= 0.05) return null;
	const startMs = new Date(job.startedAt || job.createdAt).getTime();
	const elapsed = Math.max(0, Date.now() - startMs) / 1000;
	const remaining = (elapsed * (1 - job.progress)) / job.progress;
	if (!Number.isFinite(remaining) || remaining <= 0) return null;
	const label =
		remaining < 60
			? `~${Math.ceil(remaining)}s`
			: `~${Math.ceil(remaining / 60)}m`;
	return (
		<span
			className="font-mono text-[10px] text-[var(--color-fg-muted)]"
			title={`${(job.progress * 100).toFixed(0)}% · elapsed ${Math.round(elapsed)}s`}
		>
			{label}
		</span>
	);
}
