import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

interface Props {
	quote: string;
	author?: string;
	background: string;
	textColor: string;
	accent: string;
}

export const QuoteCard: React.FC<Props> = ({
	quote,
	author,
	background,
	textColor,
	accent,
}) => {
	const frame = useCurrentFrame();
	const { width, height, durationInFrames } = useVideoConfig();
	const fontSize = Math.round(Math.min(width, height) * 0.06);

	// Typewriter — reveal one character per ~1.5 frames.
	const typeFrames = Math.max(20, durationInFrames - 30);
	const charsToShow = Math.floor(
		interpolate(frame, [0, typeFrames], [0, quote.length], {
			extrapolateLeft: "clamp",
			extrapolateRight: "clamp",
		}),
	);
	const visible = quote.slice(0, charsToShow);
	const cursorBlink = Math.floor(frame / 8) % 2 === 0;
	const cursorVisible = charsToShow < quote.length && cursorBlink;

	const authorOpacity = interpolate(
		frame,
		[typeFrames + 4, typeFrames + 18],
		[0, 1],
		{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
	);

	return (
		<AbsoluteFill
			style={{
				background,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				padding: width * 0.08,
				fontFamily: "Georgia, serif",
			}}
		>
			<div
				style={{
					fontSize,
					fontWeight: 600,
					color: textColor,
					lineHeight: 1.3,
					maxWidth: width * 0.85,
					textAlign: "center",
					fontStyle: "italic",
				}}
			>
				<span style={{ color: accent, marginRight: fontSize * 0.12 }}>“</span>
				{visible}
				{cursorVisible ? <span style={{ color: accent }}>▍</span> : null}
				<span style={{ color: accent, marginLeft: fontSize * 0.12 }}>”</span>
			</div>
			{author ? (
				<div
					style={{
						marginTop: fontSize * 0.7,
						fontSize: fontSize * 0.42,
						color: accent,
						opacity: authorOpacity,
						letterSpacing: "0.18em",
						textTransform: "uppercase",
						fontFamily: "system-ui, sans-serif",
					}}
				>
					— {author}
				</div>
			) : null}
		</AbsoluteFill>
	);
};
