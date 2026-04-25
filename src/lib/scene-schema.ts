export type EnterDirection = "left" | "right" | "bottom" | "scale";

export type BRollKind = "clip" | "image" | "gif";
export type BRollPosition =
  | "full"
  | "overlay-tl"
  | "overlay-tr"
  | "overlay-bl"
  | "overlay-br"
  | "pip-left"
  | "pip-right"
  | "lower-third";
export type BRollSource = "pexels" | "pixabay" | "tenor" | "giphy" | "upload";

export interface BRoll {
  id: string;
  kind: BRollKind;
  url: string;
  thumbUrl?: string;
  position: BRollPosition;
  startFrame: number;
  durationFrames: number;
  opacity?: number;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
  filter?: ImageFilter;
  sourceLineIdx?: number;
  source: BRollSource;
  sourceId?: string;
  attribution?: string;
  width?: number;
  height?: number;
}

export interface ImageFilter {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  blur?: number;
  grayscale?: number;
}

export interface StylePreset {
  id: string;
  name: string;
  description: string;
  accentColors: string[];
  textColor: string;
  emphasisColor: string;
  backgroundColor: string;
  vignette: number;
  fontFamily?: string;
  transition: "beat_flash" | "beat_flash_colored" | "none";
  zoomPunch: number;
  shakeIntensity: number;
  captionStyle?: "words" | "line" | "off";
}

export interface SceneBackground {
  color: string;
  graphic?: string;
  graphicY?: number;
  graphicOpacity?: number;
  vignette?: number;
  /** Full-bleed background image (covers the frame). */
  imageUrl?: string;
  /** If true, apply a slow Ken Burns zoom to the imageUrl. */
  kenBurns?: boolean;
  imageOpacity?: number;
  /** Full-bleed background video. Used by commentary/movie-review/gaming. */
  videoUrl?: string;
  videoStartSec?: number;
  videoMuted?: boolean;
}

export interface CaptionWord {
  word: string;
  startMs: number;
  endMs: number;
}

export interface Voiceover {
  audioUrl: string;
  audioDurationSec: number;
  provider: "openai" | "elevenlabs";
  voice: string;
  text: string;
  captions?: CaptionWord[];
  /** Optional hint for which speaker this line belongs to. Useful for multi-voice workflows like comic-dub. */
  speaker?: string;
}

export interface Scene {
  id: string;
  type: "character_text" | "text_only" | "big_number" | "character_pop";
  duration: number;

  voiceover?: Voiceover;
  showCaptions?: boolean;

  characterId?: string;
  characterX?: number;
  characterY?: number;
  characterScale?: number;
  enterFrom?: EnterDirection;
  flipCharacter?: boolean;

  text?: string;
  textSize?: number;
  textColor?: string;
  textY?: number;

  emphasisText?: string;
  emphasisSize?: number;
  emphasisColor?: string;
  emphasisGlow?: string;

  subtitleText?: string;
  subtitleColor?: string;

  numberFrom?: number;
  numberTo?: number;
  numberSuffix?: string;
  numberColor?: string;

  sfxId?: string;
  /** AI-generated SFX clip URL — overrides sfxId when present. */
  sceneSfxUrl?: string;
  transition?: "beat_flash" | "beat_flash_colored" | "none";
  transitionColor?: string;
  shakeIntensity?: number;
  zoomPunch?: number;

  broll?: BRoll[];

  background: SceneBackground;
}

export type Orientation = "landscape" | "portrait";

export type RenderPresetId = "1080p" | "4k" | "720p" | "gif" | "webm";

export interface RenderPreset {
  id: RenderPresetId;
  label: string;
  description: string;
  scale: number; // relative to canvas width/height (1080p is the default canvas)
  codec: "h264" | "vp9" | "gif";
  extension: "mp4" | "webm" | "gif";
}

export const RENDER_PRESETS: RenderPreset[] = [
  { id: "1080p", label: "1080p MP4", description: "YouTube / default", scale: 1, codec: "h264", extension: "mp4" },
  { id: "4k", label: "4K MP4", description: "2× upscale, slower", scale: 2, codec: "h264", extension: "mp4" },
  { id: "720p", label: "720p MP4", description: "Fast / preview", scale: 2 / 3, codec: "h264", extension: "mp4" },
  { id: "webm", label: "WebM", description: "Web-native, smaller", scale: 1, codec: "vp9", extension: "webm" },
  { id: "gif", label: "GIF", description: "Silent loop", scale: 0.5, codec: "gif", extension: "gif" },
];

export function getRenderPreset(id: RenderPresetId): RenderPreset {
  return RENDER_PRESETS.find((p) => p.id === id) ?? RENDER_PRESETS[0];
}

export type CaptionPosition = "auto" | "top" | "center" | "bottom";

export interface CaptionStyle {
  fontSize: number;
  color: string;
  strokeColor: string;
  position: CaptionPosition;
  maxWordsPerChunk: number;
  uppercase: boolean;
  /** If set, highlight one word per chunk in this color for emphasis. */
  highlightColor?: string;
}

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontSize: 64,
  color: "#ffffff",
  strokeColor: "#000000",
  position: "auto",
  maxWordsPerChunk: 3,
  uppercase: true,
};

export interface MusicBed {
  url: string;
  name: string;
  volume: number; // 0..1 when no voiceover
  duckedVolume: number; // 0..1 under voiceover
}

export interface StylePack {
  accentColors: string[];
  textColor?: string;
  emphasisColor: string;
  backgroundColor: string;
  vignette?: number;
  transition?: "beat_flash" | "beat_flash_colored" | "none";
  zoomPunch?: number;
  shakeIntensity?: number;
  captionStyle?: Partial<CaptionStyle>;
}

export interface Project {
  id: string;
  name: string;
  script: string;
  scenes: Scene[];
  fps: number;
  width: number;
  height: number;
  music?: MusicBed;
  captionStyle?: CaptionStyle;
  stylePack?: StylePack;
  /** Which workflow this project belongs to. Default: "blank". */
  workflowId?: string;
  /** Per-project workflow slot values (keyed by slot id). */
  workflowInputs?: Record<string, unknown>;
  /**
   * Optional user-written system prompt. Appended to the agent's built-in
   * prompt so the user can steer the conversation without a template.
   */
  systemPrompt?: string;
  /**
   * Agent's video-production task list. Modeled on Claude Code's TodoWrite —
   * the agent plans the work, marks tasks in_progress/completed, and the
   * route refuses to let it terminate while items are open.
   */
  taskList?: VideoTask[];
}

export interface VideoTask {
  id: string;
  title: string;
  status: "pending" | "in_progress" | "completed";
  notes?: string;
}

export function getOrientation(p: { width: number; height: number }): Orientation {
  return p.height > p.width ? "portrait" : "landscape";
}

export const DIMENSIONS: Record<Orientation, { width: number; height: number }> = {
  landscape: { width: 1920, height: 1080 },
  portrait: { width: 1080, height: 1920 },
};

export const DEFAULT_BG: SceneBackground = {
  color: "#0a0a0a",
  vignette: 0.5,
};

export function createId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function sceneDurationFrames(scene: Scene, fps: number): number {
  return Math.round(scene.duration * fps);
}

export function totalDurationFrames(scenes: Scene[], fps: number): number {
  return scenes.reduce((sum, s) => sum + sceneDurationFrames(s, fps), 0);
}

export function totalDurationSeconds(scenes: Scene[]): number {
  return scenes.reduce((sum, s) => sum + s.duration, 0);
}
