export interface ClipMoment {
  id: string;
  startTime: number;
  endTime: number;
  title: string;
  reason: string;
  score: number;
  transcript: string;
  hashtags: string[];
}

export type ClipPlatform = "tiktok" | "youtube-shorts" | "instagram-reels";

export interface CaptionStyle {
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor: string;
  position: "bottom" | "center" | "top";
}

export interface ClipJob {
  id: string;
  moment: ClipMoment;
  platforms: ClipPlatform[];
  captionStyle: CaptionStyle;
  status: "pending" | "exporting" | "done" | "error";
  error?: string;
  results: ClipResult[];
  /** Built video element for rendering (set by clip-builder) */
  videoElement: import("@/types/timeline").CreateVideoElement;
  /** Built text elements for captions + hooks (set by clip-builder) */
  textElements: import("@/types/timeline").CreateTextElement[];
}

export interface ClipResult {
  platform: ClipPlatform;
  blob: Blob;
  width: number;
  height: number;
  duration: number;
  filename: string;
}

export type PipelineState =
  | "idle"
  | "uploading"
  | "transcribing"
  | "analyzing"
  | "generating"
  | "exporting"
  | "done"
  | "error";

export interface PipelineProgress {
  state: PipelineState;
  step: number;
  totalSteps: number;
  stepLabel: string;
  progress: number; // 0-1 within current step
  clipsDone: number;
  clipsTotal: number;
}

export interface ClipperSettings {
  minClipDuration: number; // seconds, default 15
  maxClipDuration: number; // seconds, default 60
  platforms: ClipPlatform[];
  captionStyle: CaptionStyle;
  addHookText: boolean;
  maxClips: number; // default 50
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontSize: 42,
  fontFamily: "Inter",
  color: "#ffffff",
  backgroundColor: "#000000",
  position: "bottom",
};

export const DEFAULT_CLIPPER_SETTINGS: ClipperSettings = {
  minClipDuration: 15,
  maxClipDuration: 60,
  platforms: ["tiktok", "youtube-shorts", "instagram-reels"],
  captionStyle: DEFAULT_CAPTION_STYLE,
  addHookText: true,
  maxClips: 50,
};

export const PLATFORM_SPECS: Record<ClipPlatform, { width: number; height: number; aspectRatio: string; label: string }> = {
  tiktok: { width: 1080, height: 1920, aspectRatio: "9:16", label: "TikTok" },
  "youtube-shorts": { width: 1080, height: 1920, aspectRatio: "9:16", label: "YouTube Shorts" },
  "instagram-reels": { width: 1080, height: 1920, aspectRatio: "9:16", label: "Instagram Reels" },
};
