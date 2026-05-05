"use client";

import { useEffect, useRef, useState } from "react";
import {
	type ImageLayer,
	useImageEditStore,
} from "@/store/image-edit-store";

/**
 * The interactive canvas surface for the Image workspace. Renders
 * each layer as an absolutely-positioned div inside a scaled stage
 * (so 1080x1080 design fits any rail width). Pointer-down on a layer
 * selects + arms drag; pointer-down on a corner handle arms resize;
 * pointer-down on empty space deselects.
 *
 * The DOM tree mirrors the design 1:1 so PNG export can either use a
 * 2D canvas walk (see ImageWorkspace.exportPng) or rasterize this
 * tree directly.
 */
export function ImageCanvas() {
	const activeId = useImageEditStore((s) => s.activeDesignId);
	const design = useImageEditStore((s) =>
		s.activeDesignId ? s.designs[s.activeDesignId] : null,
	);
	const selectedLayerId = useImageEditStore((s) => s.selectedLayerId);
	const selectLayer = useImageEditStore((s) => s.selectLayer);
	const updateLayer = useImageEditStore((s) => s.updateLayer);

	const wrapRef = useRef<HTMLDivElement>(null);
	const [scale, setScale] = useState(1);

	// Fit-to-rail: the design's natural size (e.g. 1080x1920) needs to
	// fit the workspace centre column; recompute on resize.
	useEffect(() => {
		if (!design) return;
		const el = wrapRef.current;
		if (!el) return;
		const fit = () => {
			const padding = 48;
			const availW = el.clientWidth - padding;
			const availH = el.clientHeight - padding;
			const fitScale = Math.min(
				availW / design.width,
				availH / design.height,
				1,
			);
			setScale(Math.max(0.05, fitScale));
		};
		fit();
		const obs = new ResizeObserver(fit);
		obs.observe(el);
		return () => obs.disconnect();
	}, [design]);

	if (!design) {
		return (
			<div className="flex-1 flex items-center justify-center text-neutral-500 text-[12px]">
				Pick a design from the toolbar, or click + Design to start.
			</div>
		);
	}

	return (
		<div
			ref={wrapRef}
			className="flex-1 flex items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,#0e1014_0%,#050608_100%)]"
			onPointerDown={(e) => {
				if (e.target === e.currentTarget) selectLayer(null);
			}}
		>
			<div
				key={activeId}
				className="relative shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
				style={{
					width: design.width * scale,
					height: design.height * scale,
					backgroundColor: design.background,
				}}
				onPointerDown={(e) => {
					if (e.target === e.currentTarget) selectLayer(null);
				}}
			>
				{design.layers.map((layer) => (
					<LayerNode
						key={layer.id}
						layer={layer}
						scale={scale}
						isSelected={layer.id === selectedLayerId}
						onSelect={() => selectLayer(layer.id)}
						onChange={(patch) => updateLayer(layer.id, patch)}
					/>
				))}
				<div className="absolute -bottom-6 left-0 text-[10px] text-neutral-600 font-mono tabular-nums select-none">
					{design.width}×{design.height} · {Math.round(scale * 100)}%
				</div>
			</div>
		</div>
	);
}

interface LayerNodeProps {
	layer: ImageLayer;
	scale: number;
	isSelected: boolean;
	onSelect: () => void;
	onChange: (patch: Partial<ImageLayer>) => void;
}

