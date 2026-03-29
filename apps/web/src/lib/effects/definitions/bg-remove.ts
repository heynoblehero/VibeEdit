import type { EffectDefinition } from "@/types/effects";
import bgRemoveFragmentShader from "./bg-remove.frag.glsl";

export const bgRemoveEffectDefinition: EffectDefinition = {
	type: "bg-remove",
	name: "Background Removal",
	keywords: [
		"background",
		"remove",
		"green screen",
		"chroma",
		"blur background",
		"replace",
		"segment",
	],
	params: [
		{
			key: "mode",
			label: "Mode",
			type: "select",
			default: "remove",
			options: [
				{ value: "remove", label: "Remove" },
				{ value: "blur", label: "Blur" },
				{ value: "replace", label: "Replace Color" },
			],
		},
		{
			key: "blurAmount",
			label: "Blur Amount",
			type: "number",
			default: 50,
			min: 0,
			max: 100,
			step: 1,
		},
		{
			key: "bgColor",
			label: "Background Color",
			type: "color",
			default: "#00ff00",
		},
	],
	renderer: {
		type: "webgl",
		passes: [
			{
				fragmentShader: bgRemoveFragmentShader,
				uniforms: ({ effectParams }) => {
					const modeStr =
						typeof effectParams.mode === "string"
							? effectParams.mode
							: "remove";
					let modeNum = 0;
					if (modeStr === "blur") modeNum = 1;
					else if (modeStr === "replace") modeNum = 2;

					const blurAmount =
						typeof effectParams.blurAmount === "number"
							? effectParams.blurAmount
							: Number.parseFloat(String(effectParams.blurAmount));

					// Parse hex color to RGB floats
					const colorHex =
						typeof effectParams.bgColor === "string"
							? effectParams.bgColor
							: "#00ff00";
					const hex = colorHex.replace("#", "");
					const r = Number.parseInt(hex.substring(0, 2), 16) / 255;
					const g = Number.parseInt(hex.substring(2, 4), 16) / 255;
					const b = Number.parseInt(hex.substring(4, 6), 16) / 255;

					return {
						u_mode: modeNum,
						u_blurAmount: blurAmount / 100,
						u_bgColor: [r, g, b],
					};
				},
			},
		],
	},
};
