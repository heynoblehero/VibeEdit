import { hasEffect, registerEffect } from "../registry";
import { bgRemoveEffectDefinition } from "./bg-remove";
import { bgReplaceEffectDefinition } from "./bg-replace";
import { blurEffectDefinition } from "./blur";
import { brightenEffectDefinition } from "./brighten";
import { eyeEnlargeEffectDefinition } from "./eye-enlarge";
import { faceSlimEffectDefinition } from "./face-slim";
import { faceSmoothEffectDefinition } from "./face-smooth";
import { skinSmoothEffectDefinition } from "./skin-smooth";

const defaultEffects = [
	blurEffectDefinition,
	skinSmoothEffectDefinition,
	faceSmoothEffectDefinition,
	faceSlimEffectDefinition,
	eyeEnlargeEffectDefinition,
	brightenEffectDefinition,
	bgRemoveEffectDefinition,
	bgReplaceEffectDefinition,
];

export function registerDefaultEffects(): void {
	for (const definition of defaultEffects) {
		if (hasEffect({ effectType: definition.type })) {
			continue;
		}
		registerEffect({ definition });
	}
}
