import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";

interface ParticlesProps {
  startFrame?: number;
  /** Number of particles. Default 36. */
  count?: number;
  color?: string;
  /** Origin x (0-1 or px). Default 0.5. */
  x?: number;
  y?: number;
  /** How long the burst takes to settle. Default 36 frames. */
  duration?: number;
}

/** Confetti-style burst of square particles flying outward + falling. */
export const Particles: React.FC<ParticlesProps> = ({
  startFrame = 0,
  count = 36,
  color = "#10b981",
  x = 0.5,
  y = 0.4,
  duration = 36,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  // Pre-compute each particle's randomized vector once so they don't
  // wiggle every frame.
  const particles = useMemo(() => {
    const out: Array<{
      angle: number;
      speed: number;
      size: number;
      hue: number;
      rotSpeed: number;
    }> = [];
    let s = 1234567;
    const rand = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < count; i++) {
      out.push({
        angle: rand() * Math.PI * 2,
        speed: 8 + rand() * 14,
        size: 8 + rand() * 14,
        hue: rand() * 60 - 30, // ±30deg around base color
        rotSpeed: (rand() - 0.5) * 14,
      });
    }
    return out;
  }, [count]);

  const since = frame - startFrame;
  if (since < 0 || since > duration + 30) return null;
  const t = Math.min(1, since / duration);
  const cx = (typeof x === "number" && x <= 1 ? x * width : x) as number;
  const cy = (typeof y === "number" && y <= 1 ? y * height : y) as number;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {particles.map((p, i) => {
        const dx = Math.cos(p.angle) * p.speed * since;
        const dy = Math.sin(p.angle) * p.speed * since + 0.6 * since * since; // gravity
        const opacity = since < duration ? 1 : Math.max(0, 1 - (since - duration) / 30);
        const rot = p.rotSpeed * since;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: cx + dx - p.size / 2,
              top: cy + dy - p.size / 2,
              width: p.size,
              height: p.size,
              background: color,
              opacity,
              filter: `hue-rotate(${p.hue}deg)`,
              transform: `rotate(${rot}deg)`,
              borderRadius: i % 3 === 0 ? "50%" : 2,
              boxShadow: `0 4px 12px ${color}55`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
