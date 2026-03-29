import type { EffectDefinition } from "@/types/effects";
import { backgroundPresets } from "@/lib/backgrounds/presets";
import bgReplaceFragmentShader from "./bg-replace.frag.glsl";

/**
 * Build the preset options for the select dropdown from the presets array.
 */
const presetOptions = backgroundPresets.map((p) => ({
	value: p.id,
	label: p.name,
}));

export const bgReplaceEffectDefinition: EffectDefinition = {
	type: "bg-replace",
	name: "Background Replace",
	keywords: [
		"background",
		"replace",
		"studio",
		"virtual background",
		"green screen",
		"preset",
		"backdrop",
		"composite",
	],
	params: [
		{
			key: "preset",
			label: "Background",
			type: "select",
			default: "professional-studio",
			options: presetOptions,
		},
		{
			key: "edgeSmooth",
			label: "Edge Smoothing",
			type: "number",
			default: 25,
			min: 0,
			max: 100,
			step: 1,
		},
		{
			key: "customColor",
			label: "Custom Color",
			type: "color",
			default: "#1a1a2e",
		},
	],
	renderer: {
		type: "webgl",
		passes: [
			{
				fragmentShader: bgReplaceFragmentShader,
				uniforms: ({ effectParams }) => {
					const edgeSmooth =
						typeof effectParams.edgeSmooth === "number"
							? effectParams.edgeSmooth
							: Number.parseFloat(String(effectParams.edgeSmooth));

					return {
						// Map 0-100 to 0.0-0.5 range for the shader's smoothstep
						u_edgeSmooth: (edgeSmooth / 100) * 0.5,
					};
				},
			},
		],
	},
};
