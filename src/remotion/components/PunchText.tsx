import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { TextStyle } from "@/lib/scene-schema";

interface PunchTextProps {
  text: string;
  startFrame?: number;
  fontSize?: number;
  color?: string;
  glowColor?: string;
  x?: number | "center";
  /**
   * Horizontal alignment shorthand. Takes precedence over `x` when set.
   * "center" = block centered, "left" / "right" = pinned to that edge
   * with a 6% safe-area margin (matches the existing center padding).
   */
  align?: "left" | "center" | "right";
  y?: number;
  staggerFrames?: number;
  fontWeight?: number;
  /**
   * Optional rich-style overrides — letter spacing, font family, stroke,
   * background pill, etc. Each field overrides a default; unset = old
   * behaviour. See scene-schema.ts -> TextStyle.
   */
  style?: TextStyle;
}

const FONT_STACKS: Record<NonNullable<TextStyle["fontFamily"]>, string> = {
  system: "system-ui, -apple-system, sans-serif",
  serif: "Georgia, 'Times New Roman', serif",
  mono: "'JetBrains Mono', Menlo, monospace",
  display: "Impact, 'Bebas Neue', system-ui, sans-serif",
};

// Rough overflow-aware sizing. Frame ~1080px wide on portrait, 1920 on
// landscape; we don't know orientation here, so target a safe ~960px
// effective text-area and shrink fontSize when char-count would push
// the longest word past it. Measures characters at ~0.55 × fontSize per
// char (decent for system-ui condensed weight 800+).
function clampFontSize(text: string, requested: number, frameWidth: number): number {
  const longest = Math.max(...text.split(/\s+/).map((w) => w.length));
  if (longest === 0) return requested;
  const safeWidth = frameWidth * 0.88;
  const px = longest * requested * 0.55;
  if (px <= safeWidth) return requested;
  return Math.max(28, Math.floor((safeWidth / (longest * 0.55))));
}

function applyTransform(s: string, mode?: TextStyle["transform"]): string {
  if (!mode || mode === "none") return s;
  if (mode === "uppercase") return s.toUpperCase();
  if (mode === "lowercase") return s.toLowerCase();
  if (mode === "capitalize") {
    return s.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return s;
}

export const PunchText: React.FC<PunchTextProps> = ({
  text,
  startFrame = 0,
  fontSize: requestedFontSize = 72,
  color = "white",
  glowColor,
  x = "center",
  align,
  y = 480,
  staggerFrames = 5,
  fontWeight = 800,
  style,
}) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const transformed = applyTransform(text, style?.transform);
  const fontSize = clampFontSize(transformed, requestedFontSize, width);
  const words = transformed.split(" ");

  // align (when set) wins over x. align maps to flex justifyContent;
  // numeric x (legacy) is a left padding override.
  let justifyContent: "center" | "flex-start" | "flex-end" = "center";
  let paddingLeft: string | number = "6%";
  if (align === "left") {
    justifyContent = "flex-start";
  } else if (align === "right") {
    justifyContent = "flex-end";
  } else if (align === "center") {
    justifyContent = "center";
  } else if (typeof x === "number") {
    justifyContent = "flex-start";
    paddingLeft = x;
  }

  const fontFamily = FONT_STACKS[style?.fontFamily ?? "system"];
  const effectiveWeight = style?.weight ?? fontWeight;
  const fontStyle = style?.italic ? "italic" : "normal";
  const textDecoration = style?.underline ? "underline" : "none";
  const letterSpacing =
    style?.letterSpacing != null ? `${style.letterSpacing}em` : "-0.02em";
  const lineHeight = style?.lineHeight ?? 1.05;
  const containerOpacity = style?.opacity ?? 1;
  const glow = (glowColor ?? style?.glowColor)
    ? `0 0 ${fontSize * 0.4}px ${glowColor ?? style?.glowColor}, 0 0 ${fontSize * 0.8}px ${glowColor ?? style?.glowColor}`
    : "none";
  const stroke =
    style?.strokeColor && style?.strokeWidth
      ? `${style.strokeWidth}px ${style.strokeColor}`
      : undefined;
  const hasBg = !!style?.bgColor;

  return (
    <div
      style={{
        position: "absolute",
        top: y,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent,
        // Always reserve a 6% margin on each side so words never kiss the
        // safe-area edges on shorts platforms that crop overlays.
        paddingLeft,
        paddingRight: "6%",
        gap: fontSize * 0.3,
        flexWrap: "wrap",
        opacity: containerOpacity,
        lineHeight,
      }}
    >
      {words.map((word, i) => {
        const wordStart = startFrame + i * staggerFrames;
        const s = spring({
          frame: Math.max(0, frame - wordStart),
          fps,
          config: { damping: 11, mass: 0.7, stiffness: 200 },
          durationInFrames: 18,
        });

        if (frame < wordStart) return null;

        return (
          <span
            key={i}
            style={{
              fontSize,
              fontWeight: effectiveWeight,
              fontFamily,
              fontStyle,
              textDecoration,
              color,
              transform: `scale(${s})`,
              display: "inline-block",
              textShadow: glow,
              letterSpacing,
              WebkitTextStroke: stroke,
              backgroundColor: hasBg ? style?.bgColor : undefined,
              padding: hasBg ? `${style?.bgPadding ?? 8}px ${(style?.bgPadding ?? 8) * 1.4}px` : 0,
              borderRadius: hasBg ? (style?.bgRadius ?? 8) : 0,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
};
