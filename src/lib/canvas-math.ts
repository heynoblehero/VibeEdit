import type { Scene } from "@/lib/scene-schema";

// Fixed reference frame the renderer uses for broll layout. Kept in sync
// with src/remotion/components/BRoll.tsx so the on-screen handles match
// where the renderer actually paints.
const BROLL_REF_W = 1920;
const BROLL_REF_H = 1080;

// Bottom-anchored character height baseline. Matches the SceneRenderer.
const CHAR_HEIGHT = 550;
const CHAR_WIDTH_RATIO = 0.8;

export type LayerKind =
	| "text-item"
	| "shape"
	| "broll"
	| "bg-image"
	| "bg-video"
	| "character";

export type ResizeCorner = "tl" | "tr" | "bl" | "br";

export interface BBox {
	x: number;
	y: number;
	w: number;
	h: number;
}

export interface AspectFit {
	scale: number;
	padX: number;
	padY: number;
	drawnW: number;
	drawnH: number;
}

/**
 * Map the player wrapper's display rect onto the canvas frame, returning
 * the scale + symmetric letterbox padding. Single source of truth — every
 * overlay in the editor must agree on these numbers or the resize box
 * drifts away from the rendered content.
 */
export function aspectFit(
	rect: { width: number; height: number },
	frameW: number,
	frameH: number,
): AspectFit | null {
	if (rect.width === 0 || rect.height === 0) return null;
	const scale = Math.min(rect.width / frameW, rect.height / frameH);
	const drawnW = frameW * scale;
	const drawnH = frameH * scale;
	return {
		scale,
		padX: (rect.width - drawnW) / 2,
		padY: (rect.height - drawnH) / 2,
		drawnW,
		drawnH,
	};
}

/** Convert canvas-px → screen-px relative to the player wrapper. */
export function canvasToScreen(fit: AspectFit, x: number, y: number) {
	return { x: fit.padX + x * fit.scale, y: fit.padY + y * fit.scale };
}

/** Convert canvas-px size → screen-px size. */
export function canvasSizeToScreen(fit: AspectFit, w: number, h: number) {
	return { w: w * fit.scale, h: h * fit.scale };
}

export interface LayerHandle {
	id: string;
	kind: LayerKind;
	label: string;
	bbox: BBox;
	rotation: number;
	resizable: boolean;
	uniformScale: boolean;
	editTarget:
		| "text"
		| "shape"
		| "broll"
		| "background"
		| "character"
		| "media";
	/** Apply a translation in canvas-px and return a Scene patch. */
	applyMove: (dx: number, dy: number) => Partial<Scene>;
	/** Apply a corner resize. `dx/dy` are pointer deltas in canvas-px. */
	applyResize: (
		corner: ResizeCorner,
		dx: number,
		dy: number,
		initial: BBox,
		keepAspect: boolean,
	) => Partial<Scene>;
}

function approximateTextBBox(
	item: { content: string; x: number; y: number; w?: number; fontSize: number; lineHeight?: number },
): BBox {
	const lines = (item.content || " ").split("\n");
	const longest = lines.reduce((max, line) => Math.max(max, line.length), 1);
	const w = Math.max(80, item.w ?? longest * item.fontSize * 0.55);
	const lh = item.lineHeight ?? 1.1;
	const h = Math.max(item.fontSize * 1.2, lines.length * item.fontSize * lh);
	return { x: item.x, y: item.y, w, h };
}

function brollLayout(position: string) {
	switch (position) {
		case "full":
			return { x: 0, y: 0, w: BROLL_REF_W, h: BROLL_REF_H };
		case "overlay-tl":
			return { x: 60, y: 60, w: 560, h: 315 };
		case "overlay-tr":
			return { x: BROLL_REF_W - 620, y: 60, w: 560, h: 315 };
		case "overlay-bl":
			return { x: 60, y: BROLL_REF_H - 375, w: 560, h: 315 };
		case "overlay-br":
			return { x: BROLL_REF_W - 620, y: BROLL_REF_H - 375, w: 560, h: 315 };
		case "pip-left":
			return { x: 80, y: 260, w: 760, h: 560 };
		case "pip-right":
			return { x: BROLL_REF_W - 840, y: 260, w: 760, h: 560 };
		case "lower-third":
			return { x: 0, y: BROLL_REF_H - 400, w: BROLL_REF_W, h: 400 };
		default:
			return { x: 0, y: 0, w: BROLL_REF_W, h: BROLL_REF_H };
	}
}

