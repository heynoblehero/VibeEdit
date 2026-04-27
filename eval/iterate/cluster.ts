/**
 * Failure clustering. Reads CaseResult[] (typically loaded from a run's
 * log.jsonl) and buckets failed cases by category derived from
 * failure.kind. Used by the iterate loop to pick the worst-cluster to
 * target with a prompt mutation.
 *
 * Threshold filtering (skip clusters under N% fail-rate) is the
 * caller's responsibility — this module just buckets.
 */

import type { CaseResult } from "../runner/case-types";

/** Map a single failure.kind to a coarse cluster label. */
function clusterForKind(kind: string): string | null {
  switch (kind) {
    case "missing-required-tool":
    case "forbidden-tool-called":
    case "arg-mismatch":
    case "too-many-calls":
      return "tool-trace-mismatch";
    case "keyword-mismatch":
    case "asset-not-in-index":
      return "asset-mismatch";
    case "field-changed":
      return "manual-edit-overwrite";
    case "out-of-scope-tool":
    case "out-of-scope-mutation":
    case "scene-count-low":
    case "scene-count-high":
      return "scope-drift";
    case "duration-out-of-range":
      return "duration-miss";
    case "quality-score-low":
      return "quality-low";
    case "agent-error":
      return "wire-error";
    default:
      return null;
  }
}

/**
 * Bucket failed cases by cluster. A case appears in every cluster its
 * failures touch (deduped) — one case can be both scope-drift and
 * asset-mismatch.
 */
export function clusterFailures(results: CaseResult[]): Map<string, CaseResult[]> {
  const out = new Map<string, CaseResult[]>();
  for (const r of results) {
    if (r.pass) continue;
    const seen = new Set<string>();
    for (const f of r.failures) {
      const cluster = clusterForKind(f.kind);
      if (!cluster || seen.has(cluster)) continue;
      seen.add(cluster);
      const arr = out.get(cluster) ?? [];
      arr.push(r);
      out.set(cluster, arr);
    }
  }
  return out;
}
