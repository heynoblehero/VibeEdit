import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
	return new ImageResponse(
		(
			<div
				style={{
					width: 32,
					height: 32,
					borderRadius: 8,
					background: "linear-gradient(135deg, #8b5cf6, #d946ef, #ec4899)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<span
					style={{
						fontSize: 20,
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
