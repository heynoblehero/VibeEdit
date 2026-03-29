import { describe, test, expect } from "bun:test";

// ============================================================================
// 1. utils/math.ts
// ============================================================================
import {
  clamp,
  isNearlyEqual,
  evaluateMathExpression,
} from "@/utils/math";

describe("clamp", () => {
  test("clamps value within range (typical)", () => {
    expect(clamp({ value: 5, min: 0, max: 10 })).toBe(5);
  });

  test("clamps value below min to min", () => {
    expect(clamp({ value: -3, min: 0, max: 10 })).toBe(0);
  });

  test("clamps value above max to max", () => {
    expect(clamp({ value: 15, min: 0, max: 10 })).toBe(10);
  });

  test("returns min when value equals min", () => {
    expect(clamp({ value: 0, min: 0, max: 10 })).toBe(0);
  });

  test("returns max when value equals max", () => {
    expect(clamp({ value: 10, min: 0, max: 10 })).toBe(10);
  });

  test("handles negative range", () => {
    expect(clamp({ value: -5, min: -10, max: -1 })).toBe(-5);
  });

  test("handles zero range (min === max)", () => {
    expect(clamp({ value: 5, min: 3, max: 3 })).toBe(3);
  });

  test("handles fractional values", () => {
    expect(clamp({ value: 0.5, min: 0, max: 1 })).toBe(0.5);
  });
});

describe("isNearlyEqual", () => {
  test("returns true for identical values", () => {
    expect(isNearlyEqual({ leftValue: 1, rightValue: 1 })).toBe(true);
  });

  test("returns true for values within default epsilon", () => {
    expect(isNearlyEqual({ leftValue: 1.00005, rightValue: 1.00009 })).toBe(true);
  });

  test("returns false for values outside default epsilon", () => {
    expect(isNearlyEqual({ leftValue: 1, rightValue: 1.001 })).toBe(false);
  });

  test("uses custom epsilon", () => {
    expect(
      isNearlyEqual({ leftValue: 1, rightValue: 1.5, epsilon: 1 })
    ).toBe(true);
  });

  test("returns true for zero difference", () => {
    expect(isNearlyEqual({ leftValue: 0, rightValue: 0 })).toBe(true);
  });

  test("handles negative values", () => {
    expect(isNearlyEqual({ leftValue: -1, rightValue: -1.00005 })).toBe(true);
  });

  test("returns true at exact epsilon boundary", () => {
    expect(
      isNearlyEqual({ leftValue: 0, rightValue: 0.0001, epsilon: 0.0001 })
    ).toBe(true);
  });

  test("returns false just outside epsilon boundary", () => {
    expect(
      isNearlyEqual({ leftValue: 0, rightValue: 0.00011, epsilon: 0.0001 })
    ).toBe(false);
  });
});

describe("evaluateMathExpression", () => {
  test("evaluates simple addition", () => {
    expect(evaluateMathExpression({ input: "2 + 3" })).toBe(5);
  });

  test("evaluates multiplication", () => {
    expect(evaluateMathExpression({ input: "4 * 5" })).toBe(20);
  });

  test("evaluates complex expression with parens", () => {
    expect(evaluateMathExpression({ input: "(2 + 3) * 4" })).toBe(20);
  });

  test("evaluates division", () => {
    expect(evaluateMathExpression({ input: "10 / 2" })).toBe(5);
  });

  test("evaluates subtraction", () => {
    expect(evaluateMathExpression({ input: "10 - 3" })).toBe(7);
  });

  test("returns null for division by zero (Infinity)", () => {
    expect(evaluateMathExpression({ input: "1 / 0" })).toBe(null);
  });

  test("returns null for alphabetic input", () => {
    expect(evaluateMathExpression({ input: "abc" })).toBe(null);
  });

  test("returns null for script injection attempts", () => {
    expect(evaluateMathExpression({ input: "alert('hi')" })).toBe(null);
  });

  test("returns null for empty string", () => {
    expect(evaluateMathExpression({ input: "" })).toBe(null);
  });

  test("handles leading/trailing whitespace", () => {
    expect(evaluateMathExpression({ input: "  3 + 4  " })).toBe(7);
  });

  test("evaluates decimal numbers", () => {
    expect(evaluateMathExpression({ input: "1.5 + 2.5" })).toBe(4);
  });
});

