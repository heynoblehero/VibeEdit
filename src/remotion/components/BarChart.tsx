import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";

interface Bar {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  bars: Bar[];
  title?: string;
  unit?: string;
}

// 2-6 vertical bars that grow from 0 to their value over ~24 frames.
// Each bar staggers 4 frames after the previous. Number above each bar
// fades in once the bar reaches its target.
export const BarChart: React.FC<BarChartProps> = ({ bars, title, unit = "" }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const max = Math.max(1, ...bars.map((b) => b.value));
  const chartH = height * 0.5;
  const chartW = width * 0.8;
  const barW = chartW / bars.length - 20;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: "0 6%",
      }}
    >
      {title && (
        <div
          style={{
            fontSize: width * 0.045,
            color: "#fff",
            fontFamily: "Inter, system-ui, sans-serif",
            fontWeight: 800,
            textAlign: "center",
            textShadow: "0 4px 18px rgba(0,0,0,0.8)",
          }}
        >
          {title}
        </div>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 20,
          height: chartH,
        }}
      >
        {bars.map((b, i) => {
          const start = i * 4;
          const p = spring({
            frame: Math.max(0, frame - start),
            fps,
            config: { damping: 18, mass: 0.7, stiffness: 140 },
            durationInFrames: 24,
          });
          const h = (b.value / max) * chartH * p;
          const labelOpacity = p > 0.85 ? Math.min(1, (p - 0.85) / 0.15) : 0;
          const color = b.color ?? ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4"][i % 6];
          return (
            <div
              key={i}
              style={{
                width: barW,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  opacity: labelOpacity,
                  fontSize: width * 0.032,
                  fontWeight: 900,
                  color: "#fff",
                  fontFamily: "Inter, system-ui, sans-serif",
                  textShadow: "0 2px 10px rgba(0,0,0,0.9)",
                }}
              >
                {Math.round(b.value)}{unit}
              </div>
              <div
                style={{
                  width: barW,
                  height: h,
                  background: color,
                  borderRadius: 8,
                  boxShadow: `0 6px 22px ${color}66`,
                  transformOrigin: "bottom",
                }}
              />
              <div
                style={{
                  fontSize: width * 0.022,
                  color: "#bbb",
                  fontFamily: "Inter, system-ui, sans-serif",
                  textAlign: "center",
                  maxWidth: barW * 1.3,
                  lineHeight: 1.2,
                }}
              >
                {b.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
