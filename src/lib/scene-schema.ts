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
  /**
   * Camera move applied to the imageUrl. Overrides kenBurns when set.
   * "still" = no motion. "push_in" = scale 1→1.15 from center.
   * "pull_out" = scale 1.15→1. "pan_lr" / "pan_rl" = horizontal drift.
   * "tilt_up" / "tilt_down" = vertical drift. "ken_burns" = legacy diagonal.
   */
  cameraMove?: "still" | "push_in" | "pull_out" | "pan_lr" | "pan_rl" | "tilt_up" | "tilt_down" | "ken_burns";
  /**
   * LUT-style color grade applied to the bg image/video. Implemented as a
   * CSS filter chain so it works in Remotion + browser preview.
   *  - warm: golden hour, sepia-tinted; nostalgic / story / lifestyle
   *  - cool: blue-shifted, slightly desaturated; moody / tech / news
   *  - punchy: high contrast + saturation; commentary / hype / shorts
   *  - bw: monochrome; archival / serious / dramatic
   *  - neutral: untouched (default)
   */
  colorGrade?: "warm" | "cool" | "punchy" | "bw" | "neutral";
  /** Background blur in px (0-30). Use for focus-pull behind big text/numbers. */
  blur?: number;
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
  type: "character_text" | "text_only" | "big_number" | "character_pop" | "montage" | "split" | "stat" | "bullet_list" | "quote" | "bar_chart";
  duration: number;
  /**
   * For type=montage: 3-5 image URLs cut at ~0.5s each. Plays through them
   * in order, looping if the scene is longer than the strip.
   */
  montageUrls?: string[];
  /**
   * For type=split: left + right halves. Optional VS divider color.
   */
  splitLeftUrl?: string;
  splitRightUrl?: string;
  splitDivider?: string;
  /**
   * For type=stat: a hero number/percentage and a small label below.
   * e.g. statValue="73%", statLabel="of viewers drop in 3 seconds".
   */
  statValue?: string;
  statLabel?: string;
  statColor?: string;
  /** For type=bullet_list: lines that animate in with stagger + checkmark. */
  bulletItems?: string[];
  bulletColor?: string;
  /** For type=quote: pull-quote text + attribution. */
  quoteText?: string;
  quoteAttribution?: string;
  /** For type=bar_chart: 2-6 named bars that animate up. */
  chartBars?: Array<{ label: string; value: number; color?: string }>;
  chartTitle?: string;
  chartUnit?: string;
  /**
   * Tag the scene with its planned shot type. Lets the qualityScore +
   * gate count distinct shotTypes per project rather than guessing.
   */
  shotType?: ShotType;
  /** Tag the scene with its planned act (1/2/3) for three-act enforcement. */
  act?: 1 | 2 | 3;

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
  transition?: "beat_flash" | "beat_flash_colored" | "none" | "slide_left" | "slide_right" | "zoom_blur";
  transitionColor?: string;
  shakeIntensity?: number;
  zoomPunch?: number;
  /** When true, fire a soft lens-flare overlay on frame 0 of the scene. */
  lensFlare?: boolean;
  /** Hex color override for the lens flare. */
  lensFlareColor?: string;
  /**
   * Stack of overlay effects + framed graphics rendered on top of the
   * scene content. Order = render order. Each carries a startFrame so
   * the agent can sequence beats inside one scene without inventing more
   * scenes.
   */
  effects?: SceneEffect[];

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
  transition?: "beat_flash" | "beat_flash_colored" | "none" | "slide_left" | "slide_right" | "zoom_blur";
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
  /**
   * Markdown notes the agent accumulates from research/planning tools.
   * Persisted across turns so the agent doesn't re-search the same topic.
   */
  researchNotes?: string;
  /**
   * One-line narrative arc the agent commits to before generating media.
   * Format: "promise → stakes → reveal".
   */
  spine?: string;
  /**
   * Structured shot-list authored by planVideo tool, before any media.
   */
  shotList?: ShotPlan[];
  /**
   * Append-only log of asset decisions: which option won, why, what got tried.
   * autoresearch-style transparency for debugging "why does the video look like this?".
   */
  experiments?: ExperimentRecord[];
  /**
   * Latest computed quality score so the route can gate termination.
   */
  qualityScore?: number;
  /** Rolling window of recent scores so we can detect stalls. */
  qualityScoreHistory?: number[];
  /** Publish-time metadata generated by generatePublishMetadata. */
  metadata?: {
    titles?: string[];
    caption?: string;
    description?: string;
    hashtags?: string[];
  };
}

export type ShotType =
  | "wide"
  | "medium"
  | "closeup"
  | "ecu"
  | "ots"
  | "insert"
  | "montage"
  | "split";

export type CameraMove = "still" | "push_in" | "pull_out" | "pan_lr" | "pan_rl" | "tilt_up" | "tilt_down" | "ken_burns";

export type AssetSource = "user_upload" | "ai_generated" | "stock" | "research_url" | "library";

export interface ShotPlan {
  /** Index in the final timeline. */
  index: number;
  act: 1 | 2 | 3;
  beat: string;
  shotType: ShotType;
  cameraMove: CameraMove;
  durationHint: number;
  assetDecision: AssetSource;
  assetTarget?: string;
  text?: string;
}

export type SceneEffectKind =
  | "circle_ping"
  | "radial_pulse"
  | "scan_line"
  | "bar_wipe"
  | "corner_brackets"
  | "reveal_box"
  | "lower_third"
  | "typewriter"
  | "glitch"
  | "arrow"
  | "highlight"
  | "particles"
  | "progress_bar";

export interface SceneEffect {
  kind: SceneEffectKind;
  /** Start frame within the scene. Defaults to 0. */
  startFrame?: number;
  color?: string;
  /** Optional primary text payload (bar_wipe / lower_third). */
  text?: string;
  /** Optional secondary text (lower_third subtitle / role). */
  subtext?: string;
  /** Generic position fields — interpretation depends on `kind`. */
  x?: number | string;
  y?: number | string;
  w?: number | string;
  h?: number | string;
  /** For arrow: the tail (origin) position. x/y becomes the target. */
  fromX?: number | string;
  fromY?: number | string;
  /** For progress_bar: target fill fraction 0-1. Defaults to 1. */
  to?: number;
  /** Generic numeric param — size for circle_ping, thickness for boxes/brackets. */
  size?: number;
  thickness?: number;
}

export interface ExperimentRecord {
  ts: number;
  kind: "image" | "video" | "music" | "sfx" | "asset_route";
  decision: AssetSource;
  prompt?: string;
  url?: string;
  score?: number;
  kept: boolean;
  note?: string;
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
