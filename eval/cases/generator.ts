/**
 * Generator — expands hand-written seeds into ~250 paraphrased variants
 * each via Sonnet. The variant preserves the seed's expected behaviour
 * (assertions stay identical) while changing topic, scene labels,
 * and phrasing so the harness covers a wide intent surface.
 *
 * Output: eval/cases/generated/<seed-id>.jsonl — one JSON-encoded
 * TestCase per line. Loaded by run.ts via `--seeds generated/<file>`.
 *
 * Usage:
 *   bun run eval/cases/generator.ts -- --tier 1 [--variants 250] [--concurrency 5]
 *
 * Cost: each variant call ≈ $0.005 (Sonnet, ~600 input + ~400 output
 * tokens, no caching since each seed is different). 25k variants ≈
 * $125 in generation cost — one-shot, then re-used across iterations.
 */

import { readdir, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { TestCase } from "../runner/case-types";

const ROOT = resolve(__dirname, "..");
const SEEDS_DIR = resolve(ROOT, "cases/seeds");
const GENERATED_DIR = resolve(ROOT, "cases/generated");

interface GenOptions {
  tier?: number;
  variants?: number;
  concurrency?: number;
}

interface VariantPlan {
  /** New userMessage. */
  userMessage: string;
  /** Optional new project topic to inject as a label suffix. */
  topicSuffix?: string;
}

const SYSTEM = `You paraphrase ONE user prompt into N realistic variants for a video-editor agent eval harness.

The original prompt has known expected behaviour (asserted programmatically). Your variants must preserve that intent EXACTLY — same target scene index, same operation type, same forbidden tools — but vary:
  · phrasing (formal / casual / short / long / typo'd)
  · topic context (different video subjects)
  · explicit vs implicit ("scene 3" vs "the third one" vs "the tip about cuts")

Never change WHICH scene is targeted. Never change the operation (rearrange stays rearrange, single-edit stays single-edit). Never sneak in a second request.

Output JSON only — an array of {userMessage, topicSuffix?} objects.`;

async function callSonnet(
  prompt: string,
  apiKey: string,
): Promise<VariantPlan[]> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      system: SYSTEM,
      tools: [
        {
          name: "emit_variants",
          description: "Submit the paraphrased variants.",
          input_schema: {
            type: "object",
            properties: {
              variants: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    userMessage: { type: "string" },
                    topicSuffix: { type: "string" },
                  },
                  required: ["userMessage"],
                },
              },
            },
            required: ["variants"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "emit_variants" },
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Generator API error ${res.status}`);
  const data = (await res.json()) as {
    content?: Array<{ type: string; name?: string; input?: { variants?: VariantPlan[] } }>;
  };
  const tool = (data.content ?? []).find((b) => b.type === "tool_use" && b.name === "emit_variants");
  return tool?.input?.variants ?? [];
}

async function generateForSeed(
  seed: TestCase,
  count: number,
  apiKey: string,
): Promise<TestCase[]> {
  // Sonnet can do ~25 variants per call comfortably; batch.
  const BATCH = 25;
  const out: TestCase[] = [];
  for (let i = 0; i < count; i += BATCH) {
    const n = Math.min(BATCH, count - i);
    const prompt = `Generate ${n} variants of this prompt:

ORIGINAL PROMPT: ${JSON.stringify(seed.userMessage)}
TIER: ${seed.tier} (${seed.category})
DESCRIPTION: ${seed.description}

Important: variants must be DIFFERENT user phrasings of the SAME ask. Don't change the target scene number, the operation, or the forbidden behaviours.`;
    try {
      const plans = await callSonnet(prompt, apiKey);
      for (let j = 0; j < plans.length; j++) {
        const v = plans[j]!;
        const variant: TestCase = JSON.parse(JSON.stringify(seed));
        variant.id = `${seed.id}-v${i + j + 1}`;
        variant.userMessage = v.userMessage;
        if (v.topicSuffix) {
          variant.description = `${seed.description} [variant: ${v.topicSuffix}]`;
        }
        out.push(variant);
      }
    } catch (e) {
      console.error(`[gen] seed ${seed.id} batch ${i / BATCH}: ${e instanceof Error ? e.message : e}`);
    }
  }
  return out;
}

async function loadSeedFiles(tier?: number): Promise<Array<{ name: string; cases: TestCase[] }>> {
  const all = await readdir(SEEDS_DIR);
  const tsFiles = all.filter((f) => f.endsWith(".ts") && !f.startsWith("_"));
  const out: Array<{ name: string; cases: TestCase[] }> = [];
  for (const file of tsFiles) {
    if (tier && !file.startsWith(`tier${tier}-`)) continue;
    const mod = (await import(resolve(SEEDS_DIR, file))) as {
      cases?: TestCase[];
      default?: TestCase[];
    };
    const cases = mod.cases ?? mod.default ?? [];
    if (cases.length > 0) out.push({ name: file.replace(/\.ts$/, ""), cases });
  }
  return out;
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

export async function generate(opts: GenOptions = {}): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY required for generator (uses Sonnet to paraphrase)");
  }
  const variants = opts.variants ?? 250;
  const concurrency = opts.concurrency ?? 5;
  await mkdir(GENERATED_DIR, { recursive: true });
  const seedFiles = await loadSeedFiles(opts.tier);

  for (const sf of seedFiles) {
    console.log(`[gen] ${sf.name} · ${sf.cases.length} seeds × ${variants} variants`);
    const generatedAll: TestCase[] = [];
    const batches = await pool(sf.cases, concurrency, async (seed) => {
      const variants_ = await generateForSeed(seed, variants, apiKey);
      console.log(`[gen]   ${seed.id} → ${variants_.length} variants`);
      return variants_;
    });
    for (const batch of batches) generatedAll.push(...batch);
    const outPath = resolve(GENERATED_DIR, `${sf.name}.jsonl`);
    await writeFile(
      outPath,
      generatedAll.map((c) => JSON.stringify(c)).join("\n") + "\n",
      "utf8",
    );
    console.log(`[gen] wrote ${generatedAll.length} variants → ${outPath}`);
  }
}

function parseArgs(): GenOptions {
  const args = process.argv.slice(2);
  const opts: GenOptions = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tier" && args[i + 1]) opts.tier = Number(args[++i]);
    else if (args[i] === "--variants" && args[i + 1]) opts.variants = Number(args[++i]);
    else if (args[i] === "--concurrency" && args[i + 1]) opts.concurrency = Number(args[++i]);
  }
  return opts;
}

if (typeof require !== "undefined" && require.main === module) {
  generate(parseArgs())
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
