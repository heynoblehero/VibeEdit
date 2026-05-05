import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface Props {
	value: number;
	prefix?: string;
	suffix?: string;
	label?: string;
	color: string;
	background: string;
	accent: string;
}

export const BigNumber: React.FC<Props> = ({
	value,
	prefix = "",
	suffix = "",
	label,
	color,
	background,
	accent,
}) => {
	const frame = useCurrentFrame();
	const { fps, width, height, durationInFrames } = useVideoConfig();
	const fontSize = Math.round(Math.min(width, height) * 0.22);

	// Count-up using a soft ease so it doesn't tick robotically.
	const countEnd = Math.max(20, durationInFrames - 12);
	const counted = interpolate(frame, [0, countEnd], [0, value], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
		easing: (t) => 1 - (1 - t) ** 3,
	});
	const display = formatNumber(counted, value);

	const labelSpring = spring({
		frame: frame - 6,
		fps,
		config: { damping: 14, stiffness: 130 },
	});

	return (
		<AbsoluteFill
			style={{
				background,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				fontFamily: "system-ui, sans-serif",
				gap: fontSize * 0.05,
			}}
		>
			<div
				style={{
					fontSize,
					fontWeight: 900,
					color,
					textShadow: `0 0 ${fontSize * 0.25}px ${accent}66`,
					letterSpacing: "-0.04em",
					lineHeight: 1,
					display: "flex",
					alignItems: "baseline",
				}}
			>
				{prefix ? (
					<span style={{ fontSize: fontSize * 0.55, marginRight: fontSize * 0.05, color: accent }}>
						{prefix}
					</span>
				) : null}
				<span>{display}</span>
				{suffix ? (
					<span style={{ fontSize: fontSize * 0.55, marginLeft: fontSize * 0.05, color: accent }}>
						{suffix}
					</span>
				) : null}
			</div>
			{label ? (
				<div
					style={{
						fontSize: fontSize * 0.18,
						color,
						opacity: labelSpring * 0.85,
						letterSpacing: "0.25em",
						textTransform: "uppercase",
						transform: `translateY(${(1 - labelSpring) * 12}px)`,
					}}
				>
					{label}
				</div>
			) : null}
		</AbsoluteFill>
	);
};

function formatNumber(current: number, target: number): string {
	const decimals = Number.isInteger(target) ? 0 : 1;
	return current.toLocaleString("en-US", {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	});
}
