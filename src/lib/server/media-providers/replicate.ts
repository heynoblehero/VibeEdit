/**
 * Replicate.com adapter. Polls the prediction endpoint until done and
 * returns the output URL(s). One env var: REPLICATE_API_TOKEN.
 */

import { applyStoredKeys } from "../runtime-keys";

interface Prediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[] | { url?: string };
  error?: string | null;
  urls?: { get?: string };
}

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000;

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  applyStoredKeys();
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN not set");
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "vibeedit-studio/0.1 (+https://vibevideoedit.com)",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Replicate ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

/**
 * Run a Replicate model and return its output. Uses the "official model"
 * endpoint (no version pinning needed) for slugs without a `:` colon.
 * Slugs with `owner/model:version` use the legacy /v1/predictions endpoint.
 */
export async function replicatePredict(
  slug: string,
  input: Record<string, unknown>,
): Promise<{ output: string | string[]; predictionId: string }> {
  const hasVersion = slug.includes(":");
  const start: Prediction = (hasVersion
    ? await fetchJson("https://api.replicate.com/v1/predictions", {
        method: "POST",
        body: JSON.stringify({ version: slug.split(":")[1], input }),
      })
    : await fetchJson(
        `https://api.replicate.com/v1/models/${slug}/predictions`,
        { method: "POST", body: JSON.stringify({ input }) },
      )) as Prediction;

  if (!start.urls?.get) throw new Error("Replicate: no poll URL");
  const startedAt = Date.now();
  let pred: Prediction = start;
  while (pred.status !== "succeeded" && pred.status !== "failed" && pred.status !== "canceled") {
    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      throw new Error("Replicate prediction timed out after 5 min");
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    pred = (await fetchJson(start.urls.get)) as Prediction;
  }
  if (pred.status !== "succeeded") {
    throw new Error(pred.error ?? `Replicate prediction ${pred.status}`);
  }
  let output: string | string[];
  if (typeof pred.output === "string") {
    output = pred.output;
  } else if (Array.isArray(pred.output)) {
    output = pred.output;
  } else if (pred.output && typeof pred.output === "object" && "url" in pred.output) {
    output = String((pred.output as { url: string }).url);
  } else {
    throw new Error("Replicate returned no output URL");
  }
  return { output, predictionId: pred.id };
}