// ============================================================================
// 2. utils/color.ts
// ============================================================================
import {
  hexToHsv,
  hsvToHex,
  parseHexAlpha,
  extractColorFromText,
} from "@/utils/color";

describe("hexToHsv", () => {
  test("converts red hex to HSV", () => {
    const [h, s, v] = hexToHsv({ hex: "ff0000" });
    expect(Math.round(h)).toBe(0);
    expect(s).toBeCloseTo(1, 1);
    expect(v).toBeCloseTo(1, 1);
  });

  test("converts white hex to HSV", () => {
    const [h, s, v] = hexToHsv({ hex: "ffffff" });
    expect(s).toBeCloseTo(0, 1);
    expect(v).toBeCloseTo(1, 1);
  });

  test("converts black hex to HSV", () => {
    const [h, s, v] = hexToHsv({ hex: "000000" });
    expect(s).toBeCloseTo(0, 1);
    expect(v).toBeCloseTo(0, 1);
  });

  test("returns [0,0,0] for invalid hex", () => {
    const result = hexToHsv({ hex: "zzzzz" });
    expect(result).toEqual([0, 0, 0]);
  });

  test("converts blue hex to HSV", () => {
    const [h, s, v] = hexToHsv({ hex: "0000ff" });
    expect(Math.round(h)).toBe(240);
    expect(s).toBeCloseTo(1, 1);
    expect(v).toBeCloseTo(1, 1);
  });
});

describe("hsvToHex", () => {
  test("converts pure red HSV to hex", () => {
    const hex = hsvToHex({ h: 0, s: 1, v: 1 });
    expect(hex).toBe("ff0000");
  });

  test("converts pure green HSV to hex", () => {
    const hex = hsvToHex({ h: 120, s: 1, v: 1 });
    expect(hex).toBe("00ff00");
  });

  test("converts black HSV to hex", () => {
    const hex = hsvToHex({ h: 0, s: 0, v: 0 });
    expect(hex).toBe("000000");
  });

  test("converts white HSV to hex", () => {
    const hex = hsvToHex({ h: 0, s: 0, v: 1 });
    expect(hex).toBe("ffffff");
  });
});

describe("parseHexAlpha", () => {
  test("parses 6-char hex without alpha", () => {
    const result = parseHexAlpha({ hex: "ff0000" });
    expect(result.rgb).toBe("ff0000");
    expect(result.alpha).toBe(1);
  });

  test("parses 8-char hex with alpha", () => {
    const result = parseHexAlpha({ hex: "ff000080" });
    expect(result.rgb).toBe("ff0000");
    expect(result.alpha).toBeCloseTo(0.502, 1);
  });

  test("parses white without alpha", () => {
    const result = parseHexAlpha({ hex: "ffffff" });
    expect(result.rgb).toBe("ffffff");
    expect(result.alpha).toBe(1);
  });

  test("handles 3-char shorthand hex", () => {
    const result = parseHexAlpha({ hex: "f00" });
    expect(result.rgb).toBe("ff0000");
    expect(result.alpha).toBe(1);
  });
});

describe("extractColorFromText", () => {
  test("extracts color from hex string with hash", () => {
    const result = extractColorFromText({ text: "#ff0000" });
    expect(result).toBe("ff0000");
  });

  test("extracts color from bare hex string", () => {
    const result = extractColorFromText({ text: "00ff00" });
    expect(result).toBe("00ff00");
  });

  test("extracts color from rgb() function", () => {
    const result = extractColorFromText({ text: "rgb(255, 0, 0)" });
    expect(result).toBe("ff0000");
  });

  test("extracts color from CSS property with colon", () => {
    const result = extractColorFromText({ text: "color: #0000ff" });
    expect(result).toBe("0000ff");
  });

  test("returns null for non-color text", () => {
    expect(extractColorFromText({ text: "hello world" })).toBe(null);
  });

  test("returns null for empty string", () => {
    expect(extractColorFromText({ text: "" })).toBe(null);
  });

  test("handles named CSS color", () => {
    const result = extractColorFromText({ text: "red" });
    expect(result).toBe("ff0000");
  });

  test("strips !important from CSS text", () => {
    const result = extractColorFromText({ text: "color: #ff0000 !important;" });
    expect(result).toBe("ff0000");
  });
});

