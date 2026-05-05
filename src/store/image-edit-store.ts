"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type ImageLayerKind = "text" | "rect" | "ellipse" | "image";

interface BaseLayer {
	id: string;
	kind: ImageLayerKind;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	opacity: number;
	locked?: boolean;
	hidden?: boolean;
}

export interface TextLayer extends BaseLayer {
	kind: "text";
	text: string;
	fontSize: number;
	fontFamily: string;
	fontWeight: number;
	color: string;
	align: "left" | "center" | "right";
	letterSpacing?: number;
	lineHeight?: number;
}

export interface ShapeLayer extends BaseLayer {
	kind: "rect" | "ellipse";
	fill: string;
	stroke?: string;
	strokeWidth?: number;
	radius?: number;
}

export interface ImageBitmapLayer extends BaseLayer {
	kind: "image";
	src: string;
	objectFit: "cover" | "contain";
}

export type ImageLayer = TextLayer | ShapeLayer | ImageBitmapLayer;
// Distributed Omit so that union variants stay narrow when passed
// into addLayer — `Omit<ImageLayer, "id">` collapses the union and
// kills discrimination, breaking literal type-checks at call sites.
export type ImageLayerInput =
	| Omit<TextLayer, "id">
	| Omit<ShapeLayer, "id">
	| Omit<ImageBitmapLayer, "id">;

export interface ImageDesign {
	id: string;
	name: string;
	width: number;
	height: number;
	background: string;
	layers: ImageLayer[];
	updatedAt: number;
}

interface ImageEditStore {
	designs: Record<string, ImageDesign>;
	activeDesignId: string | null;
	selectedLayerId: string | null;

	createDesign(preset?: { name?: string; width?: number; height?: number }): string;
	deleteDesign(id: string): void;
	renameDesign(id: string, name: string): void;
	setActive(id: string | null): void;
	setBackground(color: string): void;
	setCanvasSize(width: number, height: number): void;

	addLayer(layer: ImageLayerInput): string;
	updateLayer(id: string, patch: Partial<ImageLayer>): void;
	removeLayer(id: string): void;
	duplicateLayer(id: string): void;
	moveLayer(id: string, direction: "up" | "down" | "top" | "bottom"): void;
	selectLayer(id: string | null): void;
}

const PRESET_DEFAULT = { name: "Untitled design", width: 1080, height: 1080 };

const createId = () => `il-${Math.random().toString(36).slice(2, 10)}`;

/**
 * State for the Image workspace — a minimal Canva-like editor that
 * lives next to Video / Audio / Animate. Designs persist to
 * localStorage so a refresh keeps your layout. Each design owns its
 * own canvas size, background, and ordered layer stack.
 *
 * The renderer (ImageCanvas) reads from this store; the inspector
 * mutates it. Export-to-PNG walks `layers` in order onto an offscreen
 * 2D canvas — see ImageWorkspace.exportPng.
 */
