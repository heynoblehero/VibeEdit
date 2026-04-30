"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { BRoll, Scene, SceneShape, TextItem } from "@/lib/scene-schema";
import { useEditorStore } from "@/store/editor-store";
import { useProjectStore } from "@/store/project-store";

/**
 * Drag/select overlay for canvas elements: text items, shapes, bg
 * image/video, character, b-roll. All elements share the same emerald
 * selection ring + corner ticks so the canvas feels uniform.
 *
 * - Container has pointer-events: none so empty canvas clicks fall
 *   through to the Player.
 * - Each item's hit-box has pointer-events: auto. Click selects, drag
 *   translates (x, y) — only text + shape support drag here; bg /
 *   character / broll resize/move via CanvasManipulator's corner
 *   handles which sit on top of this overlay.
 * - Selected item gets a 2px emerald ring + corner ticks; unselected
 *   bg / character / broll are invisible hit-boxes (no outline) so
 *   they don't compete with CanvasManipulator's dashed outline.
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

	const selectMedia = (
		layerId: string,
		target: "background" | "character" | "broll",
	) => {
		setSelectedLayerId(layerId);
		setEditTarget(target);
		setPaused(true);
	};

	const toScreen = (cx: number, cy: number) => ({
		x: aspectScale.padX + cx * aspectScale.scale,
		y: aspectScale.padY + cy * aspectScale.scale,
	});
	const fitW = (canvasW: number) => canvasW * aspectScale.scale;
	const fitH = (canvasH: number) => canvasH * aspectScale.scale;

	const hasBg = !!(scene.background?.imageUrl || scene.background?.videoUrl);
	const hasCharacter = !!(scene.characterId || scene.characterUrl);
	const characterX = scene.characterX ?? Math.round(frameW / 2);
	const characterY = scene.characterY ?? Math.round(frameH * 0.83);
	const characterScale = scene.characterScale ?? 1;

	return (
		<>
			<div
				className="absolute inset-0"
				style={{ pointerEvents: "none", zIndex: 30 }}
			>
				{/* Background image/video — full-canvas hit-box. Sits
				    behind everything so item-level clicks win. */}
				{hasBg && (
					<BgHandle
						isSelected={selectedLayerId === "media:bg"}
						toScreen={toScreen}
						fitW={fitW}
						fitH={fitH}
						frameW={frameW}
						frameH={frameH}
						onClick={(e) => {
							e.stopPropagation();
							selectMedia("media:bg", "background");
						}}
					/>
				)}

				{/* Character — bottom-anchored bbox */}
				{hasCharacter && (
					<CharacterHandle
						isSelected={selectedLayerId === "media:character"}
						toScreen={toScreen}
						fitW={fitW}
						fitH={fitH}
						x={characterX}
						y={characterY}
						scale={characterScale}
						onClick={(e) => {
							e.stopPropagation();
							selectMedia("media:character", "character");
						}}
					/>
				)}

				{/* B-roll items */}
				{(scene.broll ?? []).map((b) => (
					<BrollHandle
						key={b.id}
						broll={b}
						isSelected={selectedLayerId === `media:broll:${b.id}`}
						toScreen={toScreen}
						fitW={fitW}
						fitH={fitH}
						onClick={(e) => {
							e.stopPropagation();
							selectMedia(`media:broll:${b.id}`, "broll");
						}}
					/>
				))}

				{/* Shapes */}
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

				{/* Text items — drawn last so they sit on top */}
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

/** Full-canvas hit-box for the bg image/video. When selected → emerald
 *  ring + corner ticks. When unselected → invisible (transparent border)
 *  hit-box so clicks still work but the canvas isn't cluttered. */
function BgHandle({
	isSelected,
	toScreen,
	fitW,
	fitH,
	frameW,
	frameH,
	onClick,
}: {
	isSelected: boolean;
	toScreen: (cx: number, cy: number) => { x: number; y: number };
	fitW: (cw: number) => number;
	fitH: (ch: number) => number;
	frameW: number;
	frameH: number;
	onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
}) {
	const tl = toScreen(0, 0);
	return (
		<div
			onClick={onClick}
			onKeyDown={(e) => {
				if (e.key === "Enter") onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
			}}
			role="button"
			tabIndex={-1}
			className="absolute"
			style={{
				left: tl.x,
				top: tl.y,
				width: fitW(frameW),
				height: fitH(frameH),
				pointerEvents: "auto",
				cursor: "pointer",
				border: isSelected ? "2px solid #34d399" : "2px solid transparent",
				background: "transparent",
				zIndex: 1,
			}}
		>
			{isSelected && <CornerTicks />}
		</div>
	);
}

