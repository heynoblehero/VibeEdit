import type { EffectDefinition } from "@/types/effects";
import skinSmoothFragmentShader from "./skin-smooth.frag.glsl";

export const skinSmoothEffectDefinition: EffectDefinition = {
	type: "skin-smooth",
	name: "Skin Smoothing",
	keywords: ["skin", "smooth", "beauty", "soften", "face", "bilateral"],
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
				fragmentShader: skinSmoothFragmentShader,
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
				fragmentShader: skinSmoothFragmentShader,
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
