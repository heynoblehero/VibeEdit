import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

interface Props {
	title?: string;
	bullets: string[];
	background: string;
	textColor: string;
	accent: string;
}

export const BulletList: React.FC<Props> = ({
	title,
	bullets,
	background,
	textColor,
	accent,
}) => {
	const frame = useCurrentFrame();
	const { fps, width, height } = useVideoConfig();
	const fontSize = Math.round(Math.min(width, height) * 0.05);

	const titleSpring = spring({
		frame,
		fps,
		config: { damping: 14, stiffness: 120 },
	});

	return (
		<AbsoluteFill
			style={{
				background,
				display: "flex",
				flexDirection: "column",
				justifyContent: "center",
				padding: width * 0.08,
				gap: fontSize * 0.6,
				fontFamily: "system-ui, sans-serif",
			}}
		>
			{title ? (
				<div
					style={{
						fontSize: fontSize * 1.4,
						fontWeight: 800,
						color: textColor,
						opacity: titleSpring,
						transform: `translateY(${(1 - titleSpring) * 16}px)`,
						borderLeft: `${Math.max(3, fontSize * 0.1)}px solid ${accent}`,
						paddingLeft: fontSize * 0.7,
						lineHeight: 1.1,
					}}
				>
					{title}
				</div>
			) : null}
			<div style={{ display: "flex", flexDirection: "column", gap: fontSize * 0.5 }}>
				{bullets.map((bullet, i) => {
					const delay = 8 + i * 7;
					const sp = spring({
						frame: frame - delay,
						fps,
						config: { damping: 14, stiffness: 130 },
					});
					return (
						<div
							key={`${bullet}-${i}`}
							style={{
								display: "flex",
								alignItems: "baseline",
								gap: fontSize * 0.5,
								opacity: sp,
								transform: `translateX(${(1 - sp) * -20}px)`,
							}}
						>
							<span
								style={{
									color: accent,
									fontSize: fontSize * 1.1,
									fontWeight: 800,
									minWidth: fontSize * 1.5,
								}}
							>
								{(i + 1).toString().padStart(2, "0")}
							</span>
							<span
								style={{
									fontSize,
									color: textColor,
									fontWeight: 500,
									lineHeight: 1.3,
								}}
							>
								{bullet}
							</span>
						</div>
					);
				})}
			</div>
		</AbsoluteFill>
	);
};
