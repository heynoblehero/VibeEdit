import {
	isTextItemActive,
	resolveClipsForTextItem,
} from "@/lib/motion-clips";
import type { TextItem } from "@/lib/scene-schema";

const FONT_STACKS: Record<NonNullable<TextItem["fontFamily"]>, string> = {
	system:
		"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
	serif: "'Times New Roman', Georgia, serif",
	mono: "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
	display: "'Bebas Neue', Impact, 'Arial Black', sans-serif",
};

function buildTextShadow(item: TextItem): string | undefined {
	const parts: string[] = [];
	if (item.glowColor) {
		parts.push(`0 0 16px ${item.glowColor}`);
		parts.push(`0 0 4px ${item.glowColor}`);
	}
	if (item.strokeColor && (item.strokeWidth ?? 0) > 0) {
		const w = item.strokeWidth ?? 1;
		// Approximate stroke via 8-direction shadow.
		for (let dx = -1; dx <= 1; dx++) {
			for (let dy = -1; dy <= 1; dy++) {
				if (dx === 0 && dy === 0) continue;
				parts.push(`${dx * w}px ${dy * w}px 0 ${item.strokeColor}`);
			}
		}
	}
	return parts.length > 0 ? parts.join(", ") : undefined;
}

/** Convert a 0..1 opacity to a two-char hex suffix. Used when stacking
 *  the FrameShadow.opacity onto the colour. */
function opacityHex(value: number | undefined): string {
	if (value == null) return "";
	const clamped = Math.max(0, Math.min(1, value));
	return Math.round(255 * clamped)
		.toString(16)
		.padStart(2, "0");
}

function buildBoxShadow(item: TextItem): string | undefined {
	if (!item.shadow) return undefined;
	const { color, blur, x, y, opacity } = item.shadow;
	return `${x}px ${y}px ${blur}px ${color}${opacityHex(opacity)}`;
}

/**
 * Paints the scene's free-positioned text items above bg/character/broll.
 * Each item is animated independently — start/duration window the
 * paint, and motion clips / preset / keyframes stack into the wrapper
 * transform. Outline + drop shadow render on the bounding box wrapper
 * (matches Frame's outline+shadow semantics exactly).
 */
export function SceneTextItems({
	items,
	frame,
	sceneDurFrames,
}: {
	items?: TextItem[];
	frame: number;
	sceneDurFrames: number;
}) {
	if (!items || items.length === 0) return null;
	return (
		<>
			{items.map((item) => {
				if (!isTextItemActive(item, frame, sceneDurFrames)) return null;
				const transform = resolveClipsForTextItem(item, frame, sceneDurFrames);
				const fontStack = FONT_STACKS[item.fontFamily ?? "system"];
				const padding = item.bgPadding ?? 0;
				const baseRotation = item.rotation ?? 0;
				const motionRotation = transform.rotation;
				const totalRotation = baseRotation + motionRotation;
				const motionScale = transform.scale;
				const wrapperTransform =
					[
						`translate(${transform.tx}px, ${transform.ty}px)`,
						motionScale !== 1 ? `scale(${motionScale})` : null,
						totalRotation ? `rotate(${totalRotation}deg)` : null,
					]
						.filter(Boolean)
						.join(" ") || undefined;
				const baseOpacity = item.opacity ?? 1;
				const opacity = baseOpacity * transform.opacity;
				const boxShadow = buildBoxShadow(item);
				const outline =
					item.outlineColor && (item.outlineWidth ?? 0) > 0
						? `${item.outlineWidth}px solid ${item.outlineColor}`
						: undefined;
				return (
					<div
						key={item.id}
						style={{
							position: "absolute",
							left: item.x,
							top: item.y,
							maxWidth: item.w,
							transform: wrapperTransform,
							transformOrigin: "top left",
							opacity,
							pointerEvents: "none",
							// Outline + box-shadow ride the wrapper so they read as
							// "frame-style" — they hug the padded text box.
							outline,
							boxShadow,
							// Outline alone has no thickness reservation, so when an
							// outline is set we mirror it as a transparent border so
							// padding sums consistently.
							boxSizing: "border-box",
							background: item.bgColor,
							padding: item.bgColor && padding ? padding : undefined,
							borderRadius:
								item.bgColor && item.bgRadius != null
									? item.bgRadius
									: undefined,
						}}
					>
						<div
							style={{
								color: item.color,
								fontSize: item.fontSize,
								fontFamily: fontStack,
								fontWeight: item.weight ?? 800,
								fontStyle: item.italic ? "italic" : undefined,
								textDecoration: item.underline ? "underline" : undefined,
								textAlign: item.align ?? "left",
								letterSpacing:
									item.letterSpacing != null ? item.letterSpacing : undefined,
								lineHeight: item.lineHeight ?? 1.1,
								textTransform: item.transform ?? undefined,
								textShadow: buildTextShadow(item),
								whiteSpace: "pre-wrap",
							}}
						>
							{item.content}
						</div>
					</div>
				);
			})}
		</>
	);
}
