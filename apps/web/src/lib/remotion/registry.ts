import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { RemotionEffect } from "./types";
import { logSecurity } from "@/lib/ai/security-log";
import { validateUserCode } from "@/lib/ai/code-validator";

type EffectRenderer = React.FC<{ frame: number; fps: number; width: number; height: number }>;

const compiledEffects = new Map<string, EffectRenderer>();
const effectsList: RemotionEffect[] = [];

export function registerEffect(effect: RemotionEffect): void {
  const violation = validateUserCode(effect.code);
  if (violation) {
    logSecurity("critical", "remotion_code_blocked", { effectName: effect.name, violation });
    throw new Error(`Security: ${violation}`);
  }

  try {
    // Compile the code string into a React component function
    // The code should be a function that receives { frame, fps, width, height }
    // Shadow dangerous globals via var declarations in the body.
    // NOTE: "eval" and "Function" cannot be var-declared in strict mode,
    // but they are already blocked by validateUserCode() before reaching here.
    const compileFn = new Function(
      "React", "interpolate", "spring", "useCurrentFrame", "useVideoConfig",
      `"use strict";
       var fetch = void 0, XMLHttpRequest = void 0, WebSocket = void 0;
       var localStorage = void 0, sessionStorage = void 0;
       var importScripts = void 0;
       return (${effect.code});`
    );
    const component = compileFn(
      React, interpolate, spring, useCurrentFrame, useVideoConfig,
    ) as EffectRenderer;
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