// ============================================================================
// 3. utils/string.ts
// ============================================================================
import { capitalizeFirstLetter, uppercase } from "@/utils/string";

describe("capitalizeFirstLetter", () => {
  test("capitalizes first letter of a lowercase string", () => {
    expect(capitalizeFirstLetter({ string: "hello" })).toBe("Hello");
  });

  test("keeps already capitalized string unchanged", () => {
    expect(capitalizeFirstLetter({ string: "Hello" })).toBe("Hello");
  });

  test("handles empty string", () => {
    expect(capitalizeFirstLetter({ string: "" })).toBe("");
  });

  test("handles single character", () => {
    expect(capitalizeFirstLetter({ string: "a" })).toBe("A");
  });

  test("does not change rest of the string", () => {
    expect(capitalizeFirstLetter({ string: "hELLO" })).toBe("HELLO");
  });
});

describe("uppercase", () => {
  test("converts lowercase string to uppercase", () => {
    expect(uppercase({ string: "hello" })).toBe("HELLO");
  });

  test("keeps already uppercase string unchanged", () => {
    expect(uppercase({ string: "HELLO" })).toBe("HELLO");
  });

  test("handles empty string", () => {
    expect(uppercase({ string: "" })).toBe("");
  });

  test("handles mixed case string", () => {
    expect(uppercase({ string: "Hello World" })).toBe("HELLO WORLD");
  });

  test("handles string with numbers and symbols", () => {
    expect(uppercase({ string: "abc-123_def" })).toBe("ABC-123_DEF");
  });
});

// ============================================================================
// 4. utils/date.ts
// ============================================================================
import { formatDate } from "@/utils/date";

describe("formatDate", () => {
  test("formats a typical date correctly", () => {
    const date = new Date(2024, 0, 15); // Jan 15, 2024
    const result = formatDate({ date });
    expect(result).toBe("Jan 15, 2024");
  });

  test("formats December date correctly", () => {
    const date = new Date(2023, 11, 25); // Dec 25, 2023
    const result = formatDate({ date });
    expect(result).toBe("Dec 25, 2023");
  });

  test("formats date at year boundary", () => {
    const date = new Date(2024, 0, 1); // Jan 1, 2024
    const result = formatDate({ date });
    expect(result).toBe("Jan 1, 2024");
  });

  test("formats date in a different year", () => {
    const date = new Date(2000, 5, 30); // Jun 30, 2000
    const result = formatDate({ date });
    expect(result).toBe("Jun 30, 2000");
  });
});

// ============================================================================
// 5. utils/id.ts
// ============================================================================
import { generateUUID } from "@/utils/id";

describe("generateUUID", () => {
  test("returns a string", () => {
    const uuid = generateUUID();
    expect(typeof uuid).toBe("string");
  });

  test("returns a valid UUID v4 format", () => {
    const uuid = generateUUID();
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(uuidRegex.test(uuid)).toBe(true);
  });

  test("generates unique UUIDs", () => {
    const uuids = new Set(Array.from({ length: 100 }, () => generateUUID()));
    expect(uuids.size).toBe(100);
  });

  test("has correct length (36 chars including hyphens)", () => {
    const uuid = generateUUID();
    expect(uuid.length).toBe(36);
  });

  test("has hyphens at correct positions", () => {
    const uuid = generateUUID();
    expect(uuid[8]).toBe("-");
    expect(uuid[13]).toBe("-");
    expect(uuid[18]).toBe("-");
    expect(uuid[23]).toBe("-");
  });
});

// ============================================================================
// 6. lib/time.ts
// ============================================================================
import {
  roundToFrame,
  formatTimeCode,
  parseTimeCode,
  guessTimeCodeFormat,
  timeToFrame,
  frameToTime,
  snapTimeToFrame,
  getSnappedSeekTime,
  getLastFrameTime,
} from "@/lib/time";

