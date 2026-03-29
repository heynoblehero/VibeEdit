import type { EffectDefinition } from "@/types/effects";
import eyeEnlargeFragmentShader from "./eye-enlarge.frag.glsl";

export const eyeEnlargeEffectDefinition: EffectDefinition = {
	type: "eye-enlarge",
	name: "Eye Enlarge",
	keywords: ["eye", "enlarge", "big", "beauty", "magnify", "sparkle"],
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
				fragmentShader: eyeEnlargeFragmentShader,
				uniforms: ({ effectParams }) => {
					const intensity =
						typeof effectParams.intensity === "number"
							? effectParams.intensity
							: Number.parseFloat(String(effectParams.intensity));
					return {
						u_enlargeFactor: Math.max(intensity / 100, 0.0),
						// Default eye radius ~5% of UV space
						u_eyeRadius: 0.06,
						// Default positions (centered) — overridden at runtime
						// when face landmarks are available
						u_leftEyeCenter: [0.4, 0.45],
						u_rightEyeCenter: [0.6, 0.45],
					};
				},
			},
		],
	},
};
