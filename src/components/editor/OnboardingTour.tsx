"use client";

import { Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useProjectStore } from "@/store/project-store";

interface Stop {
	title: string;
	body: string;
	cta?: string;
	target: { selector: string; placement: "right" | "below" | "above" };
}

const STOPS: Stop[] = [
	{
		title: "Describe your video here",
		body: "The agent reads your prompt, picks scenes, fills text, and stitches them together. You can chat back and forth — try 'make it more punchy' or 'replace scene 2 with a quote'.",
		cta: "Got it",
		target: { selector: "[data-onboard='chat-input']", placement: "above" },
	},
	{
		title: "Scenes appear here",
		body: "The agent's output lands as scenes in this list. Click a scene to edit it on the right; double-click to rename.",
		cta: "Next",
		target: { selector: "[data-onboard='scene-list']", placement: "right" },
	},
	{
		title: "Spacebar plays",
		body: "Hit Space anywhere to play/pause. Press ⌘K for the command palette, ? for the full shortcut list. Everything autosaves.",
		cta: "Start editing",
		target: { selector: "[data-onboard='preview']", placement: "below" },
	},
];

const DONE_KEY = "vibeedit-onboarding-done";

/**
 * Three-stop coach-mark tour for new users. Triggers when the active
 * project has zero scenes AND localStorage doesn't have the done flag.
 * Each stop anchors to a `data-onboard="..."` selector elsewhere in
 * the editor, falls back to a centered card if the target isn't
 * mounted (e.g. before scenes exist).
 */
export function OnboardingTour() {
	const project = useProjectStore((s) => s.project);
	const [step, setStep] = useState(0);
	const [done, setDone] = useState(true);
	const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

	useEffect(() => {
		try {
			if (localStorage.getItem(DONE_KEY) === "1") return;
		} catch {
			return;
		}
		// Only show on a brand-new project — not on every empty-state moment.
		if (project.scenes.length > 0) return;
		setDone(false);
	}, [project.scenes.length]);

	useEffect(() => {
		if (done) return;
		const stop = STOPS[step];
		if (!stop) return;
		const el = document.querySelector(stop.target.selector) as HTMLElement | null;
		if (!el) {
			setPos(null);
			return;
		}
		const r = el.getBoundingClientRect();
		const placement = stop.target.placement;
		const top =
			placement === "above"
				? Math.max(8, r.top - 140)
				: placement === "below"
					? r.bottom + 8
					: r.top;
		const left =
			placement === "right"
				? r.right + 12
				: Math.min(window.innerWidth - 320, Math.max(8, r.left));
		setPos({ top, left });
	}, [done, step]);

	if (done) return null;
	const stop = STOPS[step];
	if (!stop) return null;

	const finish = () => {
		try {
			localStorage.setItem(DONE_KEY, "1");
		} catch {
			// best-effort
		}
		setDone(true);
	};

	const next = () => {
		if (step >= STOPS.length - 1) finish();
		else setStep((s) => s + 1);
	};

	const card = (
		<div
			className="fixed z-[80] w-72 rounded-xl bg-neutral-900 border border-emerald-500/40 shadow-[0_24px_60px_rgba(0,0,0,0.65)] p-4 motion-pop"
			style={
				pos
					? { top: pos.top, left: pos.left }
					: { top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
			}
		>
			<div className="flex items-start justify-between gap-2 mb-1">
				<div className="flex items-center gap-1.5 text-emerald-300">
					<Sparkles className="h-3.5 w-3.5" />
					<span className="text-[10px] uppercase tracking-wider font-semibold">
						{step + 1} / {STOPS.length}
					</span>
				</div>
				<button
					type="button"
					onClick={finish}
					title="Skip"
					className="text-neutral-500 hover:text-white"
				>
					<X className="h-3 w-3" />
				</button>
			</div>
			<div className="text-[14px] font-semibold text-white mb-1">
				{stop.title}
			</div>
			<div className="text-[12px] text-neutral-300 leading-relaxed mb-3">
				{stop.body}
			</div>
			<div className="flex items-center justify-end gap-2">
				<button
					type="button"
					onClick={finish}
					className="text-[11px] text-neutral-500 hover:text-neutral-200"
				>
					Skip tour
				</button>
				<button
					type="button"
					onClick={next}
					className="text-[11px] font-semibold px-3 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-neutral-950"
				>
					{stop.cta ?? "Next"}
				</button>
			</div>
		</div>
	);

	return (
		<>
			{/* Soft backdrop so the user knows the tour overlays the editor. */}
			<div className="fixed inset-0 z-[70] bg-black/30 motion-fade pointer-events-none" />
			{card}
		</>
	);
}
