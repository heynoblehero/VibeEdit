"use client";

import { Sparkles } from "lucide-react";

const ORB_POSITIONS = [
  { top: "10%", left: "15%", size: 120, color: "hsl(262 83% 58% / 0.15)", delay: "0s", duration: "8s" },
  { top: "20%", right: "10%", size: 160, color: "hsl(330 85% 65% / 0.1)", delay: "1s", duration: "10s" },
  { bottom: "15%", left: "20%", size: 100, color: "hsl(190 90% 55% / 0.08)", delay: "0.5s", duration: "9s" },
  { bottom: "25%", right: "15%", size: 140, color: "hsl(270 90% 70% / 0.12)", delay: "1.5s", duration: "11s" },
  { top: "50%", left: "50%", size: 200, color: "hsl(262 83% 58% / 0.08)", delay: "0.3s", duration: "12s" },
];

const SPARKLE_POSITIONS = [
  { top: "8%", left: "12%", size: 16, delay: "0s" },
  { top: "15%", right: "18%", size: 12, delay: "0.3s" },
  { top: "30%", left: "8%", size: 14, delay: "0.6s" },
  { top: "25%", right: "12%", size: 18, delay: "0.15s" },
  { bottom: "30%", left: "15%", size: 12, delay: "0.45s" },
  { bottom: "15%", right: "10%", size: 16, delay: "0.75s" },
  { top: "55%", left: "6%", size: 10, delay: "0.9s" },
  { top: "45%", right: "8%", size: 14, delay: "0.2s" },
  { bottom: "10%", left: "35%", size: 16, delay: "0.5s" },
  { bottom: "20%", right: "30%", size: 12, delay: "0.35s" },
  { top: "8%", left: "45%", size: 10, delay: "0.65s" },
  { top: "65%", right: "20%", size: 14, delay: "0.8s" },
];

export function RenderingOverlay() {
  return (
    <div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center overflow-hidden">
      {/* Blur layer */}
      <div className="absolute inset-0 backdrop-blur-xl" />

      {/* Dark gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/50" />

      {/* Floating orbs */}
      {ORB_POSITIONS.map((orb, i) => (
        <div
          key={`orb-${i}`}
          className="absolute rounded-full blur-3xl animate-pulse"
          style={{
            top: orb.top,
            left: orb.left,
            right: orb.right,
            bottom: orb.bottom,
            width: orb.size,
            height: orb.size,
            background: orb.color,
            animationDelay: orb.delay,
            animationDuration: orb.duration,
          }}
        />
      ))}

      {/* Sparkles scattered */}
      {SPARKLE_POSITIONS.map((pos, i) => (
        <div
          key={`sparkle-${i}`}
          className="absolute animate-pulse"
          style={{
            top: pos.top,
            left: pos.left,
            right: pos.right,
            bottom: pos.bottom,
            animationDelay: pos.delay,
            animationDuration: "2.5s",
          }}
        >
          <Sparkles
            size={pos.size}
            className="text-white/60"
            strokeWidth={1.5}
          />
        </div>
      ))}

      {/* Center content */}
      <div className="relative flex flex-col items-center gap-4">
        {/* Glowing icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary shadow-[0_0_40px_hsl(262_83%_58%/0.4)]">
          <Sparkles className="h-8 w-8 text-white" />
        </div>

        {/* Title */}
        <span
          className="text-white font-bold tracking-[0.3em] font-[family-name:var(--font-display)]"
          style={{
            fontSize: "clamp(1.4rem, 4vw, 2.5rem)",
            textShadow: "0 0 40px hsl(262 83% 58% / 0.4)",
          }}
        >
          EDITING
        </span>

        {/* Progress dots */}
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-white/60 animate-pulse"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>

        <span className="text-white/40 text-xs tracking-[0.15em] font-medium">
          working on it
        </span>
      </div>
    </div>
  );
}