describe("roundToFrame", () => {
  test("rounds time to nearest frame at 24fps", () => {
    const result = roundToFrame({ time: 1.02, fps: 24 });
    // 1.02 * 24 = 24.48 -> Math.round = 24 -> 24/24 = 1.0
    expect(result).toBeCloseTo(1.0, 5);
  });

  test("rounds time at 30fps", () => {
    const result = roundToFrame({ time: 0.5, fps: 30 });
    // 0.5 * 30 = 15 -> Math.round = 15 -> 15/30 = 0.5
    expect(result).toBeCloseTo(0.5, 5);
  });

  test("handles zero time", () => {
    expect(roundToFrame({ time: 0, fps: 30 })).toBe(0);
  });

  test("rounds correctly at frame boundary", () => {
    const result = roundToFrame({ time: 1 / 24, fps: 24 });
    expect(result).toBeCloseTo(1 / 24, 5);
  });
});

describe("formatTimeCode", () => {
  test("formats time in default HH:MM:SS:CS format", () => {
    const result = formatTimeCode({ timeInSeconds: 3661.5 });
    expect(result).toBe("01:01:01:50");
  });

  test("formats time in MM:SS format", () => {
    const result = formatTimeCode({ timeInSeconds: 125, format: "MM:SS" });
    expect(result).toBe("02:05");
  });

  test("formats time in HH:MM:SS format", () => {
    const result = formatTimeCode({ timeInSeconds: 3661, format: "HH:MM:SS" });
    expect(result).toBe("01:01:01");
  });

  test("formats time in HH:MM:SS:FF format at 24fps", () => {
    // 1.5 seconds at 24fps: 0.5 * 24 = 12 frames
    const result = formatTimeCode({
      timeInSeconds: 1.5,
      format: "HH:MM:SS:FF",
      fps: 24,
    });
    expect(result).toBe("00:00:01:12");
  });

  test("throws when HH:MM:SS:FF format used without fps", () => {
    expect(() =>
      formatTimeCode({ timeInSeconds: 1.5, format: "HH:MM:SS:FF" })
    ).toThrow("FPS is required for HH:MM:SS:FF format");
  });

  test("formats zero time", () => {
    expect(formatTimeCode({ timeInSeconds: 0 })).toBe("00:00:00:00");
  });

  test("pads single digits", () => {
    const result = formatTimeCode({ timeInSeconds: 1, format: "HH:MM:SS" });
    expect(result).toBe("00:00:01");
  });
});

describe("parseTimeCode", () => {
  test("parses MM:SS format", () => {
    const result = parseTimeCode({ timeCode: "02:30", format: "MM:SS", fps: 30 });
    expect(result).toBe(150);
  });

  test("parses HH:MM:SS format", () => {
    const result = parseTimeCode({
      timeCode: "01:02:03",
      format: "HH:MM:SS",
      fps: 30,
    });
    expect(result).toBe(3723);
  });

  test("parses HH:MM:SS:CS format", () => {
    const result = parseTimeCode({
      timeCode: "00:00:01:50",
      format: "HH:MM:SS:CS",
      fps: 30,
    });
    expect(result).toBe(1.5);
  });

  test("parses HH:MM:SS:FF format at 24fps", () => {
    const result = parseTimeCode({
      timeCode: "00:00:01:12",
      format: "HH:MM:SS:FF",
      fps: 24,
    });
    expect(result).toBe(1.5);
  });

  test("returns null for empty string", () => {
    expect(parseTimeCode({ timeCode: "", format: "MM:SS", fps: 30 })).toBe(null);
  });

  test("returns null for invalid format (wrong part count)", () => {
    expect(
      parseTimeCode({ timeCode: "01:02:03", format: "MM:SS", fps: 30 })
    ).toBe(null);
  });

  test("returns null for negative seconds in MM:SS", () => {
    expect(
      parseTimeCode({ timeCode: "01:-1", format: "MM:SS", fps: 30 })
    ).toBe(null);
  });

  test("returns null for seconds >= 60 in HH:MM:SS", () => {
    expect(
      parseTimeCode({ timeCode: "00:00:60", format: "HH:MM:SS", fps: 30 })
    ).toBe(null);
  });

  test("returns null for non-numeric input", () => {
    expect(
      parseTimeCode({ timeCode: "ab:cd", format: "MM:SS", fps: 30 })
    ).toBe(null);
  });

  test("returns null for frames >= fps in HH:MM:SS:FF", () => {
    expect(
      parseTimeCode({ timeCode: "00:00:00:30", format: "HH:MM:SS:FF", fps: 30 })
    ).toBe(null);
  });

  test("handles whitespace in timecode", () => {
    const result = parseTimeCode({
      timeCode: "  01:30  ",
      format: "MM:SS",
      fps: 30,
    });
    expect(result).toBe(90);
  });
});

