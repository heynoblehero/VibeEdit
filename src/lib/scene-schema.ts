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
  /** Px corner radius. Falls back to 16 for non-full positions, 0 for full. */
  borderRadius?: number;
  /** Border color (hex / css). When set, renders the border at borderWidth px. */
  borderColor?: string;
  /** Border width in px (1-24). Renders only if borderColor is also set. */
  borderWidth?: number;
  /**
   * Drop-shadow preset. "none" = no shadow, "soft" = subtle 12px blur,
   * "hard" = sharp dark drop, "glow" = colored halo via boxShadow. The
   * legacy "0 12px 40px rgba(0,0,0,0.55)" shadow is "soft".
   */
  shadow?: "none" | "soft" | "hard" | "glow";
  /** When shadow="glow", the halo color (hex). Defaults to white. */
  shadowColor?: string;
  /** When true, the b-roll is skipped from the render but kept in the
   *  timeline. Toggled via the eye icon in the scene list. */
  hidden?: boolean;
  /**
   * CSS mix-blend-mode applied directly to this clip — typically
   * "screen" for black-background overlays so the dark pixels drop
   * out (Issac-pack-style "Breaking Glass" / "Neon Flash" effects).
   * Per-broll instead of per-track so a single overlay clip can flip
   * blend without touching its sibling tracks.
   */
  mixBlendMode?: string;
}

export interface ImageFilter {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  blur?: number;
  grayscale?: number;
}

/**
 * Frame-level drop shadow. Renders as CSS box-shadow on the scene
 * wrapper. Default omitted = no shadow (matches today's behaviour).
 */
export interface FrameShadow {
  color: string;
  blur: number;
  x: number;
  y: number;
  opacity?: number;
}

/**
 * A vector shape painted on top of the background but below text /
 * character / broll. Position and size are in canvas coordinates
 * (0,0 top-left, project.width × project.height). For "line", x/y is
 * the start, w/h becomes the end offset.
 */
export type SceneShapeKind = "rect" | "circle" | "line" | "triangle";

export interface SceneShape {
  id: string;
  kind: SceneShapeKind;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  color?: string;
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;
  /** Px corner radius for rect. Ignored on other kinds. */
  borderRadius?: number;
  /** When true, the shape is skipped from the render. */
  hidden?: boolean;
}

/**
 * Per-text-slot styling. Optional everywhere — when a field is unset, the
 * renderer falls back to slot defaults (system font, weight 800, no
 * italic, no stroke, etc.). Lets users dial in spacing, weight, glow,
 * stroke, etc. without 30 flat fields multiplying across the 3 slots.
 */
export interface TextStyle {
  weight?: number;
  italic?: boolean;
  underline?: boolean;
  letterSpacing?: number;
  lineHeight?: number;
  transform?: "uppercase" | "lowercase" | "capitalize" | "none";
  fontFamily?: "system" | "serif" | "mono" | "display";
  strokeColor?: string;
  strokeWidth?: number;
  glowColor?: string;
  opacity?: number;
  bgColor?: string;
  bgPadding?: number;
  bgRadius?: number;
}

/**
 * Entrance / exit motion kinds available on a TextItem. Subset of
 * MotionClipKind — the kinds that read as "appear" or "leave".
 */
export type TextItemEnterKind =
  | "fade_in"
  | "slide_in_left"
  | "slide_in_right"
  | "slide_in_top"
  | "slide_in_bottom"
  | "zoom_in"
  | "pulse";

export type TextItemExitKind =
  | "fade_out"
  | "slide_out_left"
  | "slide_out_right"
  | "slide_out_top"
  | "slide_out_bottom"
  | "zoom_out";

/** Per-item keyframe property names. Item-local frame (0 = item start). */
export type TextItemKeyframeProperty =
  | "itemOpacity"
  | "itemX"
  | "itemY"
  | "itemScale"
  | "itemRotation";

/**
 * A free-positioned text item painted on top of the scene. Distinct
 * from the legacy text/emphasisText/subtitleText slots — those are
 * scene-level properties baked into PunchText with motion presets,
 * whereas a TextItem is a layer the user adds, drags, and styles
 * independently. New "+ Add Text" flow creates these.
 */
export interface TextItem {
  id: string;
  content: string;
  /** Top-left in canvas coords (0,0 at top-left of project.width × project.height). */
  x: number;
  y: number;
  /** Optional max width for wrapping. When omitted, text auto-sizes to its content. */
  w?: number;
  fontSize: number;
  color: string;
  align?: "left" | "center" | "right";
  rotation?: number;
  fontFamily?: "system" | "serif" | "mono" | "display";
  weight?: number;
  italic?: boolean;
  underline?: boolean;
  letterSpacing?: number;
  lineHeight?: number;
  transform?: "uppercase" | "lowercase" | "capitalize" | "none";
  strokeColor?: string;
  strokeWidth?: number;
  glowColor?: string;
  opacity?: number;
  /** Background pill behind the text (padding + rounded corners). */
  bgColor?: string;
  bgPadding?: number;
  bgRadius?: number;

  /**
   * Item's window on the scene timeline. Frames are scene-local
   * (0 = scene start). Defaults: 0 → end of scene. Outside this
   * window the item is not painted.
   */
  startFrame?: number;
  durationFrames?: number;

  /** Frame-style outline + box drop-shadow on the item's bounding box. */
  outlineColor?: string;
  outlineWidth?: number;
  shadow?: FrameShadow;

