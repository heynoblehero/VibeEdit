/**
 * Candidate-prompt A/B harness. Spawns a SECOND dev server on port
 * 3002 with SYSTEM_PROMPT_OVERRIDE set to a candidate prompt, re-runs
 * the failing cases against it, and decides keep/discard based on the
 * pass-rate uplift.
 *
 * Append-only experiment log lands in eval/iterate/experiment-log.jsonl.
 *
 * Also exposes iterateOnce(runId): the end-to-end driver that loads a
 * run's log.jsonl, clusters failures, picks the worst, calls the
 * mutator, A/B tests, and records the outcome.
 *
 * Usage:
 *   bun run eval/iterate/ab-test.ts <runId>
 */

import { mkdir, readFile, appendFile, readdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import type { CaseResult, TestCase } from "../runner/case-types";
import { invokeAgent } from "../runner/agent-client";
import { assertToolTrace } from "../judges/tool-trace";
import { judgeAssetMatches } from "../judges/asset-match";
import { judgeManualEditsPreserved } from "../judges/manual-edit-preserved";
import type { Project } from "../../src/lib/scene-schema";
import { clusterFailures } from "./cluster";
import { proposeMutation } from "./mutate-prompt";

const ROOT = resolve(__dirname, "..");
const REPO_ROOT = resolve(ROOT, "..");
const SEEDS_DIR = resolve(ROOT, "cases/seeds");
const RESULTS_DIR = resolve(ROOT, "results");
const ITERATE_DIR = resolve(ROOT, "iterate");
const EXPERIMENT_LOG = resolve(ITERATE_DIR, "experiment-log.jsonl");
const CANDIDATE_PORT = 3002;
const KEEP_THRESHOLD = 0.05; // 5% absolute uplift

// ── shared helpers ─────────────────────────────────────────────────

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

// ── seed loading + case lookup ─────────────────────────────────────

async function loadAllSeeds(): Promise<TestCase[]> {
  const files = await readdir(SEEDS_DIR);
  const seedFiles = files.filter((f) => f.startsWith("tier") && f.endsWith(".ts"));
  const all: TestCase[] = [];
  for (const f of seedFiles) {
    const mod = (await import(resolve(SEEDS_DIR, f))) as {
      default?: TestCase[];
      cases?: TestCase[];
    };
    const cases = mod.cases ?? mod.default ?? [];
    if (Array.isArray(cases)) all.push(...cases);
  }
  return all;
}

async function findCasesByIds(ids: string[]): Promise<TestCase[]> {
  const all = await loadAllSeeds();
  const byId = new Map(all.map((c) => [c.id, c]));
  return ids.map((id) => byId.get(id)).filter((c): c is TestCase => Boolean(c));
}

// ── single-case runner (mirrors run.ts:runOne, but takes a baseUrl) ──

async function runOne(tc: TestCase, baseUrl: string): Promise<CaseResult> {
  const project = tc.initialProject ?? emptyProject();
  const t0 = Date.now();
  const out = await invokeAgent({
    baseUrl,
    messages: [{ role: "user", content: tc.userMessage }],
    project,
    focusedSceneId: tc.focusedSceneId,
    recentManualEdits: tc.recentManualEdits,
  });

  const failures: Array<{ kind: string; detail: string }> = [];
  if (out.error) failures.push({ kind: "agent-error", detail: out.error });

  if (tc.assertions.toolTrace) {
    const r = assertToolTrace(out.toolCalls, tc.assertions.toolTrace);
    if (!r.pass) failures.push(...r.failures.map((f) => ({ kind: f.kind, detail: f.detail })));
  }

  const finalProject = out.finalProject ?? project;

  if (tc.assertions.finalSceneCount) {
    const n = finalProject.scenes.length;
    const { min, max } = tc.assertions.finalSceneCount;
    if (typeof min === "number" && n < min)
      failures.push({ kind: "scene-count-low", detail: `${n} < ${min}` });
    if (typeof max === "number" && n > max)
      failures.push({ kind: "scene-count-high", detail: `${n} > ${max}` });
  }

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

  if (tc.assertions.assetMatches && tc.assertions.assetMatches.length > 0) {
    const r = await judgeAssetMatches(finalProject, tc.assertions.assetMatches);
    if (!r.pass) failures.push(...r.failures.map((f) => ({ kind: f.kind, detail: f.detail })));
  }

  if (tc.assertions.manualEditsPreserved && tc.assertions.manualEditsPreserved.length > 0) {
    const r = judgeManualEditsPreserved(finalProject, tc.assertions.manualEditsPreserved);
    if (!r.pass) failures.push(...r.failures.map((f) => ({ kind: f.kind, detail: f.detail })));
  }

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
    costUsd: 0,
    agentError: out.error,
  };
}

