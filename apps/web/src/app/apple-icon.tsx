import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
	return new ImageResponse(
		(
			<div
				style={{
					width: 180,
					height: 180,
					borderRadius: 40,
					background: "linear-gradient(135deg, #8b5cf6, #d946ef, #ec4899)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<span
					style={{
						fontSize: 110,
						fontWeight: 900,
						color: "white",
						lineHeight: 1,
					}}
				>
					V
				</span>
			</div>
		),
		{ ...size }
	);
}