  /**
   * Paired entrance + exit motion + optional fade frames. Compiled
   * into synthetic motion clips at render time so the resolver
   * handles them with the same logic as motionClips.
   */
  enterMotion?: TextItemEnterKind;
  exitMotion?: TextItemExitKind;
  enterDurationFrames?: number;
  exitDurationFrames?: number;
  fadeInFrames?: number;
  fadeOutFrames?: number;

  /**
   * Lightweight named motion. Same surface as Scene.emphasisMotion;
   * compiles to keyframes at render time via motion-presets.ts.
   * Maps to a single transform component (tx / ty / scale / rotation /
   * opacity) based on the preset's semantics.
   */
  motion?: MotionPreset;

  /**
   * Free motion clips on the item itself. The clip's `element` field
   * is ignored — these always resolve against this item.
   */
  motionClips?: MotionClip[];

  /** Per-property keyframes. Frames are item-local (0 = item start). */
  keyframes?: Partial<Record<TextItemKeyframeProperty, Keyframe[]>>;

  /** When true, the text item is skipped from the render. */
  hidden?: boolean;
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
  /** Px corner radius applied to the bg media wrapper. 0 = sharp,
   *  larger = softer pill/card corners. Visible only when imageUrl
   *  or videoUrl is set; for color-only bgs it's a no-op. */
  borderRadius?: number;
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
  /**
   * Manual color-grading sliders. Compose with the named colorGrade
   * preset (preset applied first, sliders multiply on top).
   *  - brightness: 1.0 = neutral, 0.5 = half, 1.5 = +50%.
   *  - contrast: 1.0 = neutral.
   *  - saturation: 1.0 = neutral, 0 = grayscale.
   *  - temperature: -1..1 → cool ↔ warm, maps to ±20° hue-rotate.
   */
  brightness?: number;
  contrast?: number;
  saturation?: number;
  temperature?: number;
  imageOpacity?: number;
  /**
   * How the bg media should be sized inside the frame.
   * Always "contain" — fit fully inside the frame (may letterbox).
   * "cover" is no longer supported; the renderer ignores the stored
   * value and forces contain so re-aiming a 16:9 clip into a 9:16
   * project never crops critical content out of frame.
   */
  objectFit?: "contain";
  /**
   * 9-position alignment grid OR a custom "x% y%" string. Defaults to
   * "center". Affects how the bg media is anchored inside the frame
   * once objectFit is applied. Same semantics as CSS object-position.
   */
  objectPosition?:
    | "center"
    | "top"
    | "bottom"
    | "left"
    | "right"
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | string;
  /** Mirror the bg image/video horizontally. */
  flipH?: boolean;
  /** Mirror the bg image/video vertically. */
  flipV?: boolean;
  /** Rotate bg image/video by 90 / 180 / 270 degrees. */
  rotate?: 0 | 90 | 180 | 270;
  /**
   * Direct user-controlled scale for the bg image. 1 = full frame, 0.5
   * = half size centered, 1.5 = zoom-crop. Stacks ON TOP of cameraMove
   * preset transforms — use this for static "shrink the image to 30%"
   * adjustments without losing animation. Same for videoScale below.
   */
  imageScale?: number;
  /** Pixel offset of the bg image from frame center. -1080 to 1080. */
  imageOffsetX?: number;
  imageOffsetY?: number;
  /**
   * Explicit pixel size for the bg image. When set, the image renders in
   * a centered px-sized box instead of full-frame. imageScale still
   * multiplies on top, so users can stack a fine zoom on a specific size.
   * Either dimension can be set independently; the other defaults to
   * full-frame for that axis.
   */
  imageWidthPx?: number;
  imageHeightPx?: number;
  /**
   * Non-destructive crop on the bg image. All four fields are normalized
   * 0–1 against the original image (x,y = top-left corner; w,h = size of
   * the visible sub-rect). Renderer expands the cropped portion to fill
   * the bg viewport, preserving every other transform (scale/offset/cam).
   * Omit to render the full image. Stored — never mutates the source.
   */
  imageCrop?: { x: number; y: number; w: number; h: number };
  /**
   * URL of the original image before in-browser background removal.
   * Set when the user runs "Remove BG" on imageUrl, so a single undo
   * can restore. Cleared once the user re-uploads or removes the bg
   * image entirely.
   */
  imageUrlOriginal?: string;
  videoScale?: number;
  videoOffsetX?: number;
  videoOffsetY?: number;
  /** Same as imageWidthPx / imageHeightPx, for the bg video. */
  videoWidthPx?: number;
  videoHeightPx?: number;
  /** Same shape as imageCrop, but for the bg video. */
  videoCrop?: { x: number; y: number; w: number; h: number };
  /** Full-bleed background video. Used by commentary/movie-review/gaming. */
  videoUrl?: string;
  videoStartSec?: number;
  videoMuted?: boolean;
  /** Source-time end (sec) for the bg video. Trims any source past this
   *  point — combined with videoStartSec gives the in/out window. */
  videoEndSec?: number;
  /** Playback rate for the bg video. 1 = normal, 0.5 = slow-mo, 2 = fast.
   *  Range 0.25 – 4. Applied during render via OffthreadVideo. */
  videoPlaybackRate?: number;
  /** When the trimmed clip is shorter than the scene, loop it. */
  videoLoop?: boolean;
  /**
   * Chroma-key the background image/video — pixels close to `color` are
   * removed (replaced with transparency). Implemented via SVG
   * feColorMatrix so it works at preview AND in Remotion frame-render.
   *  - color: target color in #rrggbb (default "#00ff00" greenscreen).
   *  - tolerance: 0–1, half-width of the keyed-out band. 0.4 ≈ standard.
   *  - softness: 0–1, how soft the edge falloff is. 0 = hard, 1 = feather.
   */
  chromaKey?: {
    color: string;
    tolerance: number;
    softness: number;
  };
  /**
   * Luma-key the background — pixels darker than `threshold` (0–1) are
   * removed. Inverts when `invert` is true (cull bright pixels instead).
   * Useful for compositing dark logos onto bright frames.
   */
  lumaKey?: {
    threshold: number;
    softness: number;
    invert?: boolean;
  };
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
  /** Absolute seconds into the source file to start playback from.
   *  Maps directly to Remotion Audio.startFrom (frames). */
  trimStartSec?: number;
  /** Absolute seconds into the source file at which to stop playback.
   *  Maps to Remotion Audio.endAt (frames). */
  trimEndSec?: number;
  /** Fade-in / fade-out in seconds, applied via volume envelope. */
  fadeInSec?: number;
  fadeOutSec?: number;
  /** Per-clip gain multiplier (0..2, 1 = unity). Stacks with the
   *  scene-level audioGain and the project audioMix.voice. */
  gain?: number;
}

