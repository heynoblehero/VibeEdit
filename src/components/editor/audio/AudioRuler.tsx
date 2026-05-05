"use client";

import { formatSec, secToPx } from "@/lib/audio/clip-math";

/**
 * Tick ruler that sits above the audio lanes. Major ticks every second
 * (or every 5s when zoomed out) with M:SS labels, minor ticks at 1/4
 * second increments. Width is whatever the parent gives us — the
 * scrolling container handles overflow.
 */
interface Props {
	durationSec: number;
	pxPerSec: number;
	height?: number;
}

export function AudioRuler({ durationSec, pxPerSec, height = 22 }: Props) {
	// At low zoom the labels collide; bump the major step until they clear.
	const minLabelPx = 56;
	const candidateSteps = [1, 2, 5, 10, 30, 60];
	const major = candidateSteps.find((s) => s * pxPerSec >= minLabelPx) ?? 60;
	const minor = major <= 1 ? 0.25 : major <= 5 ? 1 : major <= 30 ? 5 : 10;

	const totalPx = secToPx(durationSec, pxPerSec);
	const ticks: { sec: number; major: boolean }[] = [];
	for (let t = 0; t <= durationSec + 0.001; t += minor) {
		ticks.push({ sec: t, major: Math.abs(t % major) < 1e-6 });
	}

	return (
		<div
			className="relative shrink-0 border-b border-neutral-800 bg-neutral-925"
			style={{ width: totalPx, height }}
		>
			{ticks.map((t, i) => {
				const left = secToPx(t.sec, pxPerSec);
				return (
					<div
						key={`${t.sec}-${i}`}
						className={`absolute top-0 bottom-0 ${
							t.major ? "border-l border-neutral-700" : "border-l border-neutral-800/60"
						}`}
						style={{ left }}
					>
						{t.major && (
							<span className="absolute top-0.5 left-1 text-[9px] font-mono text-neutral-500 select-none whitespace-nowrap">
								{formatSec(t.sec)}
							</span>
						)}
					</div>
				);
			})}
		</div>
	);
}
