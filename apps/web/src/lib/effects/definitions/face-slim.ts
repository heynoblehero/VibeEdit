import type { EffectDefinition } from "@/types/effects";
import faceSlimFragmentShader from "./face-slim.frag.glsl";

export const faceSlimEffectDefinition: EffectDefinition = {
	type: "face-slim",
	name: "Face Slim",
	keywords: ["face", "slim", "thin", "jaw", "cheek", "contour", "beauty"],
	params: [
		{
			key: "intensity",
			label: "Intensity",
			type: "number",
			default: 30,
			min: 0,
			max: 100,
			step: 1,
		},
	],
	renderer: {
		type: "webgl",
		passes: [
			{
				fragmentShader: faceSlimFragmentShader,
				uniforms: ({ effectParams }) => {
					const intensity =
						typeof effectParams.intensity === "number"
							? effectParams.intensity
							: Number.parseFloat(String(effectParams.intensity));
					return {
						u_slimFactor: Math.max(intensity / 100, 0.0),
						// Default positions (center of frame) — overridden at
						// runtime when face landmarks are available
						u_jawCenter: [0.5, 0.7],
						u_leftCheek: [0.35, 0.55],
						u_rightCheek: [0.65, 0.55],
					};
				},
			},
		],
	},
};
