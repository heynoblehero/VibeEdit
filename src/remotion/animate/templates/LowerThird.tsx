import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface Props {
	name: string;
	role?: string;
	background: string;
	accent: string;
	textColor: string;
}

export const LowerThird: React.FC<Props> = ({
	name,
	role,
	background,
	accent,
	textColor,
}) => {
	const frame = useCurrentFrame();
	const { fps, width, height, durationInFrames } = useVideoConfig();
	const fontSize = Math.round(Math.min(width, height) * 0.045);

	const inProgress = spring({ frame, fps, config: { damping: 14, stiffness: 110 } });
	const outStart = durationInFrames - 18;
	const outProgress = interpolate(frame, [outStart, durationInFrames - 4], [0, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});
	const slideX = (1 - inProgress) * -width * 0.6 + outProgress * -width * 0.6;
	const barWidth = Math.min(width * 0.6, fontSize * 22);

	return (
		<AbsoluteFill
			style={{
				background: background === "transparent" ? "transparent" : background,
				display: "flex",
				flexDirection: "column",
				justifyContent: "flex-end",
				padding: width * 0.05,
				fontFamily: "system-ui, sans-serif",
			}}
		>
			<div
				style={{
					transform: `translateX(${slideX}px)`,
					width: barWidth,
					padding: `${fontSize * 0.5}px ${fontSize}px`,
					background: `linear-gradient(90deg, ${accent} 0%, transparent 110%)`,
					borderLeft: `${Math.max(3, fontSize * 0.12)}px solid ${accent}`,
					backdropFilter: "blur(6px)",
				}}
			>
				<div
					style={{
						fontSize,
						fontWeight: 800,
						color: textColor,
						lineHeight: 1.1,
					}}
				>
					{name}
				</div>
				{role ? (
					<div
						style={{
							fontSize: fontSize * 0.55,
							color: textColor,
							opacity: 0.85,
							marginTop: fontSize * 0.2,
							letterSpacing: "0.1em",
							textTransform: "uppercase",
						}}
					>
						{role}
					</div>
				) : null}
			</div>
		</AbsoluteFill>
	);
};