describe("guessTimeCodeFormat", () => {
  test("guesses MM:SS for 2-part timecode", () => {
    expect(guessTimeCodeFormat({ timeCode: "01:30" })).toBe("MM:SS");
  });

  test("guesses HH:MM:SS for 3-part timecode", () => {
    expect(guessTimeCodeFormat({ timeCode: "01:02:03" })).toBe("HH:MM:SS");
  });

  test("guesses HH:MM:SS:FF for 4-part timecode", () => {
    expect(guessTimeCodeFormat({ timeCode: "01:02:03:04" })).toBe("HH:MM:SS:FF");
  });

  test("returns null for single number", () => {
    expect(guessTimeCodeFormat({ timeCode: "123" })).toBe(null);
  });

  test("returns null for empty string", () => {
    expect(guessTimeCodeFormat({ timeCode: "" })).toBe(null);
  });

  test("returns null for non-numeric parts", () => {
    expect(guessTimeCodeFormat({ timeCode: "ab:cd" })).toBe(null);
  });

  test("returns null for 5-part timecode", () => {
    expect(guessTimeCodeFormat({ timeCode: "1:2:3:4:5" })).toBe(null);
  });
});

describe("timeToFrame", () => {
  test("converts 1 second to 24 frames at 24fps", () => {
    expect(timeToFrame({ time: 1, fps: 24 })).toBe(24);
  });

  test("converts 0 time to frame 0", () => {
    expect(timeToFrame({ time: 0, fps: 30 })).toBe(0);
  });

  test("rounds to nearest frame", () => {
    // 0.5 * 24 = 12
    expect(timeToFrame({ time: 0.5, fps: 24 })).toBe(12);
  });

  test("handles fractional frame conversion", () => {
    // 0.04 * 30 = 1.2 -> rounds to 1
    expect(timeToFrame({ time: 0.04, fps: 30 })).toBe(1);
  });
});

describe("frameToTime", () => {
  test("converts frame 24 to 1 second at 24fps", () => {
    expect(frameToTime({ frame: 24, fps: 24 })).toBe(1);
  });

  test("converts frame 0 to 0 seconds", () => {
    expect(frameToTime({ frame: 0, fps: 30 })).toBe(0);
  });

  test("converts frame 15 at 30fps to 0.5 seconds", () => {
    expect(frameToTime({ frame: 15, fps: 30 })).toBe(0.5);
  });
});

describe("snapTimeToFrame", () => {
  test("snaps time to nearest frame boundary", () => {
    const result = snapTimeToFrame({ time: 1.02, fps: 24 });
    // frame = round(1.02 * 24) = round(24.48) = 24
    // time = 24 / 24 = 1.0
    expect(result).toBeCloseTo(1.0, 5);
  });

  test("returns original time when fps <= 0", () => {
    expect(snapTimeToFrame({ time: 1.5, fps: 0 })).toBe(1.5);
    expect(snapTimeToFrame({ time: 1.5, fps: -1 })).toBe(1.5);
  });

  test("handles zero time", () => {
    expect(snapTimeToFrame({ time: 0, fps: 30 })).toBe(0);
  });

  test("snaps correctly at exact frame boundary", () => {
    // 1/30 at 30fps should remain 1/30
    const result = snapTimeToFrame({ time: 1 / 30, fps: 30 });
    expect(result).toBeCloseTo(1 / 30, 5);
  });
});

