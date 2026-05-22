"use client";

import { useEffect, useState } from "react";

type Step = {
	id: string;
	target: "chat" | "preview" | "render";
	title: string;
	body: string;
};

const STEPS: Step[] = [
	{
		id: "chat",
		target: "chat",
		title: "1. Start with a prompt",
		body: "Click a sample prompt card or describe your video. The agent plans first, then asks you to approve before writing any code.",
	},
	{
		id: "preview",
		target: "preview",
		title: "2. Watch it build live",
		body: "When the agent writes the composition, this preview updates automatically. Press ⌘P to play / pause.",
	},
	{
		id: "render",
		target: "render",
		title: "3. Render to MP4",
		body: "Pick a preset and hit Render — or press ⌘R. Download the .mp4 from the renders page when it's done.",
	},
];

const TARGET_POSITIONS: Record<Step["target"], { x: string; y: string }> = {
	chat: { x: "left-[120px]", y: "top-[120px]" },
	preview: { x: "left-1/2 -translate-x-1/2", y: "top-[150px]" },
	render: { x: "right-[80px]", y: "bottom-[140px]" },
};

const HIGHLIGHTS: Record<Step["target"], string> = {
	chat: "left-0 top-12 w-[380px] bottom-0",
	preview: "left-[380px] top-12 right-[360px] bottom-[80px]",
	render: "left-[380px] right-[360px] bottom-0 h-[80px]",
};

export function EditorTour({ onDone }: { onDone: () => void }) {
	const [stepIndex, setStepIndex] = useState(0);
	const step = STEPS[stepIndex];

	useEffect(() => {
		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") finish();
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [stepIndex]);

	async function finish() {
		await fetch("/api/onboarding", {
			method: "PATCH",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ tourCompleted: true }),
		});
		onDone();
	}

	function next() {
		if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1);
		else finish();
	}

	const position = TARGET_POSITIONS[step.target];

	return (
		<div className="fixed inset-0 z-40 pointer-events-none">
			{/* Dim the whole screen */}
			<div className="absolute inset-0 bg-black/55" />

			{/* Highlight rectangle — punch out by reducing opacity */}
			<div
				className={`absolute ${HIGHLIGHTS[step.target]} rounded-lg ring-2 ring-[var(--color-accent)] shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] transition-all duration-300`}
			/>

			{/* Tooltip card */}
			<div
				className={`absolute ${position.x} ${position.y} pointer-events-auto w-[320px] rounded-xl border border-[var(--color-accent)] bg-[var(--color-surface)] p-4 shadow-2xl`}
			>
				<div className="mb-2 flex items-center justify-between">
					<span className="text-xs uppercase tracking-wider text-[var(--color-accent)]">
						Tour · {stepIndex + 1} / {STEPS.length}
					</span>
					<button
						onClick={finish}
						className="text-xs text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
					>
						Skip
					</button>
				</div>
				<h3 className="mb-1 text-base font-bold">{step.title}</h3>
				<p className="mb-4 text-sm text-[var(--color-fg-muted)]">
					{step.body}
				</p>
				<button
					onClick={next}
					className="w-full rounded-md bg-[var(--color-accent)] py-2 text-sm font-semibold text-black hover:opacity-90"
				>
					{stepIndex === STEPS.length - 1 ? "Got it" : "Next →"}
				</button>
			</div>
		</div>
	);
}
