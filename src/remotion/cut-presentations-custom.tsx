/**
 * cut-presentations-custom.tsx
 *
 * Bespoke TransitionPresentations for the custom CutKinds that don't
 * map 1:1 to @remotion/transitions primitives:
 *   - whip_pan
 *   - smash_cut
 *   - glitch_cut
 *   - dip_to_black, dip_to_white
 *   - beat_flash, beat_flash_colored
 *   - zoom_blur
 *   - jump_cut
 *
 * Each export is a builder that returns a `TransitionPresentation`. They
 * read `presentationProgress` (0→1) and `presentationDirection` and
 * render the `children` (the scene) with appropriate transforms / overlays.
 */

import React from "react";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";

// TransitionPresentation's prop generic must satisfy Record<string, unknown>.
// We declare ColorProps with an index signature so TS accepts it as the
// generic param across every presentation builder below.
type ColorProps = { color?: string } & Record<string, unknown>;

/* --------------------------- whip_pan --------------------------------- */

const WhipPanComp: React.FC<TransitionPresentationComponentProps<ColorProps>> = ({
  presentationProgress,
  presentationDirection,
  children,
}) => {
  const t = presentationProgress;
  const isExit = presentationDirection === "exiting";
  // Outgoing slides off to the left with motion blur; incoming slides
  // in from the right with motion blur. Cubic ease so the middle of
  // the move is fastest (the "whip" feel).
  const eased = t * t * (3 - 2 * t);
  const tx = isExit ? -eased * 100 : (1 - eased) * 100;
  const blur = Math.max(0, Math.sin(t * Math.PI) * 16);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: `translateX(${tx}%)`,
        filter: `blur(${blur}px)`,
        willChange: "transform, filter",
      }}
    >
      {children}
    </div>
  );
};

export const whipPan = (): TransitionPresentation<ColorProps> => ({
  component: WhipPanComp,
  props: {},
});

/* --------------------------- smash_cut -------------------------------- */

const SmashCutComp: React.FC<TransitionPresentationComponentProps<ColorProps>> = ({
  presentationProgress,
  presentationDirection,
  passedProps,
  children,
}) => {
  // Outgoing flashes white over the cut; incoming starts at full opacity.
  // Single sharp 1-frame flash on transition midpoint.
  const t = presentationProgress;
  const isExit = presentationDirection === "exiting";
  const flashAlpha = isExit && t > 0.85 ? 1 : !isExit && t < 0.15 ? 0.7 : 0;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {children}
      {flashAlpha > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: passedProps?.color ?? "#ffffff",
            opacity: flashAlpha,
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
};

export const smashCut = (props: ColorProps = {}): TransitionPresentation<ColorProps> => ({
  component: SmashCutComp,
  props,
});

/* --------------------------- glitch_cut ------------------------------- */

const GlitchCutComp: React.FC<TransitionPresentationComponentProps<ColorProps>> = ({
  presentationProgress,
  presentationDirection,
  children,
}) => {
  const t = presentationProgress;
  const isExit = presentationDirection === "exiting";
  // Heavy RGB-split shake near the cut midpoint; settles at the ends.
  const intensity = Math.sin(t * Math.PI);
  const shakeX = (isExit ? 1 : -1) * intensity * 18;
  const opacity = isExit ? 1 - t : t;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        opacity,
        transform: `translateX(${shakeX}px)`,
        filter:
          intensity > 0.3
            ? `drop-shadow(${intensity * 6}px 0 0 #ef4444) drop-shadow(${-intensity * 6}px 0 0 #3b82f6)`
            : undefined,
      }}
    >
      {children}
    </div>
  );
};

export const glitchCut = (): TransitionPresentation<ColorProps> => ({
  component: GlitchCutComp,
  props: {},
});

/* ----------------------- dip_to_color (black/white) ------------------- */

const DipToColorComp: React.FC<TransitionPresentationComponentProps<ColorProps>> = ({
  presentationProgress,
  presentationDirection,
  passedProps,
  children,
}) => {
  // Outgoing: 1 → 0 on the first half (fade to color), then stays 0.
  // Incoming: 0 → 1 on the second half (fade from color).
  const t = presentationProgress;
  const isExit = presentationDirection === "exiting";
  const opacity = isExit ? Math.max(0, 1 - t * 2) : Math.max(0, t * 2 - 1);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: passedProps?.color ?? "#000000",
      }}
    >
      <div style={{ position: "absolute", inset: 0, opacity }}>{children}</div>
    </div>
  );
};

export const dipToColor = (color: string): TransitionPresentation<ColorProps> => ({
  component: DipToColorComp,
  props: { color },
});

/* --------------------------- beat_flash ------------------------------- */

const BeatFlashComp: React.FC<TransitionPresentationComponentProps<ColorProps>> = ({
  presentationProgress,
  presentationDirection,
  passedProps,
  children,
}) => {
  // Single bright flash on transition midpoint, then settle.
  const t = presentationProgress;
  const isExit = presentationDirection === "exiting";
  // Triangular flash envelope peaking at t=0.5 of the transition.
  const flashAlpha = Math.max(0, 1 - Math.abs(t - 0.5) * 4);
  const opacity = isExit ? 1 - t : t;
  return (
    <div style={{ position: "absolute", inset: 0, opacity }}>
      {children}
      {flashAlpha > 0 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: passedProps?.color ?? "#ffffff",
            opacity: flashAlpha * 0.7,
            mixBlendMode: "screen",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
};

export const beatFlash = (props: ColorProps = {}): TransitionPresentation<ColorProps> => ({
  component: BeatFlashComp,
  props,
});

/* --------------------------- zoom_blur -------------------------------- */

const ZoomBlurComp: React.FC<TransitionPresentationComponentProps<ColorProps>> = ({
  presentationProgress,
  presentationDirection,
  children,
}) => {
  const t = presentationProgress;
  const isExit = presentationDirection === "exiting";
  // Outgoing scales up + blurs as it leaves; incoming scales from large
  // back to normal. Net effect: a punchy push-through-the-frame cut.
  const scale = isExit ? 1 + t * 0.18 : 1.18 - t * 0.18;
  const blur = Math.sin(t * Math.PI) * 12;
  const opacity = isExit ? 1 - t : t;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: `scale(${scale})`,
        filter: `blur(${blur}px)`,
        opacity,
      }}
    >
      {children}
    </div>
  );
};

export const zoomBlur = (): TransitionPresentation<ColorProps> => ({
  component: ZoomBlurComp,
  props: {},
});

/* --------------------------- jump_cut --------------------------------- */

const JumpCutComp: React.FC<TransitionPresentationComponentProps<ColorProps>> = ({
  presentationProgress,
  presentationDirection,
  children,
}) => {
  // Subtle 5px positional jitter + 2% scale jolt on the cut to simulate
  // the vlog-style "I'm still here, time skipped" feel. Very fast.
  const t = presentationProgress;
  const isExit = presentationDirection === "exiting";
  const jolt = Math.sin(t * Math.PI);
  const tx = (isExit ? 1 : -1) * jolt * 5;
  const scale = 1 + jolt * 0.02;
  const opacity = isExit ? 1 - t : t;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        transform: `translateX(${tx}px) scale(${scale})`,
        opacity,
      }}
    >
      {children}
    </div>
  );
};

export const jumpCut = (): TransitionPresentation<ColorProps> => ({
  component: JumpCutComp,
  props: {},
});
