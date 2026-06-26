/**
 * render-smoke.ts — end-to-end smoke test for the edit + greenscreen render loop.
 *
 * Proves the three load-bearing pieces of the "edit by talking" pipeline:
 *   A) renderEdl greenscreen background-replace (the persona signature effect)
 *   B) renderEdl multi-cut edit (concat of two trimmed segments)
 *   C) applyEdit / undoEdit edit-state round-trip (pure, no ffmpeg)
 *
 * Tests A and B synthesize their own inputs with ffmpeg (no fixtures committed),
 * so the only external requirement is ffmpeg + ffprobe on PATH.
 *
 * HOW TO RUN:
 *   cd apps/web && bun scripts/render-smoke.ts
 *
 *   Requires `ffmpeg` and `ffprobe` on PATH (run in the Docker/prod env).
 *   Test C runs even without ffmpeg. Exits non-zero if any test fails.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// IMPORTANT: project-state -> fs.ts reads STORAGE_ROOT at module-load time, so it
// must be set BEFORE those modules are imported. We point it at a throwaway temp
// dir and load project-state via dynamic import below (after this assignment).
const STORAGE_ROOT = mkdtempSync(join(tmpdir(), "vibe_smoke_storage_"));
process.env.STORAGE_ROOT = STORAGE_ROOT;

import { renderEdl, probeClip, type EditDecisionList } from "../src/lib/ai/ffmpeg-tools";

// ---------------------------------------------------------------------------
// Tiny test harness
// ---------------------------------------------------------------------------

let passCount = 0;
let failCount = 0;

function pass(name: string, detail?: string): void {
  passCount++;
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail: string): void {
  failCount++;
  console.error(`FAIL  ${name} — ${detail}`);
}

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

// Distinguish "ffmpeg/ffprobe not installed" from a real test failure so the
// message is actionable in an env that simply lacks the binaries.
function isMissingBinary(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /ENOENT|not found|ffmpeg failed|ffprobe failed|spawn ffmpeg|spawn ffprobe/i.test(msg);
}

function ffmpegAvailable(): boolean {
  for (const bin of ["ffmpeg", "ffprobe"]) {
    try {
      execFileSync(bin, ["-version"], { stdio: "ignore" });
    } catch {
      return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Synthetic input generation (ffmpeg lavfi)
// ---------------------------------------------------------------------------

function generateInputs(projectRoot: string): { green: string; bg: string } {
  const assetsDir = join(projectRoot, "assets");
  mkdirSync(assetsDir, { recursive: true });

  const green = join(assetsDir, "green.mp4");
  const bg = join(assetsDir, "bg.png");

  // 2s green clip with a red box "subject" + a 440Hz tone.
  execFileSync(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=green:s=640x360:d=2,drawbox=x=270:y=130:w=100:h=100:color=red:t=fill",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:d=2",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-shortest",
      green,
    ],
    { stdio: "ignore" },
  );

  // Blue background still.
  execFileSync(
    "ffmpeg",
    ["-y", "-f", "lavfi", "-i", "color=c=blue:s=1280x720", "-frames:v", "1", bg],
    { stdio: "ignore" },
  );

  assert(existsSync(green), "green.mp4 was not created by ffmpeg");
  assert(existsSync(bg), "bg.png was not created by ffmpeg");
  return { green, bg };
}

// ---------------------------------------------------------------------------
// TEST A — greenscreen background replace
// ---------------------------------------------------------------------------

async function testGreenscreen(projectRoot: string): Promise<void> {
  const name = "A greenscreen background replace";
  try {
    const edl: EditDecisionList = {
      version: 1,
      segments: [
        {
          source: "assets/green.mp4",
          start: 0,
          end: 2,
          background: { replaceWith: "assets/bg.png", chromaKey: true },
        },
      ],
      outputPath: "out_bg.mp4",
    };

    const result = await renderEdl({ edl, projectRootDir: projectRoot });
    assert(result.ok, `renderEdl returned not-ok: ${result.error ?? "unknown error"}`);

    const outPath = join(projectRoot, "out_bg.mp4");
    assert(existsSync(outPath), "out_bg.mp4 does not exist");

    const info = await probeClip(outPath);
    assert(
      info.durationSeconds > 1.7 && info.durationSeconds < 2.3,
      `duration ~2s expected, got ${info.durationSeconds}`,
    );
    assert(
      info.width > 0 && info.height > 0,
      `non-zero dimensions expected, got ${info.width}x${info.height}`,
    );

    pass(name, `${info.width}x${info.height}, ${info.durationSeconds.toFixed(2)}s`);
  } catch (err) {
    handleTestError(name, err);
  }
}

// ---------------------------------------------------------------------------
// TEST B — multi-cut edit, no background
// ---------------------------------------------------------------------------

async function testMultiCut(projectRoot: string): Promise<void> {
  const name = "B multi-cut edit (two segments)";
  try {
    const edl: EditDecisionList = {
      version: 1,
      segments: [
        { source: "assets/green.mp4", start: 0, end: 1 },
        { source: "assets/green.mp4", start: 1.2, end: 2 },
      ],
      outputPath: "out_cut.mp4",
    };

    const result = await renderEdl({ edl, projectRootDir: projectRoot });
    assert(result.ok, `renderEdl returned not-ok: ${result.error ?? "unknown error"}`);

    const outPath = join(projectRoot, "out_cut.mp4");
    assert(existsSync(outPath), "out_cut.mp4 does not exist");

    const info = await probeClip(outPath);
    // Two cuts of 1.0s + 0.8s ≈ 1.8s; allow generous slack for encoder timing.
    assert(info.durationSeconds > 1.3, `expected >1.3s combined, got ${info.durationSeconds}`);
    assert(
      info.width > 0 && info.height > 0,
      `non-zero dimensions expected, got ${info.width}x${info.height}`,
    );

    pass(name, `${info.width}x${info.height}, ${info.durationSeconds.toFixed(2)}s`);
  } catch (err) {
    handleTestError(name, err);
  }
}

// ---------------------------------------------------------------------------
// TEST C — edit-state undo round-trip (pure, no ffmpeg)
// ---------------------------------------------------------------------------

async function testUndo(): Promise<void> {
  const name = "C edit-state undo round-trip";
  try {
    // Dynamic import AFTER process.env.STORAGE_ROOT is set (see top of file).
    const { applyEdit, undoEdit, readProjectState } =
      await import("../src/lib/storage/project-state");

    const userId = "smoke-user";
    const projectId = "smoke-project";

    const edlV1: EditDecisionList = {
      version: 1,
      segments: [{ source: "assets/green.mp4", start: 0, end: 2 }],
      outputPath: "out.mp4",
    };
    const edlV2: EditDecisionList = {
      version: 1,
      segments: [
        { source: "assets/green.mp4", start: 0, end: 1 },
        { source: "assets/green.mp4", start: 1.2, end: 2 },
      ],
      outputPath: "out.mp4",
    };

    applyEdit(userId, projectId, edlV1, "initial edit");
    const afterV2 = applyEdit(userId, projectId, edlV2, "split into two cuts");
    assert(
      afterV2.edl.segments.length === 2,
      "after second edit, current EDL should have 2 segments",
    );
    assert(afterV2.revisions.length === 1, "should have 1 undo step after two edits");

    const undone = undoEdit(userId, projectId);
    assert(undone !== null, "undoEdit returned null — nothing to undo");
    assert(
      undone!.edl.segments.length === 1,
      `undo should restore the 1-segment EDL, got ${undone!.edl.segments.length}`,
    );

    // Verify the restore actually persisted to disk, not just the return value.
    const persisted = readProjectState(userId, projectId);
    assert(persisted !== null, "project state missing after undo");
    assert(
      persisted!.edl.segments.length === 1,
      `persisted EDL should be the 1-segment version, got ${persisted!.edl.segments.length}`,
    );
    assert(persisted!.revisions.length === 0, "undo step should have been consumed");

    pass(name, "applyEdit×2 then undoEdit restored prior EDL (in-memory + on-disk)");
  } catch (err) {
    // Test C needs no ffmpeg — any error here is a real failure.
    fail(name, err instanceof Error ? err.message : String(err));
  }
}

function handleTestError(name: string, err: unknown): void {
  if (isMissingBinary(err)) {
    fail(name, "ffmpeg required — run in the Docker/prod env (ffmpeg + ffprobe on PATH)");
  } else {
    fail(name, err instanceof Error ? err.message : String(err));
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("render-smoke: edit + greenscreen render loop");
  console.log(`storage root (temp): ${STORAGE_ROOT}`);

  const projectRoot = mkdtempSync(join(tmpdir(), "vibe_smoke_project_"));
  console.log(`project root (temp): ${projectRoot}\n`);

  try {
    if (ffmpegAvailable()) {
      generateInputs(projectRoot);
      await testGreenscreen(projectRoot);
      await testMultiCut(projectRoot);
    } else {
      fail(
        "A greenscreen background replace",
        "ffmpeg required — run in the Docker/prod env (ffmpeg + ffprobe on PATH)",
      );
      fail(
        "B multi-cut edit (two segments)",
        "ffmpeg required — run in the Docker/prod env (ffmpeg + ffprobe on PATH)",
      );
    }

    // Test C is pure and always runs.
    await testUndo();
  } finally {
    // Best-effort cleanup of the throwaway temp dirs.
    for (const dir of [projectRoot, STORAGE_ROOT]) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  }

  console.log(`\n${passCount} passed, ${failCount} failed`);
  if (failCount > 0) process.exit(1);
}

main().catch((err) => {
  console.error("render-smoke crashed:", err);
  process.exit(1);
});
