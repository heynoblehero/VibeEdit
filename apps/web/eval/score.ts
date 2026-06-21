/**
 * Deterministic composition scorer for the eval harness.
 *
 * Pure: takes the produced index.html (+ a few facts the runner gathers) and
 * returns per-check pass/fail, a 0-100 score, and a single `postable` verdict.
 * No DB, no network, no model — so it can be unit-tested in isolation and the
 * "% postable" number it feeds is reproducible.
 *
 * The checks encode the failure modes we actually shipped to users this cycle:
 * silent audio, blank/slideshow output, raw /stock/ refs that 404, broken
 * asset paths, and un-playable compositions (no duration / no timeline).
 */

export interface CheckResult {
  name: string;
  pass: boolean;
  critical: boolean;
  detail: string;
}

export interface CompositionScore {
  checks: CheckResult[];
  score: number; // 0-100, weighted — for ranking
  postable: boolean; // the headline verdict
  failedCritical: string[];
}

export interface ScoreInput {
  html: string;
  /** This brief is expected to have narration → audio + captions matter. */
  needsAudio?: boolean;
  /** Returns true if a project-relative path (e.g. "assets/x.mp3") exists on disk. */
  assetExists?: (relPath: string) => boolean;
  /** The agent run surfaced a tool error (from the runner's event stream). */
  hadToolError?: boolean;
}

const ASSET_REF_RE = /(?:src|href)\s*=\s*["'](assets\/[^"']+)["']|url\(\s*["']?(assets\/[^"')]+)/gi;

function collectAssetRefs(html: string): string[] {
  const refs = new Set<string>();
  let m: RegExpExecArray | null;
  ASSET_REF_RE.lastIndex = 0;
  while ((m = ASSET_REF_RE.exec(html)) !== null) {
    const ref = (m[1] || m[2] || "").split(/[?#]/)[0];
    if (ref) refs.add(ref);
  }
  return [...refs];
}

function countMedia(html: string): number {
  const imgs = (html.match(/<img\b/gi) || []).length;
  const videos = (html.match(/<video\b/gi) || []).length;
  const bgUrls = (html.match(/url\(\s*["']?(?:assets\/|https?:)/gi) || []).length;
  return imgs + videos + bgUrls;
}

export function scoreComposition(input: ScoreInput): CompositionScore {
  const { html, needsAudio = false, assetExists, hadToolError = false } = input;
  const checks: CheckResult[] = [];
  const add = (name: string, pass: boolean, critical: boolean, detail: string) =>
    checks.push({ name, pass, critical, detail });

  // 1. Built at all.
  const built = html.length > 800 && /<body[\s>]/i.test(html);
  add("built", built, true, built ? `${html.length} bytes` : "no/empty index.html");

  // 2. Playable — has a total duration the player can read.
  const hasDuration = /data-duration\s*=/.test(html);
  add(
    "playable_duration",
    hasDuration,
    true,
    hasDuration ? "data-duration present" : "missing data-duration",
  );

  // 3. Has a motion driver (GSAP / runtime timeline) — otherwise it's a frozen frame.
  const hasTimeline = /\bgsap\b|__hf\b|__timelines\b|\.timeline\(/i.test(html);
  add(
    "has_timeline",
    hasTimeline,
    false,
    hasTimeline ? "timeline/gsap found" : "no animation driver",
  );

  // 4. Media-rich, not a text slideshow (the core quality lever).
  const mediaCount = countMedia(html);
  add("media_rich", mediaCount >= 2, false, `${mediaCount} media element(s)`);

  // 5. No raw /stock/ refs (these 404 — the silent-audio bug).
  const rawStock = /["'(]\/stock\//.test(html);
  add("no_raw_stock", !rawStock, true, rawStock ? "references raw /stock/ path" : "clean");

  // 6. Every assets/ reference resolves on disk.
  const refs = collectAssetRefs(html);
  if (assetExists && refs.length) {
    const broken = refs.filter((r) => !assetExists(r));
    add(
      "assets_resolve",
      broken.length === 0,
      true,
      broken.length ? `broken: ${broken.slice(0, 4).join(", ")}` : `${refs.length} ok`,
    );
  } else {
    add("assets_resolve", true, true, refs.length ? "not checked" : "no asset refs");
  }

  // 7. Audio present (critical only when narration was expected).
  const audioPresent = /<audio\b[^>]*\bsrc\s*=/i.test(html);
  add(
    "audio_present",
    needsAudio ? audioPresent : true,
    needsAudio,
    audioPresent ? "has <audio>" : needsAudio ? "MISSING narration audio" : "n/a",
  );

  // 8. Captions when there's narration (soft).
  const captions = /caption|word-?highlight|data-(?:word|cap)/i.test(html);
  add(
    "captions",
    needsAudio ? captions : true,
    false,
    needsAudio ? (captions ? "captions found" : "no captions") : "n/a",
  );

  // 9. The agent run didn't error out.
  add(
    "no_tool_error",
    !hadToolError,
    false,
    hadToolError ? "a tool errored during the run" : "clean run",
  );

  // Weighted score (informational, for ranking which briefs are weakest).
  const weights: Record<string, number> = {
    built: 20,
    playable_duration: 15,
    has_timeline: 10,
    media_rich: 20,
    no_raw_stock: 10,
    assets_resolve: 10,
    audio_present: 8,
    captions: 4,
    no_tool_error: 3,
  };
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const earned = checks.reduce((sum, c) => sum + (c.pass ? (weights[c.name] ?? 0) : 0), 0);
  const score = Math.round((100 * earned) / total);

  const failedCritical = checks.filter((c) => c.critical && !c.pass).map((c) => c.name);
  // Postable = no critical failure AND it's actually a video (media-rich + score bar).
  const postable = failedCritical.length === 0 && mediaCount >= 2 && score >= 75;

  return { checks, score, postable, failedCritical };
}
