// Scene addressing for compositions.
//
// A composition is a single index.html. To let the agent edit ONE scene without
// re-reading/re-writing the whole (potentially very long) file, scenes are
// marked as balanced <div> containers carrying a stable id + time range:
//
//   <div class="scene" data-scene-id="scene-1" data-scene-start="0" data-scene-duration="10"> … </div>
//
// This module parses those markers out of the raw HTML (depth-aware, so nested
// <div>s and inline <script>/<style>/comments don't confuse the boundaries) and
// supports reading / replacing a single scene by id or by playhead time.
//
// Legacy compositions authored before the scene contract simply have no markers;
// parseScenes returns [] and callers fall back to whole-file editing.

export type SceneInfo = {
  id: string;
  // Seconds on the composition timeline. null when the attribute is absent.
  start: number | null;
  duration: number | null;
  // Character offsets of the scene's outer <div> … </div> in the source html.
  outerStart: number;
  outerEnd: number;
  // The scene's full outer HTML (the <div …> … </div> slice).
  html: string;
};

// Matches a <div …> opening tag that carries data-scene-id. `[^>]*` is safe here
// because scene opening tags don't contain '>' inside attribute values.
const SCENE_OPEN_RE = /<div\b[^>]*\bdata-scene-id\s*=\s*["']([^"']+)["'][^>]*>/gi;

function readNumberAttr(openTag: string, attr: string): number | null {
  const match = openTag.match(new RegExp(`\\b${attr}\\s*=\\s*["']([\\d.]+)["']`, "i"));
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

// Walks forward from the scene's opening <div (at `fromIndex`) and returns the
// character offset just past its matching </div>, tracking nesting depth and
// skipping <script>/<style>/comment regions where stray <div text may appear.
// Returns -1 if the markup is unbalanced.
function findSceneEnd(html: string, fromIndex: number): number {
  const tokenRe = /<script\b|<\/script>|<style\b|<\/style>|<!--|-->|<div\b|<\/div>/gi;
  tokenRe.lastIndex = fromIndex;
  let depth = 0;
  let inScript = false;
  let inStyle = false;
  let inComment = false;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(html)) !== null) {
    const token = match[0].toLowerCase();
    if (inComment) {
      if (token === "-->") inComment = false;
      continue;
    }
    if (inScript) {
      if (token === "</script>") inScript = false;
      continue;
    }
    if (inStyle) {
      if (token === "</style>") inStyle = false;
      continue;
    }
    if (token === "<!--") {
      inComment = true;
    } else if (token.startsWith("<script")) {
      inScript = true;
    } else if (token.startsWith("<style")) {
      inStyle = true;
    } else if (token.startsWith("<div")) {
      depth += 1;
    } else if (token === "</div>") {
      depth -= 1;
      if (depth === 0) return match.index + match[0].length;
    }
  }
  return -1;
}

// Parses all top-level scenes in document order. Nested data-scene-id markers
// (a scene inside a scene) are ignored — the outermost wins.
export function parseScenes(html: string): SceneInfo[] {
  const scenes: SceneInfo[] = [];
  SCENE_OPEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  let claimedUntil = -1;
  while ((match = SCENE_OPEN_RE.exec(html)) !== null) {
    const outerStart = match.index;
    // Skip markers that fall inside an already-claimed (outer) scene.
    if (outerStart < claimedUntil) continue;
    const openTag = match[0];
    const id = match[1];
    const outerEnd = findSceneEnd(html, outerStart);
    if (outerEnd === -1) continue; // unbalanced — treat as unaddressable
    claimedUntil = outerEnd;
    scenes.push({
      id,
      start: readNumberAttr(openTag, "data-scene-start"),
      duration: readNumberAttr(openTag, "data-scene-duration"),
      outerStart,
      outerEnd,
      html: html.slice(outerStart, outerEnd),
    });
  }
  return scenes;
}

export function getScene(html: string, id: string): SceneInfo | null {
  return parseScenes(html).find((scene) => scene.id === id) ?? null;
}

// The scene whose [start, start+duration) window contains `seconds`. Falls back
// to the nearest scene by start time when durations are missing/ambiguous.
export function resolveSceneAtTime(html: string, seconds: number): SceneInfo | null {
  const scenes = parseScenes(html);
  if (scenes.length === 0) return null;
  for (const scene of scenes) {
    if (scene.start == null) continue;
    const end = scene.duration != null ? scene.start + scene.duration : Number.POSITIVE_INFINITY;
    if (seconds >= scene.start && seconds < end) return scene;
  }
  // No exact hit — pick the latest scene starting at or before `seconds`.
  const timed = scenes.filter((scene) => scene.start != null);
  if (timed.length === 0) return null;
  const atOrBefore = timed.filter((scene) => (scene.start ?? 0) <= seconds);
  const pool = atOrBefore.length > 0 ? atOrBefore : timed;
  return pool.reduce((best, scene) => ((scene.start ?? 0) > (best.start ?? 0) ? scene : best));
}

// Returns the full html with scene `id`'s region replaced by `replacement`.
// Returns null when the scene id isn't found (caller decides the fallback).
export function replaceScene(html: string, id: string, replacement: string): string | null {
  const scene = getScene(html, id);
  if (!scene) return null;
  return html.slice(0, scene.outerStart) + replacement + html.slice(scene.outerEnd);
}

// Compact, human-readable manifest for the agent: one line per scene with its id,
// time range, and size, so the model can pick the right scene to read/edit.
export function sceneSummary(html: string): string {
  const scenes = parseScenes(html);
  if (scenes.length === 0) {
    return "No addressable scenes (no data-scene-id markers). Use read_file/write_file/diff_file for whole-file edits.";
  }
  const lines = scenes.map((scene) => {
    const start = scene.start != null ? `${scene.start}s` : "?";
    const dur = scene.duration != null ? `${scene.duration}s` : "?";
    return `- ${scene.id}: starts ${start}, duration ${dur} (${scene.html.length} chars)`;
  });
  return `${scenes.length} scene(s):\n${lines.join("\n")}`;
}
