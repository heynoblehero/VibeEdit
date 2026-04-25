import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import type { CaptionStyle, CaptionWord } from "@/lib/scene-schema";

interface CaptionsProps {
  words: CaptionWord[];
  style?: CaptionStyle;
  characterY?: number;
}

interface Chunk {
  words: string[];
  highlightIdx: number;
  startMs: number;
  endMs: number;
}

function pickEmphasizedWord(words: string[]): number {
  // Prefer the longest word (typically the most content-bearing).
  let best = 0;
  let bestLen = 0;
  for (let i = 0; i < words.length; i++) {
    const clean = words[i].replace(/[^\w]/g, "");
    if (clean.length > bestLen) {
      bestLen = clean.length;
      best = i;
    }
  }
  return best;
}

function buildChunks(words: CaptionWord[], chunkSize: number): Chunk[] {
  const size = Math.max(1, chunkSize);
  const chunks: Chunk[] = [];
  for (let i = 0; i < words.length; i += size) {
    const group = words.slice(i, i + size);
    if (group.length === 0) continue;
    const tokens = group.map((w) => w.word.trim());
    chunks.push({
      words: tokens,
      highlightIdx: pickEmphasizedWord(tokens),
      startMs: group[0].startMs,
      endMs: group[group.length - 1].endMs,
    });
  }
  return chunks;
}

export const Captions: React.FC<CaptionsProps> = ({ words, style, characterY }) => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  if (!words || words.length === 0) return null;

  const fontSize = style?.fontSize ?? 64;
  const color = style?.color ?? "#ffffff";
  const strokeColor = style?.strokeColor ?? "#000000";
  const uppercase = style?.uppercase ?? true;
  const maxWords = style?.maxWordsPerChunk ?? 3;
  const positionMode = style?.position ?? "auto";

  const currentMs = (frame / fps) * 1000;
  const chunks = buildChunks(words, maxWords);
  const active = chunks.findIndex((c, idx) => {
    const nextStart = chunks[idx + 1]?.startMs ?? c.endMs + 400;
    return currentMs >= c.startMs && currentMs < nextStart;
  });
  if (active < 0) return null;

  // Smart position: if the character sits in the lower half of frame, push
  // captions to the upper third so they don't cover the face.
  const characterInLowerHalf =
    typeof characterY === "number" && characterY > height * 0.55;

  let verticalStyle: React.CSSProperties;
  if (positionMode === "top" || (positionMode === "auto" && characterInLowerHalf)) {
    verticalStyle = { top: "12%" };
  } else if (positionMode === "center") {
    verticalStyle = { top: "50%", transform: "translateY(-50%)" };
  } else {
    verticalStyle = { bottom: "14%" };
  }

  const chunk = chunks[active];
  const highlightColor = style?.highlightColor;

  const sw = Math.max(2, fontSize * 0.07);
  const s = `${sw}px`;
  const sd = `${sw * 0.71}px`;
  // 8-direction stroke (4 cardinal + 4 diagonals) for clean readable edges,
  // plus a wide soft drop shadow so captions never get lost on bright BGs.
  const textShadow = [
    `-${s} 0 0 ${strokeColor}`,
    `${s} 0 0 ${strokeColor}`,
    `0 -${s} 0 ${strokeColor}`,
    `0 ${s} 0 ${strokeColor}`,
    `-${sd} -${sd} 0 ${strokeColor}`,
    `${sd} -${sd} 0 ${strokeColor}`,
    `-${sd} ${sd} 0 ${strokeColor}`,
    `${sd} ${sd} 0 ${strokeColor}`,
    `0 8px 28px rgba(0,0,0,0.85)`,
  ].join(", ");

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        ...verticalStyle,
      }}
    >
      <div
        style={{
          fontSize,
          fontWeight: 900,
          letterSpacing: 1,
          fontFamily: "Geist, system-ui, sans-serif",
          textShadow,
          padding: "0 6%",
          textAlign: "center",
          lineHeight: 1.15,
          display: "inline-flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: "0.3em",
        }}
      >
        {chunk.words.map((w, i) => {
          const display = uppercase ? w.toUpperCase() : w;
          const isHighlight = highlightColor && i === chunk.highlightIdx;
          return (
            <span
              key={i}
              style={{
                color: isHighlight ? highlightColor : color,
                transform: isHighlight ? "scale(1.08)" : undefined,
                display: "inline-block",
              }}
            >
              {display}
            </span>
          );
        })}
      </div>
    </div>
  );
};
