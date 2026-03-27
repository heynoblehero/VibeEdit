export interface ExportPreset {
  id: string;
  name: string;
  description: string;
  platform: string;
  settings: {
    format: "mp4" | "webm";
    quality: "low" | "medium" | "high" | "very_high";
    fps: number;
    width: number;
    height: number;
    includeAudio: boolean;
  };
}

export const EXPORT_PRESETS: ExportPreset[] = [
  {
    id: "youtube-1080",
    name: "YouTube 1080p",
    description: "Full HD for YouTube uploads",
    platform: "YouTube",
    settings: { format: "mp4", quality: "high", fps: 30, width: 1920, height: 1080, includeAudio: true },
  },
  {
    id: "youtube-4k",
    name: "YouTube 4K",
    description: "Ultra HD for premium content",
    platform: "YouTube",
    settings: { format: "mp4", quality: "very_high", fps: 30, width: 3840, height: 2160, includeAudio: true },
  },
  {
    id: "instagram-reel",
    name: "Instagram Reel",
    description: "Vertical 9:16 for Reels",
    platform: "Instagram",
    settings: { format: "mp4", quality: "high", fps: 30, width: 1080, height: 1920, includeAudio: true },
  },
  {
    id: "instagram-post",
    name: "Instagram Post",
    description: "Square 1:1 for feed posts",
    platform: "Instagram",
    settings: { format: "mp4", quality: "high", fps: 30, width: 1080, height: 1080, includeAudio: true },
  },
  {
    id: "tiktok",
    name: "TikTok",
    description: "Vertical 9:16 for TikTok",
    platform: "TikTok",
    settings: { format: "mp4", quality: "high", fps: 30, width: 1080, height: 1920, includeAudio: true },
  },
  {
    id: "twitter",
    name: "Twitter/X",
    description: "16:9 for Twitter posts",
    platform: "Twitter",
    settings: { format: "mp4", quality: "medium", fps: 30, width: 1280, height: 720, includeAudio: true },
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description: "Professional 16:9 for LinkedIn",
    platform: "LinkedIn",
    settings: { format: "mp4", quality: "high", fps: 30, width: 1920, height: 1080, includeAudio: true },
  },
  {
    id: "gif",
    name: "Animated GIF",
    description: "Short loop, no audio",
    platform: "General",
    settings: { format: "webm", quality: "medium", fps: 15, width: 480, height: 270, includeAudio: false },
  },
  {
    id: "thumbnail",
    name: "Video Thumbnail",
    description: "Single frame as PNG",
    platform: "General",
    settings: { format: "mp4", quality: "high", fps: 1, width: 1920, height: 1080, includeAudio: false },
  },
];

export function getPreset(id: string): ExportPreset | undefined {
  return EXPORT_PRESETS.find(p => p.id === id);
}

export function getPresetsByPlatform(platform: string): ExportPreset[] {
  return EXPORT_PRESETS.filter(p => p.platform === platform);
}