function CharacterHandle({
	isSelected,
	toScreen,
	fitW,
	fitH,
	x,
	y,
	scale,
	onClick,
}: {
	isSelected: boolean;
	toScreen: (cx: number, cy: number) => { x: number; y: number };
	fitW: (cw: number) => number;
	fitH: (ch: number) => number;
	x: number;
	y: number;
	scale: number;
	onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
}) {
	const CHAR_HEIGHT = 550;
	const CHAR_WIDTH_RATIO = 0.8;
	const pxH = CHAR_HEIGHT * scale;
	const pxW = pxH * CHAR_WIDTH_RATIO;
	const tl = toScreen(x - pxW / 2, y - pxH);
	return (
		<div
			onClick={onClick}
			onKeyDown={(e) => {
				if (e.key === "Enter") onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
			}}
			role="button"
			tabIndex={-1}
			className="absolute"
			style={{
				left: tl.x,
				top: tl.y,
				width: fitW(pxW),
				height: fitH(pxH),
				pointerEvents: "auto",
				cursor: "pointer",
				border: isSelected
					? "2px solid #34d399"
					: "1px dashed rgba(52, 211, 153, 0.18)",
				background: isSelected ? "rgba(52, 211, 153, 0.04)" : "transparent",
				borderRadius: 4,
			}}
		>
			{isSelected && <CornerTicks />}
		</div>
	);
}

function brollLayout(position: BRoll["position"]) {
	const VIDEO_W = 1920;
	const VIDEO_H = 1080;
	switch (position) {
		case "full":
			return { left: 0, top: 0, width: VIDEO_W, height: VIDEO_H };
		case "overlay-tl":
			return { left: 60, top: 60, width: 560, height: 315 };
		case "overlay-tr":
			return { left: VIDEO_W - 620, top: 60, width: 560, height: 315 };
		case "overlay-bl":
			return { left: 60, top: VIDEO_H - 375, width: 560, height: 315 };
		case "overlay-br":
			return { left: VIDEO_W - 620, top: VIDEO_H - 375, width: 560, height: 315 };
		case "pip-left":
			return { left: 80, top: 260, width: 760, height: 560 };
		case "pip-right":
			return { left: VIDEO_W - 840, top: 260, width: 760, height: 560 };
		case "lower-third":
			return { left: 0, top: VIDEO_H - 400, width: VIDEO_W, height: 400 };
		default:
			return { left: 0, top: 0, width: VIDEO_W, height: VIDEO_H };
	}
}

function BrollHandle({
	broll,
	isSelected,
	toScreen,
	fitW,
	fitH,
	onClick,
}: {
	broll: BRoll;
	isSelected: boolean;
	toScreen: (cx: number, cy: number) => { x: number; y: number };
	fitW: (cw: number) => number;
	fitH: (ch: number) => number;
	onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
}) {
	const layout = brollLayout(broll.position);
	const x = layout.left + (broll.offsetX ?? 0);
	const y = layout.top + (broll.offsetY ?? 0);
	const scale = broll.scale ?? 1;
	const tl = toScreen(x, y);
	return (
		<div
			onClick={onClick}
			onKeyDown={(e) => {
				if (e.key === "Enter") onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
			}}
			role="button"
			tabIndex={-1}
			className="absolute"
			style={{
				left: tl.x,
				top: tl.y,
				width: fitW(layout.width),
				height: fitH(layout.height),
				pointerEvents: "auto",
				cursor: "pointer",
				transform: scale !== 1 ? `scale(${scale})` : undefined,
				transformOrigin: "center center",
				border: isSelected
					? "2px solid #34d399"
					: "1px dashed rgba(52, 211, 153, 0.22)",
				background: isSelected ? "rgba(52, 211, 153, 0.04)" : "transparent",
				borderRadius: broll.borderRadius ?? 16,
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