export const useImageEditStore = create<ImageEditStore>()(
	persist(
		(set, get) => ({
			designs: {},
			activeDesignId: null,
			selectedLayerId: null,

			createDesign: (preset) => {
				const merged = { ...PRESET_DEFAULT, ...(preset ?? {}) };
				const id = `id-${Math.random().toString(36).slice(2, 10)}`;
				const design: ImageDesign = {
					id,
					name: merged.name,
					width: merged.width,
					height: merged.height,
					background: "#0a0a0a",
					layers: [],
					updatedAt: Date.now(),
				};
				set((s) => ({
					designs: { ...s.designs, [id]: design },
					activeDesignId: id,
					selectedLayerId: null,
				}));
				return id;
			},

			deleteDesign: (id) =>
				set((s) => {
					const { [id]: _, ...rest } = s.designs;
					const next: Partial<ImageEditStore> = { designs: rest };
					if (s.activeDesignId === id) {
						const remaining = Object.keys(rest);
						next.activeDesignId = remaining[0] ?? null;
						next.selectedLayerId = null;
					}
					return next as ImageEditStore;
				}),

			renameDesign: (id, name) =>
				set((s) => {
					const d = s.designs[id];
					if (!d) return s;
					return {
						designs: {
							...s.designs,
							[id]: { ...d, name, updatedAt: Date.now() },
						},
					};
				}),

			setActive: (id) =>
				set({ activeDesignId: id, selectedLayerId: null }),

			setBackground: (color) => {
				const id = get().activeDesignId;
				if (!id) return;
				set((s) => {
					const d = s.designs[id];
					if (!d) return s;
					return {
						designs: {
							...s.designs,
							[id]: { ...d, background: color, updatedAt: Date.now() },
						},
					};
				});
			},

			setCanvasSize: (width, height) => {
				const id = get().activeDesignId;
				if (!id) return;
				set((s) => {
					const d = s.designs[id];
					if (!d) return s;
					return {
						designs: {
							...s.designs,
							[id]: { ...d, width, height, updatedAt: Date.now() },
						},
					};
				});
			},

			addLayer: (layer: ImageLayerInput) => {
				const designId = get().activeDesignId;
				if (!designId) return "";
				const id = createId();
				set((s) => {
					const d = s.designs[designId];
					if (!d) return s;
					const next: ImageLayer = { ...(layer as ImageLayer), id };
					return {
						designs: {
							...s.designs,
							[designId]: {
								...d,
								layers: [...d.layers, next],
								updatedAt: Date.now(),
							},
						},
						selectedLayerId: id,
					};
				});
				return id;
			},

			updateLayer: (id, patch) => {
				const designId = get().activeDesignId;
				if (!designId) return;
				set((s) => {
					const d = s.designs[designId];
					if (!d) return s;
					return {
						designs: {
							...s.designs,
							[designId]: {
								...d,
								layers: d.layers.map((l) =>
									l.id === id ? ({ ...l, ...patch } as ImageLayer) : l,
								),
								updatedAt: Date.now(),
							},
						},
					};
				});
			},

			removeLayer: (id) => {
				const designId = get().activeDesignId;
				if (!designId) return;
				set((s) => {
					const d = s.designs[designId];
					if (!d) return s;
					return {
						designs: {
							...s.designs,
							[designId]: {
								...d,
								layers: d.layers.filter((l) => l.id !== id),
								updatedAt: Date.now(),
							},
						},
						selectedLayerId:
							s.selectedLayerId === id ? null : s.selectedLayerId,
					};
				});
			},

			duplicateLayer: (id) => {
				const designId = get().activeDesignId;
				if (!designId) return;
				set((s) => {
					const d = s.designs[designId];
					if (!d) return s;
					const src = d.layers.find((l) => l.id === id);
					if (!src) return s;
					const copy: ImageLayer = {
						...src,
						id: createId(),
						x: src.x + 24,
						y: src.y + 24,
					};
					return {
						designs: {
							...s.designs,
							[designId]: {
								...d,
								layers: [...d.layers, copy],
								updatedAt: Date.now(),
							},
						},
						selectedLayerId: copy.id,
					};
				});
			},

			moveLayer: (id, direction) => {
				const designId = get().activeDesignId;
				if (!designId) return;
				set((s) => {
					const d = s.designs[designId];
					if (!d) return s;
					const idx = d.layers.findIndex((l) => l.id === id);
					if (idx < 0) return s;
					const next = [...d.layers];
					const [layer] = next.splice(idx, 1);
					if (direction === "top") next.push(layer);
					else if (direction === "bottom") next.unshift(layer);
					else if (direction === "up")
						next.splice(Math.min(idx + 1, next.length), 0, layer);
					else next.splice(Math.max(idx - 1, 0), 0, layer);
					return {
						designs: {
							...s.designs,
							[designId]: { ...d, layers: next, updatedAt: Date.now() },
						},
					};
				});
			},

			selectLayer: (id) => set({ selectedLayerId: id }),
		}),
		{
			name: "vibeedit-image-edit",
			storage: createJSONStorage(() => localStorage),
		},
	),
);

export const SIZE_PRESETS = [
	{ label: "Square 1:1", width: 1080, height: 1080 },
	{ label: "Story 9:16", width: 1080, height: 1920 },
	{ label: "Post 4:5", width: 1080, height: 1350 },
	{ label: "Landscape 16:9", width: 1920, height: 1080 },
	{ label: "Banner 3:1", width: 1500, height: 500 },
] as const;
