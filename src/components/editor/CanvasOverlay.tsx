"use client";

import { useCallback, useLayoutEffect, useMemo, useState } from "react";
import {
	aspectFit,
	canvasToScreen,
	getLayerHandles,
	snapAxis,
	type AspectFit,
	type BBox,
	type LayerHandle,
	type ResizeCorner,
} from "@/lib/canvas-math";
import type { Scene } from "@/lib/scene-schema";
import { useEditorStore } from "@/store/editor-store";
import { useProjectStore } from "@/store/project-store";

const RING_COLOR = "rgba(52, 211, 153, 0.95)";
const RING_DIM = "rgba(52, 211, 153, 0.5)";
const HOVER_DIM = "rgba(52, 211, 153, 0.18)";

interface Props {
	scene: Scene;
	frameW: number;
	frameH: number;
	containerRef: React.RefObject<HTMLDivElement | null>;
}

type DragState =
	| {
			kind: "move";
			handleId: string;
			startClientX: number;
			startClientY: number;
			startBBox: BBox;
			screenScale: number;
			// Captured at drag start. Critical: every pointermove computes
			// the TOTAL delta from start, not an incremental one — so we
			// must apply that delta against the ORIGINAL scene snapshot,
			// otherwise scene updates re-build the handle with a stale
			// closure that double-adds the delta on every frame.
			applyMove: LayerHandle["applyMove"];
		}
	| {
			kind: "resize";
			handleId: string;
			corner: ResizeCorner;
			startClientX: number;
			startClientY: number;
			startBBox: BBox;
			screenScale: number;
			applyResize: LayerHandle["applyResize"];
		}
	| null;

/**
 * Single overlay that owns selection + move + resize for every
 * manipulable layer in the scene. Replaces the old CanvasManipulator +
 * CanvasItemHandles split — one set of pointer rules, one ring style,
 * one source of truth.
 *
 * Hit-areas paint in painter order (bg → broll → character → shape →
 * text). The selection chrome (ring + 4 corner handles + drag readout)
 * paints last so it sits on top of everything but the chrome's *fill*
 * is pointer-events:none — moves are initiated by clicking the layer's
 * own hit-area, which means clicking another layer always switches
 * selection cleanly.
 */
