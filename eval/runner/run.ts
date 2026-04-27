/**
 * Case-batch orchestrator. Loads TestCase[] from a seed file, runs
 * them with bounded concurrency against a local /api/agent, and
 * appends one JSONL row per case to results/<run-id>/log.jsonl.
 *
 * Usage:
 *   bun run eval:run -- --seeds tier1 [--count 5] [--concurrency 4]
 *
 * Environment:
 *   AGENT_BASE_URL — defaults to http://localhost:3000
 *   SYSTEM_PROMPT_OVERRIDE — passed through to the route via the
 *     dev server's env (the harness can't set per-request env vars,
 *     so for A/B testing the harness restarts the dev server with
 *     the override env set).
 */

import { mkdir, writeFile, appendFile, readdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { invokeAgent } from "./agent-client";
import { assertToolTrace } from "../judges/tool-trace";
import { judgeAssetMatches } from "../judges/asset-match";
import { judgeManualEditsPreserved } from "../judges/manual-edit-preserved";
import type { TestCase, CaseResult, TestTier } from "./case-types";
import type { Project } from "../../src/lib/scene-schema";

const ROOT = resolve(__dirname, "..");
const SEEDS_DIR = resolve(ROOT, "cases/seeds");
const RESULTS_DIR = resolve(ROOT, "results");

interface RunOptions {
  seeds: string; // file basename without extension, e.g. "tier1-build"
  count?: number;
  concurrency?: number;
  runId?: string;
}

function emptyProject(): Project {
  return {
    id: `eval-${Math.random().toString(36).slice(2, 9)}`,
    name: "Eval Project",
    script: "",
    scenes: [],
    fps: 30,
    width: 1080,
    height: 1920,
  } as Project;
}

async function loadSeeds(name: string): Promise<TestCase[]> {
  const path = resolve(SEEDS_DIR, `${name}.ts`);
  const mod = (await import(path)) as { default?: TestCase[]; cases?: TestCase[] };
  const cases = mod.cases ?? mod.default ?? [];
  if (!Array.isArray(cases) || cases.length === 0) {
    throw new Error(`Seed file ${path} did not export 'cases: TestCase[]'`);
  }
  return cases;
}

async function runOne(tc: TestCase): Promise<CaseResult> {
  const project = tc.initialProject ?? emptyProject();
  const t0 = Date.now();
  const out = await invokeAgent({
    baseUrl: process.env.AGENT_BASE_URL,
    messages: [{ role: "user", content: tc.userMessage }],
    project,
    focusedSceneId: tc.focusedSceneId,
    recentManualEdits: tc.recentManualEdits,
  });

  const failures: Array<{ kind: string; detail: string }> = [];

  if (out.error) {
    failures.push({ kind: "agent-error", detail: out.error });
  }

  // Tool-trace assertions.
  if (tc.assertions.toolTrace) {
    const r = assertToolTrace(out.toolCalls, tc.assertions.toolTrace);
    if (!r.pass) failures.push(...r.failures.map((f) => ({ kind: f.kind, detail: f.detail })));
  }

  const finalProject = out.finalProject ?? project;

  // Final scene count.
  if (tc.assertions.finalSceneCount) {
    const n = finalProject.scenes.length;
    const { min, max } = tc.assertions.finalSceneCount;
    if (typeof min === "number" && n < min)
      failures.push({ kind: "scene-count-low", detail: `${n} < ${min}` });
    if (typeof max === "number" && n > max)
      failures.push({ kind: "scene-count-high", detail: `${n} > ${max}` });
  }

  // Final duration.
  if (tc.assertions.finalDurationSec) {
    const total = finalProject.scenes.reduce((acc, s) => acc + (s.duration ?? 0), 0);
    const { minSec, maxSec } = tc.assertions.finalDurationSec;
    if (total < minSec || total > maxSec) {
      failures.push({
        kind: "duration-out-of-range",
        detail: `total=${total.toFixed(1)}s window=${minSec}-${maxSec}`,
      });
    }
  }

  // Asset-awareness — keyword-overlap judge, may escalate to LLM.
  if (tc.assertions.assetMatches && tc.assertions.assetMatches.length > 0) {
    const r = await judgeAssetMatches(finalProject, tc.assertions.assetMatches);
    if (!r.pass) failures.push(...r.failures.map((f) => ({ kind: f.kind, detail: f.detail })));
  }

  // Manual-edit preservation.
  if (tc.assertions.manualEditsPreserved && tc.assertions.manualEditsPreserved.length > 0) {
    const r = judgeManualEditsPreserved(finalProject, tc.assertions.manualEditsPreserved);
    if (!r.pass) failures.push(...r.failures.map((f) => ({ kind: f.kind, detail: f.detail })));
  }

  // qualityScore floor.
  if (typeof tc.assertions.minQualityScore === "number") {
    const qs = (finalProject as Project & { qualityScore?: number }).qualityScore;
    if (typeof qs !== "number" || qs < tc.assertions.minQualityScore) {
      failures.push({
        kind: "quality-score-low",
        detail: `qualityScore=${qs ?? "n/a"} < ${tc.assertions.minQualityScore}`,
      });
    }
  }

  return {
    caseId: tc.id,
    tier: tc.tier,
    category: tc.category,
    pass: failures.length === 0,
    failures,
    toolTrace: out.toolCalls.map((c) => ({ name: c.name, args: c.args, ok: c.ok })),
    durationMs: Date.now() - t0,
    costUsd: 0, // filled by separate cost-telemetry pass; tokens aren't on the SSE
    agentError: out.error,
  };
}

async function pool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, n) }, worker));
  return out;
}

