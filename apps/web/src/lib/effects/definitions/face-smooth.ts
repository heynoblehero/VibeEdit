import type { EffectDefinition } from "@/types/effects";
import faceSmoothFragmentShader from "./face-smooth.frag.glsl";

export const faceSmoothEffectDefinition: EffectDefinition = {
	type: "face-smooth",
	name: "Face Smoothing",
	keywords: [
		"face",
		"smooth",
		"beauty",
		"skin",
		"soften",
		"bilateral",
		"portrait",
	],
	params: [
		{
			key: "intensity",
			label: "Intensity",
			type: "number",
			default: 50,
			min: 0,
			max: 100,
			step: 1,
		},
	],
	renderer: {
		type: "webgl",
		passes: [
			{
				fragmentShader: faceSmoothFragmentShader,
				uniforms: ({ effectParams }) => {
					const intensity =
						typeof effectParams.intensity === "number"
							? effectParams.intensity
							: Number.parseFloat(String(effectParams.intensity));
					return {
						u_intensity: Math.max(intensity / 100, 0.0),
						u_direction: [1, 0],
					};
				},
			},
			{
				fragmentShader: faceSmoothFragmentShader,
				uniforms: ({ effectParams }) => {
					const intensity =
						typeof effectParams.intensity === "number"
							? effectParams.intensity
							: Number.parseFloat(String(effectParams.intensity));
					return {
						u_intensity: Math.max(intensity / 100, 0.0),
						u_direction: [0, 1],
					};
				},
			},
		],
	},
};
