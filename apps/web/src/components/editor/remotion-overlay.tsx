"use client";

import React, { useMemo } from "react";
import { Player } from "@remotion/player";
import { VibeEditComposition } from "@/lib/remotion/composition";
import { getAllEffects } from "@/lib/remotion/registry";
import { useEditor } from "@/hooks/use-editor";

export function RemotionOverlay() {
  const editor = useEditor();
  const effects = getAllEffects();

  // Don't render if no effects
  if (effects.length === 0) return null;

  const fps = 30;
  const totalDuration = editor.timeline.getTotalDuration();
  const durationInFrames = Math.max(Math.ceil(totalDuration * fps), 1);

  return (
    <div className="absolute inset-0 z-5 pointer-events-none">
      <Player
        component={VibeEditComposition}
        compositionWidth={1920}
        compositionHeight={1080}
        durationInFrames={durationInFrames}
        fps={fps}
        style={{ width: "100%", height: "100%", backgroundColor: "transparent" }}
        controls={false}
        autoPlay={false}
      />
    </div>
  );
}