export interface Scene {
  id: string;
  type: "character_text" | "text_only" | "big_number" | "character_pop" | "montage" | "split" | "stat" | "bullet_list" | "quote" | "bar_chart" | "three_text" | "three_card" | "three_particles";
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
   * 3D scene props (used by three_text / three_card / three_particles).
   * Each variant treats the fields a little differently — the renderer
   * reads what it needs.
   */
  threeText?: string;
  /** Image URL displayed on a rotating card (three_card). */
  threeCardImageUrl?: string;
  /** Hex accent color for the 3D scene's lighting / particles. */
  threeAccentColor?: string;
  /** Particle count for three_particles. Default 200. */
  threeParticleCount?: number;
  /**
   * Tag the scene with its planned shot type. Lets the qualityScore +
   * gate count distinct shotTypes per project rather than guessing.
   */
  shotType?: ShotType;
  /** Tag the scene with its planned act (1/2/3) for three-act enforcement. */
  act?: 1 | 2 | 3;
  /**
   * If set, this scene's image generation passes the subject's reference
   * image into an identity-preserving model so the same face/look appears.
   * Resolved against project.subjects[].
   */
  subjectId?: string;
  /**
   * Speed warp. 1.0 = normal. 0.5 = half-speed (slow-mo). 2.0 = 2× fast.
   * Range 0.25 → 4.0. Renderer compresses/expands the visual sequence
   * accordingly; voiceover speed defaults to match unless audioFollowsSpeed
   * is explicitly false (preserves real time even when visuals warp).
   */
  /**
   * If true, the scene is hidden from the rendered output AND skipped
   * in the live preview. Useful for "park" scenes you're keeping for
   * later but don't want in the next export. Distinct from delete —
   * the scene stays in the timeline and is visually dimmed.
   */
  muted?: boolean;
  /**
   * One of 6 colour tags shown as a left bar on the timeline block.
   * Helps the user quickly group / triage scenes (red = needs work,
   * green = locked, etc.). No render-side semantics — purely UI.
   */
  colorTag?: "red" | "amber" | "green" | "blue" | "purple" | "pink";
  /** Optional short label shown on the timeline block (overrides 'Scene N'). */
  label?: string;
  /**
   * Visual fade-in length on scene entry (frames). Defaults to 4 (the
   * existing 'soft cut' baked into SceneRenderer). 0 = hard cut.
   */
  fadeInFrames?: number;
  /** Visual fade-out length on scene exit (frames). 0 = no fade. */
  fadeOutFrames?: number;
  /**
   * Locked scenes are read-only on the timeline: trim handle hidden,
   * drag-to-reorder ignored, delete blocked. Lets users 'finalize' a
   * scene so accidental edits don't sneak in. Lock icon shows on the
   * block; context menu still has 'Unlock'.
   */
  locked?: boolean;
  speedFactor?: number;
  /**
   * Per-scene audio level. 0 = mute, 1.0 = unity, 2.0 = +6 dB. Multiplies
   * voiceover + sfx volume in the composition. Music stays on its own
   * project-level master.
   */
  audioGain?: number;
  /**
   * Per-element motion preset names. Each renders by expanding to a
   * Keyframe[] from lib/motion-presets.ts and feeding the renderer.
   * Keyframes set explicitly via `keyframes` override these.
   */
  textMotion?: MotionPreset;
  emphasisMotion?: MotionPreset;
  characterMotion?: MotionPreset;
  bgMotion?: MotionPreset;
  /**
   * Explicit keyframes per animatable property. Overrides any motion
   * preset for the same property. Renderer interpolates per frame.
   */
  keyframes?: Partial<Record<KeyframeProperty, Keyframe[]>>;

  /**
   * High-level motion clips — self-contained "slide_in_right for
   * 60 frames starting at frame 0" segments per element. Stack alongside
   * keyframes / motion presets; the renderer accumulates all active
   * clips at the current frame. Preferred surface for the agent: one
   * tool call per phase instead of choreographing keyframes by hand.
   */
  motionClips?: MotionClip[];

  voiceover?: Voiceover;
  showCaptions?: boolean;

