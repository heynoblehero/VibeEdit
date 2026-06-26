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
  /**
   * Which pipeline produced this output.
   *  - "build" (default): a generated composition (GSAP/runtime timeline).
   *  - "edit": an EDL-rendered footage edit wrapped in a single-clip index.html
   *    that references the processed output mp4. Edit-mode toggles a set of
   *    additive checks; build-mode scores exactly as it did before this field
   *    existed.
   */
  mode?: "build" | "edit";
  /** This brief is expected to have narration → audio + captions matter. */
  needsAudio?: boolean;
  /** Returns true if a project-relative path (e.g. "assets/x.mp3") exists on disk. */
  assetExists?: (relPath: string) => boolean;
  /** The agent run surfaced a tool error (from the runner's event stream). */
  hadToolError?: boolean;
}

/**
 * Extract <video> source paths from the html (the src attr on <video> itself,
 * or on nested <source> elements). Used by edit-mode playback wiring checks.
 */
const VIDEO_SRC_RE =
  /<video\b[^>]*\bsrc\s*=\s*["']([^"']+)["']|<source\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;

function collectVideoSrcs(html: string): string[] {
  const srcs = new Set<string>();
  let m: RegExpExecArray | null;
  VIDEO_SRC_RE.lastIndex = 0;
  while ((m = VIDEO_SRC_RE.exec(html)) !== null) {
    const ref = (m[1] || m[2] || "").split(/[?#]/)[0];
    if (ref) srcs.add(ref);
  }
  return [...srcs];
}

const PROCESSED_VIDEO_RE = /(?:assets\/processed\/|\boutput\b)[^"')\s]*\.(?:mp4|webm|mov|m4v)/i;

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
  const { html, mode = "build", needsAudio = false, assetExists, hadToolError = false } = input;
  const isEdit = mode === "edit";
  const checks: CheckResult[] = [];
  const add = (name: string, pass: boolean, critical: boolean, detail: string) =>
    checks.push({ name, pass, critical, detail });

  // 1. Built at all.
  const built = html.length > 800 && /<body[\s>]/i.test(html);
  add("built", built, true, built ? `${html.length} bytes` : "no/empty index.html");

  // 2. Playable — has a total duration the player can read.
  // (In edit mode the <video> element is the timing source, so duration is
  // informational rather than critical — but build-mode behavior is unchanged.)
  const hasDuration = /data-duration\s*=/.test(html);
  add(
    "playable_duration",
    hasDuration,
    !isEdit,
    hasDuration ? "data-duration present" : "missing data-duration",
  );

  // 3. Has a motion driver (GSAP / runtime timeline) — otherwise it's a frozen
  // frame. N/a in edit mode: a single-clip footage edit has no timeline driver,
  // the rendered mp4 carries the motion.
  const hasTimeline = /\bgsap\b|__hf\b|__timelines\b|\.timeline\(/i.test(html);
  add(
    "has_timeline",
    isEdit ? true : hasTimeline,
    false,
    isEdit ? "n/a (edit)" : hasTimeline ? "timeline/gsap found" : "no animation driver",
  );

  // 4. Media-rich, not a text slideshow (the core quality lever).
  // An edit is a single processed clip — one <video> is enough.
  const mediaCount = countMedia(html);
  const mediaBar = isEdit ? 1 : 2;
  add("media_rich", mediaCount >= mediaBar, false, `${mediaCount} media element(s)`);

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

  // ── Edit-mode checks (additive; only emitted when mode === "edit"). ──
  // An edit must actually be wired for playback: the wrapper index.html has to
  // reference the processed output video, not just describe the edit in text.
  let videoWired = false;
  if (isEdit) {
    const videoSrcs = collectVideoSrcs(html);
    const hasVideoEl = /<video\b/i.test(html);

    // 10. There is a real <video>/<source> pointing at a processed render.
    const processedSrc =
      videoSrcs.find((s) => PROCESSED_VIDEO_RE.test(s)) ||
      (PROCESSED_VIDEO_RE.test(html) ? "html" : undefined);
    videoWired = hasVideoEl && (videoSrcs.length > 0 || processedSrc !== undefined);
    add(
      "edit_video_wired",
      videoWired,
      true,
      videoWired
        ? `<video> → ${processedSrc ?? videoSrcs[0]}`
        : hasVideoEl
          ? "<video> has no resolvable source"
          : "no <video> element wiring the rendered clip",
    );

    // 11. The render output points at a processed/output artifact (not a raw
    // upload echoed back unchanged — a "frozen", no-op edit).
    const pointsAtProcessed =
      videoSrcs.some((s) => PROCESSED_VIDEO_RE.test(s)) || PROCESSED_VIDEO_RE.test(html);
    add(
      "edit_processed_output",
      pointsAtProcessed,
      false,
      pointsAtProcessed ? "references processed/output render" : "no processed/output ref found",
    );

    // 12. Not a static text-only result masquerading as a video.
    const notFrozen = videoWired && html.length > 800;
    add(
      "edit_not_static",
      notFrozen,
      true,
      notFrozen ? "playable clip wrapper" : "static/empty result — not a playable clip",
    );

    // 13. Resolved video sources exist on disk (when we can check).
    if (assetExists && videoSrcs.length) {
      const localSrcs = videoSrcs.filter((s) => !/^https?:/i.test(s));
      const brokenVid = localSrcs.filter((s) => !assetExists(s));
      add(
        "edit_video_resolves",
        brokenVid.length === 0,
        true,
        brokenVid.length ? `broken: ${brokenVid.slice(0, 4).join(", ")}` : `${localSrcs.length} ok`,
      );
    } else {
      add(
        "edit_video_resolves",
        true,
        true,
        videoSrcs.length ? "not checked" : "no local video src",
      );
    }
  }

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
    // Edit-mode weights — only contribute when those checks are present.
    edit_video_wired: 25,
    edit_processed_output: 8,
    edit_not_static: 15,
    edit_video_resolves: 10,
  };
  // Only the weights for checks that actually ran count toward the denominator,
  // so build-mode totals stay exactly 100 (additive edit checks don't dilute it).
  const total = checks.reduce((sum, c) => sum + (weights[c.name] ?? 0), 0);
  const earned = checks.reduce((sum, c) => sum + (c.pass ? (weights[c.name] ?? 0) : 0), 0);
  const score = total > 0 ? Math.round((100 * earned) / total) : 0;

  const failedCritical = checks.filter((c) => c.critical && !c.pass).map((c) => c.name);
  // Postable = no critical failure AND it's actually a video (enough media +
  // score bar). In edit mode the one wired <video> is the video, so the bar is
  // the same media floor the check uses.
  const postable =
    failedCritical.length === 0 &&
    mediaCount >= mediaBar &&
    (isEdit ? videoWired : true) &&
    score >= 75;

  return { checks, score, postable, failedCritical };
}
