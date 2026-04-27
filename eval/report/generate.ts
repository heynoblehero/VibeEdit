/**
 * Final-report generator for the VibeEdit eval harness.
 *
 * Reads `eval/results/<runId>/log.jsonl` (one CaseResult per line) and
 * optionally `eval/iterate/experiment-log.jsonl` (mutation history) and
 * emits a human-readable markdown report.
 *
 * Usage:
 *   bun run eval/report/generate.ts -- [--run-id <id>] [--out <path>] [--help]
 *
 * If `--run-id` is omitted, the most recent dir under `eval/results/` is used.
 */

import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { CaseResult, TestTier } from "../runner/case-types";

// ── Paths ──────────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const EVAL_ROOT = resolve(__dirname, "..");
const RESULTS_DIR = resolve(EVAL_ROOT, "results");
const EXPERIMENT_LOG = resolve(EVAL_ROOT, "iterate/experiment-log.jsonl");
const DEFAULT_OUT = resolve(EVAL_ROOT, "report/final.md");

// ── Types ──────────────────────────────────────────────────────────
interface ExperimentEntry {
  ts: string;
  version: string | number;
  cluster: string;
  mutationDescription: string;
  diff: string;
  casesRetested: number;
  passBefore: number;
  passAfter: number;
  kept: boolean;
  reason?: string;
}

interface RunSummary {
  runId?: string;
  seeds?: string;
  total?: number;
  pass?: number;
  byTier?: Record<string, { pass: number; total: number }>;
  byCategory?: Record<string, { pass: number; total: number }>;
  totalMs?: number;
}

interface CliArgs {
  runId?: string;
  out?: string;
  help: boolean;
}

// ── CLI ────────────────────────────────────────────────────────────
const HELP_TEXT = `vibeedit eval report generator

Usage:
  bun run eval/report/generate.ts -- [options]

Options:
  --run-id <id>    Specific run dir under eval/results/ (default: latest)
  --out <path>     Output markdown path (default: eval/report/final.md)
  --help           Show this help

Reads:
  eval/results/<runId>/log.jsonl       (required)
  eval/results/<runId>/summary.json    (optional)
  eval/iterate/experiment-log.jsonl    (optional)
`;

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { help: false };
  // Skip leading "--" separator if present (bun run passes through after `--`).
  const args = argv.filter((a) => a !== "--");
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--help" || a === "-h") out.help = true;
    else if (a === "--run-id" && args[i + 1]) out.runId = args[++i];
    else if (a === "--out" && args[i + 1]) out.out = args[++i];
  }
  return out;
}

function fail(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

// ── Filesystem helpers ─────────────────────────────────────────────
async function findLatestRunDir(): Promise<string | null> {
  if (!existsSync(RESULTS_DIR)) return null;
  let entries: string[];
  try {
    entries = await readdir(RESULTS_DIR);
  } catch {
    return null;
  }
  const dirs: Array<{ name: string; mtimeMs: number }> = [];
  for (const name of entries) {
    const p = resolve(RESULTS_DIR, name);
    try {
      const s = await stat(p);
      if (s.isDirectory()) dirs.push({ name, mtimeMs: s.mtimeMs });
    } catch {
      // skip
    }
  }
  if (dirs.length === 0) return null;
  dirs.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return dirs[0]!.name;
}

async function readJsonlSafe<T>(path: string): Promise<T[]> {
  const txt = await readFile(path, "utf8");
  const out: T[] = [];
  for (const line of txt.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as T);
    } catch (e) {
      console.warn(`warn: skipping malformed line in ${path}: ${(e as Error).message}`);
    }
  }
  return out;
}

