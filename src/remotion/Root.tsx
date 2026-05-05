import React from "react";
import { Composition } from "remotion";
import type { AudioSfxClip, CaptionStyle, MusicBed, Scene, Track } from "@/lib/scene-schema";
import { projectTotalFrames } from "@/lib/scene-schema";
import { VideoComposition } from "./Composition";

export interface RootProps extends Record<string, unknown> {
  scenes: Scene[];
  fps: number;
  characters: Record<string, string>;
  sfx: Record<string, string>;
  width: number;
  height: number;
  music?: MusicBed;
  captionStyle?: CaptionStyle;
  tracks?: Track[];
  sfxClips?: AudioSfxClip[];
}

const defaultProps: RootProps = {
  scenes: [],
  fps: 30,
  characters: {},
  sfx: {},
  width: 1920,
  height: 1080,
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="VibeEditVideo"
      component={VideoComposition as React.ComponentType<RootProps>}
      durationInFrames={1}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={defaultProps}
      calculateMetadata={({ props }) => {
        const duration = Math.max(
          1,
          projectTotalFrames({
            scenes: props.scenes,
            tracks: props.tracks,
            fps: props.fps,
          }),
        );
        return {
          durationInFrames: duration,
          fps: props.fps,
          width: props.width,
          height: props.height,
        };
      }}
    />
  );
};
