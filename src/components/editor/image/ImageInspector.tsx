"use client";

import { Copy, Lock, Trash2, Unlock } from "lucide-react";
import {
	type ImageBitmapLayer,
	type ImageLayer,
	type ShapeLayer,
	type TextLayer,
	useImageEditStore,
} from "@/store/image-edit-store";

/**
 * Right rail of the Image workspace. Reads the selected layer + the
 * canvas-level fields (background, size) and emits patches back into
 * the store. All inputs are immediate (no apply-button) — matches
 * Canva-like immediacy.
 */
export function ImageInspector() {
	const design = useImageEditStore((s) =>
		s.activeDesignId ? s.designs[s.activeDesignId] : null,
	);
	const selectedId = useImageEditStore((s) => s.selectedLayerId);
	const updateLayer = useImageEditStore((s) => s.updateLayer);
	const removeLayer = useImageEditStore((s) => s.removeLayer);
	const duplicateLayer = useImageEditStore((s) => s.duplicateLayer);
	const setBackground = useImageEditStore((s) => s.setBackground);
	const setCanvasSize = useImageEditStore((s) => s.setCanvasSize);

	if (!design) return null;
	const layer = design.layers.find((l) => l.id === selectedId) ?? null;

	return (
		<div className="w-72 shrink-0 flex flex-col border-l border-neutral-800 bg-neutral-950/40">
			<div className="sticky top-0 z-10 px-3 py-2 border-b border-neutral-800 bg-neutral-900 text-[11px] uppercase tracking-wider text-sky-300 font-semibold">
				{layer ? layerHeading(layer) : "Canvas"}
			</div>
			<div className="flex-1 overflow-y-auto p-3 space-y-4">
				{!layer ? (
					<CanvasFields
						design={design}
						onBg={setBackground}
						onSize={setCanvasSize}
					/>
				) : (
					<>
						{layer.kind === "text" ? (
							<TextFields
								layer={layer}
								onChange={(p) => updateLayer(layer.id, p)}
							/>
						) : layer.kind === "image" ? (
							<ImageFields
								layer={layer}
								onChange={(p) => updateLayer(layer.id, p)}
							/>
						) : (
							<ShapeFields
								layer={layer}
								onChange={(p) => updateLayer(layer.id, p)}
							/>
						)}
						<TransformFields
							layer={layer}
							onChange={(p) => updateLayer(layer.id, p)}
						/>
						<div className="flex items-center gap-1 pt-2 border-t border-neutral-800">
							<button
								type="button"
								onClick={() => duplicateLayer(layer.id)}
								className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-neutral-300 hover:bg-neutral-800"
								title="Duplicate"
							>
								<Copy className="h-3 w-3" /> Duplicate
							</button>
							<button
								type="button"
								onClick={() =>
									updateLayer(layer.id, { locked: !layer.locked })
								}
								className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-neutral-300 hover:bg-neutral-800"
								title={layer.locked ? "Unlock" : "Lock"}
							>
								{layer.locked ? (
									<Unlock className="h-3 w-3" />
								) : (
									<Lock className="h-3 w-3" />
								)}
								{layer.locked ? "Unlock" : "Lock"}
							</button>
							<button
								type="button"
								onClick={() => removeLayer(layer.id)}
								className="flex items-center gap-1 px-2 py-1 rounded text-[11px] text-red-300 hover:bg-red-500/10 ml-auto"
								title="Delete layer"
							>
								<Trash2 className="h-3 w-3" /> Delete
							</button>
						</div>
					</>
				)}
			</div>
		</div>
	);
}

function layerHeading(l: ImageLayer): string {
	if (l.kind === "text") return "Text layer";
	if (l.kind === "image") return "Image layer";
	if (l.kind === "ellipse") return "Ellipse layer";
	return "Rectangle layer";
}

function CanvasFields({
	design,
	onBg,
	onSize,
}: {
	design: { background: string; width: number; height: number };
	onBg: (c: string) => void;
	onSize: (w: number, h: number) => void;
}) {
	return (
		<div className="space-y-3">
			<Field label="Background">
				<ColorRow value={design.background} onChange={onBg} />
			</Field>
			<Field label="Canvas size">
				<div className="flex items-center gap-1.5">
					<NumInput
						value={design.width}
						onChange={(v) => onSize(v, design.height)}
					/>
					<span className="text-[10px] text-neutral-500">×</span>
					<NumInput
						value={design.height}
						onChange={(v) => onSize(design.width, v)}
					/>
				</div>
			</Field>
		</div>
	);
}

function TextFields({
	layer,
	onChange,
}: {
	layer: TextLayer;
	onChange: (p: Partial<TextLayer>) => void;
}) {
	return (
		<div className="space-y-3">
			<Field label="Text">
				<textarea
					value={layer.text}
					onChange={(e) => onChange({ text: e.target.value })}
					rows={3}
					className="w-full bg-neutral-900 border border-neutral-800 rounded text-[12px] text-neutral-100 px-2 py-1.5 focus:border-sky-500 focus:outline-none resize-none"
				/>
			</Field>
			<Field label="Color">
				<ColorRow
					value={layer.color}
					onChange={(c) => onChange({ color: c })}
				/>
			</Field>
			<Field label="Font size">
				<NumInput
					value={layer.fontSize}
					onChange={(v) => onChange({ fontSize: v })}
				/>
			</Field>
			<Field label="Weight">
				<select
					value={layer.fontWeight}
					onChange={(e) => onChange({ fontWeight: Number(e.target.value) })}
					className="w-full bg-neutral-900 border border-neutral-800 rounded text-[12px] text-neutral-200 px-2 py-1 focus:border-sky-500 focus:outline-none"
				>
					{[300, 400, 500, 600, 700, 800, 900].map((w) => (
						<option key={w} value={w}>
							{w}
						</option>
					))}
				</select>
			</Field>
			<Field label="Align">
				<div className="flex gap-1">
					{(["left", "center", "right"] as const).map((a) => (
						<button
							key={a}
							type="button"
							onClick={() => onChange({ align: a })}
							className={`flex-1 px-2 py-1 rounded text-[11px] ${
								layer.align === a
									? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/40"
									: "bg-neutral-900 text-neutral-400 hover:text-white"
							}`}
						>
							{a}
						</button>
					))}
				</div>
			</Field>
		</div>
	);
}

