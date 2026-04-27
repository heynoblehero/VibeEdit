/**
 * Tool-call trace judge. The bread-and-butter assertion type for the
 * harness: given the agent's tool_start sequence, did it call the
 * tools we expected, and did it avoid the tools we forbid?
 *
 * Cheap, fully programmatic — no LLM calls. Catches ~70% of intent
 * failures (wrong tool, wrong scope, scope-drift, gave-up-too-early).
 */

import type { ToolCallTrace } from "../runner/agent-client";

export interface ArgMatch {
  /** Dot-path into the args object, e.g. "sceneId" or "patch.text". */
  path: string;
  /** Exact value, regex (string starting with /), or { in: [...] }. */
  match:
    | string
    | number
    | boolean
    | { regex: string }
    | { in: Array<string | number | boolean> }
    | { any: true };
}

export interface ToolExpectation {
  /** Tool name to look for. */
  name: string;
  /** Minimum number of times this tool must appear. Default 1. */
  minCount?: number;
  /** Maximum number of times this tool may appear. Default Infinity. */
  maxCount?: number;
  /** Per-call argument constraints — applied to the FIRST matching call. */
  args?: ArgMatch[];
}

export interface ToolTraceAssertion {
  /** These tools MUST appear at least minCount times each. */
  mustCall?: ToolExpectation[];
  /** These tool names must NEVER appear. */
  mustNotCall?: string[];
  /** Total tool calls must be ≤ this. Catches "agent went hog wild". */
  maxTotalCalls?: number;
}

export interface ToolTraceFailure {
  kind:
    | "missing-required-tool"
    | "forbidden-tool-called"
    | "arg-mismatch"
    | "too-many-calls";
  detail: string;
}

export interface ToolTraceResult {
  pass: boolean;
  failures: ToolTraceFailure[];
}

function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object") return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function matchValue(actual: unknown, expected: ArgMatch["match"]): boolean {
  if (typeof expected === "object" && expected !== null) {
    if ("any" in expected) return actual !== undefined;
    if ("regex" in expected)
      return typeof actual === "string" && new RegExp(expected.regex).test(actual);
    if ("in" in expected) return expected.in.some((v) => v === actual);
  }
  return actual === expected;
}

export function assertToolTrace(
  trace: ToolCallTrace[],
  spec: ToolTraceAssertion,
): ToolTraceResult {
  const failures: ToolTraceFailure[] = [];

  if (spec.mustCall) {
    for (const exp of spec.mustCall) {
      const matches = trace.filter((c) => c.name === exp.name);
      const min = exp.minCount ?? 1;
      const max = exp.maxCount ?? Infinity;
      if (matches.length < min) {
        failures.push({
          kind: "missing-required-tool",
          detail: `${exp.name}: expected ≥${min}, saw ${matches.length}`,
        });
        continue;
      }
      if (matches.length > max) {
        failures.push({
          kind: "too-many-calls",
          detail: `${exp.name}: expected ≤${max}, saw ${matches.length}`,
        });
      }
      if (exp.args && matches.length > 0) {
        // Find at least ONE call whose args satisfy ALL ArgMatches.
        const ok = matches.some((call) =>
          exp.args!.every((a) => matchValue(getByPath(call.args, a.path), a.match)),
        );
        if (!ok) {
          failures.push({
            kind: "arg-mismatch",
            detail: `${exp.name}: no call matched required args ${JSON.stringify(exp.args)}`,
          });
        }
      }
    }
  }

  if (spec.mustNotCall) {
    for (const name of spec.mustNotCall) {
      if (trace.some((c) => c.name === name)) {
        failures.push({
          kind: "forbidden-tool-called",
          detail: `${name} was called but is on mustNotCall list`,
        });
      }
    }
  }

  if (typeof spec.maxTotalCalls === "number" && trace.length > spec.maxTotalCalls) {
    failures.push({
      kind: "too-many-calls",
      detail: `total tool calls ${trace.length} > maxTotalCalls ${spec.maxTotalCalls}`,
    });
  }

  return { pass: failures.length === 0, failures };
}
