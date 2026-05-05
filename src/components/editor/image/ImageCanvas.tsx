"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
	type ImageDesign,
	type ImageLayer,
	useImageEditStore,
} from "@/store/image-edit-store";

const SNAP_THRESHOLD_PX = 6;

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
	const removeLayer = useImageEditStore((s) => s.removeLayer);
	const duplicateLayer = useImageEditStore((s) => s.duplicateLayer);
	const moveLayer = useImageEditStore((s) => s.moveLayer);

	const wrapRef = useRef<HTMLDivElement>(null);
	const [scale, setScale] = useState(1);
	// Active snap guide lines drawn during drag — vertical lines at
	// snapped X positions, horizontal at snapped Y. Cleared on drag end.
	const [guides, setGuides] = useState<{ vx: number[]; hy: number[] }>({
		vx: [],
		hy: [],
	});
	// Right-click context menu state. Stored in client coords so the
	// menu can position itself anywhere over the workspace.
	const [menu, setMenu] = useState<{
		layerId: string;
		x: number;
		y: number;
	} | null>(null);

	useEffect(() => {
		if (!menu) return;
		const close = () => setMenu(null);
		window.addEventListener("pointerdown", close);
		window.addEventListener("scroll", close, true);
		window.addEventListener("keydown", (e) => {
			if (e.key === "Escape") close();
		});
		return () => {
			window.removeEventListener("pointerdown", close);
			window.removeEventListener("scroll", close, true);
		};
	}, [menu]);

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
						design={design}
						isSelected={layer.id === selectedLayerId}
						onSelect={() => selectLayer(layer.id)}
						onChange={(patch) => updateLayer(layer.id, patch)}
						onGuides={setGuides}
						onContextMenu={(x, y) => {
							selectLayer(layer.id);
							setMenu({ layerId: layer.id, x, y });
						}}
					/>
				))}
				{/* Snap guide overlays — only visible while a drag pins a layer
				    against a snap target. Pure visual hint, no pointer events. */}
				{guides.vx.map((x, i) => (
					<div
						key={`vx-${i}`}
						className="absolute top-0 bottom-0 w-px bg-sky-400/80 pointer-events-none"
						style={{ left: x * scale }}
					/>
				))}
				{guides.hy.map((y, i) => (
					<div
						key={`hy-${i}`}
						className="absolute left-0 right-0 h-px bg-sky-400/80 pointer-events-none"
						style={{ top: y * scale }}
					/>
				))}
				<div className="absolute -bottom-6 left-0 text-[10px] text-neutral-600 font-mono tabular-nums select-none">
					{design.width}×{design.height} · {Math.round(scale * 100)}%
				</div>
			</div>
			{menu &&
				(() => {
					const layer = design.layers.find((l) => l.id === menu.layerId);
					if (!layer) return null;
					return (
						<ContextMenu
							x={menu.x}
							y={menu.y}
							layer={layer}
							onClose={() => setMenu(null)}
							onDuplicate={() => duplicateLayer(layer.id)}
							onDelete={() => removeLayer(layer.id)}
							onToggleLock={() =>
								updateLayer(layer.id, { locked: !layer.locked })
							}
							onToggleHidden={() =>
								updateLayer(layer.id, { hidden: !layer.hidden })
							}
							onMove={(direction) => moveLayer(layer.id, direction)}
						/>
					);
				})()}
		</div>
	);
}

interface ContextMenuProps {
	x: number;
	y: number;
	layer: ImageLayer;
	onClose: () => void;
	onDuplicate: () => void;
	onDelete: () => void;
	onToggleLock: () => void;
	onToggleHidden: () => void;
	onMove: (direction: "up" | "down" | "top" | "bottom") => void;
}