describe("getSnappedSeekTime", () => {
  test("snaps and clamps within duration", () => {
    const result = getSnappedSeekTime({ rawTime: 1.02, duration: 10, fps: 24 });
    expect(result).toBeCloseTo(1.0, 5);
  });

  test("clamps negative time to 0", () => {
    const result = getSnappedSeekTime({ rawTime: -1, duration: 10, fps: 30 });
    expect(result).toBe(0);
  });

  test("clamps time exceeding duration to duration", () => {
    const result = getSnappedSeekTime({ rawTime: 15, duration: 10, fps: 30 });
    expect(result).toBe(10);
  });

  test("handles zero duration", () => {
    const result = getSnappedSeekTime({ rawTime: 5, duration: 0, fps: 30 });
    expect(result).toBe(0);
  });
});

describe("getLastFrameTime", () => {
  test("returns time of last frame", () => {
    // duration 10s at 30fps: last frame at 10 - 1/30
    const result = getLastFrameTime({ duration: 10, fps: 30 });
    expect(result).toBeCloseTo(10 - 1 / 30, 5);
  });

  test("returns 0 for zero duration", () => {
    expect(getLastFrameTime({ duration: 0, fps: 30 })).toBe(0);
  });

  test("returns 0 for negative duration", () => {
    expect(getLastFrameTime({ duration: -5, fps: 30 })).toBe(0);
  });

  test("returns duration when fps <= 0", () => {
    expect(getLastFrameTime({ duration: 10, fps: 0 })).toBe(10);
    expect(getLastFrameTime({ duration: 10, fps: -1 })).toBe(10);
  });

  test("handles 1-frame duration", () => {
    // duration = 1/30, last frame = 1/30 - 1/30 = 0
    const result = getLastFrameTime({ duration: 1 / 30, fps: 30 });
    expect(result).toBeCloseTo(0, 5);
  });
});

// ============================================================================
// 7. lib/scenes.ts
// ============================================================================
import {
  getMainScene,
  ensureMainScene,
  buildDefaultScene,
  getProjectDurationFromScenes,
} from "@/lib/scenes";
import type { TScene } from "@/types/timeline";

function makeScene(overrides: Partial<TScene> & { id: string; isMain: boolean }): TScene {
  return {
    name: overrides.name ?? "Test Scene",
    tracks: overrides.tracks ?? [],
    bookmarks: overrides.bookmarks ?? [],
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
    ...overrides,
  };
}

describe("getMainScene", () => {
  test("returns the main scene from a list", () => {
    const scenes: TScene[] = [
      makeScene({ id: "1", isMain: false }),
      makeScene({ id: "2", isMain: true, name: "Main" }),
    ];
    const result = getMainScene({ scenes });
    expect(result?.id).toBe("2");
  });

  test("returns null when no main scene exists", () => {
    const scenes: TScene[] = [
      makeScene({ id: "1", isMain: false }),
    ];
    expect(getMainScene({ scenes })).toBe(null);
  });

  test("returns null for empty array", () => {
    expect(getMainScene({ scenes: [] })).toBe(null);
  });

  test("returns first main scene if multiple exist", () => {
    const scenes: TScene[] = [
      makeScene({ id: "1", isMain: true, name: "First Main" }),
      makeScene({ id: "2", isMain: true, name: "Second Main" }),
    ];
    const result = getMainScene({ scenes });
    expect(result?.id).toBe("1");
  });
});

describe("ensureMainScene", () => {
  test("returns scenes unchanged if main scene exists", () => {
    const scenes: TScene[] = [
      makeScene({ id: "1", isMain: true }),
      makeScene({ id: "2", isMain: false }),
    ];
    const result = ensureMainScene({ scenes });
    expect(result.length).toBe(2);
    expect(result[0].id).toBe("1");
  });

  test("prepends a main scene when none exists", () => {
    const scenes: TScene[] = [
      makeScene({ id: "1", isMain: false }),
    ];
    const result = ensureMainScene({ scenes });
    expect(result.length).toBe(2);
    expect(result[0].isMain).toBe(true);
    expect(result[0].name).toBe("Main scene");
  });

  test("adds a main scene to empty array", () => {
    const result = ensureMainScene({ scenes: [] });
    expect(result.length).toBe(1);
    expect(result[0].isMain).toBe(true);
  });
});