/**
 * Build the list of manipulable handles for a scene, in painter order
 * (background first, foreground last). Each handle owns its own move
 * + resize math so the overlay can stay generic.
 */
export function getLayerHandles(
	scene: Scene,
	frameW: number,
	frameH: number,
): LayerHandle[] {
	const handles: LayerHandle[] = [];

	// Background image / video share the "media:bg" handle id — they're
	// mutually exclusive in the BackgroundPanel UI, and the rest of the
	// app (selection chrome, delete handler, computeSelection) already
	// keys off that id, so unifying them keeps the layer-routing tidy.
	const bgKind: "bg-image" | "bg-video" | null = scene.background?.imageUrl
		? "bg-image"
		: scene.background?.videoUrl
			? "bg-video"
			: null;
	if (bgKind) {
		const isImage = bgKind === "bg-image";
		const scale = isImage
			? scene.background.imageScale ?? 1
			: scene.background.videoScale ?? 1;
		const offX = isImage
			? scene.background.imageOffsetX ?? 0
			: scene.background.videoOffsetX ?? 0;
		const offY = isImage
			? scene.background.imageOffsetY ?? 0
			: scene.background.videoOffsetY ?? 0;
		const w = frameW * scale;
		const h = frameH * scale;
		// The renderer composes transforms as `scale(s) translate(tx, ty)`,
		// which CSS evaluates right-to-left → translation is magnified by
		// the scale on screen. Mirror that here so the green box hugs the
		// actually-rendered image instead of drifting away from it.
		handles.push({
			id: "media:bg",
			kind: bgKind,
			label: isImage ? "Background image" : "Background video",
			bbox: {
				x: frameW / 2 - w / 2 + offX * scale,
				y: frameH / 2 - h / 2 + offY * scale,
				w,
				h,
			},
			rotation: 0,
			resizable: true,
			uniformScale: true,
			editTarget: "background",
			// Drag delta `dx` is in canvas-px (already accounting for the
			// player's display scale). The renderer multiplies offset by
			// imageScale, so we divide by it here to keep the image
			// tracking the cursor 1:1.
			applyMove: (dx, dy) => {
				const safe = Math.max(0.0001, scale);
				const newOffX = Math.round(offX + dx / safe);
				const newOffY = Math.round(offY + dy / safe);
				return isImage
					? {
							background: {
								...scene.background,
								imageOffsetX: newOffX,
								imageOffsetY: newOffY,
							},
						}
					: {
							background: {
								...scene.background,
								videoOffsetX: newOffX,
								videoOffsetY: newOffY,
							},
						};
			},
			applyResize: (corner, dx, dy) => {
				const next = uniformScaleFromCorner(scale, corner, dx, dy, frameW, frameH);
				return {
					background: {
						...scene.background,
						...(isImage
							? { imageScale: round2(next) }
							: { videoScale: round2(next) }),
					},
				};
			},
		});
	}

	// B-roll — uniform scale on top of a layout-defined position. We
	// store offsets/scale on the broll so the layout stays sticky and
	// the user can nudge from there.
	for (const broll of scene.broll ?? []) {
		const layout = brollLayout(broll.position);
		const scale = broll.scale ?? 1;
		const offX = broll.offsetX ?? 0;
		const offY = broll.offsetY ?? 0;
		// scale is applied around layout center via CSS transform: scale
		// in the renderer, so the bbox is layout × scale, recentered.
		const cx = layout.x + layout.w / 2 + offX;
		const cy = layout.y + layout.h / 2 + offY;
		const w = layout.w * scale;
		const h = layout.h * scale;
		const id = `media:broll:${broll.id}`;
		handles.push({
			id,
			kind: "broll",
			label: `B-roll · ${broll.position}`,
			bbox: { x: cx - w / 2, y: cy - h / 2, w, h },
			rotation: 0,
			resizable: true,
			uniformScale: true,
			editTarget: "broll",
			applyMove: (dx, dy) => ({
				broll: (scene.broll ?? []).map((b) =>
					b.id === broll.id
						? { ...b, offsetX: Math.round(offX + dx), offsetY: Math.round(offY + dy) }
						: b,
				),
			}),
			applyResize: (corner, dx, dy) => {
				const next = uniformScaleFromCorner(scale, corner, dx, dy, layout.w, layout.h);
				return {
					broll: (scene.broll ?? []).map((b) =>
						b.id === broll.id ? { ...b, scale: round2(next) } : b,
					),
				};
			},
		});
	}

	// Character — bottom-anchored. characterX/Y is the bottom-center
	// anchor; height = CHAR_HEIGHT × scale. Resize keeps that anchor
	// pinned so the character doesn't sink into the floor.
	const hasChar = !!(scene.characterId || scene.characterUrl);
	if (hasChar) {
		const scale = scene.characterScale ?? 1;
		const charX = scene.characterX ?? Math.round(frameW / 2);
		const charY = scene.characterY ?? Math.round(frameH * 0.83);
		const h = CHAR_HEIGHT * scale;
		const w = h * CHAR_WIDTH_RATIO;
		handles.push({
			id: "media:character",
			kind: "character",
			label: "Character",
			bbox: { x: charX - w / 2, y: charY - h, w, h },
			rotation: 0,
			resizable: true,
			uniformScale: true,
			editTarget: "character",
			applyMove: (dx, dy) => ({
				characterX: Math.round(charX + dx),
				characterY: Math.round(charY + dy),
			}),
			applyResize: (corner, dx, dy) => {
				const next = uniformScaleFromCorner(scale, corner, dx, dy, w, h);
				return { characterScale: round2(next) };
			},
		});
	}

	// Shapes — proper free w/h with corner anchoring on the opposite
	// corner. Shift on resize would lock aspect; that's wired in the
	// overlay via `keepAspect`.
	for (const shape of scene.shapes ?? []) {
		const id = `shape:${shape.id}`;
		handles.push({
			id,
			kind: "shape",
			label: `Shape · ${shape.kind}`,
			bbox: { x: shape.x, y: shape.y, w: shape.w, h: shape.h },
			rotation: shape.rotation ?? 0,
			resizable: true,
			uniformScale: false,
			editTarget: "shape",
			applyMove: (dx, dy) => ({
				shapes: (scene.shapes ?? []).map((sh) =>
					sh.id === shape.id
						? { ...sh, x: Math.round(shape.x + dx), y: Math.round(shape.y + dy) }
						: sh,
				),
			}),
			applyResize: (corner, dx, dy, initial, keepAspect) => {
				const next = freeResize(initial, corner, dx, dy, keepAspect);
				return {
					shapes: (scene.shapes ?? []).map((sh) =>
						sh.id === shape.id
							? {
									...sh,
									x: Math.round(next.x),
									y: Math.round(next.y),
									w: Math.max(8, Math.round(next.w)),
									h: Math.max(8, Math.round(next.h)),
								}
							: sh,
					),
				};
			},
		});
	}

	// Text items — top-left anchor, fontSize-driven dimensions. Resize
	// scales fontSize (and width if explicitly set) so the text stays
	// readable; it's not a free w/h box.
	for (const item of scene.textItems ?? []) {
		const id = `text-item:${item.id}`;
		const bbox = approximateTextBBox(item);
		handles.push({
			id,
			kind: "text-item",
			label: `Text · ${item.content.slice(0, 18) || "Empty"}`,
			bbox,
			rotation: item.rotation ?? 0,
			resizable: true,
			uniformScale: true,
			editTarget: "text",
			applyMove: (dx, dy) => ({
				textItems: (scene.textItems ?? []).map((it) =>
					it.id === item.id
						? { ...it, x: Math.round(item.x + dx), y: Math.round(item.y + dy) }
						: it,
				),
			}),
			applyResize: (corner, dx, dy, initial) => {
				// Uniform scale anchored at the corner OPPOSITE the one being
				// dragged so the text grows/shrinks toward the cursor.
				const factor = uniformScaleFromCorner(1, corner, dx, dy, initial.w, initial.h);
				const minSize = 12;
				const nextSize = Math.max(minSize, Math.round(item.fontSize * factor));
				const sizeRatio = nextSize / item.fontSize;
				const nextW = item.w ? Math.max(40, Math.round(item.w * sizeRatio)) : item.w;
				// Keep the anchor (opposite corner of the dragged one) pinned.
				const anchor = oppositeCorner(corner);
				const ax = anchor === "tl" || anchor === "bl" ? initial.x : initial.x + initial.w;
				const ay = anchor === "tl" || anchor === "tr" ? initial.y : initial.y + initial.h;
				const nextH = initial.h * sizeRatio;
				const nextWFinal = (nextW ?? initial.w) * 1; // keep nominal
				const newX =
					anchor === "tl" || anchor === "bl"
						? ax
						: ax - (nextWFinal || initial.w * sizeRatio);
				const newY = anchor === "tl" || anchor === "tr" ? ay : ay - nextH;
				return {
					textItems: (scene.textItems ?? []).map((it) =>
						it.id === item.id
							? {
									...it,
									x: Math.round(newX),
									y: Math.round(newY),
									fontSize: nextSize,
									...(nextW !== undefined ? { w: nextW } : {}),
								}
							: it,
					),
				};
			},
		});
	}

	return handles;
}