// ── candidate dev server lifecycle ─────────────────────────────────

async function waitForServer(baseUrl: string, timeoutMs = 60_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/setup`);
      if (res.ok) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

interface SpawnedServer {
  proc: ChildProcess;
  baseUrl: string;
  kill: () => void;
}

function spawnCandidateServer(candidatePrompt: string, port: number): SpawnedServer {
  const proc = spawn("bun", ["run", "dev"], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      SYSTEM_PROMPT_OVERRIDE: candidatePrompt,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  // Drain output to prevent the pipe from blocking — but don't print
  // it (next.js dev is noisy).
  proc.stdout?.on("data", () => {});
  proc.stderr?.on("data", () => {});
  return {
    proc,
    baseUrl: `http://localhost:${port}`,
    kill: () => {
      if (!proc.killed) {
        try {
          proc.kill("SIGTERM");
        } catch {
          // already gone
        }
      }
    },
  };
}

// ── public API ─────────────────────────────────────────────────────

export interface ABTestArgs {
  currentPromptPath: string;
  candidatePrompt: string;
  failingCases: CaseResult[];
  originalRunId: string;
  cluster?: string;
  mutationDescription?: string;
  diff?: string;
  /** Bump the version label written to experiment-log.jsonl. */
  version?: string;
  /** Concurrency for the re-run. Default 4. */
  concurrency?: number;
}

export interface ABTestResult {
  passBefore: number;
  passAfter: number;
  kept: boolean;
  reason: string;
}

export async function abTest(args: ABTestArgs): Promise<ABTestResult> {
  const tcs = await findCasesByIds(args.failingCases.map((c) => c.caseId));
  const total = tcs.length;
  // passBefore over the failing slice is by definition 0 — they all
  // failed in the original run. We still record it for log clarity.
  const passBefore = 0;

  if (total === 0) {
    const result: ABTestResult = {
      passBefore: 0,
      passAfter: 0,
      kept: false,
      reason: "no-failing-cases-resolved",
    };
    await recordExperiment(args, total, 0, 0, result);
    return result;
  }

  const server = spawnCandidateServer(args.candidatePrompt, CANDIDATE_PORT);
  let passAfter = 0;
  let reason = "";

  try {
    const ready = await waitForServer(server.baseUrl);
    if (!ready) {
      reason = "candidate-server-failed-to-start";
      const result: ABTestResult = { passBefore: 0, passAfter: 0, kept: false, reason };
      await recordExperiment(args, total, 0, 0, result);
      return result;
    }

    const concurrency = args.concurrency ?? 4;
    const results = await pool(tcs, concurrency, (tc) => runOne(tc, server.baseUrl));
    passAfter = results.filter((r) => r.pass).length;
  } finally {
    server.kill();
  }

  const before = passBefore / total;
  const after = passAfter / total;
  const kept = after - before >= KEEP_THRESHOLD;
  reason = kept
    ? `uplift ${(after - before).toFixed(3)} >= ${KEEP_THRESHOLD}`
    : `uplift ${(after - before).toFixed(3)} < ${KEEP_THRESHOLD}`;

  const result: ABTestResult = { passBefore: before, passAfter: after, kept, reason };
  await recordExperiment(args, total, before, after, result);
  return result;
}

async function recordExperiment(
  args: ABTestArgs,
  casesRetested: number,
  passBefore: number,
  passAfter: number,
  result: ABTestResult,
): Promise<void> {
  await mkdir(dirname(EXPERIMENT_LOG), { recursive: true });
  const entry = {
    ts: new Date().toISOString(),
    version: args.version ?? `iter-${Date.now()}`,
    cluster: args.cluster ?? "unknown",
    mutationDescription: args.mutationDescription ?? "",
    diff: args.diff ?? "",
    casesRetested,
    passBefore,
    passAfter,
    kept: result.kept,
    reason: result.reason,
    originalRunId: args.originalRunId,
  };
  await appendFile(EXPERIMENT_LOG, JSON.stringify(entry) + "\n", "utf8");
}

// ── end-to-end driver ──────────────────────────────────────────────

