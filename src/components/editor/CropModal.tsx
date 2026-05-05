"use client";

import { Crop as CropIcon, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PropertyModal } from "./PropertyModal";

/**
 * Generic crop editor for a single image / video frame. Outputs a
 * normalized rect (x, y, w, h all in 0–1) against the source media.
 * The renderer applies the crop as a CSS wrapper trick — this modal
 * never mutates the source asset, so the crop is fully reversible.
 *
 * Used by BackgroundPanel (bg image / bg video) and any layer that
 * holds a single image. Keep it source-agnostic: it accepts a `src`
 * URL + a media kind ("image" | "video") for the live preview.
 */

export type CropRect = { x: number; y: number; w: number; h: number };

type Handle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | "move" | null;

interface CropModalProps {
	open: boolean;
	onClose: () => void;
	src: string;
	mediaKind?: "image" | "video";
	value?: CropRect;
	onChange: (rect: CropRect | undefined) => void;
}

const FULL: CropRect = { x: 0, y: 0, w: 1, h: 1 };
const MIN_SIZE = 0.05;

function clamp(n: number, lo: number, hi: number): number {
	return Math.max(lo, Math.min(hi, n));
}

export function CropModal({ open, onClose, src, mediaKind = "image", value, onChange }: CropModalProps) {
	const stageRef = useRef<HTMLDivElement | null>(null);
	const [rect, setRect] = useState<CropRect>(value ?? FULL);
	const [aspect, setAspect] = useState<number | null>(null);
	const dragRef = useRef<{
		handle: Handle;
		startRect: CropRect;
		startX: number;
		startY: number;
		stageW: number;
		stageH: number;
	} | null>(null);

	// Reset to incoming value whenever modal opens / value changes externally.
	useEffect(() => {
		if (open) setRect(value ?? FULL);
	}, [open, value]);

	const beginDrag = (handle: Handle) => (e: React.PointerEvent) => {
		e.preventDefault();
		e.stopPropagation();
		const stage = stageRef.current;
		if (!stage) return;
		const r = stage.getBoundingClientRect();
		dragRef.current = {
			handle,
			startRect: rect,
			startX: e.clientX,
			startY: e.clientY,
			stageW: r.width,
			stageH: r.height,
		};
		(e.target as Element).setPointerCapture?.(e.pointerId);
	};

	const onPointerMove = (e: React.PointerEvent) => {
		const drag = dragRef.current;
		if (!drag || !drag.handle) return;
		const dx = (e.clientX - drag.startX) / drag.stageW;
		const dy = (e.clientY - drag.startY) / drag.stageH;
		const s = drag.startRect;
		let { x, y, w, h } = s;

		switch (drag.handle) {
			case "move":
				x = clamp(s.x + dx, 0, 1 - s.w);
				y = clamp(s.y + dy, 0, 1 - s.h);
				break;
			case "e":
				w = clamp(s.w + dx, MIN_SIZE, 1 - s.x);
				break;
			case "w": {
				const nx = clamp(s.x + dx, 0, s.x + s.w - MIN_SIZE);
				w = s.w + (s.x - nx);
				x = nx;
				break;
			}
			case "s":
				h = clamp(s.h + dy, MIN_SIZE, 1 - s.y);
				break;
			case "n": {
				const ny = clamp(s.y + dy, 0, s.y + s.h - MIN_SIZE);
				h = s.h + (s.y - ny);
				y = ny;
				break;
			}
			case "ne":
				w = clamp(s.w + dx, MIN_SIZE, 1 - s.x);
				h = clamp(s.h - dy, MIN_SIZE, s.y + s.h);
				y = clamp(s.y + s.h - h, 0, 1);
				break;
			case "nw": {
				const nx = clamp(s.x + dx, 0, s.x + s.w - MIN_SIZE);
				const ny = clamp(s.y + dy, 0, s.y + s.h - MIN_SIZE);
				w = s.w + (s.x - nx);
				h = s.h + (s.y - ny);
				x = nx;
				y = ny;
				break;
			}
			case "se":
				w = clamp(s.w + dx, MIN_SIZE, 1 - s.x);
				h = clamp(s.h + dy, MIN_SIZE, 1 - s.y);
				break;
			case "sw": {
				const nx = clamp(s.x + dx, 0, s.x + s.w - MIN_SIZE);
				w = s.w + (s.x - nx);
				h = clamp(s.h + dy, MIN_SIZE, 1 - s.y);
				x = nx;
				break;
			}
		}
		setRect({ x, y, w, h });
	};

	const endDrag = () => {
		dragRef.current = null;
	};

	const apply = () => {
		const isFull = rect.w >= 0.999 && rect.h >= 0.999 && rect.x <= 0.001 && rect.y <= 0.001;
		onChange(isFull ? undefined : rect);
		onClose();
	};

	const reset = () => {
		setRect(FULL);
		onChange(undefined);
	};

	const stageMaxW = 720;
	const stageMaxH = 420;
	const a = aspect ?? 16 / 9;
	const stageW = Math.min(stageMaxW, stageMaxH * a);
	const stageH = stageW / a;

	const handlePos: Record<Exclude<Handle, "move" | null>, { left: string; top: string; cursor: string }> = {
		n: { left: "50%", top: "0%", cursor: "ns-resize" },
		s: { left: "50%", top: "100%", cursor: "ns-resize" },
		e: { left: "100%", top: "50%", cursor: "ew-resize" },
		w: { left: "0%", top: "50%", cursor: "ew-resize" },
		ne: { left: "100%", top: "0%", cursor: "nesw-resize" },
		nw: { left: "0%", top: "0%", cursor: "nwse-resize" },
		se: { left: "100%", top: "100%", cursor: "nwse-resize" },
		sw: { left: "0%", top: "100%", cursor: "nesw-resize" },
	};

	return (
		<PropertyModal
			open={open}
			onClose={onClose}
			title="Crop media"
			subtitle={`${(rect.w * 100).toFixed(0)}% × ${(rect.h * 100).toFixed(0)}% · drag the rectangle to reframe`}
			accent="cyan"
			width="huge"
		>
			<div className="flex flex-col items-center gap-3">
				<div
					className="relative bg-neutral-950 rounded-md overflow-hidden border border-neutral-800"
					style={{ width: stageW, height: stageH }}
					ref={stageRef}
					onPointerMove={onPointerMove}
					onPointerUp={endDrag}
					onPointerCancel={endDrag}
				>
					{mediaKind === "video" ? (
						<video
							src={src}
							className="absolute inset-0 w-full h-full object-contain pointer-events-none"
							muted
							playsInline
							onLoadedMetadata={(e) => {
								const v = e.currentTarget;
								if (v.videoWidth && v.videoHeight) setAspect(v.videoWidth / v.videoHeight);
							}}
						/>
					) : (
						/* biome-ignore lint/performance/noImgElement: crop modal uses native sizing for accurate aspect */
						<img
							src={src}
							alt=""
							className="absolute inset-0 w-full h-full object-contain pointer-events-none"
							onLoad={(e) => {
								const i = e.currentTarget;
								if (i.naturalWidth && i.naturalHeight) setAspect(i.naturalWidth / i.naturalHeight);
							}}
						/>
					)}

					<div className="absolute inset-0 bg-black/55 pointer-events-none" />
					<div
						onPointerDown={beginDrag("move")}
						className="absolute border-2 border-cyan-400 cursor-move"
						style={{
							left: `${rect.x * 100}%`,
							top: `${rect.y * 100}%`,
							width: `${rect.w * 100}%`,
							height: `${rect.h * 100}%`,
							boxShadow: "0 0 0 9999px rgba(0,0,0,0)",
						}}
					>
						<div className="absolute inset-0 pointer-events-none">
							{[1, 2].map((i) => (
								<div
									key={`v${i}`}
									className="absolute top-0 bottom-0 border-l border-cyan-300/40"
									style={{ left: `${(i * 100) / 3}%` }}
								/>
							))}
							{[1, 2].map((i) => (
								<div
									key={`h${i}`}
									className="absolute left-0 right-0 border-t border-cyan-300/40"
									style={{ top: `${(i * 100) / 3}%` }}
								/>
							))}
						</div>
						<div
							className="absolute inset-0 pointer-events-none"
							style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)" }}
						/>
						{(Object.keys(handlePos) as Array<Exclude<Handle, "move" | null>>).map((h) => (
							<button
								key={h}
								type="button"
								onPointerDown={beginDrag(h)}
								className="absolute h-3 w-3 rounded-sm bg-cyan-400 border border-neutral-900 -translate-x-1/2 -translate-y-1/2 hover:scale-110"
								style={{ left: handlePos[h].left, top: handlePos[h].top, cursor: handlePos[h].cursor }}
								aria-label={`Resize ${h}`}
							/>
						))}
					</div>
				</div>

				<div className="flex items-center gap-2 text-[10px] text-neutral-400 font-mono tabular-nums">
					<span>x {(rect.x * 100).toFixed(1)}%</span>
					<span>y {(rect.y * 100).toFixed(1)}%</span>
					<span>w {(rect.w * 100).toFixed(1)}%</span>
					<span>h {(rect.h * 100).toFixed(1)}%</span>
				</div>

				<div className="flex items-center gap-2 self-stretch pt-1">
					<button
						type="button"
						onClick={reset}
						className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500"
					>
						<RotateCcw className="h-3 w-3" /> Reset
					</button>
					<div className="flex-1" />
					<button
						type="button"
						onClick={onClose}
						className="text-[11px] px-3 py-1.5 rounded-md border border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={apply}
						className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-md bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-semibold"
					>
						<CropIcon className="h-3 w-3" /> Apply crop
					</button>
				</div>
			</div>
		</PropertyModal>
	);
}
