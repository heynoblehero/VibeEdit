"use client";

import { Scissors } from "lucide-react";
import { useState } from "react";
import type { Cut, CutKind, Easing, Scene } from "@/lib/scene-schema";
import { useProjectStore } from "@/store/project-store";
import { EasingGraph } from "./EasingGraph";
import { PropertyModal } from "./PropertyModal";

/**
 * Animated, focused modal for editing a cut between two scenes. Same
 * visual pattern as the Look & Key / Animate modals so the editor feels
 * cohesive: pick a CUT type, dial in the timeline (duration + audio
 * offsets), pick an animation curve. Live preview not included — cuts
 * play back via the main canvas, not a mini renderer.
 */

const CUT_GROUPS: { label: string; kinds: { id: CutKind; label: string; hint?: string }[] }[] = [
	{
		label: "Hard cuts",
		kinds: [
			{ id: "hard", label: "Hard", hint: "instant" },
			{ id: "jump_cut", label: "Jump cut", hint: "stutter" },
			{ id: "smash_cut", label: "Smash cut", hint: "color flash" },
			{ id: "match_cut", label: "Match cut" },
		],
	},
	{
		label: "Fades & dips",
		kinds: [
			{ id: "fade", label: "Fade", hint: "cross-dissolve" },
			{ id: "dip_to_black", label: "Dip → black" },
			{ id: "dip_to_white", label: "Dip → white" },
			{ id: "beat_flash", label: "Beat flash" },
			{ id: "beat_flash_colored", label: "Color flash" },
		],
	},
	{
		label: "Motion",
		kinds: [
			{ id: "slide_left", label: "Slide ←" },
			{ id: "slide_right", label: "Slide →" },
			{ id: "whip_pan", label: "Whip pan" },
			{ id: "zoom_blur", label: "Zoom blur" },
		],
	},
	{
		label: "Reveals",
		kinds: [
			{ id: "iris", label: "Iris" },
			{ id: "clock_wipe", label: "Clock wipe" },
			{ id: "wipe", label: "Wipe" },
			{ id: "flip", label: "Flip" },
			{ id: "glitch_cut", label: "Glitch" },
		],
	},
];

const EASING_OPTIONS: Easing[] = [
	"linear",
	"ease_in",
	"ease_out",
	"ease_in_out",
	"ease_in_back",
	"ease_out_back",
	"ease_in_out_back",
	"spring",
	"snappy",
	"bouncy",
	"custom",
];

const KINDS_WITH_COLOR = new Set<CutKind>([
	"beat_flash_colored",
	"dip_to_black",
	"dip_to_white",
	"smash_cut",
]);

interface CutModalProps {
	open: boolean;
	onClose: () => void;
	cut: Cut;
	fromScene: Scene;
	toScene: Scene;
}

