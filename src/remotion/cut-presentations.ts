/**
 * cut-presentations.ts
 *
 * Maps a CutKind (schema-level enum) to a Remotion TransitionPresentation.
 * Composition.tsx calls `presentationFor(kind, { width, height, color })`
 * for every cut.
 *
 * v1 (commit 2.1) wires the kinds that map directly to @remotion/transitions
 * primitives. Custom presentations (whip_pan, smash_cut, glitch_cut,
 * dip_to_*, beat_flash variants, jump_cut, match_cut) land in commit 2.3.
 */

import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { wipe } from "@remotion/transitions/wipe";
import { flip } from "@remotion/transitions/flip";
import { clockWipe } from "@remotion/transitions/clock-wipe";
import { iris } from "@remotion/transitions/iris";
import { none } from "@remotion/transitions/none";
import type { CutKind } from "@/lib/scene-schema";

interface PresentationDims {
  width: number;
  height: number;
  color?: string;
}

// We type the return as `unknown`-presentation because the props type
// varies per primitive (iris/clockWipe carry width/height; fade carries
// nothing). TransitionSeries.Transition accepts any presentation, so the
// caller doesn't need to know the inner shape.
//
// The typed-cast wrapper keeps each branch's return concrete locally so
// future presentation upgrades (when we switch jump_cut from fade-stub
// to a real component) don't fight the unifying return type.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPresentation = ReturnType<typeof fade> | any;

export function presentationFor(
  kind: CutKind,
  dims: PresentationDims,
): AnyPresentation {
  const wh = { width: dims.width, height: dims.height };
  switch (kind) {
    case "hard":
      // Zero-duration transition still needs a presentation; none() is
      // a no-op that renders identically to two adjacent Sequences with
      // no Transition between them.
      return none();
    case "fade":
      return fade();
    case "dip_to_black":
      // v1 stub: single fade through transparent. Commit 2.3 swaps for
      // a true two-stage fade-to-color-then-fade-from custom presentation.
      return fade();
    case "dip_to_white":
      return fade();
    case "wipe":
      return wipe();
    case "iris":
      return iris(wh);
    case "clock_wipe":
      return clockWipe(wh);
    case "flip":
      return flip();
    case "slide_left":
      return slide({ direction: "from-right" });
    case "slide_right":
      return slide({ direction: "from-left" });
    // Custom kinds — commit 2.3 replaces these stubs with bespoke
    // presentations. v1 falls through to fade so cut.durationFrames > 0
    // still produces a visible transition rather than a runtime error.
    case "beat_flash":
    case "beat_flash_colored":
    case "zoom_blur":
    case "jump_cut":
    case "smash_cut":
    case "whip_pan":
    case "glitch_cut":
    case "match_cut":
      return fade();
  }
  return none();
}
