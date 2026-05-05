import { AbsoluteFill, interpolate, Img, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface Props {
	imageUrl: string;
	background: string;
	accent: string;
}

export const LogoReveal: React.FC<Props> = ({ imageUrl, background, accent }) => {
	const frame = useCurrentFrame();
	const { fps, width, height } = useVideoConfig();
	const target = Math.min(width, height) * 0.55;

	const scaleSpring = spring({
		frame,
		fps,
		config: { damping: 11, stiffness: 110 },
	});
	const opacity = interpolate(frame, [0, 8], [0, 1], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	const shimmerStart = 8;
	const shimmerEnd = 30;
	const shimmerX = interpolate(frame, [shimmerStart, shimmerEnd], [-target, target], {
		extrapolateLeft: "clamp",
		extrapolateRight: "clamp",
	});

	return (
		<AbsoluteFill
			style={{
				background,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
			}}
		>
			<div
				style={{
					width: target,
					height: target,
					position: "relative",
					transform: `scale(${0.6 + scaleSpring * 0.4})`,
					opacity,
				}}
			>
				{imageUrl ? (
					<Img
						src={imageUrl}
						style={{ width: "100%", height: "100%", objectFit: "contain" }}
					/>
				) : (
					<div
						style={{
							width: "100%",
							height: "100%",
							borderRadius: "50%",
							background: accent,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							color: "#fff",
							fontSize: target * 0.4,
							fontWeight: 900,
							fontFamily: "system-ui, sans-serif",
						}}
					>
						?
					</div>
				)}
				<div
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						width: target * 0.4,
						height: "100%",
						transform: `translateX(${shimmerX}px) skewX(-20deg)`,
						background: `linear-gradient(90deg, transparent, ${accent}99, transparent)`,
						mixBlendMode: "screen",
						pointerEvents: "none",
					}}
				/>
			</div>
		</AbsoluteFill>
	);
};
