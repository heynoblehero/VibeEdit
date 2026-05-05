"use client";

import {
	Circle,
	Download,
	Image as ImageIcon,
	Plus,
	Square,
	Type,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "@/lib/toast";
import {
	type ImageDesign,
	type ImageLayer,
	SIZE_PRESETS,
	useImageEditStore,
} from "@/store/image-edit-store";
import { ImageCanvas } from "./ImageCanvas";
import { ImageInspector } from "./ImageInspector";
import { LayerList } from "./LayerList";

/**
 * Sky-themed Canva-lite workspace. Sits next to Video / Audio /
 * Animate as the fourth tab. Designs persist to localStorage via
 * useImageEditStore. PNG export walks the active design's layer
 * stack onto an offscreen 2D canvas — no html2canvas dependency.
 */
export function ImageWorkspace() {
	const designs = useImageEditStore((s) => s.designs);
	const activeId = useImageEditStore((s) => s.activeDesignId);
	const createDesign = useImageEditStore((s) => s.createDesign);
	const deleteDesign = useImageEditStore((s) => s.deleteDesign);
	const setActive = useImageEditStore((s) => s.setActive);
	const renameDesign = useImageEditStore((s) => s.renameDesign);
	const addLayer = useImageEditStore((s) => s.addLayer);

	// Auto-create one design on first mount so the canvas isn't empty.
	useEffect(() => {
		const state = useImageEditStore.getState();
		if (Object.keys(state.designs).length === 0) {
			state.createDesign({ name: "Untitled design" });
		} else if (!state.activeDesignId) {
			const first = Object.keys(state.designs)[0];
			if (first) state.setActive(first);
		}
	}, []);

	const fileInputRef = useRef<HTMLInputElement>(null);
	const active = activeId ? designs[activeId] : null;

	const addText = () => {
		if (!active) return;
		addLayer({
			kind: "text",
			text: "Heading",
			x: active.width / 2 - 200,
			y: active.height / 2 - 60,
			width: 400,
			height: 120,
			rotation: 0,
			opacity: 1,
			fontSize: 96,
			fontFamily: "system-ui, -apple-system, sans-serif",
			fontWeight: 700,
			color: "#ffffff",
			align: "center",
			lineHeight: 1.1,
		});
	};
	const addRect = () => {
		if (!active) return;
		addLayer({
			kind: "rect",
			x: active.width / 2 - 150,
			y: active.height / 2 - 100,
			width: 300,
			height: 200,
			rotation: 0,
			opacity: 1,
			fill: "#0ea5e9",
			radius: 16,
		});
	};
	const addEllipse = () => {
		if (!active) return;
		addLayer({
			kind: "ellipse",
			x: active.width / 2 - 120,
			y: active.height / 2 - 120,
			width: 240,
			height: 240,
			rotation: 0,
			opacity: 1,
			fill: "#38bdf8",
		});
	};
	const handleFile = async (file: File) => {
		if (!active) return;
		const reader = new FileReader();
		reader.onload = () => {
			const dataUrl = reader.result as string;
			const probe = new Image();
			probe.onload = () => {
				const ratio = probe.width / probe.height || 1;
				const w = Math.min(active.width * 0.6, probe.width);
				const h = w / ratio;
				addLayer({
					kind: "image",
					src: dataUrl,
					x: active.width / 2 - w / 2,
					y: active.height / 2 - h / 2,
					width: w,
					height: h,
					rotation: 0,
					opacity: 1,
					objectFit: "cover",
				});
			};
			probe.src = dataUrl;
		};
		reader.readAsDataURL(file);
	};

	const exportPng = async () => {
		if (!active) return;
		try {
			const blob = await renderDesignToPng(active);
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = `${active.name || "design"}.png`;
			a.click();
			URL.revokeObjectURL(url);
			toast.success("Exported");
		} catch (err) {
			console.error(err);
			toast.error("Export failed", {
				description: (err as Error).message ?? "unknown",
			});
		}
	};

	return (
		<div className="flex-1 flex flex-col min-h-0">
			<div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-800 bg-neutral-950/60">
				<select
					value={activeId ?? ""}
					onChange={(e) => setActive(e.target.value)}
					className="bg-neutral-900 border border-neutral-800 rounded text-[12px] text-neutral-200 px-2 py-1 focus:border-sky-500 focus:outline-none"
				>
					{Object.values(designs).map((d) => (
						<option key={d.id} value={d.id}>
							{d.name}
						</option>
					))}
				</select>
				<input
					type="text"
					value={active?.name ?? ""}
					onChange={(e) => active && renameDesign(active.id, e.target.value)}
					placeholder="Design name"
					className="bg-neutral-900 border border-neutral-800 rounded text-[12px] text-neutral-200 px-2 py-1 focus:border-sky-500 focus:outline-none w-44"
				/>
				<button
					type="button"
					onClick={() => createDesign()}
					className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-sky-300 hover:bg-sky-500/10 ring-1 ring-sky-500/30"
					title="New design"
				>
					<Plus className="h-3 w-3" /> Design
				</button>
				<select
					onChange={(e) => {
						const preset = SIZE_PRESETS.find((p) => p.label === e.target.value);
						if (preset && active) {
							useImageEditStore
								.getState()
								.setCanvasSize(preset.width, preset.height);
						}
					}}
					value=""
					className="bg-neutral-900 border border-neutral-800 rounded text-[11px] text-neutral-300 px-2 py-1 focus:border-sky-500 focus:outline-none"
				>
					<option value="">Size preset…</option>
					{SIZE_PRESETS.map((p) => (
						<option key={p.label} value={p.label}>
							{p.label}
						</option>
					))}
				</select>
				<div className="h-4 w-px bg-neutral-800 mx-1" />
				<button
					type="button"
					onClick={addText}
					className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-neutral-300 hover:bg-neutral-800"
					title="Add text"
				>
					<Type className="h-3 w-3" /> Text
				</button>
				<button
					type="button"
					onClick={addRect}
					className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-neutral-300 hover:bg-neutral-800"
					title="Add rectangle"
				>
					<Square className="h-3 w-3" /> Rect
				</button>
				<button
					type="button"
					onClick={addEllipse}
					className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-neutral-300 hover:bg-neutral-800"
					title="Add ellipse"
				>
					<Circle className="h-3 w-3" /> Ellipse
				</button>
				<button
					type="button"
					onClick={() => fileInputRef.current?.click()}
					className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-neutral-300 hover:bg-neutral-800"
					title="Add image"
				>
					<ImageIcon className="h-3 w-3" /> Image
				</button>
				<input
					ref={fileInputRef}
					type="file"
					accept="image/*"
					className="hidden"
					onChange={(e) => {
						const f = e.target.files?.[0];
						if (f) handleFile(f);
						e.target.value = "";
					}}
				/>
				<div className="ml-auto flex items-center gap-1.5">
					<button
						type="button"
						onClick={exportPng}
						className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-sky-500 hover:bg-sky-400 text-neutral-950 text-[12px] font-semibold"
						title="Download as PNG"
					>
						<Download className="h-3.5 w-3.5" /> Export PNG
					</button>
					{active && Object.keys(designs).length > 1 ? (
						<button
							type="button"
							onClick={() => {
								if (window.confirm(`Delete "${active.name}"?`)) {
									deleteDesign(active.id);
								}
							}}
							className="px-2 py-1.5 rounded text-[11px] text-neutral-500 hover:text-red-300 hover:bg-red-500/10"
							title="Delete this design"
						>
							Delete
						</button>
					) : null}
				</div>
			</div>
			<div className="flex-1 flex min-h-0">
				<LayerList />
				<ImageCanvas />
				<ImageInspector />
			</div>
		</div>
	);
}

/**
 * Render a design's layer stack to a PNG blob via offscreen 2D
 * canvas. Image layers fetch via crossOrigin=anonymous; data: URLs
 * (the upload path) work without CORS. Text uses canvas font shorthand.
 */
async function renderDesignToPng(design: ImageDesign): Promise<Blob> {
	const canvas = document.createElement("canvas");
	canvas.width = design.width;
	canvas.height = design.height;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("2d context unavailable");

	ctx.fillStyle = design.background;
	ctx.fillRect(0, 0, design.width, design.height);

	for (const layer of design.layers) {
		if (layer.hidden) continue;
		ctx.save();
		ctx.globalAlpha = layer.opacity;
		const cx = layer.x + layer.width / 2;
		const cy = layer.y + layer.height / 2;
		if (layer.rotation) {
			ctx.translate(cx, cy);
			ctx.rotate((layer.rotation * Math.PI) / 180);
			ctx.translate(-cx, -cy);
		}
		await drawLayer(ctx, layer);
		ctx.restore();
	}

	return await new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) resolve(blob);
			else reject(new Error("toBlob returned null"));
		}, "image/png");
	});
}

