import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { RemotionEffect } from "./types";

type EffectRenderer = React.FC<{ frame: number; fps: number; width: number; height: number }>;

const compiledEffects = new Map<string, EffectRenderer>();
const effectsList: RemotionEffect[] = [];

export function registerEffect(effect: RemotionEffect): void {
  try {
    // Compile the code string into a React component function
    // The code should be a function that receives { frame, fps, width, height }
    const compileFn = new Function(
      "React", "interpolate", "spring", "useCurrentFrame", "useVideoConfig",
      `return (${effect.code});`
    );
    const component = compileFn(React, interpolate, spring, useCurrentFrame, useVideoConfig) as EffectRenderer;
    compiledEffects.set(effect.id, component);

    // Add to list (replace if same id)
    const idx = effectsList.findIndex(e => e.id === effect.id);
    if (idx >= 0) effectsList[idx] = effect;
    else effectsList.push(effect);
  } catch (err) {
    console.error(`Failed to compile Remotion effect "${effect.name}":`, err);
    throw err;
  }
}

export function getCompiledEffect(id: string): EffectRenderer | undefined {
  return compiledEffects.get(id);
}

export function getAllEffects(): RemotionEffect[] {
  return [...effectsList];
}

export function removeEffect(id: string): void {
  compiledEffects.delete(id);
  const idx = effectsList.findIndex(e => e.id === id);
  if (idx >= 0) effectsList.splice(idx, 1);
}

export function clearEffects(): void {
  compiledEffects.clear();
  effectsList.length = 0;
}
