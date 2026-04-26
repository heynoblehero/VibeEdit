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
import {
  beatFlash,
  dipToColor,
  glitchCut,
  jumpCut,
  smashCut,
  whipPan,
  zoomBlur,
} from "./cut-presentations-custom";
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
      return dipToColor("#000000");
    case "dip_to_white":
      return dipToColor("#ffffff");
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
    case "beat_flash":
      return beatFlash();
    case "beat_flash_colored":
      return beatFlash({ color: dims.color });
    case "zoom_blur":
      return zoomBlur();
    case "jump_cut":
      return jumpCut();
    case "smash_cut":
      return smashCut({ color: dims.color });
    case "whip_pan":
      return whipPan();
    case "glitch_cut":
      return glitchCut();
    case "match_cut":
      // Match cuts are conceptually a hard cut with agent-suggested
      // alignment — no visual blend. Renders as none() but the agent
      // gets credit for the timing intent in qualityScore.
      return none();
  }
  return none();
}
