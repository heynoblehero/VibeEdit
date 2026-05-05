import {
	AbsoluteFill,
	interpolate,
	spring,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";

interface Props {
	text: string;
	subtitle?: string;
	color: string;
	background: string;
	accent: string;
}

export const KineticTitle: React.FC<Props> = ({
	text,
	subtitle,
	color,
	background,
	accent,
}) => {
	const frame = useCurrentFrame();
	const { fps, width, height } = useVideoConfig();
	const words = text.split(/\s+/).filter(Boolean);

	const fontSize = Math.round(Math.min(width, height) * 0.085);

	return (
		<AbsoluteFill
			style={{
				background,
				fontFamily: "system-ui, sans-serif",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				gap: fontSize * 0.4,
			}}
		>
			<div
				style={{
					display: "flex",
					flexWrap: "wrap",
					gap: fontSize * 0.3,
					justifyContent: "center",
					maxWidth: width * 0.85,
				}}
			>
				{words.map((word, i) => {
					const delay = i * 4;
					const translate = interpolate(
						frame - delay,
						[0, 18],
						[fontSize * 0.6, 0],
						{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
					);
					const opacity = interpolate(frame - delay, [0, 12], [0, 1], {
						extrapolateLeft: "clamp",
						extrapolateRight: "clamp",
					});
					const scale = spring({
						frame: frame - delay,
						fps,
						config: { damping: 12, stiffness: 140 },
					});
					return (
						<span
							key={`${word}-${i}`}
							style={{
								fontSize,
								fontWeight: 800,
								color,
								opacity,
								transform: `translateY(${translate}px) scale(${scale})`,
								textShadow: `0 0 ${fontSize * 0.4}px ${accent}55`,
								lineHeight: 1.05,
							}}
						>
							{word}
						</span>
					);
				})}
			</div>
			{subtitle ? (
				<div
					style={{
						fontSize: fontSize * 0.32,
						color: accent,
						opacity: interpolate(frame, [20, 36], [0, 1], {
							extrapolateLeft: "clamp",
							extrapolateRight: "clamp",
						}),
						letterSpacing: "0.18em",
						textTransform: "uppercase",
						fontWeight: 600,
					}}
				>
					{subtitle}
				</div>
			) : null}
		</AbsoluteFill>
	);
};