export function CanvasOverlay({ scene, frameW, frameH, containerRef }: Props) {
	const updateScene = useProjectStore((s) => s.updateScene);
	const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
	const setSelectedLayerId = useEditorStore((s) => s.setSelectedLayerId);
	const setEditTarget = useEditorStore((s) => s.setEditTarget);
	const setPaused = useEditorStore((s) => s.setPaused);

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

	const fit = aspectFit(rect, frameW, frameH);
	const handles = useMemo(
		() => getLayerHandles(scene, frameW, frameH),
		[scene, frameW, frameH],
	);
	const selected = handles.find((h) => h.id === selectedLayerId) ?? null;

	const [drag, setDrag] = useState<DragState>(null);
	const [readout, setReadout] = useState<{
		canvasX: number;
		canvasY: number;
		label: string;
	} | null>(null);
	const [snapHints, setSnapHints] = useState<{ x: boolean; y: boolean }>({
		x: false,
		y: false,
	});

	const startMove = useCallback(
		(event: React.PointerEvent, handle: LayerHandle) => {
			event.preventDefault();
			event.stopPropagation();
			if (!fit) return;
			setSelectedLayerId(handle.id);
			setEditTarget(handle.editTarget);
			setPaused(true);
			setDrag({
				kind: "move",
				handleId: handle.id,
				startClientX: event.clientX,
				startClientY: event.clientY,
				startBBox: { ...handle.bbox },
				screenScale: fit.scale,
				applyMove: handle.applyMove,
			});
			(event.target as HTMLElement).setPointerCapture?.(event.pointerId);
		},
		[fit, setSelectedLayerId, setEditTarget, setPaused],
	);

	const startResize = useCallback(
		(event: React.PointerEvent, handle: LayerHandle, corner: ResizeCorner) => {
			event.preventDefault();
			event.stopPropagation();
			if (!fit) return;
			setSelectedLayerId(handle.id);
			setEditTarget(handle.editTarget);
			setPaused(true);
			setDrag({
				kind: "resize",
				handleId: handle.id,
				corner,
				startClientX: event.clientX,
				startClientY: event.clientY,
				startBBox: { ...handle.bbox },
				screenScale: fit.scale,
				applyResize: handle.applyResize,
			});
			(event.target as HTMLElement).setPointerCapture?.(event.pointerId);
		},
		[fit, setSelectedLayerId, setEditTarget, setPaused],
	);

	useLayoutEffect(() => {
		if (!drag) return;
		const onMove = (event: PointerEvent) => {
			const dxScreen = event.clientX - drag.startClientX;
			const dyScreen = event.clientY - drag.startClientY;
			const dxCanvas = dxScreen / drag.screenScale;
			const dyCanvas = dyScreen / drag.screenScale;
			if (drag.kind === "move") {
				let useDx = dxCanvas;
				let useDy = dyCanvas;
				let snapX = false;
				let snapY = false;
				// Snap the bbox center on canvas center / edges with a 14px
				// canvas tolerance. Hold Alt to bypass.
				if (!event.altKey) {
					const centerX = drag.startBBox.x + drag.startBBox.w / 2 + dxCanvas;
					const centerY = drag.startBBox.y + drag.startBBox.h / 2 + dyCanvas;
					const sx = snapAxis(centerX, frameW, 14);
					const sy = snapAxis(centerY, frameH, 14);
					if (sx.snappedTo) {
						useDx = sx.value - (drag.startBBox.x + drag.startBBox.w / 2);
						snapX = true;
					}
					if (sy.snappedTo) {
						useDy = sy.value - (drag.startBBox.y + drag.startBBox.h / 2);
						snapY = true;
					}
				}
				updateScene(scene.id, drag.applyMove(useDx, useDy));
				const cx = drag.startBBox.x + drag.startBBox.w / 2 + useDx;
				const cy = drag.startBBox.y + drag.startBBox.h / 2 + useDy;
				setReadout({
					canvasX: cx,
					canvasY: cy,
					label: `${Math.round(cx)}, ${Math.round(cy)}`,
				});
				setSnapHints({ x: snapX, y: snapY });
			} else {
				updateScene(
					scene.id,
					drag.applyResize(
						drag.corner,
						dxCanvas,
						dyCanvas,
						drag.startBBox,
						event.shiftKey,
					),
				);
				setReadout({
					canvasX: drag.startBBox.x + drag.startBBox.w / 2,
					canvasY: drag.startBBox.y + drag.startBBox.h / 2,
					// Show the cumulative drag in canvas-px so the user has
					// a number to chase. Live bbox readback would be nicer
					// but it'd require coupling back to `handles` and
					// re-introduces the stale-closure thrash we just fixed.
					label: `Δ ${Math.round(dxCanvas)}, ${Math.round(dyCanvas)}`,
				});
			}
		};
		const onUp = () => {
			setDrag(null);
			setReadout(null);
			setSnapHints({ x: false, y: false });
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onUp);
		return () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			window.removeEventListener("pointercancel", onUp);
		};
	}, [drag, updateScene, scene.id, frameW, frameH]);

	if (!fit) return null;

	return (
		<div
			className="absolute inset-0"
			style={{ pointerEvents: "none", zIndex: 30 }}
		>
			{handles.map((handle) => (
				<HandleHitArea
					key={handle.id}
					handle={handle}
					fit={fit}
					isSelected={handle.id === selectedLayerId}
					onPointerDown={(event) => startMove(event, handle)}
				/>
			))}

			{selected && (
				<SelectionChrome
					handle={selected}
					fit={fit}
					readout={readout}
					snapHints={snapHints}
					frameW={frameW}
					frameH={frameH}
					onCornerDown={(event, corner) =>
						startResize(event, selected, corner)
					}
				/>
			)}
		</div>
	);
}

function HandleHitArea({
	handle,
	fit,
	isSelected,
	onPointerDown,
}: {
	handle: LayerHandle;
	fit: AspectFit;
	isSelected: boolean;
	onPointerDown: (event: React.PointerEvent) => void;
}) {
	const tl = canvasToScreen(fit, handle.bbox.x, handle.bbox.y);
	const screenW = handle.bbox.w * fit.scale;
	const screenH = handle.bbox.h * fit.scale;
	const isBg = handle.kind === "bg-image" || handle.kind === "bg-video";
	return (
		<div
			role="button"
			tabIndex={-1}
			onPointerDown={onPointerDown}
			className="absolute"
			style={{
				left: tl.x,
				top: tl.y,
				width: screenW,
				height: screenH,
				pointerEvents: "auto",
				cursor: isSelected ? "move" : "pointer",
				transform: handle.rotation
					? `rotate(${handle.rotation}deg)`
					: undefined,
				transformOrigin: "top left",
				border:
					isBg || isSelected
						? "2px solid transparent"
						: `1px dashed ${HOVER_DIM}`,
				background: "transparent",
				borderRadius: 2,
			}}
			title={handle.label}
		/>
	);
}

