"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { Scene, SceneShape, TextItem } from "@/lib/scene-schema";
import { useEditorStore } from "@/store/editor-store";
import { useProjectStore } from "@/store/project-store";

/**
 * Drag overlay for free-positioned text items and shapes on the
 * preview canvas.
 *
 * - Container has pointer-events: none so empty canvas clicks fall
 *   through to the Player.
 * - Each item's hit-box has pointer-events: auto. Click selects, drag
 *   translates (x, y).
 * - Pointer movement deltas convert from screen pixels to canvas
 *   coords using the wrapper's actual rect; the Player letterboxes,
 *   so we use the smaller axis-ratio as the uniform scale.
 * - Selected item gets an emerald box with corner ticks + a live
 *   X,Y readout next to the cursor while dragging.
 *
 * Sibling of CanvasManipulator (image/character/video) — same idea,
 * different schema field paths.
 */
export function CanvasItemHandles({
	scene,
	frameW,
	frameH,
	containerRef,
}: {
	scene: Scene;
	frameW: number;
	frameH: number;
	containerRef: React.RefObject<HTMLDivElement | null>;
}) {
	const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
	const setSelectedLayerId = useEditorStore((s) => s.setSelectedLayerId);
	const setEditTarget = useEditorStore((s) => s.setEditTarget);
	const setPaused = useEditorStore((s) => s.setPaused);
	const updateScene = useProjectStore((s) => s.updateScene);

	const [rect, setRect] = useState({ width: 0, height: 0 });
	useLayoutEffect(() => {
		const node = containerRef.current;
		if (!node) return;
		const sync = () => {
			const r = node.getBoundingClientRect();
			setRect({ width: r.width, height: r.height });
		};
		sync();
		const observer = new ResizeObserver(sync);
		observer.observe(node);
		return () => observer.disconnect();
	}, [containerRef]);

	const aspectScale = (() => {
		if (rect.width === 0 || rect.height === 0) return null;
		const sx = rect.width / frameW;
		const sy = rect.height / frameH;
		const scale = Math.min(sx, sy);
		const drawnW = frameW * scale;
		const drawnH = frameH * scale;
		return {
			scale,
			padX: (rect.width - drawnW) / 2,
			padY: (rect.height - drawnH) / 2,
		};
	})();

	const dragRef = useRef<{
		kind: "text-item" | "shape";
		id: string;
		startClientX: number;
		startClientY: number;
		startItemX: number;
		startItemY: number;
	} | null>(null);
	const [dragLabel, setDragLabel] = useState<{
		x: number;
		y: number;
		text: string;
	} | null>(null);

	if (!aspectScale) return null;

	const startDrag = (
		event: React.PointerEvent<HTMLDivElement>,
		kind: "text-item" | "shape",
		item: { id: string; x: number; y: number },
	) => {
		event.preventDefault();
		event.stopPropagation();
		setSelectedLayerId(`${kind}:${item.id}`);
		setEditTarget(kind === "text-item" ? "text" : "shape");
		setPaused(true);
		dragRef.current = {
			kind,
			id: item.id,
			startClientX: event.clientX,
			startClientY: event.clientY,
			startItemX: item.x,
			startItemY: item.y,
		};
		const onMove = (ev: PointerEvent) => {
			const drag = dragRef.current;
			if (!drag) return;
			const dx = (ev.clientX - drag.startClientX) / aspectScale.scale;
			const dy = (ev.clientY - drag.startClientY) / aspectScale.scale;
			const newX = Math.round(drag.startItemX + dx);
			const newY = Math.round(drag.startItemY + dy);
			if (drag.kind === "text-item") {
				updateScene(scene.id, {
					textItems: (scene.textItems ?? []).map((it) =>
						it.id === drag.id ? { ...it, x: newX, y: newY } : it,
					),
				});
			} else {
				updateScene(scene.id, {
					shapes: (scene.shapes ?? []).map((sh) =>
						sh.id === drag.id ? { ...sh, x: newX, y: newY } : sh,
					),
				});
			}
			setDragLabel({ x: ev.clientX, y: ev.clientY, text: `${newX}, ${newY}` });
		};
		const onUp = () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			dragRef.current = null;
			setDragLabel(null);
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
	};

	const toScreen = (cx: number, cy: number) => ({
		x: aspectScale.padX + cx * aspectScale.scale,
		y: aspectScale.padY + cy * aspectScale.scale,
	});
	const fitW = (canvasW: number) => canvasW * aspectScale.scale;
	const fitH = (canvasH: number) => canvasH * aspectScale.scale;

	return (
		<>
			<div
				className="absolute inset-0"
				style={{ pointerEvents: "none", zIndex: 30 }}
			>
				{(scene.textItems ?? []).map((item) => (
					<TextItemHandle
						key={item.id}
						item={item}
						isSelected={selectedLayerId === `text-item:${item.id}`}
						toScreen={toScreen}
						fitW={fitW}
						fitH={fitH}
						onPointerDown={(event) => startDrag(event, "text-item", item)}
					/>
				))}
				{(scene.shapes ?? []).map((shape) => (
					<ShapeHandle
						key={shape.id}
						shape={shape}
						isSelected={selectedLayerId === `shape:${shape.id}`}
						toScreen={toScreen}
						fitW={fitW}
						fitH={fitH}
						onPointerDown={(event) => startDrag(event, "shape", shape)}
					/>
				))}
			</div>
			{dragLabel && <CursorBadge {...dragLabel} />}
		</>
	);
}

