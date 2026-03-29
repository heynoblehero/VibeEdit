import type { EffectDefinition } from "@/types/effects";
import brightenFragmentShader from "./brighten.frag.glsl";

export const brightenEffectDefinition: EffectDefinition = {
	type: "brighten",
	name: "Brightness",
	keywords: ["bright", "brightness", "exposure", "light", "lighten", "darken"],
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
				fragmentShader: brightenFragmentShader,
				uniforms: ({ effectParams }) => {
					const intensity =
						typeof effectParams.intensity === "number"
							? effectParams.intensity
							: Number.parseFloat(String(effectParams.intensity));
					// Map 0-100 intensity to 0.5-2.0 brightness multiplier
					// 0 = 0.5x (dimmer), 50 = 1.0x (no change), 100 = 2.0x (bright)
					const u_brightness = 0.5 + (intensity / 100) * 1.5;
					return {
						u_brightness,
					};
				},
			},
		],
	},
};
