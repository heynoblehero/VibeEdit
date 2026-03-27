import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { RemotionEffect } from "./types";
import { logSecurity } from "@/lib/ai/security-log";

type EffectRenderer = React.FC<{ frame: number; fps: number; width: number; height: number }>;

const compiledEffects = new Map<string, EffectRenderer>();
const effectsList: RemotionEffect[] = [];

const BLOCKED_PATTERNS = [
  /(?<!React\.)(?<!\w)fetch\s*\(/,          // fetch() but not someFetch()
  /\bXMLHttpRequest\b/,
  /\bnew\s+WebSocket\b/,
  /\blocalStorage\b/,
  /\bsessionStorage\b/,
  /\bdocument\.cookie\b/,
  /(?<!\w)eval\s*\(/,                        // eval() but not someEval()
  /\bnew\s+Function\b/,
  /\bimport\s*\(/,
  /\brequire\s*\(/,
  /\bwindow\.open\b/,
  /\bnavigator\.sendBeacon\b/,               // specific navigator abuse, not all navigator
  /\blocation\s*=\b/,                        // location assignment, not the word "location"
  /\blocation\.href\s*=/,
  /\b__editor\b/,
  /\bprocess\.env\b/,
  /\bglobalThis\b/,
  /\bwindow\[/,
  /\bdocument\.(write|querySelector|getElementById|body)/,  // removed createElement — React needs it
  /\bpostMessage\b/,
  /\bsetInterval\s*\(/,
];

function validateEffectCode(code: string): string | null {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(code)) {
      return `Blocked: code contains unsafe pattern "${pattern.source}"`;
    }
  }
  if (code.length > 5000) {
    return "Code too long (max 5000 chars)";
  }
  return null;
}

export function registerEffect(effect: RemotionEffect): void {
  const violation = validateEffectCode(effect.code);
  if (violation) {
    logSecurity("critical", "remotion_code_blocked", { effectName: effect.name, violation });
    throw new Error(`Security: ${violation}`);
  }

  try {
    // Compile the code string into a React component function
    // The code should be a function that receives { frame, fps, width, height }
    const compileFn = new Function(
      "React", "interpolate", "spring", "useCurrentFrame", "useVideoConfig",
      // Shadow dangerous globals
      "fetch", "XMLHttpRequest", "WebSocket", "localStorage", "sessionStorage",
      "eval", "Function", "importScripts",
      `"use strict"; return (${effect.code});`
    );
    const component = compileFn(
      React, interpolate, spring, useCurrentFrame, useVideoConfig,
      undefined, undefined, undefined, undefined, undefined,
      undefined, undefined, undefined
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
