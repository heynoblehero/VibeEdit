export interface RemotionEffect {
  id: string;
  name: string;
  code: string;
  startFrame: number;
  durationFrames: number;
  props: Record<string, unknown>;
}

export interface RemotionCompositionProps {
  effects: RemotionEffect[];
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
}