function LayerNode({
	layer,
	scale,
	isSelected,
	onSelect,
	onChange,
}: LayerNodeProps) {
	if (layer.hidden) return null;

	const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
		e.stopPropagation();
		onSelect();
		if (layer.locked) return;
		const startPx = { x: e.clientX, y: e.clientY };
		const start = { x: layer.x, y: layer.y };
		(e.target as HTMLElement).setPointerCapture(e.pointerId);

		const onMove = (ev: PointerEvent) => {
			const dx = (ev.clientX - startPx.x) / scale;
			const dy = (ev.clientY - startPx.y) / scale;
			onChange({ x: start.x + dx, y: start.y + dy });
		};
		const onUp = () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
	};

	const onResize = (corner: "nw" | "ne" | "sw" | "se") =>
		(e: React.PointerEvent<HTMLDivElement>) => {
			e.stopPropagation();
			if (layer.locked) return;
			const startPx = { x: e.clientX, y: e.clientY };
			const start = {
				x: layer.x,
				y: layer.y,
				width: layer.width,
				height: layer.height,
			};
			(e.target as HTMLElement).setPointerCapture(e.pointerId);

			const onMove = (ev: PointerEvent) => {
				const dx = (ev.clientX - startPx.x) / scale;
				const dy = (ev.clientY - startPx.y) / scale;
				let { x, y, width, height } = start;
				if (corner === "se") {
					width = Math.max(8, start.width + dx);
					height = Math.max(8, start.height + dy);
				} else if (corner === "ne") {
					width = Math.max(8, start.width + dx);
					height = Math.max(8, start.height - dy);
					y = start.y + dy;
				} else if (corner === "sw") {
					width = Math.max(8, start.width - dx);
					height = Math.max(8, start.height + dy);
					x = start.x + dx;
				} else {
					width = Math.max(8, start.width - dx);
					height = Math.max(8, start.height - dy);
					x = start.x + dx;
					y = start.y + dy;
				}
				onChange({ x, y, width, height });
			};
			const onUp = () => {
				window.removeEventListener("pointermove", onMove);
				window.removeEventListener("pointerup", onUp);
			};
			window.addEventListener("pointermove", onMove);
			window.addEventListener("pointerup", onUp);
		};

	const baseStyle: React.CSSProperties = {
		position: "absolute",
		left: layer.x * scale,
		top: layer.y * scale,
		width: layer.width * scale,
		height: layer.height * scale,
		opacity: layer.opacity,
		transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
		transformOrigin: "center center",
		cursor: layer.locked ? "default" : "move",
		userSelect: "none",
	};

	return (
		<div
			style={baseStyle}
			onPointerDown={onPointerDown}
			className={isSelected ? "ring-2 ring-sky-400" : ""}
		>
			{layer.kind === "text" ? (
				<div
					style={{
						width: "100%",
						height: "100%",
						display: "flex",
						alignItems: "center",
						justifyContent:
							layer.align === "center"
								? "center"
								: layer.align === "right"
									? "flex-end"
									: "flex-start",
						color: layer.color,
						fontSize: layer.fontSize * scale,
						fontFamily: layer.fontFamily,
						fontWeight: layer.fontWeight,
						letterSpacing: (layer.letterSpacing ?? 0) * scale,
						lineHeight: layer.lineHeight ?? 1.2,
						overflow: "hidden",
						textAlign: layer.align,
						pointerEvents: "none",
					}}
				>
					{layer.text}
				</div>
			) : layer.kind === "rect" ? (
				<div
					style={{
						width: "100%",
						height: "100%",
						background: layer.fill,
						borderRadius: layer.radius ? layer.radius * scale : 0,
						border:
							layer.stroke && layer.strokeWidth
								? `${layer.strokeWidth * scale}px solid ${layer.stroke}`
								: undefined,
					}}
				/>
			) : layer.kind === "ellipse" ? (
				<div
					style={{
						width: "100%",
						height: "100%",
						background: layer.fill,
						borderRadius: "50%",
						border:
							layer.stroke && layer.strokeWidth
								? `${layer.strokeWidth * scale}px solid ${layer.stroke}`
								: undefined,
					}}
				/>
			) : layer.kind === "image" ? (
				// biome-ignore lint/a11y/useAltText: decorative canvas layer; alt n/a
				<img
					src={layer.src}
					alt=""
					draggable={false}
					style={{
						width: "100%",
						height: "100%",
						objectFit: layer.objectFit,
						pointerEvents: "none",
					}}
				/>
			) : null}
			{isSelected && !layer.locked && (
				<>
					<Handle corner="nw" onPointerDown={onResize("nw")} />
					<Handle corner="ne" onPointerDown={onResize("ne")} />
					<Handle corner="sw" onPointerDown={onResize("sw")} />
					<Handle corner="se" onPointerDown={onResize("se")} />
				</>
			)}
		</div>
	);
}

function Handle({
	corner,
	onPointerDown,
}: {
	corner: "nw" | "ne" | "sw" | "se";
	onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
	const pos: React.CSSProperties = {
		position: "absolute",
		width: 10,
		height: 10,
		background: "#fff",
		border: "1px solid #38bdf8",
		borderRadius: 2,
	};
	if (corner === "nw") Object.assign(pos, { left: -6, top: -6, cursor: "nwse-resize" });
	if (corner === "ne") Object.assign(pos, { right: -6, top: -6, cursor: "nesw-resize" });
	if (corner === "sw") Object.assign(pos, { left: -6, bottom: -6, cursor: "nesw-resize" });
	if (corner === "se") Object.assign(pos, { right: -6, bottom: -6, cursor: "nwse-resize" });
	return <div style={pos} onPointerDown={onPointerDown} />;
}
