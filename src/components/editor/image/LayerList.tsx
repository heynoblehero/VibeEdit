"use client";

import {
	ArrowDown,
	ArrowUp,
	Eye,
	EyeOff,
	Image as ImageIcon,
	Square,
	Type,
} from "lucide-react";
import {
	type ImageLayer,
	useImageEditStore,
} from "@/store/image-edit-store";

/**
 * Left rail — layer stack for the active design. Top of the list is
 * front-most. Click selects, eye toggles visibility, arrows reorder
 * within the stack. The store's `layers` array is bottom-to-top in
 * draw order; we flip the display order here for UX.
 */
export function LayerList() {
	const design = useImageEditStore((s) =>
		s.activeDesignId ? s.designs[s.activeDesignId] : null,
	);
	const selectedId = useImageEditStore((s) => s.selectedLayerId);
	const selectLayer = useImageEditStore((s) => s.selectLayer);
	const updateLayer = useImageEditStore((s) => s.updateLayer);
	const moveLayer = useImageEditStore((s) => s.moveLayer);

	if (!design) return null;
	const reversed = [...design.layers].reverse();

	return (
		<div className="w-56 shrink-0 flex flex-col border-r border-neutral-800 bg-neutral-950/40">
			<div className="sticky top-0 z-10 px-3 py-2 border-b border-neutral-800 bg-neutral-900 text-[11px] uppercase tracking-wider text-sky-300 font-semibold">
				Layers
			</div>
			<div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
				{reversed.length === 0 ? (
					<div className="px-2 py-4 text-[11px] text-neutral-600 leading-relaxed">
						No layers yet — add Text, Rect, Ellipse or Image from the
						toolbar above.
					</div>
				) : (
					reversed.map((layer) => (
						<LayerRow
							key={layer.id}
							layer={layer}
							selected={layer.id === selectedId}
							onSelect={() => selectLayer(layer.id)}
							onToggleHidden={() =>
								updateLayer(layer.id, { hidden: !layer.hidden })
							}
							onMoveUp={() => moveLayer(layer.id, "up")}
							onMoveDown={() => moveLayer(layer.id, "down")}
						/>
					))
				)}
			</div>
		</div>
	);
}

interface RowProps {
	layer: ImageLayer;
	selected: boolean;
	onSelect: () => void;
	onToggleHidden: () => void;
	onMoveUp: () => void;
	onMoveDown: () => void;
}

function LayerRow({
	layer,
	selected,
	onSelect,
	onToggleHidden,
	onMoveUp,
	onMoveDown,
}: RowProps) {
	const Icon =
		layer.kind === "text"
			? Type
			: layer.kind === "image"
				? ImageIcon
				: Square;
	const label =
		layer.kind === "text"
			? (layer.text || "Text").slice(0, 24)
			: layer.kind === "image"
				? "Image"
				: layer.kind === "ellipse"
					? "Ellipse"
					: "Rectangle";
	return (
		<div
			className={`group flex items-center gap-1 px-2 py-1.5 rounded text-[11px] cursor-pointer ${
				selected
					? "bg-sky-500/20 text-sky-100 ring-1 ring-sky-500/40"
					: "text-neutral-300 hover:bg-neutral-800"
			}`}
			onClick={onSelect}
			onKeyDown={(e) => {
				if (e.key === "Enter" || e.key === " ") {
					e.preventDefault();
					onSelect();
				}
			}}
			role="button"
			tabIndex={0}
		>
			<Icon className="h-3 w-3 shrink-0" />
			<span className={`flex-1 truncate ${layer.hidden ? "opacity-40" : ""}`}>
				{label}
			</span>
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onMoveUp();
				}}
				className="opacity-0 group-hover:opacity-100 touch-reveal text-neutral-500 hover:text-white"
				title="Bring forward"
			>
				<ArrowUp className="h-3 w-3" />
			</button>
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onMoveDown();
				}}
				className="opacity-0 group-hover:opacity-100 touch-reveal text-neutral-500 hover:text-white"
				title="Send backward"
			>
				<ArrowDown className="h-3 w-3" />
			</button>
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation();
					onToggleHidden();
				}}
				className="text-neutral-500 hover:text-white"
				title={layer.hidden ? "Show" : "Hide"}
			>
				{layer.hidden ? (
					<EyeOff className="h-3 w-3" />
				) : (
					<Eye className="h-3 w-3" />
				)}
			</button>
		</div>
	);
}
