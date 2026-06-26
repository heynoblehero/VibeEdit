/**
 * Pure self-check for the scorer's edit-mode extensions.
 *
 * No ffmpeg, no network, no model — just asserts that:
 *   (a) build-mode scoring is unchanged (no regression vs. the pre-edit-mode
 *       behavior),
 *   (b) an edit-mode result whose index.html wires a processed <video> is
 *       postable,
 *   (c) an edit-mode result that's just static text is NOT postable.
 *
 *   bun eval/score.edit.check.ts
 */
import { scoreComposition, type ScoreInput } from "./score";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) {
    console.log(`  ✓ ${msg}`);
  } else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
}

// A representative, fully-passing BUILD composition (media-rich, animated,
// durationed, clean asset refs). This is the fixture we use to lock in that
// adding edit-mode fields does not change build-mode output.
const BUILD_HTML = `<!doctype html><html><head>
  <script>window.gsap = {}; gsap.timeline();</script>
</head>
<body data-duration="30">
  <img src="assets/images/a.jpg" />
  <img src="assets/images/b.jpg" />
  <div style="background:url('assets/images/c.jpg')"></div>
</body></html>`.padEnd(900, " ");

const buildInput: ScoreInput = {
  html: BUILD_HTML,
  assetExists: () => true,
};

// (a) No regression: scoring WITHOUT mode === scoring WITH mode:"build", and
// the build score is the full 100 (so the additive edit weights/checks did not
// dilute the denominator).
const noMode = scoreComposition(buildInput);
const explicitBuild = scoreComposition({ ...buildInput, mode: "build" });

assert(
  JSON.stringify(noMode) === JSON.stringify(explicitBuild),
  "build: omitting mode === mode:'build' (identical result)",
);
assert(noMode.postable === true, "build: media-rich animated comp is postable");
assert(noMode.score === 100, `build: fully-passing comp scores 100 (got ${noMode.score})`);
assert(
  noMode.checks.every((c) => !c.name.startsWith("edit_")),
  "build: no edit_* checks leak into build mode",
);

// (b) Edit-mode, properly wired: a single-clip wrapper that references the
// processed render output.
const EDIT_OK_HTML = `<!doctype html><html><head></head>
<body data-duration="18">
  <video controls playsinline src="assets/processed/output.mp4"></video>
</body></html>`.padEnd(900, " ");

const editOk = scoreComposition({
  html: EDIT_OK_HTML,
  mode: "edit",
  needsAudio: false,
  assetExists: () => true,
});

assert(editOk.postable === true, `edit: wired <video> clip is postable (score ${editOk.score})`);
assert(
  editOk.checks.find((c) => c.name === "edit_video_wired")?.pass === true,
  "edit: edit_video_wired passes for a real processed <video>",
);
assert(
  editOk.checks.find((c) => c.name === "edit_processed_output")?.pass === true,
  "edit: edit_processed_output detects assets/processed/output.mp4",
);

// Also accept a nested <source> pointing at the render output.
const EDIT_SOURCE_HTML = `<!doctype html><html><body data-duration="20">
  <video controls><source src="output.mp4" type="video/mp4" /></video>
</body></html>`.padEnd(900, " ");
const editSource = scoreComposition({
  html: EDIT_SOURCE_HTML,
  mode: "edit",
  assetExists: () => true,
});
assert(editSource.postable === true, "edit: <source>-wired clip is also postable");

// (c) Edit-mode, static text only (a "frozen"/no-op edit) — NOT postable.
const EDIT_STATIC_HTML = `<!doctype html><html><body data-duration="18">
  <h1>Your edit is ready</h1>
  <p>We trimmed the clip and added captions.</p>
</body></html>`.padEnd(900, " ");

const editStatic = scoreComposition({ html: EDIT_STATIC_HTML, mode: "edit" });
assert(editStatic.postable === false, "edit: static text-only result is NOT postable");
assert(
  editStatic.failedCritical.includes("edit_video_wired"),
  "edit: static result fails edit_video_wired (critical)",
);
assert(
  editStatic.failedCritical.includes("edit_not_static"),
  "edit: static result fails edit_not_static (critical)",
);

// Broken local video src should fail edit_video_resolves.
const editBroken = scoreComposition({
  html: EDIT_OK_HTML,
  mode: "edit",
  assetExists: () => false,
});
assert(
  editBroken.failedCritical.includes("edit_video_resolves"),
  "edit: missing video file fails edit_video_resolves (critical)",
);

if (failures > 0) {
  console.error(`\n${failures} assertion(s) failed.`);
  process.exit(1);
}
console.log("\nAll edit-mode self-checks passed.");
