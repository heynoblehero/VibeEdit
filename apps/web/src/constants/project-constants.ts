import type { TCanvasPreset, TCanvasSize } from "@/types/project";

export const DEFAULT_CANVAS_PRESETS: TCanvasPreset[] = [
	{ label: "YouTube 1080p", platform: "YouTube", width: 1920, height: 1080 },
	{ label: "YouTube 4K", platform: "YouTube", width: 3840, height: 2160 },
	{ label: "YouTube Shorts", platform: "YouTube", width: 1080, height: 1920 },
	{ label: "TikTok", platform: "TikTok", width: 1080, height: 1920 },
	{ label: "Instagram Reel", platform: "Instagram", width: 1080, height: 1920 },
	{ label: "Instagram Post", platform: "Instagram", width: 1080, height: 1080 },
	{ label: "Instagram Portrait", platform: "Instagram", width: 1080, height: 1350 },
	{ label: "Twitter / X", platform: "Twitter", width: 1280, height: 720 },
	{ label: "LinkedIn", platform: "LinkedIn", width: 1200, height: 627 },
	{ label: "Facebook Feed", platform: "Facebook", width: 1280, height: 720 },
	{ label: "Pinterest", platform: "Pinterest", width: 1000, height: 1500 },
	{ label: "Cinematic 21:9", platform: "Cinema", width: 2560, height: 1080 },
	{ label: "Classic 4:3", platform: "Classic", width: 1440, height: 1080 },
];

export const FPS_PRESETS = [
	{ value: "24", label: "24 fps" },
	{ value: "25", label: "25 fps" },
	{ value: "30", label: "30 fps" },
	{ value: "60", label: "60 fps" },
	{ value: "120", label: "120 fps" },
] as const;

export const BLUR_INTENSITY_PRESETS: { label: string; value: number }[] = [
	{ label: "Light", value: 4 },
	{ label: "Medium", value: 8 },
	{ label: "Heavy", value: 18 },
] as const;

export const DEFAULT_CANVAS_SIZE: TCanvasSize = { width: 1920, height: 1080 };
export const DEFAULT_FPS = 30;
export const DEFAULT_BLUR_INTENSITY = 8;
export const DEFAULT_COLOR = "#000000";

export const CUSTOM_CANVAS_MIN = 64;
export const CUSTOM_CANVAS_MAX = 7680;
