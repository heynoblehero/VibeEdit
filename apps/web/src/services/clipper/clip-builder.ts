import type { ClipMoment, CaptionStyle } from "@/types/clipper";
import type {
  CreateVideoElement,
  CreateTextElement,
  TextBackground,
} from "@/types/timeline";
import type { TranscriptionSegment, CaptionChunk } from "@/types/transcription";
import { buildCaptionChunks } from "@/lib/transcription/caption";
import {
  DEFAULT_TRANSFORM,
  DEFAULT_OPACITY,
} from "@/constants/timeline-constants";
import { DEFAULT_TEXT_BACKGROUND } from "@/constants/text-constants";

/**
 * Resolves a vertical Y position (in px from center) for captions based
 * on the CaptionStyle position setting. These values assume a 1920-height
 * canvas and TextNode rendering that centers text at canvasCenter + transform.position.
 */
function getCaptionYOffset(position: CaptionStyle["position"]): number {
  switch (position) {
    case "top":
      return -700;
    case "center":
      return 0;
    case "bottom":
      return 700;
    default:
      return 700;
  }
}

/**
 * Filters transcript segments that overlap with the clip time range
 * and adjusts their start/end times to be relative to the clip start.
 */
function getSegmentsInRange(
  segments: TranscriptionSegment[],
  clipStart: number,
  clipEnd: number,
): TranscriptionSegment[] {
  const result: TranscriptionSegment[] = [];

  for (const seg of segments) {
    // Skip segments fully outside clip range
    if (seg.end <= clipStart || seg.start >= clipEnd) continue;

    // Clamp and make relative to clip start
    const relativeStart = Math.max(0, seg.start - clipStart);
    const relativeEnd = Math.min(clipEnd - clipStart, seg.end - clipStart);

    if (relativeEnd > relativeStart) {
      result.push({
        text: seg.text,
        start: relativeStart,
        end: relativeEnd,
      });
    }
  }

  return result;
}

/**
 * Builds a text element for a caption background style.
 */
function buildCaptionBackground(
  captionStyle: CaptionStyle,
): TextBackground {
  if (!captionStyle.backgroundColor || captionStyle.backgroundColor === "transparent") {
    return { ...DEFAULT_TEXT_BACKGROUND, enabled: false };
  }

  return {
    enabled: true,
    color: captionStyle.backgroundColor,
    cornerRadius: 12,
    paddingX: 30,
    paddingY: 20,
    offsetX: 0,
    offsetY: 0,
  };
}

/**
 * Builds a CreateTextElement from a CaptionChunk for use in the clip timeline.
 */
function buildCaptionTextElement(
  chunk: CaptionChunk,
  captionStyle: CaptionStyle,
  index: number,
): CreateTextElement {
  const yOffset = getCaptionYOffset(captionStyle.position);

  return {
    type: "text",
    name: `Caption ${index + 1}`,
    content: chunk.text,
    fontSize: captionStyle.fontSize,
    fontFamily: captionStyle.fontFamily,
    color: captionStyle.color,
    background: buildCaptionBackground(captionStyle),
    textAlign: "center",
    fontWeight: "bold",
    fontStyle: "normal",
    textDecoration: "none",
    letterSpacing: 0,
    lineHeight: 1.2,
    duration: chunk.duration,
    startTime: chunk.startTime,
    trimStart: 0,
    trimEnd: 0,
    transform: {
      scale: 1,
      position: { x: 0, y: yOffset },
      rotate: 0,
    },
    opacity: DEFAULT_OPACITY,
  };
}

/**
 * Builds a hook text overlay (big title text shown in the first 3 seconds).
 */
function buildHookTextElement(title: string): CreateTextElement {
  return {
    type: "text",
    name: "Hook Text",
    content: title,
    fontSize: 60,
    fontFamily: "Inter",
    color: "#ffffff",
    background: {
      enabled: true,
      color: "rgba(0, 0, 0, 0.7)",
      cornerRadius: 16,
      paddingX: 40,
      paddingY: 30,
      offsetX: 0,
      offsetY: 0,
    },
    textAlign: "center",
    fontWeight: "bold",
    fontStyle: "normal",
    textDecoration: "none",
    letterSpacing: 0,
    lineHeight: 1.2,
    duration: 3,
    startTime: 0,
    trimStart: 0,
    trimEnd: 0,
    transform: {
      ...DEFAULT_TRANSFORM,
      position: { x: 0, y: -200 },
    },
    opacity: DEFAULT_OPACITY,
  };
}

/**
 * Builds all timeline elements for a single clip.
 *
 * Returns a video element (trimmed to the moment's time range)
 * plus caption text elements and an optional hook text overlay.
 * All element startTimes are 0-based relative to the clip start.
 */
export function buildClipTimeline({
  moment,
  sourceMediaId,
  captionStyle,
  addHookText,
  segments,
}: {
  moment: ClipMoment;
  sourceMediaId: string;
  captionStyle: CaptionStyle;
  addHookText: boolean;
  segments: TranscriptionSegment[];
}): {
  videoElement: CreateVideoElement;
  textElements: CreateTextElement[];
} {
  const clipDuration = moment.endTime - moment.startTime;

  // Build the video element trimmed to the moment range
  const videoElement: CreateVideoElement = {
    type: "video",
    name: moment.title,
    mediaId: sourceMediaId,
    duration: clipDuration,
    startTime: 0,
    trimStart: moment.startTime,
    trimEnd: 0,
    transform: { ...DEFAULT_TRANSFORM },
    opacity: DEFAULT_OPACITY,
  };

  const textElements: CreateTextElement[] = [];

  // Build caption elements from overlapping transcript segments
  const clippedSegments = getSegmentsInRange(
    segments,
    moment.startTime,
    moment.endTime,
  );

  if (clippedSegments.length > 0) {
    const captionChunks = buildCaptionChunks({
      segments: clippedSegments,
    });

    for (let i = 0; i < captionChunks.length; i++) {
      const chunk = captionChunks[i];
      // Ensure caption doesn't exceed clip duration
      if (chunk.startTime >= clipDuration) break;

      const clampedDuration = Math.min(
        chunk.duration,
        clipDuration - chunk.startTime,
      );

      textElements.push(
        buildCaptionTextElement(
          { ...chunk, duration: clampedDuration },
          captionStyle,
          i,
        ),
      );
    }
  }

  // Add hook text as a big title in the first 3 seconds
  if (addHookText && moment.title) {
    textElements.push(buildHookTextElement(moment.title));
  }

  return { videoElement, textElements };
}
