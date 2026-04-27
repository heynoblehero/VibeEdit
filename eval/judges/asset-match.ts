/**
 * Asset-awareness judge. For each `assetMatches` expectation in a case,
 * locate the asset URL the agent placed at (sceneIndex, field), look it
 * up in the Isaac asset index, and check its tagged keywords overlap
 * with the expected keywords.
 *
 * Cheap path: programmatic set-overlap on keywords.
 * Escalation: if the keyword check fails AND the agent picked an asset
 *  outside the index (or asset has no overlap), the LLM-judge gets a
 *  shot at it ("the scene is about X — is the chosen asset Y a
 *  reasonable pick?"). LLM-judge default is currently disabled here
 *  to keep cost predictable; judges/llm-judge.ts can be wired in once
 *  baseline numbers exist.
 */

import type { Project, Scene, SceneEffect } from "../../src/lib/scene-schema";
import type { AssetMatchExpectation } from "../runner/case-types";
import { findAsset, keywordsFor } from "../fixtures/isaac-asset-index";

export interface AssetMatchFailure {
  kind: "missing-asset" | "asset-not-in-index" | "keyword-mismatch";
  detail: string;
}

export interface AssetMatchResult {
  pass: boolean;
  failures: AssetMatchFailure[];
}

function readField(scene: Scene, field: string): string | null {
  switch (field) {
    case "background.imageUrl":
      return scene.background?.imageUrl ?? null;
    case "background.videoUrl":
      return scene.background?.videoUrl ?? null;
    case "characterUrl":
      return (scene as Scene & { characterUrl?: string }).characterUrl ?? null;
    case "sceneSfxUrl":
      return scene.sceneSfxUrl ?? null;
    case "effects[].url": {
      const fx = (scene.effects ?? []) as SceneEffect[];
      // Effects use varied URL fields — flatten the obvious ones.
      const found = fx
        .map((e) => {
          const obj = e as unknown as Record<string, unknown>;
          return (
            (typeof obj.url === "string" ? obj.url : null) ??
            (typeof obj.videoUrl === "string" ? obj.videoUrl : null) ??
            (typeof obj.imageUrl === "string" ? obj.imageUrl : null)
          );
        })
        .find((u): u is string => typeof u === "string" && u.length > 0);
      return found ?? null;
    }
    default:
      return null;
  }
}

export async function judgeAssetMatches(
  project: Project,
  expectations: AssetMatchExpectation[],
): Promise<AssetMatchResult> {
  const failures: AssetMatchFailure[] = [];
  for (const exp of expectations) {
    const scene = project.scenes[exp.sceneIndex];
    if (!scene) {
      failures.push({
        kind: "missing-asset",
        detail: `scene ${exp.sceneIndex} does not exist`,
      });
      continue;
    }
    const url = readField(scene, exp.field);
    if (!url) {
      failures.push({
        kind: "missing-asset",
        detail: `scene ${exp.sceneIndex} ${exp.field} is empty`,
      });
      continue;
    }
    const asset = findAsset(url);
    if (!asset) {
      failures.push({
        kind: "asset-not-in-index",
        detail: `scene ${exp.sceneIndex} picked ${url} — outside the Isaac pack`,
      });
      continue;
    }
    const tagged = new Set(keywordsFor(url));
    const wanted = exp.expectKeywords;
    const hit = wanted.some((k) => tagged.has(k));
    if (!hit) {
      failures.push({
        kind: "keyword-mismatch",
        detail: `scene ${exp.sceneIndex} ${exp.field}=${asset.path} keywords=[${[...tagged].join(",")}] expected one of [${wanted.join(",")}]`,
      });
    }
  }
  return { pass: failures.length === 0, failures };
}