export async function run(opts: RunOptions): Promise<{ runId: string; pass: number; total: number }> {
  const cases = (await loadSeeds(opts.seeds)).slice(0, opts.count ?? Infinity);
  const concurrency = opts.concurrency ?? 4;
  const runId = opts.runId ?? new Date().toISOString().replace(/[:.]/g, "-");
  const dir = resolve(RESULTS_DIR, runId);
  await mkdir(dir, { recursive: true });
  const logPath = resolve(dir, "log.jsonl");
  await writeFile(logPath, "", "utf8");

  console.log(`[eval] running ${cases.length} cases · concurrency=${concurrency} · runId=${runId}`);
  const started = Date.now();
  let done = 0;
  let pass = 0;

  const results = await pool(cases, concurrency, async (tc) => {
    const r = await runOne(tc);
    done++;
    if (r.pass) pass++;
    await appendFile(logPath, JSON.stringify(r) + "\n", "utf8");
    process.stdout.write(
      `\r[eval] ${done}/${cases.length} · pass=${pass} (${((pass / done) * 100).toFixed(1)}%) · ${r.caseId} ${r.pass ? "✓" : "✗"}        \n`,
    );
    return r;
  });

  const totalMs = Date.now() - started;
  const summary = {
    runId,
    seeds: opts.seeds,
    total: results.length,
    pass: results.filter((r) => r.pass).length,
    byTier: byTier(results),
    byCategory: byCategory(results),
    totalMs,
  };
  await writeFile(resolve(dir, "summary.json"), JSON.stringify(summary, null, 2), "utf8");
  console.log(
    `\n[eval] done · ${summary.pass}/${summary.total} (${((summary.pass / summary.total) * 100).toFixed(1)}%) · ${(totalMs / 1000).toFixed(1)}s`,
  );
  return { runId, pass: summary.pass, total: summary.total };
}

function byTier(rs: CaseResult[]): Record<string, { pass: number; total: number }> {
  const out: Record<string, { pass: number; total: number }> = {};
  for (const r of rs) {
    const k = `tier${r.tier}`;
    out[k] ??= { pass: 0, total: 0 };
    out[k].total++;
    if (r.pass) out[k].pass++;
  }
  return out;
}

function byCategory(rs: CaseResult[]): Record<string, { pass: number; total: number }> {
  const out: Record<string, { pass: number; total: number }> = {};
  for (const r of rs) {
    out[r.category] ??= { pass: 0, total: 0 };
    out[r.category].total++;
    if (r.pass) out[r.category].pass++;
  }
  return out;
}

// ── CLI entry ───────────────────────────────────────────────────────
function parseArgs(): RunOptions {
  const args = process.argv.slice(2);
  let seeds = "tier1-build";
  let count: number | undefined;
  let concurrency: number | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--seeds" && args[i + 1]) seeds = args[++i]!;
    else if (args[i] === "--count" && args[i + 1]) count = Number(args[++i]);
    else if (args[i] === "--concurrency" && args[i + 1]) concurrency = Number(args[++i]);
  }
  return { seeds, count, concurrency };
}

if (typeof require !== "undefined" && require.main === module) {
  run(parseArgs())
    .then((r) => {
      process.exit(r.pass === r.total ? 0 : 1);
    })
    .catch((e) => {
      console.error(e);
      process.exit(2);
    });
}