async function readJsonOptional<T>(path: string): Promise<T | null> {
  try {
    const txt = await readFile(path, "utf8");
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}

// ── Formatting helpers ─────────────────────────────────────────────
function fmtInt(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}
function fmtPct(num: number, denom: number): string {
  if (denom === 0) return "0.0%";
  return `${((num / denom) * 100).toFixed(1)}%`;
}
function fmtMs(ms: number): string {
  if (!Number.isFinite(ms)) return "n/a";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  const rs = s - m * 60;
  if (m < 60) return `${m}m ${rs.toFixed(0)}s`;
  const h = Math.floor(m / 60);
  const rm = m - h * 60;
  return `${h}h ${rm}m`;
}
function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return "$0.00";
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}
function fmtDelta(d: number): string {
  const sign = d > 0 ? "+" : d < 0 ? "" : "±";
  return `${sign}${d.toFixed(1)} pp`;
}

/** Escape any literal triple-backtick fences inside a code block by
 *  replacing them with a zero-width-joined variant. */
function escapeForFence(s: string): string {
  return s.replace(/```/g, "``​`");
}

/** Escape a value for safe inclusion in a markdown table cell. */
function tableCell(s: string): string {
  return s.replace(/\|/g, "\\|").replace(/\n/g, " ").replace(/\r/g, "");
}

// ── Section builders ───────────────────────────────────────────────
function buildHeader(
  runId: string,
  results: CaseResult[],
  summary: RunSummary | null,
  ts: string,
): string {
  const total = results.length;
  const pass = results.filter((r) => r.pass).length;
  const totalCost = results.reduce((acc, r) => acc + (r.costUsd ?? 0), 0);
  const wallMs = summary?.totalMs ?? results.reduce((acc, r) => acc + (r.durationMs ?? 0), 0);
  const lines: string[] = [];
  lines.push(`# VibeEdit Eval Report`);
  lines.push("");
  lines.push(`- **Run ID:** \`${runId}\``);
  lines.push(`- **Generated:** ${ts}`);
  lines.push(`- **Total cases:** ${fmtInt(total)}`);
  lines.push(`- **Wall clock:** ${fmtMs(wallMs)}`);
  lines.push(`- **Total cost:** ${fmtUsd(totalCost)}`);
  lines.push("");
  lines.push(`**Pass rate: ${fmtPct(pass, total)} (${fmtInt(pass)} / ${fmtInt(total)})**`);
  lines.push("");
  return lines.join("\n");
}

function buildPerTierTable(results: CaseResult[]): string {
  // Group by tier; pick the most-frequent category per tier as the label.
  const byTier = new Map<TestTier, { total: number; pass: number; cats: Map<string, number> }>();
  for (const r of results) {
    const t = r.tier;
    let bucket = byTier.get(t);
    if (!bucket) {
      bucket = { total: 0, pass: 0, cats: new Map() };
      byTier.set(t, bucket);
    }
    bucket.total++;
    if (r.pass) bucket.pass++;
    bucket.cats.set(r.category, (bucket.cats.get(r.category) ?? 0) + 1);
  }
  const sorted = [...byTier.entries()].sort((a, b) => a[0] - b[0]);
  const lines: string[] = [];
  lines.push(`## Per-tier pass rates`);
  lines.push("");
  if (sorted.length === 0) {
    lines.push("_No tier data._");
    lines.push("");
    return lines.join("\n");
  }
  lines.push(`| Tier | Category | Total | Passed | Pass % |`);
  lines.push(`| ---- | -------- | ----- | ------ | ------ |`);
  for (const [tier, b] of sorted) {
    const cat = [...b.cats.entries()].sort((a, c) => c[1] - a[1])[0]?.[0] ?? "—";
    lines.push(
      `| ${tier} | ${tableCell(cat)} | ${fmtInt(b.total)} | ${fmtInt(b.pass)} | ${fmtPct(b.pass, b.total)} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}

function buildFailureHeatmap(results: CaseResult[]): string {
  const kindCounts = new Map<string, { count: number; byTier: Map<TestTier, number> }>();
  for (const r of results) {
    for (const f of r.failures) {
      let bucket = kindCounts.get(f.kind);
      if (!bucket) {
        bucket = { count: 0, byTier: new Map() };
        kindCounts.set(f.kind, bucket);
      }
      bucket.count++;
      bucket.byTier.set(r.tier, (bucket.byTier.get(r.tier) ?? 0) + 1);
    }
  }
  const top = [...kindCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);
  const lines: string[] = [];
  lines.push(`## Failure heatmap by category`);
  lines.push("");
  if (top.length === 0) {
    lines.push("_No failures recorded._");
    lines.push("");
    return lines.join("\n");
  }
  lines.push(`| Failure kind | Count | Hardest-hit tier |`);
  lines.push(`| ------------ | ----- | ---------------- |`);
  for (const [kind, b] of top) {
    const worst = [...b.byTier.entries()].sort((a, c) => c[1] - a[1])[0];
    const tierLabel = worst ? `tier ${worst[0]} (${fmtInt(worst[1])})` : "—";
    lines.push(`| ${tableCell(kind)} | ${fmtInt(b.count)} | ${tableCell(tierLabel)} |`);
  }
  lines.push("");
  return lines.join("\n");
}

function buildIterationProgression(entries: ExperimentEntry[]): string {
  const lines: string[] = [];
  lines.push(`## Iteration progression`);
  lines.push("");
  if (entries.length === 0) {
    lines.push("_No mutations recorded._");
    lines.push("");
    return lines.join("\n");
  }
  lines.push(
    `| Version | Cluster | Kept | Pass before | Pass after | Δ | Description |`,
  );
  lines.push(
    `| ------- | ------- | ---- | ----------- | ---------- | -- | ----------- |`,
  );
  let kept = 0;
  let upliftSum = 0;
  for (const e of entries) {
    const before = e.casesRetested > 0 ? (e.passBefore / e.casesRetested) * 100 : 0;
    const after = e.casesRetested > 0 ? (e.passAfter / e.casesRetested) * 100 : 0;
    const delta = after - before;
    if (e.kept) {
      kept++;
      upliftSum += delta;
    }
    lines.push(
      `| ${tableCell(String(e.version))} | ${tableCell(e.cluster)} | ${e.kept ? "✓" : "✗"} | ${before.toFixed(1)}% | ${after.toFixed(1)}% | ${fmtDelta(delta)} | ${tableCell(e.mutationDescription)} |`,
    );
  }
  const meanUplift = kept > 0 ? upliftSum / kept : 0;
  lines.push("");
  lines.push(
    `${fmtInt(entries.length)} mutations tried, ${fmtInt(kept)} kept, mean pass-rate uplift on kept: ${fmtDelta(meanUplift)}`,
  );
  lines.push("");
  return lines.join("\n");
}

function buildTopMutations(entries: ExperimentEntry[]): string {
  const lines: string[] = [];
  lines.push(`## Top 10 kept mutations`);
  lines.push("");
  const kept = entries
    .filter((e) => e.kept)
    .map((e) => {
      const before = e.casesRetested > 0 ? (e.passBefore / e.casesRetested) * 100 : 0;
      const after = e.casesRetested > 0 ? (e.passAfter / e.casesRetested) * 100 : 0;
      return { e, delta: after - before };
    })
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 10);
  if (kept.length === 0) {
    lines.push("_No kept mutations._");
    lines.push("");
    return lines.join("\n");
  }
  for (let i = 0; i < kept.length; i++) {
    const k = kept[i]!;
    lines.push(
      `### ${i + 1}. ${k.e.mutationDescription} (${fmtDelta(k.delta)}, cluster: \`${k.e.cluster}\`, v${k.e.version})`,
    );
    lines.push("");
    lines.push("```diff");
    lines.push(escapeForFence(k.e.diff ?? ""));
    lines.push("```");
    lines.push("");
  }
  return lines.join("\n");
}

/** Deterministic Mulberry32 PRNG so the report is stable across regenerations. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleN<T>(arr: T[], n: number, rng: () => number): T[] {
  if (arr.length <= n) return [...arr];
  const indices = arr.map((_, i) => i);
  // Fisher-Yates partial shuffle.
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rng() * (indices.length - i));
    [indices[i], indices[j]] = [indices[j]!, indices[i]!];
  }
  return indices.slice(0, n).map((i) => arr[i]!);
}

function buildNotableFailures(results: CaseResult[], userMessageById: Map<string, string>): string {
  const lines: string[] = [];
  lines.push(`## Notable failed cases`);
  lines.push("");
  lines.push(`Up to 5 randomly-sampled FAILED cases per tier (deterministic seed).`);
  lines.push("");
  const byTier = new Map<TestTier, CaseResult[]>();
  for (const r of results) {
    if (r.pass) continue;
    let arr = byTier.get(r.tier);
    if (!arr) {
      arr = [];
      byTier.set(r.tier, arr);
    }
    arr.push(r);
  }
  const tiers = [...byTier.keys()].sort((a, b) => a - b);
  if (tiers.length === 0) {
    lines.push("_No failures across any tier — nothing to show._");
    lines.push("");
    return lines.join("\n");
  }
  for (const tier of tiers) {
    const failed = byTier.get(tier)!;
    const rng = mulberry32(0xc0ffee + tier);
    const sample = sampleN(failed, 5, rng);
    lines.push(`### Tier ${tier} (${fmtInt(failed.length)} failures total, showing ${sample.length})`);
    lines.push("");
    for (const r of sample) {
      lines.push(`#### \`${r.caseId}\` — ${r.category}`);
      lines.push("");
      const userMsg = userMessageById.get(r.caseId);
      if (userMsg) {
        lines.push(`**User message:**`);
        lines.push("");
        lines.push("```");
        lines.push(escapeForFence(userMsg));
        lines.push("```");
        lines.push("");
      }
      if (r.agentError) {
        lines.push(`**Agent error:** \`${tableCell(r.agentError)}\``);
        lines.push("");
      }
      lines.push(`**Failures (${r.failures.length}):**`);
      lines.push("");
      for (const f of r.failures) {
        lines.push(`- **${f.kind}**`);
        lines.push("  ```");
        for (const ln of escapeForFence(f.detail).split("\n")) {
          lines.push(`  ${ln}`);
        }
        lines.push("  ```");
      }
      lines.push("");
      const trace = r.toolTrace.slice(0, 5);
      lines.push(`**First ${trace.length} tool call(s):**`);
      lines.push("");
      if (trace.length === 0) {
        lines.push("_(no tool calls)_");
      } else {
        lines.push("```json");
        lines.push(escapeForFence(JSON.stringify(trace, null, 2)));
        lines.push("```");
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

function buildCostAndTime(
  results: CaseResult[],
  summary: RunSummary | null,
  experiment: ExperimentEntry[] | null,
): string {
  const totalCost = results.reduce((acc, r) => acc + (r.costUsd ?? 0), 0);
  const baselineWallMs = summary?.totalMs ?? results.reduce((acc, r) => acc + (r.durationMs ?? 0), 0);
  const totalCases = results.length;
  const avgPerCaseMs = totalCases > 0 ? baselineWallMs / totalCases : 0;
  const avgPerCaseUsd = totalCases > 0 ? totalCost / totalCases : 0;

  const lines: string[] = [];
  lines.push(`## Cost & time totals`);
  lines.push("");
  lines.push(`- **Total Anthropic API spend:** ${fmtUsd(totalCost)}`);
  lines.push(`- **Baseline run wall clock:** ${fmtMs(baselineWallMs)}`);
  lines.push(`- **Avg per-case wall clock:** ${fmtMs(avgPerCaseMs)}`);
  lines.push(`- **Avg per-case cost:** ${fmtUsd(avgPerCaseUsd)}`);

  if (experiment && experiment.length > 0) {
    const totalRetested = experiment.reduce((acc, e) => acc + (e.casesRetested ?? 0), 0);
    const iterMs = totalRetested * avgPerCaseMs;
    const iterCost = totalRetested * avgPerCaseUsd;
    const meanRetestPerMutation = totalRetested / experiment.length;
    const perIterCost = meanRetestPerMutation * avgPerCaseUsd;
    lines.push(`- **Iteration loop wall clock (estimated):** ${fmtMs(iterMs)} across ${fmtInt(totalRetested)} re-tested case-runs`);
    lines.push(`- **Iteration loop cost (estimated):** ${fmtUsd(iterCost)}`);
    lines.push(`- **Estimated cost per future iteration:** ${fmtUsd(perIterCost)} (≈ ${fmtInt(meanRetestPerMutation)} cases × ${fmtUsd(avgPerCaseUsd)}/case)`);
  } else {
    lines.push(`- **Iteration loop:** _no experiment-log.jsonl present_`);
    lines.push(`- **Estimated per-iteration cost going forward:** unknown until first iteration runs`);
  }
  lines.push("");
  return lines.join("\n");
}

// ── userMessage lookup (optional) ──────────────────────────────────
/**
 * Best-effort: if any seed file is loadable as a plain dynamic import we
 * grab its userMessages keyed by case id. Failure is silent — the report
 * just omits user messages in that case.
 */
async function loadUserMessages(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const seedsDir = resolve(EVAL_ROOT, "cases/seeds");
  if (!existsSync(seedsDir)) return out;
  let names: string[];
  try {
    names = await readdir(seedsDir);
  } catch {
    return out;
  }
  for (const name of names) {
    if (!name.endsWith(".ts")) continue;
    const p = resolve(seedsDir, name);
    try {
      const mod = (await import(p)) as {
        default?: Array<{ id: string; userMessage: string }>;
        cases?: Array<{ id: string; userMessage: string }>;
      };
      const cases = mod.cases ?? mod.default ?? [];
      for (const c of cases) {
        if (c && typeof c.id === "string" && typeof c.userMessage === "string") {
          out.set(c.id, c.userMessage);
        }
      }
    } catch {
      // skip seed files that aren't loadable in isolation
    }
  }
  return out;
}

// ── Main ───────────────────────────────────────────────────────────
export async function generateReport(args: CliArgs): Promise<string> {
  if (!existsSync(RESULTS_DIR)) {
    fail(
      `no results directory at ${RESULTS_DIR}. Run the harness first (\`bun run eval:run\`).`,
    );
  }

  let runId = args.runId;
  if (!runId) {
    const latest = await findLatestRunDir();
    if (!latest) {
      console.error(HELP_TEXT);
      console.error("\nerror: no run dirs found under eval/results/.");
      process.exit(1);
    }
    runId = latest;
  }

  const runDir = resolve(RESULTS_DIR, runId);
  if (!existsSync(runDir)) {
    fail(`run dir not found: ${runDir}`);
  }
  const logPath = resolve(runDir, "log.jsonl");
  if (!existsSync(logPath)) {
    fail(`log.jsonl missing in ${runDir}`);
  }

  const results = await readJsonlSafe<CaseResult>(logPath);
  if (results.length === 0) {
    fail(`no CaseResult rows in ${logPath}`);
  }

  const summary = await readJsonOptional<RunSummary>(resolve(runDir, "summary.json"));

  let experiment: ExperimentEntry[] | null = null;
  if (existsSync(EXPERIMENT_LOG)) {
    experiment = await readJsonlSafe<ExperimentEntry>(EXPERIMENT_LOG);
  }

  const userMessages = await loadUserMessages();
  const ts = new Date().toISOString();

  const sections: string[] = [];
  sections.push(buildHeader(runId, results, summary, ts));
  sections.push(buildPerTierTable(results));
  sections.push(buildFailureHeatmap(results));
  if (experiment) {
    sections.push(buildIterationProgression(experiment));
    sections.push(buildTopMutations(experiment));
  }
  sections.push(buildNotableFailures(results, userMessages));
  sections.push(buildCostAndTime(results, summary, experiment));

  const md = sections.join("\n");
  const outPath = args.out ? resolve(args.out) : DEFAULT_OUT;
  await writeFile(outPath, md, "utf8");
  console.log(`[report] wrote ${outPath} (${md.length} bytes, ${results.length} cases)`);
  return outPath;
}

// ── Entry ──────────────────────────────────────────────────────────
const isMain = (() => {
  try {
    return process.argv[1] && resolve(process.argv[1]) === __filename;
  } catch {
    return false;
  }
})();

if (isMain) {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }
  generateReport(args).catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`error: ${msg}`);
    process.exit(1);
  });
}
