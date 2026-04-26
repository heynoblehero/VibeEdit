import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";

interface TypewriterProps {
  text: string;
  startFrame?: number;
  /** Characters per frame. Default 1.5 — fast but readable. */
  speed?: number;
  color?: string;
  fontSize?: number;
  y?: number | string;
}

/** Reveals text character-by-character with a blinking caret. */
export const Typewriter: React.FC<TypewriterProps> = ({
  text,
  startFrame = 0,
  speed = 1.5,
  color = "#ffffff",
  fontSize,
  y = "40%",
}) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const since = frame - startFrame;
  if (since < 0) return null;
  const charsShown = Math.min(text.length, Math.floor(since * speed));
  const visible = text.slice(0, charsShown);
  const caretOn = Math.floor(since / 8) % 2 === 0;
  const fs = fontSize ?? Math.min(width * 0.06, 80);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: y,
        display: "flex",
        justifyContent: "center",
        padding: "0 6%",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          fontSize: fs,
          fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
          color,
          fontWeight: 800,
          letterSpacing: -0.02 * fs,
          textShadow: "0 6px 24px rgba(0,0,0,0.85)",
          whiteSpace: "pre-wrap",
          textAlign: "center",
          maxWidth: "85%",
        }}
      >
        {visible}
        <span
          style={{
            display: "inline-block",
            width: fs * 0.6,
            opacity: caretOn ? 1 : 0,
            color,
          }}
        >
          ▌
        </span>
      </div>
    </div>
  );
};

interface GlitchProps {
  text: string;
  startFrame?: number;
  /** How many frames to glitch before settling. Default 14. */
  duration?: number;
  color?: string;
  fontSize?: number;
  y?: number | string;
}

/**
 * Cyberpunk-style glitch reveal: text starts as random ASCII garble,
 * resolves to the real string with RGB-split shake. Settled state holds
 * after `duration`.
 */
export const Glitch: React.FC<GlitchProps> = ({
  text,
  startFrame = 0,
  duration = 14,
  color = "#10b981",
  fontSize,
  y = "40%",
}) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const since = frame - startFrame;
  if (since < 0) return null;
  const fs = fontSize ?? Math.min(width * 0.07, 96);
  const t = Math.min(1, since / duration);
  // Char-by-char: each char picks a random glyph from the candidates
  // until t crosses a per-char threshold, then shows the real char.
  const CHARS = "!@#$%&*+-=<>?_/\\|0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const display = text
    .split("")
    .map((c, i) => {
      const charT = i / Math.max(1, text.length - 1);
      if (t > charT) return c;
      const seed = (since * 31 + i * 17) % CHARS.length;
      return CHARS[seed];
    })
    .join("");
  // RGB-split shake during glitch.
  const shaking = t < 1;
  const shakeX = shaking ? Math.sin(since * 1.3) * 4 : 0;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: y,
        display: "flex",
        justifyContent: "center",
        padding: "0 6%",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "relative",
          fontSize: fs,
          fontFamily: "'JetBrains Mono', 'SF Mono', Menlo, monospace",
          fontWeight: 950,
          color,
          letterSpacing: -0.02 * fs,
          transform: `translateX(${shakeX}px)`,
          textShadow: shaking
            ? `2px 0 0 #ef4444, -2px 0 0 #3b82f6, 0 6px 24px rgba(0,0,0,0.85)`
            : `0 6px 24px rgba(0,0,0,0.85)`,
          textAlign: "center",
          maxWidth: "85%",
        }}
      >
        {display}
      </div>
    </div>
  );
};
