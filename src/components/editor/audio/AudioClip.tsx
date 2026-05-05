"use client";

import { useEffect, useRef, useState } from "react";
import { AudioWaveform } from "@/components/editor/AudioWaveform";
import { cls } from "@/lib/design/tokens";

/**
 * One clip block on an audio lane. Click to select; drag the body
 * (when `onMoveSec` is provided) to reposition; drag the left/right
 * edges (when `onTrim` is provided) to trim.
 *
 * The component is callback-driven — the timeline owns the logic for
 * which interactions each kind supports:
 *   - vo / music: trim only (movement is locked to the scene boundary).
 *   - sfx (free-floating): both trim AND move.
 *
 * Coords come back as deltas in seconds, computed from pxPerSec, so
 * the parent can clamp and dispatch to the right store action.
 */
export type AudioClipKind = "vo" | "music" | "sfx";

interface Props {
	kind: AudioClipKind;
	id: string;
	src?: string;
	leftPx: number;
	widthPx: number;
	pxPerSec: number;
	label: string;
	subLabel?: string;
	selected: boolean;
	onSelect: () => void;
	/** Called with a delta in seconds during a body drag. Move support
	 *  is opt-in — pass nothing to disable. */
	onMoveSec?: (deltaSec: number, phase: "start" | "drag" | "end") => void;
	/** Called with current left + right trim deltas (seconds). */
	onTrimSec?: (
		startDeltaSec: number,
		endDeltaSec: number,
		phase: "start" | "drag" | "end",
	) => void;
}

const KIND_STYLES: Record<
	AudioClipKind,
	{ bg: string; border: string; wave: string; text: string; ring: string }
> = {
	vo: {
		bg: "bg-orange-500/20",
		border: "border-orange-400/60",
		wave: "rgba(253, 186, 116, 0.9)",
		text: "text-orange-100",
		ring: "ring-orange-400/50",
	},
	music: {
		bg: "bg-red-500/15",
		border: "border-red-400/50",
		wave: "rgba(248, 113, 113, 0.85)",
		text: "text-red-200",
		ring: "ring-red-400/50",
	},
	sfx: {
		bg: "bg-orange-600/20",
		border: "border-orange-500/60",
		wave: "rgba(251, 146, 60, 0.9)",
		text: "text-orange-200",
		ring: "ring-orange-400/60",
	},
};

type Drag =
	| { kind: "move"; startX: number }
	| { kind: "trim-left"; startX: number }
	| { kind: "trim-right"; startX: number }
	| null;

export function AudioClip({
	kind,
	src,
	leftPx,
	widthPx,
	pxPerSec,
	label,
	subLabel,
	selected,
	onSelect,
	onMoveSec,
	onTrimSec,
}: Props) {
	const style = KIND_STYLES[kind];
	const minVisibleWidth = 8;
	const w = Math.max(minVisibleWidth, widthPx);

	const [drag, setDrag] = useState<Drag>(null);
	const [hover, setHover] = useState(false);
	const movedRef = useRef(false);

	useEffect(() => {
		if (!drag) return;

		const onMove = (e: MouseEvent) => {
			const dx = e.clientX - drag.startX;
			if (Math.abs(dx) > 2) movedRef.current = true;
			const ds = dx / pxPerSec;
			if (drag.kind === "move" && onMoveSec) {
				onMoveSec(ds, "drag");
			} else if (drag.kind === "trim-left" && onTrimSec) {
				onTrimSec(ds, 0, "drag");
			} else if (drag.kind === "trim-right" && onTrimSec) {
				onTrimSec(0, ds, "drag");
			}
		};
		const onUp = (e: MouseEvent) => {
			const dx = e.clientX - drag.startX;
			const ds = dx / pxPerSec;
			if (drag.kind === "move" && onMoveSec) onMoveSec(ds, "end");
			else if (drag.kind === "trim-left" && onTrimSec) onTrimSec(ds, 0, "end");
			else if (drag.kind === "trim-right" && onTrimSec) onTrimSec(0, ds, "end");
			setDrag(null);
		};

		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
		return () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
		};
	}, [drag, pxPerSec, onMoveSec, onTrimSec]);

	const startDrag = (
		kind: "move" | "trim-left" | "trim-right",
	) => (e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		movedRef.current = false;
		setDrag({ kind, startX: e.clientX } as Drag);
		// Tell the parent we're starting so it can snapshot original
		// values for delta math.
		if (kind === "move") onMoveSec?.(0, "start");
		else if (kind === "trim-left") onTrimSec?.(0, 0, "start");
		else if (kind === "trim-right") onTrimSec?.(0, 0, "start");
	};

	const onClickBody = (e: React.MouseEvent) => {
		// Don't trigger select if the user just dragged.
		if (movedRef.current) {
			e.preventDefault();
			e.stopPropagation();
			return;
		}
		onSelect();
	};

	const canMove = !!onMoveSec;
	const canTrim = !!onTrimSec;

	return (
		<div
			role="button"
			tabIndex={0}
			onClick={onClickBody}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onSelect();
				}
			}}
			onMouseDown={canMove ? startDrag("move") : undefined}
			onMouseEnter={() => setHover(true)}
			onMouseLeave={() => setHover(false)}
			className={cls(
				"absolute top-1 bottom-1 rounded-md border overflow-hidden select-none",
				"transition-[box-shadow,filter] duration-150",
				style.bg,
				selected
					? cls("border-white shadow-lg ring-1", style.ring)
					: style.border,
				hover && !selected ? "brightness-110" : "",
				canMove ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
			)}
			style={{ left: leftPx, width: w }}
			aria-label={`${label} clip`}
		>
			{src ? <AudioWaveform src={src} color={style.wave} height={56} /> : null}
			<div className="relative z-10 px-2 py-1 flex flex-col h-full justify-between pointer-events-none">
				<span
					className={cls(
						"text-[10px] font-semibold truncate drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]",
						style.text,
					)}
				>
					{label}
				</span>
				{subLabel && w > 60 ? (
					<span className="text-[9px] text-neutral-300/80 truncate drop-shadow-[0_1px_1px_rgba(0,0,0,0.6)]">
						{subLabel}
					</span>
				) : null}
			</div>

			{canTrim ? (
				<>
					<TrimHandle
						side="left"
						visible={hover || selected || drag?.kind === "trim-left"}
						onMouseDown={startDrag("trim-left")}
					/>
					<TrimHandle
						side="right"
						visible={hover || selected || drag?.kind === "trim-right"}
						onMouseDown={startDrag("trim-right")}
					/>
				</>
			) : null}
		</div>
	);
}

function TrimHandle({
	side,
	visible,
	onMouseDown,
}: {
	side: "left" | "right";
	visible: boolean;
	onMouseDown: (e: React.MouseEvent) => void;
}) {
	return (
		<div
			role="slider"
			aria-label={`Trim ${side}`}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-valuenow={50}
			tabIndex={-1}
			onMouseDown={onMouseDown}
			className={cls(
				"absolute top-0 bottom-0 w-2 z-20 transition-opacity duration-150",
				side === "left" ? "left-0" : "right-0",
				visible ? "opacity-100" : "opacity-0",
				"cursor-ew-resize group",
			)}
		>
			<div
				className={cls(
					"absolute inset-y-1 bg-white/70 rounded",
					side === "left" ? "left-0.5 w-0.5" : "right-0.5 w-0.5",
				)}
			/>
			<div
				className={cls(
					"absolute top-1/2 -translate-y-1/2 h-5 w-1 bg-white/90 rounded-sm shadow",
					side === "left" ? "left-0" : "right-0",
				)}
			/>
		</div>
	);
}
