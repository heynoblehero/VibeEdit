import { describe, expect, test } from "bun:test";
import {
  buildAssContent,
  buildGradeFilter,
  buildTransformFilter,
  type CaptionCue,
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

  test("subtracts cross-fade overlap from later segment offsets", () => {
    const segments: EdlSegment[] = [
      { source: "a.mp4", start: 0, end: 2, transitionAfter: { type: "fade", duration: 0.5 } },
      { source: "a.mp4", start: 0, end: 2, transitionAfter: { type: "wipeleft", duration: 0.3 } },
      { source: "a.mp4", start: 0, end: 2 },
    ];
    // seg0 @ 0; seg1 @ 2 - 0.5 = 1.5; seg2 @ 1.5 + 2 - 0.3 = 3.2
    const offsets = computeSegmentOffsets(segments);
    expect(offsets[0]).toBeCloseTo(0, 5);
    expect(offsets[1]).toBeCloseTo(1.5, 5);
    expect(offsets[2]).toBeCloseTo(3.2, 5);
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

  const gridSegments: EdlSegment[] = Array.from({ length: 6 }, (_, index) => ({
    source: "a.mp4",
    start: index,
    end: index + 1,
    beat: "SCENE",
    grade: index % 2 === 0 ? "auto" : "none",
  }));

  test("beat-sync: flags cuts that miss the beat grid", () => {
    // Interior cuts fall at 1,2,3,4,5; these beats miss them all by >0.12s.
    const beats = [0.4, 1.5, 2.6, 3.7, 10, 11];
    const result = validateEdl({ segments: gridSegments }, { beats });
    expect(result.issues.some((issue) => issue.code === "off_beat_cuts")).toBe(true);
  });

  test("beat-sync: cuts on the beat grid pass", () => {
    const beats = [0, 1, 2, 3, 4, 5];
    const result = validateEdl({ segments: gridSegments }, { beats });
    expect(result.issues.some((issue) => issue.code === "off_beat_cuts")).toBe(false);
  });
});

describe("buildAssContent", () => {
  const cues: CaptionCue[] = [
    { text: "hello world", start: 0.2, end: 1.5 },
    { text: "second line", start: 1.6, end: 2.8 },
  ];

  test("emits a valid ASS structure sized to the video", () => {
    const ass = buildAssContent(cues, { videoWidth: 1920, videoHeight: 1080 });
    expect(ass).toContain("[Script Info]");
    expect(ass).toContain("PlayResX: 1920");
    expect(ass).toContain("PlayResY: 1080");
    expect(ass).toContain("[V4+ Styles]");
    expect(ass).toContain("[Events]");
    // Two dialogue events, in centisecond timestamps.
    const dialogues = ass.split("\n").filter((line) => line.startsWith("Dialogue:"));
    expect(dialogues).toHaveLength(2);
    expect(dialogues[0]).toContain("0:00:00.20");
    expect(dialogues[0]).toContain("0:00:01.50");
  });

  test("default style is 'clean' and the used style block is emitted", () => {
    const ass = buildAssContent(cues, { videoWidth: 1080, videoHeight: 1920 });
    expect(ass).toContain("Style: clean,");
    // Font size scales with height: 0.05 * 1920 = 96.
    expect(ass).toContain("Style: clean,Liberation Sans,96,");
  });

  test("'bold' preset uppercases text and adds a scale-in pop tag", () => {
    const ass = buildAssContent([{ text: "pop", start: 0, end: 1 }], {
      videoWidth: 1080,
      videoHeight: 1920,
      defaultStyle: "bold",
    });
    expect(ass).toContain("Style: bold,");
    expect(ass).toContain(",,0,0,0,,{\\fad(50,0)\\t(0,120,\\fscx112\\fscy112)");
    expect(ass).toContain("POP"); // uppercased
  });

  test("per-cue style override emits both style blocks", () => {
    const ass = buildAssContent(
      [
        { text: "normal", start: 0, end: 1 },
        { text: "emphasis", start: 1, end: 2, style: "karaoke" },
      ],
      { videoWidth: 1920, videoHeight: 1080, defaultStyle: "clean" },
    );
    expect(ass).toContain("Style: clean,");
    expect(ass).toContain("Style: karaoke,");
    // The karaoke cue uses the karaoke style name in its Dialogue line.
    const karaokeLine = ass
      .split("\n")
      .find((line) => line.startsWith("Dialogue:") && line.includes("karaoke"));
    expect(karaokeLine).toBeDefined();
  });

  test("strips brace injection from caption text", () => {
    const ass = buildAssContent([{ text: "a{\\evil}b", start: 0, end: 1 }], {
      videoWidth: 1920,
      videoHeight: 1080,
    });
    const dialogue = ass.split("\n").find((line) => line.startsWith("Dialogue:"));
    expect(dialogue).toContain("a\\evilb"); // braces removed, no override injected
  });
});

describe("buildGradeFilter", () => {
  test("empty grade object yields no filter", () => {
    expect(buildGradeFilter({})).toBe("");
  });

  test("a named look expands to its filter chain", () => {
    const filter = buildGradeFilter({ look: "teal-orange" });
    expect(filter).toContain("curves=");
    expect(filter).toContain("eq=saturation=1.12");
  });

  test("look combines with manual eq (look first, then eq)", () => {
    const filter = buildGradeFilter({ look: "vibrant", brightness: 0.1 });
    const eqIndex = filter.indexOf("eq=brightness=0.1");
    expect(eqIndex).toBeGreaterThan(-1);
    // The vibrant look chain appears before the manual eq.
    expect(filter.indexOf("saturation=1.3")).toBeLessThan(eqIndex);
  });

  test("temperature adds a colorbalance stage", () => {
    expect(buildGradeFilter({ temperature: "warm" })).toContain("colorbalance=rs=0.05");
    expect(buildGradeFilter({ temperature: "cool" })).toContain("colorbalance=rs=-0.05");
  });

  test("bw-contrast desaturates via hue=s=0", () => {
    expect(buildGradeFilter({ look: "bw-contrast" })).toContain("hue=s=0");
  });
});

describe("buildTransformFilter", () => {
  test("no move yields no filter", () => {
    expect(buildTransformFilter({}, 3)).toBe("");
    expect(buildTransformFilter({ startScale: 1, endScale: 1 }, 3)).toBe("");
  });

  test("a punch-in produces a time-driven crop with escaped commas", () => {
    const filter = buildTransformFilter({ startScale: 1, endScale: 1.2 }, 2);
    expect(filter).toStartWith("crop=");
    expect(filter).toContain("iw/");
    // progress term references clip time and escapes the comma for ffmpeg.
    expect(filter).toContain("min(t/2.000\\,1)");
    expect(filter).toContain("(0.2000)");
  });

  test("a static zoom (equal scales, no pan) still emits a crop", () => {
    expect(buildTransformFilter({ startScale: 1.3, endScale: 1.3 }, 2)).toStartWith("crop=");
  });

  test("scales below 1 are clamped up to 1", () => {
    expect(buildTransformFilter({ startScale: 0.5, endScale: 0.5 }, 2)).toBe("");
  });
});
