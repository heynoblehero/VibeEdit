/**
 * capture-frames.ts — bun CLI wrapper around in-process snapshot capture.
 *
 * WHY THIS EXISTS: `src/lib/ai/snapshot/capture.ts` does
 * `await import("@hyperframes/core/compiler")` + `@hyperframes/engine`. The
 * `@hyperframes/core` package's `exports` map points those subpaths at TS
 * SOURCE (`./src/*.ts`), which Node (`next start`) cannot require and webpack
 * (`next build`) cannot bundle. So capture.ts must NOT be imported by anything
 * reachable from the Next bundle. Instead, tools.ts spawns THIS script with
 * `bun`, which natively runs `.ts` and the Hyperframes `src`.
 *
 * INTERFACE:
 *   args:  argv[2] = project dir (absolute)
 *          argv[3] = JSON array of timestamps in seconds, e.g. "[0.5,2,4]"
 *   stdout: JSON array of project-relative frame paths, e.g.
 *           ["snapshots/frame-00-at-0.5s.png", ...]
 *   exit:  0 on success, non-zero on error (message on stderr).
 *
 * RUN (smoke test in container):
 *   bun apps/web/scripts/capture-frames.ts /path/to/project '[0.5,2]'
 */
import { captureFrames } from "../src/lib/ai/snapshot/capture";

async function main(): Promise<void> {
  const dir = process.argv[2];
  const timestampsJson = process.argv[3];

  if (!dir) {
    throw new Error("missing project dir (argv[2])");
  }
  if (!timestampsJson) {
    throw new Error("missing timestamps JSON (argv[3])");
  }

  let timestamps: unknown;
  try {
    timestamps = JSON.parse(timestampsJson);
  } catch (err) {
    throw new Error(`invalid timestamps JSON: ${(err as Error).message}`);
  }
  if (!Array.isArray(timestamps) || !timestamps.every((t) => typeof t === "number")) {
    throw new Error("timestamps must be a JSON array of numbers");
  }

  const paths = await captureFrames(dir, { at: timestamps as number[] });
  process.stdout.write(JSON.stringify(paths));
}

main().then(
  () => {
    process.exit(0);
  },
  (err: unknown) => {
    process.stderr.write(`capture-frames failed: ${(err as Error).message}\n`);
    process.exit(1);
  },
);