async function drawLayer(
	ctx: CanvasRenderingContext2D,
	layer: ImageLayer,
): Promise<void> {
	if (layer.kind === "rect") {
		ctx.fillStyle = layer.fill;
		if (layer.radius && layer.radius > 0) {
			roundedRect(ctx, layer.x, layer.y, layer.width, layer.height, layer.radius);
			ctx.fill();
		} else {
			ctx.fillRect(layer.x, layer.y, layer.width, layer.height);
		}
		if (layer.stroke && layer.strokeWidth) {
			ctx.strokeStyle = layer.stroke;
			ctx.lineWidth = layer.strokeWidth;
			if (layer.radius && layer.radius > 0) {
				roundedRect(ctx, layer.x, layer.y, layer.width, layer.height, layer.radius);
				ctx.stroke();
			} else {
				ctx.strokeRect(layer.x, layer.y, layer.width, layer.height);
			}
		}
		return;
	}
	if (layer.kind === "ellipse") {
		ctx.fillStyle = layer.fill;
		ctx.beginPath();
		ctx.ellipse(
			layer.x + layer.width / 2,
			layer.y + layer.height / 2,
			layer.width / 2,
			layer.height / 2,
			0,
			0,
			Math.PI * 2,
		);
		ctx.fill();
		if (layer.stroke && layer.strokeWidth) {
			ctx.strokeStyle = layer.stroke;
			ctx.lineWidth = layer.strokeWidth;
			ctx.stroke();
		}
		return;
	}
	if (layer.kind === "text") {
		ctx.fillStyle = layer.color;
		ctx.font = `${layer.fontWeight} ${layer.fontSize}px ${layer.fontFamily}`;
		ctx.textBaseline = "middle";
		ctx.textAlign =
			layer.align === "center"
				? "center"
				: layer.align === "right"
					? "right"
					: "left";
		const lines = layer.text.split(/\n/);
		const lh = layer.fontSize * (layer.lineHeight ?? 1.2);
		const startY = layer.y + layer.height / 2 - ((lines.length - 1) * lh) / 2;
		const tx =
			layer.align === "center"
				? layer.x + layer.width / 2
				: layer.align === "right"
					? layer.x + layer.width
					: layer.x;
		lines.forEach((line, i) => {
			ctx.fillText(line, tx, startY + i * lh);
		});
		return;
	}
	if (layer.kind === "image") {
		const img = await loadImage(layer.src);
		drawImageFitted(ctx, img, layer.x, layer.y, layer.width, layer.height, layer.objectFit);
	}
}

