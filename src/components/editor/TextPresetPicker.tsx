"use client";

import { Plus, Type } from "lucide-react";
import type { TextItem } from "@/lib/scene-schema";
import { TEXT_PRESETS, type TextPreset } from "@/lib/text-presets";
import { PropertyModal } from "./PropertyModal";

/**
 * Picker grid for the curated text-style presets. Click a tile to
 * spawn a TextItem with that preset baked in. The preview tile shows
 * the preset's sample copy in its actual style so users see what they
 * pick. Plain Text falls back to the default placeholder when the
 * user wants a blank slate.
 */

interface Props {
	open: boolean;
	onClose: () => void;
	onPick: (style: Partial<TextItem>, copy: string) => void;
}

export function TextPresetPicker({ open, onClose, onPick }: Props) {
	const handlePick = (preset: TextPreset) => {
		onPick(preset.style, preset.sampleCopy);
		onClose();
	};

	return (
		<PropertyModal
			open={open}
			onClose={onClose}
			title="Add text"
			subtitle="Pick a preset to start, or open with plain text"
			accent="amber"
			width="huge"
		>
			<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
				<button
					type="button"
					onClick={() => {
						onPick({}, "New text");
						onClose();
					}}
					className="flex flex-col items-center justify-center gap-1.5 h-28 rounded-md border border-dashed border-neutral-700 hover:border-amber-400 hover:bg-amber-500/5 text-neutral-400 hover:text-amber-200 transition-colors"
				>
					<Plus className="h-5 w-5" />
					<span className="text-[11px] font-semibold">Plain text</span>
					<span className="text-[9px] text-neutral-500">Empty starting point</span>
				</button>

				{TEXT_PRESETS.map((preset) => (
					<button
						key={preset.id}
						type="button"
						onClick={() => handlePick(preset)}
						className="flex flex-col rounded-md border border-neutral-700 hover:border-amber-400 overflow-hidden transition-colors group"
					>
						<div
							className="flex-1 flex items-center justify-center px-2 overflow-hidden"
							style={{ backgroundColor: preset.previewBg, minHeight: 84 }}
						>
							<PresetSample preset={preset} />
						</div>
						<div className="px-2 py-1.5 bg-neutral-900 border-t border-neutral-800 group-hover:border-amber-400/50">
							<div className="flex items-center gap-1 text-[11px] font-semibold text-neutral-200">
								<Type className="h-3 w-3 text-amber-300/70" />
								{preset.label}
							</div>
							{preset.hint && (
								<div className="text-[9px] text-neutral-500 ml-4">{preset.hint}</div>
							)}
						</div>
					</button>
				))}
			</div>
		</PropertyModal>
	);
}

/**
 * Mini renderer that approximates the preset's look in a thumbnail.
 * Not a perfect match — strokes and glows are simplified — but close
 * enough to read at-a-glance.
 */
function PresetSample({ preset }: { preset: TextPreset }) {
	const s = preset.style;
	const fontFamilyMap: Record<NonNullable<TextItem["fontFamily"]>, string> = {
		system: "ui-sans-serif, system-ui, sans-serif",
		serif: "ui-serif, Georgia, serif",
		mono: "ui-monospace, monospace",
		display: "Impact, 'Arial Black', sans-serif",
	};
	const family = s.fontFamily ? fontFamilyMap[s.fontFamily] : fontFamilyMap.system;

	const stroke =
		s.strokeColor && s.strokeWidth
			? `-1px -1px 0 ${s.strokeColor}, 1px -1px 0 ${s.strokeColor}, -1px 1px 0 ${s.strokeColor}, 1px 1px 0 ${s.strokeColor}`
			: undefined;
	const glow = s.glowColor
		? `0 0 10px ${s.glowColor}, 0 0 20px ${s.glowColor}80`
		: s.shadow
			? `${s.shadow.x}px ${s.shadow.y}px ${s.shadow.blur}px ${s.shadow.color}`
			: undefined;
	const textShadow = [stroke, glow].filter(Boolean).join(", ") || undefined;

	const scale = Math.min(1, 28 / (s.fontSize ?? 56));

	return (
		<span
			style={{
				fontFamily: family,
				fontSize: `${(s.fontSize ?? 56) * scale}px`,
				color: s.color ?? "#fafafa",
				fontWeight: s.weight ?? 600,
				fontStyle: s.italic ? "italic" : undefined,
				textTransform: s.transform ?? "none",
				letterSpacing: s.letterSpacing ? `${s.letterSpacing * scale}px` : undefined,
				lineHeight: s.lineHeight ?? 1.1,
				textAlign: s.align ?? "center",
				textShadow,
				backgroundColor: s.bgColor,
				padding: s.bgPadding ? `${s.bgPadding * scale}px ${(s.bgPadding ?? 0) * scale * 1.4}px` : undefined,
				borderRadius: s.bgRadius ? `${s.bgRadius * scale}px` : undefined,
				border: s.outlineColor && s.outlineWidth ? `${s.outlineWidth}px solid ${s.outlineColor}` : undefined,
				WebkitTextStroke:
					s.color === "transparent" && s.strokeColor && s.strokeWidth
						? `${Math.max(1, s.strokeWidth * scale)}px ${s.strokeColor}`
						: undefined,
				display: "inline-block",
				maxWidth: "100%",
				whiteSpace: "nowrap",
				overflow: "hidden",
				textOverflow: "ellipsis",
			}}
		>
			{preset.sampleCopy}
		</span>
	);
}
