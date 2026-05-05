"use client";

import { useRef, useState } from "react";
import type { Easing } from "@/lib/scene-schema";

/**
 * Interactive cubic-bezier curve editor. Two draggable control points
 * inside a unit canvas. Drag updates `bezier` and flips `easing` to
 * "custom" so the curve persists. Picking a named preset from outside
 * (the easing select) just resets the displayed curve to that preset.
 *
 * Used by CutModal and the keyframe inspector in AnimateModal.
 */

export const EASING_CURVE: Record<Exclude<Easing, "custom">, [number, number, number, number]> = {
	linear: [0, 0, 1, 1],
	ease_in: [0.42, 0, 1, 1],
	ease_out: [0, 0, 0.58, 1],
	ease_in_out: [0.42, 0, 0.58, 1],
	ease_in_back: [0.36, 0, 0.66, -0.56],
	ease_out_back: [0.34, 1.56, 0.64, 1],
	ease_in_out_back: [0.68, -0.6, 0.32, 1.6],
	spring: [0.34, 1.56, 0.64, 1],
	snappy: [0.85, 0, 0.15, 1],
	bouncy: [0.34, 1.56, 0.64, 1],
};

export function curveFor(
	easing: Easing | undefined,
	bezier?: [number, number, number, number],
): [number, number, number, number] {
	if (easing === "custom" && bezier) return bezier;
	const named = (easing ?? "ease_in_out") as Exclude<Easing, "custom">;
	return EASING_CURVE[named] ?? EASING_CURVE.ease_in_out;
}

interface Props {
	easing: Easing | undefined;
	bezier?: [number, number, number, number];
	onChange: (next: {
		easing: Easing;
		bezier: [number, number, number, number] | undefined;
	}) => void;
	width?: number;
	height?: number;
	accent?: string;
	label?: boolean;
}