function ShapeFields({
	layer,
	onChange,
}: {
	layer: ShapeLayer;
	onChange: (p: Partial<ShapeLayer>) => void;
}) {
	return (
		<div className="space-y-3">
			<Field label="Fill">
				<ColorRow value={layer.fill} onChange={(c) => onChange({ fill: c })} />
			</Field>
			<Field label="Stroke">
				<ColorRow
					value={layer.stroke ?? "#000000"}
					onChange={(c) => onChange({ stroke: c })}
				/>
			</Field>
			<Field label="Stroke width">
				<NumInput
					value={layer.strokeWidth ?? 0}
					onChange={(v) => onChange({ strokeWidth: v })}
				/>
			</Field>
			{layer.kind === "rect" && (
				<Field label="Corner radius">
					<NumInput
						value={layer.radius ?? 0}
						onChange={(v) => onChange({ radius: v })}
					/>
				</Field>
			)}
		</div>
	);
}

function ImageFields({
	layer,
	onChange,
}: {
	layer: ImageBitmapLayer;
	onChange: (p: Partial<ImageBitmapLayer>) => void;
}) {
	return (
		<div className="space-y-3">
			<Field label="Source URL">
				<input
					type="text"
					value={layer.src}
					onChange={(e) => onChange({ src: e.target.value })}
					className="w-full bg-neutral-900 border border-neutral-800 rounded text-[12px] text-neutral-200 px-2 py-1 focus:border-sky-500 focus:outline-none"
				/>
			</Field>
			<Field label="Fit">
				<div className="flex gap-1">
					{(["cover", "contain"] as const).map((f) => (
						<button
							key={f}
							type="button"
							onClick={() => onChange({ objectFit: f })}
							className={`flex-1 px-2 py-1 rounded text-[11px] ${
								layer.objectFit === f
									? "bg-sky-500/20 text-sky-200 ring-1 ring-sky-500/40"
									: "bg-neutral-900 text-neutral-400 hover:text-white"
							}`}
						>
							{f}
						</button>
					))}
				</div>
			</Field>
		</div>
	);
}

function TransformFields({
	layer,
	onChange,
}: {
	layer: ImageLayer;
	onChange: (p: Partial<ImageLayer>) => void;
}) {
	return (
		<div className="space-y-2 pt-2 border-t border-neutral-800">
			<div className="text-[10px] uppercase tracking-wider text-neutral-500">
				Transform
			</div>
			<div className="grid grid-cols-2 gap-2">
				<Field label="X">
					<NumInput
						value={Math.round(layer.x)}
						onChange={(v) => onChange({ x: v })}
					/>
				</Field>
				<Field label="Y">
					<NumInput
						value={Math.round(layer.y)}
						onChange={(v) => onChange({ y: v })}
					/>
				</Field>
				<Field label="W">
					<NumInput
						value={Math.round(layer.width)}
						onChange={(v) => onChange({ width: Math.max(8, v) })}
					/>
				</Field>
				<Field label="H">
					<NumInput
						value={Math.round(layer.height)}
						onChange={(v) => onChange({ height: Math.max(8, v) })}
					/>
				</Field>
				<Field label="Rotate °">
					<NumInput
						value={Math.round(layer.rotation)}
						onChange={(v) => onChange({ rotation: v })}
					/>
				</Field>
				<Field label="Opacity">
					<input
						type="range"
						min={0}
						max={100}
						value={Math.round(layer.opacity * 100)}
						onChange={(e) =>
							onChange({ opacity: Number(e.target.value) / 100 })
						}
						className="w-full accent-sky-400"
					/>
				</Field>
			</div>
		</div>
	);
}

function Field({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<label className="block">
			<span className="block text-[10px] uppercase tracking-wider text-neutral-500 mb-1">
				{label}
			</span>
			{children}
		</label>
	);
}

function NumInput({
	value,
	onChange,
}: {
	value: number;
	onChange: (v: number) => void;
}) {
	return (
		<input
			type="number"
			value={value}
			onChange={(e) => {
				const next = Number(e.target.value);
				if (!Number.isNaN(next)) onChange(next);
			}}
			className="w-full bg-neutral-900 border border-neutral-800 rounded text-[12px] text-neutral-200 px-2 py-1 focus:border-sky-500 focus:outline-none font-mono tabular-nums"
		/>
	);
}

function ColorRow({
	value,
	onChange,
}: {
	value: string;
	onChange: (v: string) => void;
}) {
	return (
		<div className="flex items-center gap-1.5">
			<input
				type="color"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="h-7 w-9 rounded border border-neutral-800 bg-neutral-900 cursor-pointer"
			/>
			<input
				type="text"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="flex-1 bg-neutral-900 border border-neutral-800 rounded text-[12px] text-neutral-200 px-2 py-1 focus:border-sky-500 focus:outline-none font-mono"
			/>
		</div>
	);
}
