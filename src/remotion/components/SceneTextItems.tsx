import type { TextItem } from "@/lib/scene-schema";

const FONT_STACKS: Record<NonNullable<TextItem["fontFamily"]>, string> = {
	system:
		"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
	serif: "'Times New Roman', Georgia, serif",
	mono: "'JetBrains Mono', 'SF Mono', Menlo, Consolas, monospace",
	display: "'Bebas Neue', Impact, 'Arial Black', sans-serif",
};

function buildShadow(item: TextItem): string | undefined {
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

/**
 * Paints the scene's free-positioned text items above bg/character/broll.
 * Each item is an absolutely-positioned div with its own font + style stack.
 */
export function SceneTextItems({ items }: { items?: TextItem[] }) {
	if (!items || items.length === 0) return null;
	return (
		<>
			{items.map((item) => {
				const fontStack = FONT_STACKS[item.fontFamily ?? "system"];
				const padding = item.bgPadding ?? 0;
				return (
					<div
						key={item.id}
						style={{
							position: "absolute",
							left: item.x,
							top: item.y,
							maxWidth: item.w,
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
							opacity: item.opacity ?? 1,
							textShadow: buildShadow(item),
							background: item.bgColor,
							padding: item.bgColor && padding ? padding : undefined,
							borderRadius:
								item.bgColor && item.bgRadius != null
									? item.bgRadius
									: undefined,
							transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
							transformOrigin: "top left",
							whiteSpace: "pre-wrap",
							pointerEvents: "none",
						}}
					>
						{item.content}
					</div>
				);
			})}
		</>
	);
}