function ContextMenu({
	x,
	y,
	layer,
	onClose,
	onDuplicate,
	onDelete,
	onToggleLock,
	onToggleHidden,
	onMove,
}: ContextMenuProps) {
	const items: Array<{ label: string; action: () => void; danger?: boolean }> = [
		{ label: "Duplicate", action: onDuplicate },
		{ label: "Bring to front", action: () => onMove("top") },
		{ label: "Bring forward", action: () => onMove("up") },
		{ label: "Send backward", action: () => onMove("down") },
		{ label: "Send to back", action: () => onMove("bottom") },
		{ label: layer.locked ? "Unlock" : "Lock", action: onToggleLock },
		{ label: layer.hidden ? "Show" : "Hide", action: onToggleHidden },
		{ label: "Delete", action: onDelete, danger: true },
	];
	return (
		<div
			role="menu"
			className="fixed z-50 min-w-[180px] rounded-md bg-neutral-900 border border-neutral-700 shadow-xl py-1"
			style={{ left: x, top: y }}
			onPointerDown={(e) => e.stopPropagation()}
		>
			{items.map((item) => (
				<button
					key={item.label}
					type="button"
					onClick={() => {
						item.action();
						onClose();
					}}
					className={`w-full text-left px-3 py-1.5 text-[12px] hover:bg-neutral-800 ${
						item.danger ? "text-red-300" : "text-neutral-200"
					}`}
				>
					{item.label}
				</button>
			))}
		</div>
	);
}

interface LayerNodeProps {
	layer: ImageLayer;
	scale: number;
	design: ImageDesign;
	isSelected: boolean;
	onSelect: () => void;
	onChange: (patch: Partial<ImageLayer>) => void;
	onGuides: (g: { vx: number[]; hy: number[] }) => void;
	onContextMenu: (clientX: number, clientY: number) => void;
}

function LayerNode({
	layer,
	scale,
	design,
	isSelected,
	onSelect,
	onChange,
	onGuides,
	onContextMenu,
}: LayerNodeProps) {
	// Snap targets: canvas left/center/right + top/middle/bottom + every
	// other layer's left/center/right + top/middle/bottom. Memoised so a
	// drag with 50 layers doesn't rebuild on every pointermove.
	const snapTargets = useMemo(() => {
		const xs: number[] = [0, design.width / 2, design.width];
		const ys: number[] = [0, design.height / 2, design.height];
		for (const other of design.layers) {
			if (other.id === layer.id || other.hidden) continue;
			xs.push(other.x, other.x + other.width / 2, other.x + other.width);
			ys.push(other.y, other.y + other.height / 2, other.y + other.height);
		}
		return { xs, ys };
	}, [design.layers, design.width, design.height, layer.id]);

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
			let nx = start.x + dx;
			let ny = start.y + dy;
			const guides: { vx: number[]; hy: number[] } = { vx: [], hy: [] };
			// Try to snap any of {left, center, right} of the dragged
			// layer to any candidate; same for vertical edges.
			const w = layer.width;
			const h = layer.height;
			const xCandidates: Array<[number, number]> = [
				[nx, 0],
				[nx + w / 2, w / 2],
				[nx + w, w],
			];
			let bestX: { delta: number; line: number } | null = null;
			for (const [edge, offset] of xCandidates) {
				for (const target of snapTargets.xs) {
					const d = target - edge;
					if (
						Math.abs(d) < SNAP_THRESHOLD_PX &&
						(!bestX || Math.abs(d) < Math.abs(bestX.delta))
					) {
						bestX = { delta: d, line: target };
						nx = target - offset;
					}
				}
			}
			if (bestX) guides.vx.push(bestX.line);
			const yCandidates: Array<[number, number]> = [
				[ny, 0],
				[ny + h / 2, h / 2],
				[ny + h, h],
			];
			let bestY: { delta: number; line: number } | null = null;
			for (const [edge, offset] of yCandidates) {
				for (const target of snapTargets.ys) {
					const d = target - edge;
					if (
						Math.abs(d) < SNAP_THRESHOLD_PX &&
						(!bestY || Math.abs(d) < Math.abs(bestY.delta))
					) {
						bestY = { delta: d, line: target };
						ny = target - offset;
					}
				}
			}
			if (bestY) guides.hy.push(bestY.line);
			onGuides(guides);
			onChange({ x: nx, y: ny });
		};
		const onUp = () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			onGuides({ vx: [], hy: [] });
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
			onContextMenu={(e) => {
				e.preventDefault();
				e.stopPropagation();
				onContextMenu(e.clientX, e.clientY);
			}}
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