function round2(value: number): number {
	return Math.round(value * 100) / 100;
}

function oppositeCorner(corner: ResizeCorner): ResizeCorner {
	if (corner === "tl") return "br";
	if (corner === "tr") return "bl";
	if (corner === "bl") return "tr";
	return "tl";
}

const CORNER_SIGN: Record<ResizeCorner, [number, number]> = {
	br: [1, 1],
	bl: [-1, 1],
	tr: [1, -1],
	tl: [-1, -1],
};

/**
 * Compute a new uniform scale from a corner drag. `outward` is the
 * pointer travel projected onto the corner's outward diagonal; we map
 * that onto a fraction of the box's natural diagonal so a full-corner
 * drag roughly doubles the scale. Clamped to a sane 0.05..6 range.
 */
function uniformScaleFromCorner(
	startScale: number,
	corner: ResizeCorner,
	dx: number,
	dy: number,
	refW: number,
	refH: number,
): number {
	const [sx, sy] = CORNER_SIGN[corner];
	const outward = sx * dx + sy * dy;
	const diag = Math.max(1, Math.hypot(refW, refH));
	const next = startScale * (1 + (outward * 2) / diag);
	return Math.max(0.05, Math.min(6, next));
}

/**
 * Free w/h resize anchored at the corner opposite the one being dragged.
 * Negative widths flip into positives by clamping x to the smaller edge.
 * Aspect-ratio lock is engaged when `keepAspect` is true.
 */
