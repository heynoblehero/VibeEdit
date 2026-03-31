import { ImageResponse } from "next/og";

export const alt = "VibeEdit — AI Video Editor";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
	return new ImageResponse(
		(
			<div
				style={{
					width: "100%",
					height: "100%",
					background: "#08080c",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					position: "relative",
				}}
			>
				{/* Gradient blob */}
				<div
					style={{
						position: "absolute",
						top: "-20%",
						left: "-10%",
						width: "60%",
						height: "60%",
						borderRadius: "50%",
						background: "rgba(139, 92, 246, 0.2)",
						filter: "blur(80px)",
					}}
				/>
				<div
					style={{
						position: "absolute",
						bottom: "-20%",
						right: "-10%",
						width: "50%",
						height: "50%",
						borderRadius: "50%",
						background: "rgba(217, 70, 239, 0.15)",
						filter: "blur(80px)",
					}}
				/>

				{/* Icon */}
				<div
					style={{
						width: 80,
						height: 80,
						borderRadius: 20,
						background: "linear-gradient(135deg, #8b5cf6, #d946ef, #ec4899)",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						marginBottom: 24,
					}}
				>
					<span style={{ fontSize: 50, fontWeight: 900, color: "white" }}>V</span>
				</div>

				{/* Title */}
				<h1
					style={{
						fontSize: 72,
						fontWeight: 900,
						color: "white",
						margin: 0,
						lineHeight: 1.1,
						textAlign: "center",
					}}
				>
					VibeEdit
				</h1>

				{/* Subtitle */}
				<p
					style={{
						fontSize: 28,
						color: "rgba(255,255,255,0.6)",
						margin: "16px 0 0",
						textAlign: "center",
					}}
				>
					Edit videos by talking to AI
				</p>
			</div>
		),
		{ ...size }
	);
}
