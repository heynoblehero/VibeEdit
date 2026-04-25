import React from "react";
import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from "remotion";

interface MontageProps {
  urls: string[];
  /** Seconds per cut. Default 0.5. */
  cutSec?: number;
}

export const Montage: React.FC<MontageProps> = ({ urls, cutSec = 0.5 }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  if (urls.length === 0) return null;
  const cutFrames = Math.max(1, Math.round(cutSec * fps));
  // Loop through urls if scene runtime is longer than urls.length * cutSec.
  const idx = Math.floor(frame / cutFrames) % urls.length;

  // Slight scale-pop on each cut so it doesn't feel like a flipbook.
  const intoCut = (frame % cutFrames) / cutFrames;
  const scale = 1.04 - intoCut * 0.04;

  // Hold the last image past the end if duration overshoots montage.
  const lastFrame = durationInFrames - 1;
  const finalIdx = frame >= lastFrame ? urls.length - 1 : idx;

  return (
    <AbsoluteFill>
      <Img
        key={finalIdx}
        src={urls[finalIdx]}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      />
    </AbsoluteFill>
  );
};
