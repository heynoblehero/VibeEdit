import { describe, expect, test } from "bun:test";
import {
  computeSegmentOffsets,
  type EdlSegment,
  type TranscriptWord,
  validateEdl,
} from "./ffmpeg-tools";

// A clean 8-scene edit that should pass every check without warnings.
const goodSegments: EdlSegment[] = [
  { source: "a.mp4", start: 0, end: 2, beat: "HOOK", grade: "auto" },
  { source: "a.mp4", start: 3, end: 5.2, beat: "PROBLEM", grade: "none" },
  {
    source: "a.mp4",
    start: 6,
    end: 8.5,
    beat: "PROOF",
    grade: { brightness: 0.1 },
  },
  { source: "a.mp4", start: 9, end: 11, beat: "PROOF", grade: "auto" },
  { source: "a.mp4", start: 12, end: 14.5, beat: "DETAIL", grade: "none" },
  {
    source: "a.mp4",
    start: 15,
    end: 17,
    beat: "DETAIL",
    grade: { contrast: 1.1 },
  },
  { source: "a.mp4", start: 18, end: 20.3, beat: "TURN", grade: "auto" },
  { source: "a.mp4", start: 21, end: 23, beat: "CTA", grade: "none" },
];

describe("computeSegmentOffsets", () => {
  test("accumulates speed-adjusted durations", () => {
    const segments: EdlSegment[] = [
      { source: "a.mp4", start: 0, end: 2 },
      { source: "a.mp4", start: 5, end: 9, speed: 2 }, // 4s source → 2s output
      { source: "a.mp4", start: 0, end: 3 },
    ];
    expect(computeSegmentOffsets(segments)).toEqual([0, 2, 4]);
  });

  test("single segment starts at 0", () => {
    expect(computeSegmentOffsets([{ source: "a.mp4", start: 1, end: 4 }])).toEqual([0]);
  });
});

describe("validateEdl", () => {
  test("a clean 8-scene edit passes with no issues", () => {
    const result = validateEdl({ segments: goodSegments });
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  test("empty EDL is an error", () => {
    const result = validateEdl({ segments: [] });
    expect(result.ok).toBe(false);
    expect(result.issues[0]?.code).toBe("no_segments");
  });

  test("end <= start is a hard error", () => {
    const result = validateEdl({
      segments: [{ source: "a.mp4", start: 5, end: 5 }],
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "bad_window")).toBe(true);
  });

  test("flags glitch-short segments, few scenes, and flat grade as warnings", () => {
    const result = validateEdl({
      segments: [
        { source: "a.mp4", start: 0, end: 0.2 }, // too short
        { source: "a.mp4", start: 1, end: 3 },
      ],
    });
    expect(result.ok).toBe(true); // warnings only
    const codes = result.issues.map((issue) => issue.code);
    expect(codes).toContain("too_short");
    expect(codes).toContain("few_scenes");
  });

  test("flags a long static scene", () => {
    const segments = [...goodSegments];
    segments[0] = {
      source: "a.mp4",
      start: 0,
      end: 9,
      beat: "HOOK",
      grade: "auto",
    };
    const result = validateEdl({ segments });
    expect(result.issues.some((issue) => issue.code === "long_scenes")).toBe(true);
  });

  test("flags an identical duplicate cut", () => {
    const segments = [...goodSegments, goodSegments[0]];
    const result = validateEdl({ segments });
    expect(result.issues.some((issue) => issue.code === "duplicate_segment")).toBe(true);
  });

  test("flags a caption that runs past the output end", () => {
    const result = validateEdl({
      segments: goodSegments,
      // total output ≈ 18.2s; this caption ends at 30s.
      captions: [{ text: "hello", start: 28, end: 30 }],
    });
    expect(result.issues.some((issue) => issue.code === "caption_past_end")).toBe(true);
  });

  test("an invalid caption window is a hard error", () => {
    const result = validateEdl({
      segments: goodSegments,
      captions: [{ text: "bad", start: 2, end: 1 }],
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.code === "bad_caption")).toBe(true);
  });

  test("detects a mid-word cut when a transcript is supplied", () => {
    const words: TranscriptWord[] = [
      { word: "hello", start: 0, end: 0.4 },
      { word: "world", start: 0.5, end: 1.2 }, // segment ends at 0.9 → mid "world"
    ];
    const result = validateEdl({ segments: [{ source: "a.mp4", start: 0, end: 0.9 }] }, { words });
    expect(result.issues.some((issue) => issue.code === "mid_word_cut")).toBe(true);
  });

  test("clean word-gap cut does NOT flag a mid-word cut", () => {
    const words: TranscriptWord[] = [
      { word: "hello", start: 0, end: 0.4 },
      { word: "world", start: 0.6, end: 1.2 },
    ];
    // Cut at 0.5 lands in the gap between words.
    const result = validateEdl({ segments: [{ source: "a.mp4", start: 0, end: 0.5 }] }, { words });
    expect(result.issues.some((issue) => issue.code === "mid_word_cut")).toBe(false);
  });
});
