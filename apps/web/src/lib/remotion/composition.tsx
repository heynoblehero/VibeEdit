"use client";

import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { getCompiledEffect, getAllEffects } from "./registry";

export const VibeEditComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const effects = getAllEffects();

  return (
    <AbsoluteFill style={{ backgroundColor: "transparent" }}>
      {effects.map((effect) => {
        const Component = getCompiledEffect(effect.id);
        if (!Component) return null;
        return (
          <Sequence
            key={effect.id}
            from={effect.startFrame}
            durationInFrames={effect.durationFrames}
          >
            <AbsoluteFill>
              <Component frame={frame - effect.startFrame} fps={fps} width={width} height={height} />
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};