describe("buildDefaultScene", () => {
  test("creates a scene with given name and isMain flag", () => {
    const scene = buildDefaultScene({ name: "My Scene", isMain: true });
    expect(scene.name).toBe("My Scene");
    expect(scene.isMain).toBe(true);
  });

  test("creates a non-main scene", () => {
    const scene = buildDefaultScene({ name: "Secondary", isMain: false });
    expect(scene.isMain).toBe(false);
  });

  test("generates a valid UUID for the scene id", () => {
    const scene = buildDefaultScene({ name: "Test", isMain: true });
    expect(scene.id).toBeDefined();
    expect(scene.id.length).toBe(36);
  });

  test("initializes with empty bookmarks", () => {
    const scene = buildDefaultScene({ name: "Test", isMain: true });
    expect(scene.bookmarks).toEqual([]);
  });

  test("initializes with tracks (including main track)", () => {
    const scene = buildDefaultScene({ name: "Test", isMain: true });
    expect(scene.tracks.length).toBeGreaterThanOrEqual(1);
  });

  test("sets createdAt and updatedAt dates", () => {
    const before = new Date();
    const scene = buildDefaultScene({ name: "Test", isMain: true });
    const after = new Date();
    expect(scene.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(scene.updatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });
});

describe("getProjectDurationFromScenes", () => {
  test("returns 0 for empty scenes array", () => {
    expect(getProjectDurationFromScenes({ scenes: [] })).toBe(0);
  });

  test("returns 0 when main scene has no tracks", () => {
    const scenes: TScene[] = [
      makeScene({ id: "1", isMain: true, tracks: [] }),
    ];
    expect(getProjectDurationFromScenes({ scenes })).toBe(0);
  });

  test("returns 0 when main scene has empty tracks", () => {
    const scenes: TScene[] = [
      makeScene({
        id: "1",
        isMain: true,
        tracks: [
          {
            id: "t1",
            name: "Track",
            type: "video",
            elements: [],
            isMain: true,
            muted: false,
            hidden: false,
          },
        ],
      }),
    ];
    expect(getProjectDurationFromScenes({ scenes })).toBe(0);
  });

  test("calculates duration from elements in main scene", () => {
    const scenes: TScene[] = [
      makeScene({
        id: "1",
        isMain: true,
        tracks: [
          {
            id: "t1",
            name: "Track",
            type: "video",
            elements: [
              {
                id: "e1",
                name: "Clip",
                type: "video",
                mediaId: "m1",
                startTime: 0,
                duration: 5,
                trimStart: 0,
                trimEnd: 0,
                transform: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0 },
                opacity: 1,
              },
              {
                id: "e2",
                name: "Clip2",
                type: "video",
                mediaId: "m2",
                startTime: 5,
                duration: 3,
                trimStart: 0,
                trimEnd: 0,
                transform: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0 },
                opacity: 1,
              },
            ],
            isMain: true,
            muted: false,
            hidden: false,
          },
        ],
      }),
    ];
    expect(getProjectDurationFromScenes({ scenes })).toBe(8);
  });

  test("uses first scene when no main scene exists", () => {
    const scenes: TScene[] = [
      makeScene({
        id: "1",
        isMain: false,
        tracks: [
          {
            id: "t1",
            name: "Track",
            type: "video",
            elements: [
              {
                id: "e1",
                name: "Clip",
                type: "video",
                mediaId: "m1",
                startTime: 0,
                duration: 10,
                trimStart: 0,
                trimEnd: 0,
                transform: { x: 0, y: 0, width: 1920, height: 1080, rotation: 0 },
                opacity: 1,
              },
            ],
            isMain: true,
            muted: false,
            hidden: false,
          },
        ],
      }),
    ];
    expect(getProjectDurationFromScenes({ scenes })).toBe(10);
  });
});

// ============================================================================
// 8. lib/export.ts
// ============================================================================
import { getExportMimeType, getExportFileExtension } from "@/lib/export";
import type { ExportFormat } from "@/types/export";

describe("getExportMimeType", () => {
  test("returns correct mime type for mp4", () => {
    expect(getExportMimeType({ format: "mp4" })).toBe("video/mp4");
  });

  test("returns correct mime type for webm", () => {
    expect(getExportMimeType({ format: "webm" })).toBe("video/webm");
  });

  test("returns undefined for unknown format", () => {
    expect(getExportMimeType({ format: "avi" as ExportFormat })).toBeUndefined();
  });
});