function freeResize(
	initial: BBox,
	corner: ResizeCorner,
	dx: number,
	dy: number,
	keepAspect: boolean,
): BBox {
	let { x, y, w, h } = initial;
	if (corner === "br") {
		w = initial.w + dx;
		h = initial.h + dy;
	} else if (corner === "bl") {
		x = initial.x + dx;
		w = initial.w - dx;
		h = initial.h + dy;
	} else if (corner === "tr") {
		y = initial.y + dy;
		w = initial.w + dx;
		h = initial.h - dy;
	} else {
		x = initial.x + dx;
		y = initial.y + dy;
		w = initial.w - dx;
		h = initial.h - dy;
	}
	if (keepAspect && initial.w > 0 && initial.h > 0) {
		const ratio = initial.w / initial.h;
		// Use the dominant axis to drive the other one.
		if (Math.abs(w / ratio) >= Math.abs(h)) {
			const nh = w / ratio;
			if (corner === "tl" || corner === "tr") y = initial.y + (initial.h - nh);
			h = nh;
		} else {
			const nw = h * ratio;
			if (corner === "tl" || corner === "bl") x = initial.x + (initial.w - nw);
			w = nw;
		}
	}
	// Normalize negatives.
	if (w < 0) {
		x = x + w;
		w = -w;
	}
	if (h < 0) {
		y = y + h;
		h = -h;
	}
	return { x, y, w, h };
}

/**
 * Snap a moving x/y onto canvas guides (center, halves, edges). Returns
 * both the snapped value and which guide fired so the overlay can paint
 * a hint line. Tolerance is in canvas px.
 */
export function snapAxis(
	value: number,
	frameSize: number,
	tolerance: number,
): { value: number; snappedTo: "start" | "center" | "end" | null } {
	const candidates: Array<{ at: number; tag: "start" | "center" | "end" }> = [
		{ at: 0, tag: "start" },
		{ at: frameSize / 2, tag: "center" },
		{ at: frameSize, tag: "end" },
	];
	for (const c of candidates) {
		if (Math.abs(value - c.at) <= tolerance) {
			return { value: c.at, snappedTo: c.tag };
		}
	}
	return { value, snappedTo: null };
}