export function EasingGraph({
	easing,
	bezier,
	onChange,
	width = 200,
	height = 140,
	accent = "rgb(34 211 238)",
	label = true,
}: Props) {
	const svgRef = useRef<SVGSVGElement | null>(null);
	const [draggingHandle, setDraggingHandle] = useState<0 | 1 | null>(null);

	const [x1, y1, x2, y2] = curveFor(easing, bezier);

	const PAD_X = 14;
	const PAD_Y_TOP = 28;
	const PAD_Y_BOTTOM = 28;
	const innerW = width - PAD_X * 2;
	const innerH = height - PAD_Y_TOP - PAD_Y_BOTTOM;

	// Map a bezier (0..1 X, often allow Y outside) to SVG coords. Y is
	// inverted (1 at top of inner area, 0 at bottom). Y can overshoot
	// for "back" / "spring" curves so we clamp the drawable range to
	// [-0.6 .. 1.6] for visual purposes.
	const toSvg = (bx: number, by: number): { x: number; y: number } => ({
		x: PAD_X + bx * innerW,
		y: PAD_Y_TOP + (1 - (by + 0.6) / 2.2) * innerH,
	});
	const fromSvg = (sx: number, sy: number): { bx: number; by: number } => ({
		bx: Math.max(0, Math.min(1, (sx - PAD_X) / innerW)),
		by: Math.max(-0.6, Math.min(1.6, ((1 - (sy - PAD_Y_TOP) / innerH) * 2.2) - 0.6)),
	});

	const start = toSvg(0, 0);
	const end = toSvg(1, 1);
	const cp1 = toSvg(x1, y1);
	const cp2 = toSvg(x2, y2);

	const beginDrag = (which: 0 | 1) => (e: React.PointerEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setDraggingHandle(which);
		(e.target as Element).setPointerCapture?.(e.pointerId);
	};
	const onMove = (e: React.PointerEvent) => {
		if (draggingHandle === null) return;
		const svg = svgRef.current;
		if (!svg) return;
		const rect = svg.getBoundingClientRect();
		const sx = ((e.clientX - rect.left) / rect.width) * width;
		const sy = ((e.clientY - rect.top) / rect.height) * height;
		const { bx, by } = fromSvg(sx, sy);
		const next: [number, number, number, number] =
			draggingHandle === 0 ? [bx, by, x2, y2] : [x1, y1, bx, by];
		onChange({ easing: "custom", bezier: next });
	};
	const endDrag = () => setDraggingHandle(null);

	// Build a polyline approximation of the bezier so we can show the
	// curve with overshoot — SVG <path C> already handles overshoot
	// natively, but a polyline lets us style differently if needed.
	const samples: string[] = [];
	const N = 24;
	for (let i = 0; i <= N; i++) {
		const t = i / N;
		const mt = 1 - t;
		const bx = 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t;
		const by = 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t;
		const p = toSvg(bx, by);
		samples.push(`${p.x},${p.y}`);
	}

	return (
		<div className="inline-flex flex-col gap-1">
			<svg
				ref={svgRef}
				width={width}
				height={height}
				viewBox={`0 0 ${width} ${height}`}
				className="rounded-md bg-neutral-950 border border-neutral-800 cursor-default touch-none select-none"
				onPointerMove={onMove}
				onPointerUp={endDrag}
				onPointerCancel={endDrag}
			>
				{/* baseline + ceiling reference lines */}
				<line
					x1={PAD_X}
					y1={toSvg(0, 0).y}
					x2={PAD_X + innerW}
					y2={toSvg(0, 0).y}
					stroke="rgb(38 38 38)"
					strokeDasharray="2 3"
				/>
				<line
					x1={PAD_X}
					y1={toSvg(0, 1).y}
					x2={PAD_X + innerW}
					y2={toSvg(0, 1).y}
					stroke="rgb(38 38 38)"
					strokeDasharray="2 3"
				/>
				<line
					x1={PAD_X}
					y1={toSvg(0, 0).y}
					x2={PAD_X}
					y2={toSvg(0, 1).y}
					stroke="rgb(38 38 38)"
				/>
				<line
					x1={PAD_X + innerW}
					y1={toSvg(0, 0).y}
					x2={PAD_X + innerW}
					y2={toSvg(0, 1).y}
					stroke="rgb(38 38 38)"
				/>

				{/* control-point handle leashes */}
				<line
					x1={start.x}
					y1={start.y}
					x2={cp1.x}
					y2={cp1.y}
					stroke="rgb(64 64 64)"
					strokeDasharray="3 3"
				/>
				<line
					x1={end.x}
					y1={end.y}
					x2={cp2.x}
					y2={cp2.y}
					stroke="rgb(64 64 64)"
					strokeDasharray="3 3"
				/>

				{/* the curve itself */}
				<polyline
					points={samples.join(" ")}
					stroke={accent}
					strokeWidth={2}
					fill="none"
				/>

				{/* endpoints (not draggable — bezier is anchored at 0,0 → 1,1) */}
				<circle cx={start.x} cy={start.y} r={3} fill={accent} />
				<circle cx={end.x} cy={end.y} r={3} fill={accent} />

				{/* draggable control points */}
				<circle
					cx={cp1.x}
					cy={cp1.y}
					r={7}
					fill={accent}
					stroke="rgb(10 10 10)"
					strokeWidth={2}
					style={{ cursor: "grab" }}
					onPointerDown={beginDrag(0)}
				/>
				<circle
					cx={cp2.x}
					cy={cp2.y}
					r={7}
					fill={accent}
					stroke="rgb(10 10 10)"
					strokeWidth={2}
					style={{ cursor: "grab" }}
					onPointerDown={beginDrag(1)}
				/>

				{label && (
					<text
						x={width - PAD_X}
						y={height - 8}
						textAnchor="end"
						fontSize={9}
						fill="rgb(115 115 115)"
						fontFamily="ui-monospace, monospace"
					>
						{x1.toFixed(2)}, {y1.toFixed(2)}, {x2.toFixed(2)}, {y2.toFixed(2)}
					</text>
				)}
			</svg>
		</div>
	);
}
