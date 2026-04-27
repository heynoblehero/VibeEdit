/**
 * Common test-case shape shared across runner / generator / report.
 * One TestCase = one user message against one (initial state) →
 * one set of assertions on the agent's behaviour.
 */

import type { Project } from "../../src/lib/scene-schema";
import type { ManualEditLogEntry } from "./agent-client";
import type { ToolTraceAssertion } from "../judges/tool-trace";

export type TestTier = 1 | 2 | 3 | 4 | 5 | 6;

export type TestCategory =
  | "build" // tier 1
  | "single-edit" // tier 2
  | "rearrange" // tier 3
  | "cuts-overlays" // tier 4
  | "asset-awareness" // tier 5
  | "manual-edit-preserve"; // tier 6

export interface AssetMatchExpectation {
  /** Scene index (0-based). */
  sceneIndex: number;
  /** Where the agent should put the asset. */
  field:
    | "background.imageUrl"
    | "background.videoUrl"
    | "characterUrl"
    | "sceneSfxUrl"
    | "effects[].url";
  /** At least one of these keywords must match the asset's tagged keywords. */
  expectKeywords: string[];
}

export interface DurationExpectation {
  minSec: number;
  maxSec: number;
}

export interface ManualEditPreserveExpectation {
  sceneId: string;
  field: string;
  /** The value MUST equal this after the agent runs. */
  value: string | number | null;
}

export interface TestCase {
  id: string;
  tier: TestTier;
  category: TestCategory;
  /** Human-readable description (printed in failure logs). */
  description: string;
  /** Initial project — null = empty new project (the agent route requires
   *  at least an empty Project shape; runner constructs it). */
  initialProject: Project | null;
  /** Pre-injected manual edits (for tier-6 awareness tests). */
  recentManualEdits: ManualEditLogEntry[];
  /** focusedSceneId set on the request. */
  focusedSceneId: string | null;
  /** The user's chat message for this turn. */
  userMessage: string;
  /** Programmatic assertions. */
  assertions: {
    toolTrace?: ToolTraceAssertion;
    /** Total scene count after the run, ranges. */
    finalSceneCount?: { min?: number; max?: number };
    /** Total clip duration. */
    finalDurationSec?: DurationExpectation;
    /** Asset-awareness checks per scene. */
    assetMatches?: AssetMatchExpectation[];
    /** Tier-6 fields that must remain untouched. */
    manualEditsPreserved?: ManualEditPreserveExpectation[];
    /** qualityScore from videoQualityScore tool, if the agent ran it. */
    minQualityScore?: number;
    /** When true, the harness invokes the LLM-judge for ambiguous intent. */
    llmJudgeForIntent?: boolean;
  };
}

export interface CaseResult {
  caseId: string;
  tier: TestTier;
  category: TestCategory;
  pass: boolean;
  failures: Array<{ kind: string; detail: string }>;
  /** Raw tool-call sequence — kept on disk for failure analysis. */
  toolTrace: Array<{ name: string; args: Record<string, unknown>; ok?: boolean }>;
  /** Wall clock + cost telemetry. */
  durationMs: number;
  costUsd: number;
  /** Optional LLM-judge score (1-5). */
  intentScore?: number;
  /** When something went wrong on the wire. */
  agentError?: string | null;
}