/** Approximate text bounding box. We don't measure DOM — fontSize ×
 *  content length ≈ width is a fine handle approximation. */
function textBox(item: TextItem) {
	const lines = (item.content || "").split("\n");
	const longest = lines.reduce((max, l) => Math.max(max, l.length), 1);
	const w = Math.max(80, item.w ?? longest * item.fontSize * 0.55);
	const h = Math.max(
		item.fontSize * 1.2,
		lines.length * item.fontSize * (item.lineHeight ?? 1.1),
	);
	return { w, h };
}

function TextItemHandle({
	item,
	isSelected,
	toScreen,
	fitW,
	fitH,
	onPointerDown,
}: {
	item: TextItem;
	isSelected: boolean;
	toScreen: (cx: number, cy: number) => { x: number; y: number };
	fitW: (cw: number) => number;
	fitH: (ch: number) => number;
	onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
}) {
	const { w, h } = textBox(item);
	const tl = toScreen(item.x, item.y);
	return (
		<div
			onPointerDown={onPointerDown}
			className="absolute"
			style={{
				left: tl.x,
				top: tl.y,
				width: fitW(w),
				height: fitH(h),
				pointerEvents: "auto",
				cursor: "move",
				transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
				transformOrigin: "top left",
				border: isSelected
					? "2px solid #34d399"
					: "1px dashed rgba(52, 211, 153, 0.35)",
				borderRadius: 4,
				background: isSelected ? "rgba(52, 211, 153, 0.06)" : "transparent",
				transition: "border-color 100ms",
			}}
		>
			{isSelected && <CornerTicks />}
		</div>
	);
}

function ShapeHandle({
	shape,
	isSelected,
	toScreen,
	fitW,
	fitH,
	onPointerDown,
}: {
	shape: SceneShape;
	isSelected: boolean;
	toScreen: (cx: number, cy: number) => { x: number; y: number };
	fitW: (cw: number) => number;
	fitH: (ch: number) => number;
	onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
}) {
	const tl = toScreen(shape.x, shape.y);
	return (
		<div
			onPointerDown={onPointerDown}
			className="absolute"
			style={{
				left: tl.x,
				top: tl.y,
				width: fitW(shape.w),
				height: fitH(shape.h),
				pointerEvents: "auto",
				cursor: "move",
				transform: shape.rotation ? `rotate(${shape.rotation}deg)` : undefined,
				transformOrigin: "top left",
				border: isSelected
					? "2px solid #34d399"
					: "1px dashed rgba(245, 158, 11, 0.45)",
				borderRadius: shape.kind === "circle" ? "50%" : 4,
				background: isSelected ? "rgba(52, 211, 153, 0.06)" : "transparent",
			}}
		>
			{isSelected && <CornerTicks />}
		</div>
	);
}

function CornerTicks() {
	return (
		<>
			<Tick at="tl" />
			<Tick at="tr" />
			<Tick at="bl" />
			<Tick at="br" />
		</>
	);
}

function Tick({ at }: { at: "tl" | "tr" | "bl" | "br" }) {
	const pos = (() => {
		switch (at) {
			case "tl":
				return { left: -4, top: -4 };
			case "tr":
				return { right: -4, top: -4 };
			case "bl":
				return { left: -4, bottom: -4 };
			case "br":
				return { right: -4, bottom: -4 };
		}
	})();
	return (
		<div
			className="absolute h-2 w-2 rounded-sm"
			style={{
				...pos,
				background: "#34d399",
				boxShadow: "0 0 0 1px #0a0a0a",
				pointerEvents: "none",
			}}
		/>
	);
}

function CursorBadge({ x, y, text }: { x: number; y: number; text: string }) {
	return (
		<div
			className="fixed z-50 px-1.5 py-0.5 rounded bg-emerald-500 text-black text-[10px] font-mono font-semibold shadow-lg pointer-events-none"
			style={{ left: x + 14, top: y + 14 }}
		>
			{text}
		</div>
	);
}