function loadImage(src: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "anonymous";
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
		img.src = src;
	});
}

function drawImageFitted(
	ctx: CanvasRenderingContext2D,
	img: HTMLImageElement,
	x: number,
	y: number,
	w: number,
	h: number,
	mode: "cover" | "contain",
) {
	const ratio = img.width / img.height;
	const targetRatio = w / h;
	let sx = 0;
	let sy = 0;
	let sw = img.width;
	let sh = img.height;
	let dx = x;
	let dy = y;
	let dw = w;
	let dh = h;
	if (mode === "cover") {
		if (ratio > targetRatio) {
			// image wider than box — crop sides
			const newW = img.height * targetRatio;
			sx = (img.width - newW) / 2;
			sw = newW;
		} else {
			const newH = img.width / targetRatio;
			sy = (img.height - newH) / 2;
			sh = newH;
		}
	} else {
		if (ratio > targetRatio) {
			dh = w / ratio;
			dy = y + (h - dh) / 2;
		} else {
			dw = h * ratio;
			dx = x + (w - dw) / 2;
		}
	}
	ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function roundedRect(
	ctx: CanvasRenderingContext2D,
	x: number,
	y: number,
	w: number,
	h: number,
	r: number,
) {
	const rad = Math.min(r, w / 2, h / 2);
	ctx.beginPath();
	ctx.moveTo(x + rad, y);
	ctx.lineTo(x + w - rad, y);
	ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
	ctx.lineTo(x + w, y + h - rad);
	ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
	ctx.lineTo(x + rad, y + h);
	ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
	ctx.lineTo(x, y + rad);
	ctx.quadraticCurveTo(x, y, x + rad, y);
	ctx.closePath();
}