async function readRunLog(runId: string): Promise<CaseResult[]> {
  const path = resolve(RESULTS_DIR, runId, "log.jsonl");
  const txt = await readFile(path, "utf8");
  return txt
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as CaseResult);
}

/**
 * Apply a unified-diff-style mutation to the current prompt. The
 * mutator emits diffs in `+/-` line form (no @@ headers). We resolve
 * by removing every `-` line that matches verbatim and inserting `+`
 * lines at the same locus. If the diff doesn't apply cleanly we fall
 * back to appending `+` lines to the end.
 */
function applyMutation(currentPrompt: string, diff: string): string {
  const lines = currentPrompt.split("\n");
  const diffLines = diff.split("\n");
  const removals: string[] = [];
  const additions: string[] = [];
  for (const dl of diffLines) {
    if (dl.startsWith("- ")) removals.push(dl.slice(2));
    else if (dl.startsWith("-")) removals.push(dl.slice(1));
    else if (dl.startsWith("+ ")) additions.push(dl.slice(2));
    else if (dl.startsWith("+")) additions.push(dl.slice(1));
  }
  let insertAt = lines.length;
  const out = [...lines];
  for (const rm of removals) {
    const idx = out.findIndex((l) => l === rm);
    if (idx >= 0) {
      out.splice(idx, 1);
      insertAt = Math.min(insertAt, idx);
    }
  }
  out.splice(insertAt, 0, ...additions);
  return out.join("\n");
}

export async function iterateOnce(
  runId: string,
): Promise<{ mutationsKept: number; mutationsTried: number }> {
  const results = await readRunLog(runId);
  const total = results.length;
  if (total === 0) return { mutationsKept: 0, mutationsTried: 0 };

  const clusters = clusterFailures(results);
  // Skip clusters under 5% case fail-rate.
  const eligible: Array<[string, CaseResult[]]> = [];
  for (const [name, cases] of clusters) {
    if (cases.length / total >= 0.05) eligible.push([name, cases]);
  }
  if (eligible.length === 0) return { mutationsKept: 0, mutationsTried: 0 };

  // Pick the worst (highest fail count).
  eligible.sort((a, b) => b[1].length - a[1].length);
  const [worstName, worstCases] = eligible[0]!;
  console.log(`[iterate] worst cluster: ${worstName} (${worstCases.length} cases)`);

  const mutation = await proposeMutation(worstName, worstCases);
  if (!mutation) {
    console.log("[iterate] mutator returned null (API error or missing key)");
    return { mutationsKept: 0, mutationsTried: 0 };
  }
  console.log(`[iterate] mutation: ${mutation.description}`);

  const { readCurrentPrompt } = await import("./mutate-prompt");
  const currentPrompt = await readCurrentPrompt();
  const candidatePrompt = applyMutation(currentPrompt, mutation.diff);

  const result = await abTest({
    currentPromptPath: resolve(REPO_ROOT, "src/app/api/agent/route.ts"),
    candidatePrompt,
    failingCases: worstCases,
    originalRunId: runId,
    cluster: worstName,
    mutationDescription: mutation.description,
    diff: mutation.diff,
  });

  console.log(
    `[iterate] passAfter=${result.passAfter.toFixed(2)} kept=${result.kept} (${result.reason})`,
  );

  if (result.kept) {
    // Persist the candidate so a human can review/commit it.
    await mkdir(ITERATE_DIR, { recursive: true });
    await writeFile(resolve(ITERATE_DIR, ".candidate-prompt.txt"), candidatePrompt, "utf8");
  }
  return { mutationsKept: result.kept ? 1 : 0, mutationsTried: 1 };
}

// ── CLI entry ──────────────────────────────────────────────────────

function printHelp(): void {
  console.log(`Usage: bun run eval/iterate/ab-test.ts <runId>

Reads eval/results/<runId>/log.jsonl, clusters failures, asks Sonnet
for a SYSTEM_PROMPT mutation targeting the worst cluster, spawns a
candidate dev server on port ${CANDIDATE_PORT}, re-runs the failing
cases, and appends an entry to eval/iterate/experiment-log.jsonl.

Requires ANTHROPIC_API_KEY in the environment.`);
}

if (typeof require !== "undefined" && require.main === module) {
  const runId = process.argv[2];
  if (!runId) {
    printHelp();
    process.exit(0);
  }
  iterateOnce(runId)
    .then((r) => {
      console.log(`[iterate] done · tried=${r.mutationsTried} kept=${r.mutationsKept}`);
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(2);
    });
}