  characterId?: string;
  /**
   * Direct character image URL (uploaded asset or external). Used when
   * the user dragged an image in and wants it rendered as a character
   * without registering a Subject first. characterId takes precedence
   * when both are set; characterScale / characterX / characterY apply
   * to either source.
   */
  characterUrl?: string;
  characterX?: number;
  characterY?: number;
  characterScale?: number;
  enterFrom?: EnterDirection;
  flipCharacter?: boolean;

  text?: string;
  textSize?: number;
  textColor?: string;
  textY?: number;
  /** Horizontal alignment for `text`. Defaults to "center". */
  textAlign?: "left" | "center" | "right";

  emphasisText?: string;
  emphasisSize?: number;
  emphasisColor?: string;
  emphasisGlow?: string;
  /** Horizontal alignment for `emphasisText`. Defaults to "center". */
  emphasisAlign?: "left" | "center" | "right";

  subtitleText?: string;
  subtitleColor?: string;
  /** Horizontal alignment for `subtitleText`. Defaults to "center". */
  subtitleAlign?: "left" | "center" | "right";

  /** Optional rich styling for each text slot. */
  textStyle?: TextStyle;
  emphasisStyle?: TextStyle;
  subtitleStyle?: TextStyle;

  /** Frame outline (border around the whole scene). */
  outlineColor?: string;
  outlineWidth?: number;
  /** Frame drop shadow. */
  shadow?: FrameShadow;
  /** Vector shapes layered between bg and text/broll. */
  shapes?: SceneShape[];
  /** Free-positioned text items. Independent of the emphasis/text/subtitle slots. */
  textItems?: TextItem[];

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

export type RenderPresetId =
  | "1080p"
  | "4k"
  | "720p"
  | "540p_internal"
  | "gif"
  | "webm"
  | "tiktok"
  | "reels"
  | "yt_shorts"
  | "yt_16x9";

export interface RenderPreset {
  id: RenderPresetId;
  label: string;
  description: string;
  scale: number; // relative to canvas width/height (1080p is the default canvas)
  codec: "h264" | "vp9" | "gif";
  extension: "mp4" | "webm" | "gif";
  /**
   * Platform-tuned video bitrate hint, in kbps. The render route can
   * pass this through to the underlying ffmpeg call. Undefined = use
   * the default for the codec.
   */
  videoBitrateKbps?: number;
  /** Audio bitrate hint, in kbps. Defaults to 192 elsewhere. */
  audioBitrateKbps?: number;
  /**
   * Optional expected aspect ratio. UI uses this to warn the user when
   * their project canvas doesn't match the preset (e.g. trying to
   * export a 16:9 project with the TikTok preset). Renderer doesn't
   * crop — just emits the warning.
   */
  expectedRatio?: "9:16" | "16:9" | "1:1";
}

export const RENDER_PRESETS: RenderPreset[] = [
  // Generic / quality-tier presets.
  { id: "1080p", label: "1080p MP4", description: "YouTube / default", scale: 1, codec: "h264", extension: "mp4" },
  { id: "4k", label: "4K MP4", description: "2× upscale, slower", scale: 2, codec: "h264", extension: "mp4" },
  { id: "720p", label: "720p MP4", description: "Fast / preview", scale: 2 / 3, codec: "h264", extension: "mp4" },
  // Internal-only — used by the AI critic loop to render fast 540p
  // previews for vision-model evaluation. Hidden from the user-facing
  // preset dropdown via Render UI filtering.
  { id: "540p_internal", label: "540p (internal)", description: "Critic-loop only", scale: 0.5, codec: "h264", extension: "mp4" },
  { id: "webm", label: "WebM", description: "Web-native, smaller", scale: 1, codec: "vp9", extension: "webm" },
  { id: "gif", label: "GIF", description: "Silent loop", scale: 0.5, codec: "gif", extension: "gif" },
  // Platform-tuned presets. Bitrates land on each platform's preferred
  // input range so re-encode at the platform side keeps quality.
  {
    id: "tiktok",
    label: "TikTok",
    description: "9:16 · H.264 · 8 Mbps · 192k AAC",
    scale: 1,
    codec: "h264",
    extension: "mp4",
    videoBitrateKbps: 8000,
    audioBitrateKbps: 192,
    expectedRatio: "9:16",
  },
  {
    id: "reels",
    label: "Instagram Reels",
    description: "9:16 · H.264 · 5 Mbps · 192k AAC",
    scale: 1,
    codec: "h264",
    extension: "mp4",
    videoBitrateKbps: 5000,
    audioBitrateKbps: 192,
    expectedRatio: "9:16",
  },
  {
    id: "yt_shorts",
    label: "YouTube Shorts",
    description: "9:16 · H.264 · 12 Mbps · 192k AAC",
    scale: 1,
    codec: "h264",
    extension: "mp4",
    videoBitrateKbps: 12000,
    audioBitrateKbps: 192,
    expectedRatio: "9:16",
  },
  {
    id: "yt_16x9",
    label: "YouTube 16:9",
    description: "16:9 · H.264 · 12 Mbps · 192k AAC",
    scale: 1,
    codec: "h264",
    extension: "mp4",
    videoBitrateKbps: 12000,
    audioBitrateKbps: 192,
    expectedRatio: "16:9",
  },
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

/**
 * Free-floating SFX clip placed directly on the project timeline (not
 * bound to a scene). Great for "drop a whoosh halfway through scene 2"
 * use cases where the per-scene sfxId/sceneSfxUrl model is too coarse.
 * Renderer treats these like extra audio rails on top of the scene
 * voiceover/SFX rails.
 */
export interface AudioSfxClip {
  id: string;
  url: string;
  name: string;
  /** Absolute frame on the project timeline. */
  startFrame: number;
  /** How long the clip plays for (in frames). The renderer wraps the
   *  Audio in a Sequence of this length. */
  durationFrames: number;
  trimStartSec?: number;
  trimEndSec?: number;
  fadeInSec?: number;
  fadeOutSec?: number;
  /** 0..2 multiplier; stacks with project.audioMix.sfx. */
  gain?: number;
}

export interface MusicBed {
  url: string;
  name: string;
  volume: number; // 0..1 when no voiceover
  duckedVolume: number; // 0..1 under voiceover
  /** Trim into the source file (seconds). */
  trimStartSec?: number;
  /** Hard cap from the trimmed start (seconds). */
  trimEndSec?: number;
  /** Fade-in / fade-out applied at clip edges. */
  fadeInSec?: number;
  fadeOutSec?: number;
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
  /** Wall-clock millis of the most recent mutation. Used by the
   *  dashboard to sort projects by recency. Optional for backwards
   *  compat with persisted projects from before this field existed. */
  updatedAt?: number;
  /** Wall-clock millis when the user moved the project to trash.
   *  When set, dashboard hides the project unless the Trash view is
   *  active. Auto-purged after 30 days. */
  deletedAt?: number;
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
  /** Recurring subjects (people / products / characters) reused across scenes. */
  subjects?: Subject[];
  /**
   * Cuts between scenes. Keyed by scene-id pair so reordering doesn't
   * break the link. When a pair has no entry, renderer falls back to
   * `scene.transition` (legacy compat).
   */
  cuts?: Cut[];
  /**
   * Per-project upload bin. Files dropped via the Uploads panel land
   * here; the agent's analyzeUpload / routeAsset tools can read this
   * list to know what's available.
   */
  uploads?: ProjectUpload[];
  /** Publish-time metadata generated by generatePublishMetadata. */
  metadata?: {
    titles?: string[];
    caption?: string;
    description?: string;
    hashtags?: string[];
  };
  /**
   * Locked palette — set by applyPaletteToProject. While this is set,
   * the agent's updateScene calls that change text/emphasis/subtitle/
   * number colors must use one of these hex values, otherwise the
   * route rejects them. Keeps the project visually unified once a
   * palette decision has been made.
   */
  paletteLock?: {
    colors: string[];
    appliedAt: number;
  };
  /**
   * Rolling log of agent activity across turns. Each entry is one
   * concrete event: assistant text, a tool call result, or a failed
   * gate. Capped to the last ~200 entries by the route. Lets the user
   * /replay a session, lets eval inspect the trace, and lets the agent
   * itself reference what it did last turn instead of guessing.
   */
  agentLog?: AgentLogEntry[];
  /**
   * Project-wide audio mix. Each gain is a 0–2 multiplier (default 1)
   * applied on top of any per-scene audioGain and the renderer's bed
   * volumes. Lets the user dim music under VO, push sfx, etc. without
   * touching every scene.
   */
  audioMix?: {
    music?: number;
    voice?: number;
    sfx?: number;
  };
  /** Free-floating SFX clips dropped directly on the project timeline.
   *  Renderer ignores when absent for backwards compat. */
  sfxClips?: AudioSfxClip[];
  /**
   * User-placed timeline markers. Render as vertical bars in the
   * Timeline ruler. M key while editing sets a marker at the
   * current playhead frame. No render-side semantics — purely UX.
   */
  markers?: Array<{
    id: string;
    frame: number;
    label?: string;
    color?: "red" | "amber" | "green" | "blue" | "purple" | "pink";
  }>;
  /**
   * Multi-track timeline. When undefined, the project renders as a
   * single sequential track (legacy behaviour) using project.scenes
   * verbatim. When defined, project.tracks ordered top-to-bottom is
   * the visual stack: track[0] is the bottom-most "main" video, each
   * subsequent track layers on top with optional opacity / blendMode.
   * Each track's scenes are SEQUENTIAL on that track, starting at
   * startOffsetSec on the global timeline. project.scenes is still
   * the source of truth for scene definitions; tracks reference scene
   * ids via sceneIds.
   */
  tracks?: Track[];
}

/* ============================================================
 * Sprint 15: Multi-track timeline (M1-M4)
 * ============================================================ */

export type TrackKind =
  /** Bottom-most full-frame video. The legacy behaviour. */
  | "video"
  /** Layered on top of video; honours opacity + blendMode. */
  | "overlay"
  /** Audio-only track — scene visuals are skipped, only voiceover/sfx mix in. */
  | "audio";

export interface Track {
  id: string;
  kind: TrackKind;
  /** User-visible name shown in the track header (e.g. "V1", "Music"). */
  name: string;
  /** Ordered scene ids on this track. Scenes play back-to-back. */
  sceneIds: string[];
  /** Skip the entire track on render (visual + audio). */
  muted?: boolean;
  /** Block edits + drags affecting this track's scene list. */
  locked?: boolean;
  /** 0-1 alpha multiplier applied to the whole track (overlay only). */
  opacity?: number;
  /** CSS mix-blend-mode applied to the track (overlay only). */
  blendMode?:
    | "normal"
    | "multiply"
    | "screen"
    | "overlay"
    | "difference"
    | "lighten"
    | "darken";
  /**
   * When this track's first scene starts on the global timeline (s).
   * 0 = aligns with project start. Lets an overlay come in late.
   */
  startOffsetSec?: number;
}

/**
 * Migrate a legacy project (no tracks) to a default single-track
 * layout. Pure helper — does NOT mutate the project.
 */
export function defaultTracksFromScenes(scenes: Scene[]): Track[] {
  return [
    {
      id: `track-${Math.random().toString(36).slice(2, 8)}`,
      kind: "video",
      name: "V1",
      sceneIds: scenes.map((s) => s.id),
    },
  ];
}

/** Resolve a project to its rendered track list — back-compat aware. */
export function resolveTracks(project: Pick<Project, "scenes" | "tracks">): Track[] {
  if (project.tracks && project.tracks.length > 0) return project.tracks;
  return defaultTracksFromScenes(project.scenes);
}

/* ============================================================
 * Sprint 8: Cuts, Keyframes, Motion Presets, Easings
 * ============================================================ */

/** Named easing curves shared by Keyframes and Cuts. */
export type Easing =
  | "linear"
  | "ease_in"
  | "ease_out"
  | "ease_in_out"
  | "ease_in_back"
  | "ease_out_back"
  | "ease_in_out_back"
  | "spring"
  | "snappy"
  | "bouncy"
  /** Use the sibling `bezier` field as the curve. Set when the user
   *  drags the easing-curve graph handles. */
  | "custom";

/** Cut treatments at the boundary BETWEEN two scenes. */
export type CutKind =
  | "hard"
  | "beat_flash"
  | "beat_flash_colored"
  | "slide_left"
  | "slide_right"
  | "zoom_blur"
  | "fade"
  | "dip_to_black"
  | "dip_to_white"
  | "iris"
  | "clock_wipe"
  | "flip"
  | "wipe"
  | "jump_cut"
  | "smash_cut"
  | "whip_pan"
  | "glitch_cut"
  | "match_cut";

/**
 * A boundary between two scenes. Lives on `project.cuts` keyed by scene
 * id pair so reordering scenes doesn't break the link.
 *
 * audioLeadFrames > 0  → J-cut: incoming voiceover starts BEFORE the
 *                         visual cut by N frames.
 * audioTrailFrames > 0 → L-cut: outgoing voiceover continues AFTER the
 *                         visual cut for N frames.
 * Both default to 0 (synchronous cut).
 */
export interface Cut {
  id: string;
  fromSceneId: string;
  toSceneId: string;
  kind: CutKind;
  /** How long the transition spans, in frames. 0 for hard / instant. */
  durationFrames: number;
  easing?: Easing;
  /** Custom cubic-bezier control points [x1, y1, x2, y2] used when
   *  `easing === "custom"`. Drawn by dragging the easing graph handles. */
  bezier?: [number, number, number, number];
  /** For colored cuts (beat_flash_colored / dip_to_<color>). */
  color?: string;
  audioLeadFrames?: number;
  audioTrailFrames?: number;
}

/** Animatable scene-level properties. Tight whitelist for v1. */
export type KeyframeProperty =
  | "textY"
  | "textOpacity"
  | "textScale"
  | "emphasisY"
  | "emphasisOpacity"
  | "emphasisScale"
  | "characterY"
  | "characterScale"
  | "bgScale"
  | "bgOffsetX"
  | "bgOffsetY"
  | "bgRotation"
  | "overlayOpacity";

/**
 * One keyframe on a property's timeline. The renderer interpolates
 * between consecutive keyframes using the per-keyframe `easing`. Bezier
 * handles are reserved for the "pro mode" follow-up — present in the
 * schema so v1→pro is a UI-only change with no data migration.
 */
export interface Keyframe {
  /** Frame within the scene (0 = scene start). */
  frame: number;
  value: number;
  easing?: Easing;
  /** Custom cubic-bezier control points [x1, y1, x2, y2] for the
   *  segment leading INTO the next keyframe. Used when easing === "custom". */
  bezier?: [number, number, number, number];
  /** Pro-mode bezier control points. [t, value] in 0..1. Ignored in v1. */
  bezierIn?: [number, number];
  bezierOut?: [number, number];
}

/** Per-element motion preset names. Each maps to a Keyframe[] generator
 *  in lib/motion-presets.ts (added in commit 5.1). Keep this list
 *  aligned with that file. */
export type MotionPreset =
  | "none"
  | "drift_up"
  | "drift_down"
  | "pulse"
  | "shake"
  | "ken_burns_in"
  | "ken_burns_out"
  | "parallax_slow"
  | "parallax_fast"
  | "bounce_in"
  | "fade_in_out"
  | "wobble"
  | "slide_in_right"
  | "slide_in_left"
  | "slide_in_top"
  | "slide_in_bottom"
  | "slide_out_right"
  | "slide_out_left"
  | "slide_out_top"
  | "slide_out_bottom"
  | "flip_x_180"
  // Issac-pack ports — spring-flavoured entrances. bounce_pop_in is a
  // bigger overshoot than bounce_in (1.15 peak vs 1.0 settle); stagger
  // adds the per-item fade+scale curve that pairs with offset start
  // frames to cascade multiple elements.
  | "bounce_pop_in"
  | "stagger_fade_scale";

/**
 * Motion clip kinds — self-contained motion segments. Each runs from
 * `startFrame` for `durationFrames`, evaluated at progress t∈[0,1].
 * Multiple clips on the same element stack: translate sums, rotation
 * sums, scale multiplies, opacity multiplies.
 */
export type MotionClipKind =
  | "slide_in_right"
  | "slide_in_left"
  | "slide_in_top"
  | "slide_in_bottom"
  | "slide_out_right"
  | "slide_out_left"
  | "slide_out_top"
  | "slide_out_bottom"
  | "fade_in"
  | "fade_out"
  | "zoom_in"
  | "zoom_out"
  | "shake"
  | "wobble"
  | "pulse"
  | "flip_x_180"
  | "flip_y_180"
  | "spin_360";

/**
 * Element targets that motion clips can attach to.
 *  - bg / character / text / emphasis / subtitle: the singleton elements
 *    on every scene.
 *  - broll: per-id BRoll item (the clip's `targetId` selects which one).
 *  - scene: the whole scene wrapper — applies on top of every child.
 */
export type MotionClipElement =
  | "bg"
  | "character"
  | "text"
  | "emphasis"
  | "subtitle"
  | "broll"
  | "scene";

export interface MotionClip {
  id: string;
  element: MotionClipElement;
  kind: MotionClipKind;
  /** Frame the clip starts at (relative to scene start). */
  startFrame: number;
  /** How many frames the clip plays for. */
  durationFrames: number;
  /** Optional per-kind tuning. shake uses this as amplitude (px),
   *  wobble as degrees, pulse as scale jitter. */
  intensity?: number;
  /** Optional per-kind override for rotation amount (flip / spin). */
  degrees?: number;
  /**
   * For element="broll": the BRoll item's id this clip targets. When
   * omitted on a "broll" clip, the clip applies to every BRoll in the
   * scene (rare — usually you target one). Ignored for other elements.
   */
  targetId?: string;
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

/**
 * A recurring person / character / product that will appear in multiple
 * scenes. Registered once; every subsequent generation referencing this
 * subject's id passes the referenceImageUrl into an identity-preserving
 * model so the same face/look shows up consistently.
 */
export interface Subject {
  id: string;
  /** Human-readable name. "Sarah Chen", "the dog", "iPhone Pro Max". */
  name: string;
  /** Short physical description. Anchors prompts when reference fails. */
  description: string;
  /** URL of the canonical hero portrait — what every subsequent gen targets. */
  referenceImageUrl: string;
  /**
   * Type hint so we route to the right reference-conditioning model.
   * "person" → InstantID-style face matching.
   * "product" → image-to-image structural matching.
   * "other" → general subject matching.
   */
  kind: "person" | "product" | "other";
  createdAt: number;
  /** Number of scenes referencing this subject (cached). */
  usageCount?: number;
}

/**
 * Per-project upload reference. Files persist under
 * VIBEEDIT_DATA_DIR/uploads/ via /api/assets/upload (server side); the
 * project tracks its own list of uploaded files so the Uploads panel
 * can render a per-project bin even though the bytes live in a shared
 * directory.
 */
export interface ProjectUpload {
  id: string;
  name: string;
  url: string;
  /** MIME type from the upload, e.g. "image/png", "video/mp4". */
  type?: string;
  bytes?: number;
  uploadedAt: number;
}

export interface AgentLogEntry {
  /** Epoch ms when this event was logged. */
  ts: number;
  /** Conversation turn ordinal — increments per user message. */
  turn: number;
  kind: "text" | "tool_call" | "tool_result" | "gate";
  /** For tool_call / tool_result. */
  tool?: string;
  /** Compact arg/result preview. Args trimmed to ~200 chars per value. */
  preview?: string;
  /** ok flag for tool_result and gate. */
  ok?: boolean;
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

/**
 * Build a placeholder TextItem for new-scene creation flows. Sized for
 * the project's aspect (portrait scenes use a bigger font + lower y).
 * startFrame/durationFrames default to "full scene span" via the
 * resolver's fallback — no need to pass scene-specific frame counts.
 */
export function defaultPlaceholderTextItem(opts?: {
  content?: string;
  fontSize?: number;
  x?: number;
  y?: number;
  color?: string;
}): TextItem {
  return {
    id: `t-${createId().slice(0, 6)}`,
    content: opts?.content ?? "edit me",
    x: opts?.x ?? 200,
    y: opts?.y ?? 400,
    fontSize: opts?.fontSize ?? 96,
    color: opts?.color ?? "#ffffff",
    weight: 800,
    align: "left",
  };
}

/**
 * Convert legacy emphasisText / text / subtitleText fields into real
 * free-positioned TextItems and clear the legacy slots. Idempotent —
 * scenes with no legacy text return unchanged. Position approximates
 * the legacy stacked layout starting at scene.textY (or y=360 default)
 * with 110px increments per active slot.
 */
export function migrateLegacyTextToTextItems(scene: Scene): Scene {
  const has = scene.emphasisText || scene.text || scene.subtitleText;
  if (!has) return scene;
  const items: TextItem[] = [...(scene.textItems ?? [])];
  let yCursor = scene.textY ?? 360;
  if (scene.emphasisText) {
    items.push({
      id: `t-${createId().slice(0, 6)}`,
      content: scene.emphasisText,
      x: 200,
      y: yCursor,
      fontSize: scene.emphasisSize ?? 96,
      color: scene.emphasisColor ?? "#ffffff",
      glowColor: scene.emphasisGlow,
      align: scene.emphasisAlign ?? "left",
      weight: 800,
    });
    yCursor += (scene.emphasisSize ?? 96) * 1.2;
  }
  if (scene.text) {
    items.push({
      id: `t-${createId().slice(0, 6)}`,
      content: scene.text,
      x: 200,
      y: yCursor,
      fontSize: scene.textSize ?? 64,
      color: scene.textColor ?? "#cccccc",
      align: scene.textAlign ?? "left",
      weight: 600,
    });
    yCursor += (scene.textSize ?? 64) * 1.2;
  }
  if (scene.subtitleText) {
    items.push({
      id: `t-${createId().slice(0, 6)}`,
      content: scene.subtitleText,
      x: 200,
      y: yCursor,
      fontSize: 36,
      color: scene.subtitleColor ?? "#aaaaaa",
      align: scene.subtitleAlign ?? "left",
      weight: 500,
    });
  }
  return {
    ...scene,
    textItems: items,
    emphasisText: undefined,
    emphasisSize: undefined,
    emphasisColor: undefined,
    emphasisGlow: undefined,
    emphasisStyle: undefined,
    emphasisAlign: undefined,
    text: undefined,
    textSize: undefined,
    textColor: undefined,
    textY: undefined,
    textAlign: undefined,
    textStyle: undefined,
    subtitleText: undefined,
    subtitleColor: undefined,
    subtitleAlign: undefined,
    subtitleStyle: undefined,
  };
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

/**
 * Multi-track aware total. When tracks are defined, returns the latest
 * end frame across all tracks (track.startOffsetSec + sum of its
 * scenes' durations). Falls back to the legacy sum-of-scenes when
 * tracks is undefined / empty.
 */
export function projectTotalFrames(
  project: Pick<Project, "scenes" | "tracks" | "fps">,
): number {
  const fps = project.fps;
  if (!project.tracks || project.tracks.length === 0) {
    return totalDurationFrames(project.scenes, fps);
  }
  const sceneById = new Map<string, Scene>(
    project.scenes.map((s) => [s.id, s]),
  );
  let max = 0;
  for (const t of project.tracks) {
    if (t.muted) continue;
    const start = Math.round((t.startOffsetSec ?? 0) * fps);
    let frames = 0;
    for (const id of t.sceneIds) {
      const sc = sceneById.get(id);
      if (sc && !sc.muted) frames += sceneDurationFrames(sc, fps);
    }
    max = Math.max(max, start + frames);
  }
  return Math.max(1, max);
}

/**
 * Runtime whitelist of `Scene` field names. Used by the agent's
 * `updateScene` tool to reject patches that target non-existent fields —
 * those silently no-op'd before, leaving the agent reporting success
 * when the renderer changed nothing.
 *
 * Keep in sync with the `Scene` interface above. Adding a field to the
 * interface without adding it here will cause `updateScene` to reject it.
 */
export const VALID_SCENE_FIELDS: ReadonlySet<keyof Scene> = new Set<keyof Scene>([
  "type",
  "duration",
  "montageUrls",
  "splitLeftUrl",
  "splitRightUrl",
  "splitDivider",
  "statValue",
  "statLabel",
  "statColor",
  "bulletItems",
  "bulletColor",
  "quoteText",
  "quoteAttribution",
  "chartBars",
  "chartTitle",
  "chartUnit",
  "threeText",
  "threeCardImageUrl",
  "threeAccentColor",
  "threeParticleCount",
  "shotType",
  "act",
  "subjectId",
  "muted",
  "colorTag",
  "label",
  "fadeInFrames",
  "fadeOutFrames",
  "locked",
  "speedFactor",
  "audioGain",
  "textMotion",
  "emphasisMotion",
  "characterMotion",
  "bgMotion",
  "keyframes",
  "motionClips",
  "voiceover",
  "showCaptions",
  "characterId",
  "characterUrl",
  "characterX",
  "characterY",
  "characterScale",
  "enterFrom",
  "flipCharacter",
  "text",
  "textSize",
  "textColor",
  "textY",
  "textAlign",
  "emphasisText",
  "emphasisSize",
  "emphasisColor",
  "emphasisGlow",
  "emphasisAlign",
  "subtitleText",
  "subtitleColor",
  "subtitleAlign",
  "textStyle",
  "emphasisStyle",
  "subtitleStyle",
  "outlineColor",
  "outlineWidth",
  "shadow",
  "shapes",
  "textItems",
  "numberFrom",
  "numberTo",
  "numberSuffix",
  "numberColor",
  "sfxId",
  "sceneSfxUrl",
  "transition",
  "transitionColor",
  "shakeIntensity",
  "zoomPunch",
  "lensFlare",
  "lensFlareColor",
  "effects",
  "broll",
  "background",
]);

/** Same idea as VALID_SCENE_FIELDS, but for the nested SceneBackground. */
export const VALID_BACKGROUND_FIELDS: ReadonlySet<keyof SceneBackground> = new Set<keyof SceneBackground>([
  "color",
  "graphic",
  "graphicY",
  "graphicOpacity",
  "vignette",
  "borderRadius",
  "imageUrl",
  "kenBurns",
  "cameraMove",
  "colorGrade",
  "blur",
  "brightness",
  "contrast",
  "saturation",
  "temperature",
  "imageOpacity",
  "objectFit",
  "objectPosition",
  "flipH",
  "flipV",
  "rotate",
  "imageScale",
  "imageOffsetX",
  "imageOffsetY",
  "imageWidthPx",
  "imageHeightPx",
  "imageCrop",
  "imageUrlOriginal",
  "videoScale",
  "videoOffsetX",
  "videoOffsetY",
  "videoWidthPx",
  "videoHeightPx",
  "videoCrop",
  "videoUrl",
  "videoStartSec",
  "videoMuted",
  "videoEndSec",
  "videoPlaybackRate",
  "videoLoop",
  "chromaKey",
  "lumaKey",
]);
