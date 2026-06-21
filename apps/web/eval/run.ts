/**
 * Eval harness — runs representative briefs through the REAL generation
 * pipeline and reports a single number: % of generations that produce a
 * postable video.
 *
 * It drives the same `runAgent` the chat route uses (same system prompt, tools,
 * model), in two turns (brief → plan, then "approve" → build, mirroring the
 * approval gate), then scores the produced index.html deterministically.
 *
 * Run on a host with the agent env set (ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL,
 * STORAGE_ROOT, and optionally OPENAI/ELEVENLABS/REPLICATE keys for narrated
 * briefs). It is NOT a unit test — it spends real model tokens.
 *
 *   bun eval/run.ts                      # all briefs
 *   bun eval/run.ts --briefs=apple-evil  # subset
 *   bun eval/run.ts --concurrency=1 --keep
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { runAgent, type AgentEvent } from "@/lib/ai/agent";
import { ensureProjectDir, projectDir, readProjectText } from "@/lib/storage/fs";
import { BRIEFS, type Brief } from "./briefs";
import { scoreComposition, type CompositionScore } from "./score";

const EVAL_USER = "eval-harness";

function parseArgs() {
  const args = process.argv.slice(2);
  const get = (k: string) => args.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
  return {
    briefIds: get("briefs")
      ?.split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    concurrency: Math.max(1, Number(get("concurrency")) || 2),
    keep: args.includes("--keep"),
  };
}

function envApiKeys(): Record<string, string> {
  const keys: Record<string, string> = {};
  if (process.env.OPENAI_API_KEY) keys.openai = process.env.OPENAI_API_KEY;
  if (process.env.ELEVENLABS_API_KEY) keys.elevenlabs = process.env.ELEVENLABS_API_KEY;
  const rep = process.env.REPLICATE_API_TOKEN || process.env.REPLICATE_API_KEY;
  if (rep) keys.replicate = rep;
  return keys;
}

interface BriefRun {
  brief: Brief;
  projectId: string;
  score: CompositionScore;
  turns: number;
  hadToolError: boolean;
  errorNote?: string;
}

async function runOneTurn(
  userMessage: string,
  priorHistory: string | undefined,
  ctx: Parameters<typeof runAgent>[0]["ctx"],
): Promise<{ text: string; hadToolError: boolean }> {
  let text = "";
  let hadToolError = false;
  const onEvent = (e: AgentEvent) => {
    if (e.type === "text") text += e.text;
    else if (e.type === "tool_result" && /^ERROR:/m.test(e.result)) hadToolError = true;
    else if (e.type === "error") hadToolError = true;
  };
  await runAgent({ userMessage, priorHistory, ctx, onEvent });
  return { text, hadToolError };
}

async function runBrief(brief: Brief, keep: boolean): Promise<BriefRun> {
  const projectId = `eval-${brief.id}-${Date.now().toString(36)}`;
  ensureProjectDir(EVAL_USER, projectId);
  const dir = projectDir(EVAL_USER, projectId);
  const ctx = {
    userId: EVAL_USER,
    projectId,
    platform: undefined,
    aspectRatio: brief.format,
    apiKeys: envApiKeys(),
    enqueueRender: async () => "eval-noop",
  };

  let hadToolError = false;
  let errorNote: string | undefined;
  try {
    // Turn 1 — brief → plan (agent stops at the approval gate).
    const t1 = await runOneTurn(brief.prompt, undefined, ctx);
    hadToolError = t1.hadToolError;
    // Turn 2 — approve → build.
    const priorHistory = `User: ${brief.prompt}\nAssistant: ${t1.text}`;
    const t2 = await runOneTurn(
      "Approve the plan — build the full composition now.",
      priorHistory,
      ctx,
    );
    hadToolError = hadToolError || t2.hadToolError;
  } catch (err) {
    errorNote = (err as Error).message;
  }

  let html = "";
  try {
    html = readProjectText(EVAL_USER, projectId, "index.html");
  } catch {
    /* no composition produced */
  }

  const score = scoreComposition({
    html,
    needsAudio: brief.needsAudio,
    assetExists: (rel) => existsSync(join(dir, rel)),
    hadToolError,
  });

  if (!keep) {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }

  return { brief, projectId, score, turns: 2, hadToolError, errorNote };
}

async function pool<T>(
  items: T[],
  n: number,
  fn: (item: T) => Promise<BriefRun>,
): Promise<BriefRun[]> {
  const out: BriefRun[] = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++];
      out.push(await fn(item));
    }
  });
  await Promise.all(workers);
  return out;
}

async function main() {
  const { briefIds, concurrency, keep } = parseArgs();
  const set = briefIds ? BRIEFS.filter((b) => briefIds.includes(b.id)) : BRIEFS;
  if (set.length === 0) {
    console.error("No matching briefs.");
    process.exit(1);
  }

  console.log(`\n▶ Eval: ${set.length} brief(s), concurrency ${concurrency}\n`);
  const started = Date.now();
  const results = await pool(set, concurrency, (b) => {
    console.log(`  … running ${b.id}`);
    return runBrief(b, keep);
  });
  results.sort((a, b) => a.brief.id.localeCompare(b.brief.id));

  const postable = results.filter((r) => r.score.postable).length;
  const pct = Math.round((100 * postable) / results.length);

  console.log(`\n${"─".repeat(60)}`);
  for (const r of results) {
    const mark = r.score.postable ? "✓" : "✗";
    const fails = r.score.failedCritical.length
      ? ` [crit: ${r.score.failedCritical.join(", ")}]`
      : "";
    const note = r.errorNote ? ` (run error: ${r.errorNote})` : "";
    console.log(
      `  ${mark} ${r.brief.id.padEnd(16)} score ${String(r.score.score).padStart(3)}/100${fails}${note}`,
    );
  }
  console.log(`${"─".repeat(60)}`);
  console.log(
    `  POSTABLE: ${postable}/${results.length}  (${pct}%)   ·   ${((Date.now() - started) / 1000).toFixed(0)}s\n`,
  );

  const report = {
    timestamp: new Date().toISOString(),
    postablePct: pct,
    postable,
    total: results.length,
    results: results.map((r) => ({
      id: r.brief.id,
      postable: r.score.postable,
      score: r.score.score,
      failedCritical: r.score.failedCritical,
      checks: r.score.checks,
      errorNote: r.errorNote,
    })),
  };
  const outDir = fileURLToPath(new URL("./reports", import.meta.url));
  mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  writeFileSync(join(outDir, `${stamp}.json`), JSON.stringify(report, null, 2));
  writeFileSync(join(outDir, "latest.json"), JSON.stringify(report, null, 2));
  console.log(`  Report → eval/reports/${stamp}.json (and latest.json)\n`);

  // Non-zero exit if the postable rate regresses below the bar — for CI gating.
  const BAR = Number(process.env.EVAL_POSTABLE_BAR) || 0;
  if (pct < BAR) {
    console.error(`✗ Postable rate ${pct}% is below the bar (${BAR}%).`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
