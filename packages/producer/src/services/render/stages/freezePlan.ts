/**
 * freezePlan — write the meta/{composition,encoder,chunks}.json + plan.json
 * manifest at the end of `plan()`, compute the planHash from the frozen
 * artifacts, and return the manifest path.
 *
 * Phase 1 PR 1.1 ships the signature only: there are no callers yet. The
 * function body is added in Phase 3 PR 3.1 when `services/distributed/plan.ts`
 * lands and composes the Phase-1 stages. Keeping the skeleton in this PR
 * means subsequent stage-extraction PRs can grow the `stages/` directory
 * without touching the `producer/src/index.ts` export surface again.
 *
 * See DISTRIBUTED-RENDERING-PLAN.md §2.1 phase 6, §4.1 directory layout,
 * §4.3 LockedRenderConfig.
 */

import type { Fps } from "@hyperframes/core";
import type { PlanDimensions } from "./planHash.js";

/**
 * The encoder configuration locked in at plan time. Mirrors §4.3
 * LockedRenderConfig in the design doc. Phase 1 declares the shape; Phase 2
 * + Phase 3 populate it from the existing `renderOrchestrator` config and
 * the new closed-GOP encoder args.
 */
export interface LockedRenderConfig {
  // Capture
  captureMode: "beginframe" | "screenshot";
  forceScreenshot: boolean;
  deviceScaleFactor: number;
  useLayeredHdrComposite: boolean;
  /** Hard-pinned to "software" in v1 distributed renders. */
  browserGpuMode: "software";
  warmupTicks: number;

  // Encode
  encoder: "libx264-software" | "libx265-software" | "prores-software" | "png-sequence";
  ffmpegVersion: string;
  preset: string;
  crf?: number;
  bitrate?: string;
  /** Equal to chunkSize for closed-GOP concat-copy. */
  gopSize: number;
  closedGop: true;
  forceKeyframes: "n=0";
  pixelFormat: string;

  // Chunking
  chunkSize: number;
  chunkCount: number;

  /** Snapshot of `PRODUCER_RUNTIME_*` env vars at plan time. */
  runtimeEnv: Record<string, string>;
}

export interface CompositionMetadataJson {
  durationSeconds: number;
  width: number;
  height: number;
  fps: Fps;
  videoCount: number;
  audioCount: number;
  imageCount: number;
}

export interface ChunkSliceJson {
  index: number;
  startFrame: number;
  /** Inclusive end frame for the chunk. */
  endFrame: number;
}

/**
 * Inputs to `freezePlan`. `planDir` already contains `compiled/`,
 * `video-frames/`, and (optionally) `audio.aac` by the time freezePlan
 * runs — see §2.1 phases 1-5.
 */
export interface FreezePlanInput {
  /** Absolute path to the plan directory being frozen. */
  planDir: string;
  composition: CompositionMetadataJson;
  encoder: LockedRenderConfig;
  chunks: readonly ChunkSliceJson[];
  dimensions: PlanDimensions;
  producerVersion: string;
  /** Hash of the deterministic-font snapshot baked into the plan. */
  fontSnapshotSha: string;
}

export interface FreezePlanResult {
  /** Absolute path to `plan.json`. */
  planJsonPath: string;
  /** Content-addressed planHash; see §4.2. */
  planHash: string;
}

/**
 * Freeze a plan directory: write `meta/*.json` + top-level `plan.json`, then
 * compute `planHash` over the canonicalized contents.
 *
 * Skeleton only in Phase 1. Phase 3 PR 3.1 wires this up.
 */
export async function freezePlan(_input: FreezePlanInput): Promise<FreezePlanResult> {
  throw new Error(
    "freezePlan is not implemented yet — wired in Phase 3 PR 3.1 (see DISTRIBUTED-RENDERING-PLAN.md §11).",
  );
}