export function CutModal({ open, onClose, cut, fromScene, toScene }: CutModalProps) {
	const upsertCut = useProjectStore((s) => s.upsertCut);
	const fps = useProjectStore((s) => s.project.fps);
	const [tab, setTab] = useState<"kind" | "timing">("kind");

	const update = (patch: Partial<Cut>) => {
		const next: Cut = {
			...cut,
			...patch,
			kind: patch.kind ?? cut.kind,
			durationFrames: Math.max(0, Math.round(patch.durationFrames ?? cut.durationFrames)),
		};
		// Drop fields that don't apply to the current kind.
		if (!KINDS_WITH_COLOR.has(next.kind)) next.color = undefined;
		upsertCut(next);
	};

	const fromIdx = useProjectStore((s) =>
		s.project.scenes.findIndex((sc) => sc.id === fromScene.id),
	);
	const toIdx = useProjectStore((s) =>
		s.project.scenes.findIndex((sc) => sc.id === toScene.id),
	);

	return (
		<PropertyModal
			open={open}
			onClose={onClose}
			title="Cut & transition"
			subtitle={`Scene ${fromIdx + 1} → ${toIdx + 1} · ${cut.kind.replace(/_/g, " ")} · ${cut.durationFrames}f (${(cut.durationFrames / fps).toFixed(2)}s)`}
			accent="emerald"
			width="wide"
		>
			<div className="flex gap-1 p-0.5 rounded-md bg-neutral-950 border border-neutral-800">
				{(
					[
						["kind", "Cut style"],
						["timing", "Timing & curve"],
					] as const
				).map(([id, label]) => (
					<button
						key={id}
						type="button"
						onClick={() => setTab(id)}
						className={`flex-1 text-[11px] px-2 py-1.5 rounded transition-colors ${
							tab === id
								? "bg-emerald-500/15 text-emerald-200"
								: "text-neutral-500 hover:text-white"
						}`}
					>
						{label}
					</button>
				))}
			</div>

			{tab === "kind" && (
				<div className="space-y-3">
					{CUT_GROUPS.map((group) => (
						<div key={group.label}>
							<div className="text-[9px] uppercase tracking-wider text-neutral-500 mb-1.5">
								{group.label}
							</div>
							<div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
								{group.kinds.map((k) => {
									const active = cut.kind === k.id;
									return (
										<button
											key={k.id}
											type="button"
											onClick={() => update({ kind: k.id })}
											className={`text-left px-2 py-1.5 rounded-md border transition-colors ${
												active
													? "border-emerald-500 bg-emerald-500/15 text-emerald-200"
													: "border-neutral-700 text-neutral-300 hover:border-neutral-500 hover:bg-neutral-900"
											}`}
										>
											<div className="flex items-center gap-1.5">
												<Scissors className="h-3 w-3 shrink-0" />
												<span className="text-[11px] font-semibold truncate">
													{k.label}
												</span>
											</div>
											{k.hint && (
												<div className="text-[9px] text-neutral-500 ml-4">{k.hint}</div>
											)}
										</button>
									);
								})}
							</div>
						</div>
					))}

					{KINDS_WITH_COLOR.has(cut.kind) && (
						<div className="rounded-md border border-neutral-700 bg-neutral-950/40 p-3 space-y-2">
							<div className="text-[10px] uppercase tracking-wider text-neutral-500">
								Flash / dip color
							</div>
							<div className="flex items-center gap-2">
								<input
									type="color"
									value={cut.color ?? "#10b981"}
									onChange={(e) => update({ color: e.target.value })}
									className="h-9 w-12 rounded cursor-pointer bg-transparent border border-neutral-700"
								/>
								<span className="text-[11px] text-neutral-300 font-mono">
									{cut.color ?? "#10b981"}
								</span>
							</div>
						</div>
					)}
				</div>
			)}

			{tab === "timing" && (
				<div className="space-y-4">
					<div className="space-y-1">
						<div className="flex items-baseline justify-between">
							<label className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
								Duration
							</label>
							<span className="text-[10px] font-mono text-neutral-400 tabular-nums">
								{cut.durationFrames}f · {(cut.durationFrames / fps).toFixed(2)}s
							</span>
						</div>
						<input
							type="range"
							min={0}
							max={120}
							step={1}
							value={cut.durationFrames}
							onChange={(e) => update({ durationFrames: Number(e.target.value) })}
							className="w-full accent-emerald-500 h-1.5"
						/>
						<div className="flex items-center gap-1 text-[10px] text-neutral-500">
							<span>Quick:</span>
							{[0, 6, 12, 24, 36, 60].map((f) => (
								<button
									key={f}
									type="button"
									onClick={() => update({ durationFrames: f })}
									className={`px-1.5 py-0.5 rounded text-[10px] ${
										cut.durationFrames === f
											? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/50"
											: "border border-neutral-800 text-neutral-400 hover:border-neutral-600"
									}`}
								>
									{f}f
								</button>
							))}
						</div>
					</div>

					<div className="space-y-2">
						<label className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">
							Easing curve · drag the dots to reshape
						</label>
						<div className="flex items-start gap-3">
							<EasingGraph
								easing={cut.easing}
								bezier={cut.bezier}
								onChange={(next) => update({ easing: next.easing, bezier: next.bezier })}
								accent="rgb(110 231 183)"
							/>
							<div className="flex-1 space-y-1.5">
								<select
									value={cut.easing ?? "ease_in_out"}
									onChange={(e) => {
										const value = e.target.value as Easing;
										// Picking a named easing clears any custom bezier we
										// were storing — the graph re-derives from EASING_CURVE.
										update({
											easing: value,
											bezier: value === "custom" ? cut.bezier : undefined,
										});
									}}
									className="w-full text-xs px-2 py-1.5 rounded bg-neutral-950 border border-neutral-700 text-neutral-200 focus:border-emerald-400 focus:outline-none"
								>
									{EASING_OPTIONS.map((e) => (
										<option key={e} value={e}>
											{e.replace(/_/g, "-")}
										</option>
									))}
								</select>
								{cut.easing === "custom" && (
									<button
										type="button"
										onClick={() =>
											update({ easing: "ease_in_out", bezier: undefined })
										}
										className="text-[10px] text-neutral-500 hover:text-white px-1.5 py-0.5 rounded border border-neutral-800 hover:border-neutral-600"
									>
										Reset to ease-in-out
									</button>
								)}
								<div className="text-[9px] text-neutral-600">
									Curve maps cut progress 0→1. Y past the dashed lines = overshoot
									(bouncy / back).
								</div>
							</div>
						</div>
					</div>

					<div className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3 space-y-3">
						<div className="text-[10px] uppercase tracking-wider text-neutral-500">
							Audio offsets (J / L cuts)
						</div>
						<div className="space-y-1">
							<div className="flex items-baseline justify-between">
								<label className="text-[9px] uppercase tracking-wider text-neutral-600">
									J · lead-in (audio starts before cut)
								</label>
								<span className="text-[10px] font-mono text-neutral-500 tabular-nums">
									{cut.audioLeadFrames ?? 0}f
								</span>
							</div>
							<input
								type="range"
								min={0}
								max={60}
								step={1}
								value={cut.audioLeadFrames ?? 0}
								onChange={(e) =>
									update({
										audioLeadFrames:
											Number(e.target.value) > 0 ? Number(e.target.value) : undefined,
									})
								}
								className="w-full accent-amber-500 h-1.5"
							/>
						</div>
						<div className="space-y-1">
							<div className="flex items-baseline justify-between">
								<label className="text-[9px] uppercase tracking-wider text-neutral-600">
									L · trail-out (audio continues after cut)
								</label>
								<span className="text-[10px] font-mono text-neutral-500 tabular-nums">
									{cut.audioTrailFrames ?? 0}f
								</span>
							</div>
							<input
								type="range"
								min={0}
								max={60}
								step={1}
								value={cut.audioTrailFrames ?? 0}
								onChange={(e) =>
									update({
										audioTrailFrames:
											Number(e.target.value) > 0 ? Number(e.target.value) : undefined,
									})
								}
								className="w-full accent-amber-500 h-1.5"
							/>
						</div>
					</div>
				</div>
			)}
		</PropertyModal>
	);
}