describe("getExportFileExtension", () => {
  test("returns .mp4 for mp4 format", () => {
    expect(getExportFileExtension({ format: "mp4" })).toBe(".mp4");
  });

  test("returns .webm for webm format", () => {
    expect(getExportFileExtension({ format: "webm" })).toBe(".webm");
  });

  test("returns dot-prefixed extension for any format string", () => {
    expect(getExportFileExtension({ format: "mov" as ExportFormat })).toBe(".mov");
  });
});

// ============================================================================
// 9. lib/project/export-presets.ts
// ============================================================================
import {
  getPreset,
  EXPORT_PRESETS,
  getPresetsByPlatform,
} from "@/lib/project/export-presets";

describe("EXPORT_PRESETS", () => {
  test("is a non-empty array", () => {
    expect(Array.isArray(EXPORT_PRESETS)).toBe(true);
    expect(EXPORT_PRESETS.length).toBeGreaterThan(0);
  });

  test("every preset has required fields", () => {
    for (const preset of EXPORT_PRESETS) {
      expect(preset.id).toBeDefined();
      expect(preset.name).toBeDefined();
      expect(preset.description).toBeDefined();
      expect(preset.platform).toBeDefined();
      expect(preset.settings).toBeDefined();
      expect(preset.settings.format).toBeDefined();
      expect(preset.settings.quality).toBeDefined();
      expect(typeof preset.settings.fps).toBe("number");
      expect(typeof preset.settings.width).toBe("number");
      expect(typeof preset.settings.height).toBe("number");
      expect(typeof preset.settings.includeAudio).toBe("boolean");
    }
  });

  test("all preset IDs are unique", () => {
    const ids = EXPORT_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("contains known presets", () => {
    const ids = EXPORT_PRESETS.map((p) => p.id);
    expect(ids).toContain("youtube-1080");
    expect(ids).toContain("instagram-reel");
    expect(ids).toContain("tiktok");
  });
});

describe("getPreset", () => {
  test("returns preset by valid id", () => {
    const preset = getPreset("youtube-1080");
    expect(preset).toBeDefined();
    expect(preset?.name).toBe("YouTube 1080p");
  });

  test("returns youtube-4k preset", () => {
    const preset = getPreset("youtube-4k");
    expect(preset).toBeDefined();
    expect(preset?.settings.width).toBe(3840);
    expect(preset?.settings.height).toBe(2160);
  });

  test("returns undefined for unknown id", () => {
    expect(getPreset("nonexistent")).toBeUndefined();
  });

  test("returns undefined for empty string", () => {
    expect(getPreset("")).toBeUndefined();
  });

  test("returns the tiktok preset with correct settings", () => {
    const preset = getPreset("tiktok");
    expect(preset?.platform).toBe("TikTok");
    expect(preset?.settings.width).toBe(1080);
    expect(preset?.settings.height).toBe(1920);
    expect(preset?.settings.format).toBe("mp4");
  });
});

describe("getPresetsByPlatform", () => {
  test("returns all YouTube presets", () => {
    const presets = getPresetsByPlatform("YouTube");
    expect(presets.length).toBeGreaterThanOrEqual(2);
    expect(presets.every((p) => p.platform === "YouTube")).toBe(true);
  });

  test("returns all Instagram presets", () => {
    const presets = getPresetsByPlatform("Instagram");
    expect(presets.length).toBeGreaterThanOrEqual(2);
    expect(presets.every((p) => p.platform === "Instagram")).toBe(true);
  });

  test("returns empty array for unknown platform", () => {
    expect(getPresetsByPlatform("Vimeo")).toEqual([]);
  });

  test("returns empty array for empty string", () => {
    expect(getPresetsByPlatform("")).toEqual([]);
  });

  test("returns General presets", () => {
    const presets = getPresetsByPlatform("General");
    expect(presets.length).toBeGreaterThanOrEqual(1);
  });

  test("is case-sensitive (lowercase fails)", () => {
    expect(getPresetsByPlatform("youtube")).toEqual([]);
  });
});
