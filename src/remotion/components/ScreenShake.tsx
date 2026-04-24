import React from "react";
import { useCurrentFrame } from "remotion";
import { shake } from "@/lib/anim";

interface ScreenShakeProps {
  hitFrame: number;
  duration?: number;
  intensity?: number;
  freq?: number;
  children: React.ReactNode;
}

export const ScreenShake: React.FC<ScreenShakeProps> = ({
  hitFrame,
  duration = 12,
  intensity = 8,
  freq = 0.9,
  children,
}) => {
  const frame = useCurrentFrame();
  const { x, y } = shake(frame, hitFrame, hitFrame + duration, intensity, freq);

  return (
    <div style={{ transform: `translate(${x}px, ${y}px)` }}>
      {children}
    </div>
  );
};