function SelectionChrome({
	handle,
	fit,
	readout,
	snapHints,
	frameW,
	frameH,
	onCornerDown,
}: {
	handle: LayerHandle;
	fit: AspectFit;
	readout: { canvasX: number; canvasY: number; label: string } | null;
	snapHints: { x: boolean; y: boolean };
	frameW: number;
	frameH: number;
	onCornerDown: (event: React.PointerEvent, corner: ResizeCorner) => void;
}) {
	const tl = canvasToScreen(fit, handle.bbox.x, handle.bbox.y);
	const screenW = handle.bbox.w * fit.scale;
	const screenH = handle.bbox.h * fit.scale;
	const corners: ResizeCorner[] = ["tl", "tr", "bl", "br"];

	return (
		<>
			{snapHints.x && (
				<div
					className="absolute"
					style={{
						left: fit.padX + (frameW / 2) * fit.scale,
						top: fit.padY,
						width: 1,
						height: fit.drawnH,
						background: RING_COLOR,
						pointerEvents: "none",
						zIndex: 1,
					}}
				/>
			)}
			{snapHints.y && (
				<div
					className="absolute"
					style={{
						top: fit.padY + (frameH / 2) * fit.scale,
						left: fit.padX,
						height: 1,
						width: fit.drawnW,
						background: RING_COLOR,
						pointerEvents: "none",
						zIndex: 1,
					}}
				/>
			)}

			<div
				className="absolute"
				style={{
					left: tl.x,
					top: tl.y,
					width: screenW,
					height: screenH,
					transform: handle.rotation
						? `rotate(${handle.rotation}deg)`
						: undefined,
					transformOrigin: "top left",
					// Inset shadow paints the 2px ring INSIDE the bbox so
					// the visual rect matches the actual image rect — CSS
					// outline draws external and made the box look ~4px
					// wider and taller than the rendered content.
					boxShadow: `inset 0 0 0 2px ${RING_COLOR}`,
					pointerEvents: "none",
					zIndex: 2,
				}}
			/>

			{handle.resizable &&
				corners.map((corner) => {
					const cx =
						corner === "tl" || corner === "bl" ? tl.x : tl.x + screenW;
					const cy =
						corner === "tl" || corner === "tr" ? tl.y : tl.y + screenH;
					return (
						<div
							key={corner}
							onPointerDown={(event) => onCornerDown(event, corner)}
							className="absolute"
							style={{
								left: cx - 6,
								top: cy - 6,
								width: 12,
								height: 12,
								background: "#10b981",
								border: "2px solid #064e3b",
								borderRadius: 3,
								pointerEvents: "auto",
								zIndex: 3,
								cursor:
									corner === "tl" || corner === "br"
										? "nwse-resize"
										: "nesw-resize",
								boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
							}}
						/>
					);
				})}

			{handle.resizable && !handle.uniformScale && (
				<>
					<EdgeMarker x={tl.x + screenW / 2} y={tl.y} />
					<EdgeMarker x={tl.x + screenW / 2} y={tl.y + screenH} />
					<EdgeMarker x={tl.x} y={tl.y + screenH / 2} />
					<EdgeMarker x={tl.x + screenW} y={tl.y + screenH / 2} />
				</>
			)}

			{readout && (
				<>
					<div
						className="absolute px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-emerald-500 text-black shadow-md pointer-events-none"
						style={{
							left: tl.x,
							top: Math.max(0, tl.y - 22),
							zIndex: 4,
						}}
					>
						{readout.label}
					</div>
					<AxisGuides
						canvasX={readout.canvasX}
						canvasY={readout.canvasY}
						fit={fit}
					/>
				</>
			)}
		</>
	);
}

function EdgeMarker({ x, y }: { x: number; y: number }) {
	return (
		<div
			className="absolute"
			style={{
				left: x - 3,
				top: y - 3,
				width: 6,
				height: 6,
				borderRadius: 999,
				background: RING_DIM,
				pointerEvents: "none",
				zIndex: 2,
			}}
		/>
	);
}

function AxisGuides({
	canvasX,
	canvasY,
	fit,
}: {
	canvasX: number;
	canvasY: number;
	fit: AspectFit;
}) {
	const screenX = fit.padX + canvasX * fit.scale;
	const screenY = fit.padY + canvasY * fit.scale;
	return (
		<div
			className="absolute inset-0 pointer-events-none"
			style={{ zIndex: 4 }}
		>
			<div
				className="absolute"
				style={{
					left: screenX,
					top: fit.padY,
					height: fit.drawnH,
					width: 1,
					background:
						"repeating-linear-gradient(0deg, rgba(52,211,153,0.7) 0 4px, transparent 4px 8px)",
				}}
			/>
			<div
				className="absolute"
				style={{
					top: screenY,
					left: fit.padX,
					width: fit.drawnW,
					height: 1,
					background:
						"repeating-linear-gradient(90deg, rgba(52,211,153,0.7) 0 4px, transparent 4px 8px)",
				}}
			/>
			<div
				className="absolute px-1 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500 text-black"
				style={{
					left: screenX,
					top: Math.max(0, fit.padY - 18),
					transform: "translateX(-50%)",
				}}
			>
				x {Math.round(canvasX)}
			</div>
			<div
				className="absolute px-1 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500 text-black"
				style={{
					top: screenY,
					left: Math.max(0, fit.padX - 4),
					transform: "translate(-100%, -50%)",
				}}
			>
				y {Math.round(canvasY)}
			</div>
		</div>
	);
}
