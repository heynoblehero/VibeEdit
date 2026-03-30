import { describe, test, expect, beforeEach } from "bun:test";

//  1. Subtitle Parser 
import {
  parseSRT,
  parseVTT,
  parseSubtitleFile,
} from "@/lib/media/subtitle-parser";

//  2. EDL Parser 
import { parseEDL } from "@/lib/media/edl-parser";

//  3. LUT Parser 
import {
  parseCubeLUT,
  registerLUT,
  getLUT,
  getAllLUTs,
} from "@/lib/media/lut-parser";

//  4. Lottie Utilities 
import {
  parseLottieJSON,
  registerLottie,
  getLottieData,
  getAllLotties,
} from "@/lib/media/lottie-utils";

//  5. Media Utilities 
import {
  getMediaTypeFromFile,
  mediaSupportsAudio,
  SUPPORTS_AUDIO,
} from "@/lib/media/media-utils";

//  6. Auto-Caption 
import { generatePlaceholderCaptions } from "@/lib/media/auto-caption";

//  7. Effects Registry 
import {
  registerEffect,
  getEffect,
  getAllEffects,
  hasEffect,
  buildDefaultEffectInstance,
} from "@/lib/effects";

//  8. Remotion Templates 
import {
  getTemplate,
  getTemplatesByCategory,
  getAllTemplates,
  TEMPLATES,
} from "@/lib/remotion/templates";

//  9. Sticker ID 
import {
  parseStickerId,
  buildStickerId,
} from "@/lib/stickers/sticker-id";

//  10. Security Log 
import {
  logSecurity,
  getSecurityLog,
} from "@/lib/ai/security-log";

//  11. Action Definitions 
import {
  ACTIONS,
  getActionDefinition,
  getDefaultShortcuts,
} from "@/lib/actions/definitions";

//  12. Action Registry 
import {
  bindAction,
  unbindAction,
  invokeAction,
} from "@/lib/actions/registry";

//  13. Gradient Parser 
import { parseGradient } from "@/lib/gradients/parser";

//  14. Transcription Captions 
import { buildCaptionChunks } from "@/lib/transcription/caption";

// 
//  1. SUBTITLE PARSER
// 

describe("parseSRT", () => {
  const SAMPLE_SRT = `1
00:00:01,000 --> 00:00:04,000
Hello world

2
00:00:05,500 --> 00:00:08,250
This is subtitle two

3
00:01:00,000 --> 00:01:03,500
Third subtitle with
multiple lines`;

  test("parses well-formed SRT content", () => {
    const cues = parseSRT(SAMPLE_SRT);
    expect(cues).toHaveLength(3);
  });

  test("returns correct index, start, end, and text for first cue", () => {
    const cues = parseSRT(SAMPLE_SRT);
    expect(cues[0].index).toBe(1);
    expect(cues[0].startTime).toBe(1.0);
    expect(cues[0].endTime).toBe(4.0);
    expect(cues[0].text).toBe("Hello world");
  });

  test("parses fractional seconds correctly (comma notation)", () => {
    const cues = parseSRT(SAMPLE_SRT);
    expect(cues[1].startTime).toBeCloseTo(5.5, 2);
    expect(cues[1].endTime).toBeCloseTo(8.25, 2);
  });

  test("handles multi-line subtitle text", () => {
    const cues = parseSRT(SAMPLE_SRT);
    expect(cues[2].text).toBe("Third subtitle with\nmultiple lines");
  });

  test("parses hour-based timestamps", () => {
    const srt = `1
01:30:00,000 --> 01:30:05,000
Hour thirty`;
    const cues = parseSRT(srt);
    expect(cues[0].startTime).toBe(5400);
    expect(cues[0].endTime).toBe(5405);
  });

  test("returns empty array for empty string", () => {
    expect(parseSRT("")).toEqual([]);
  });

  test("skips malformed blocks (missing arrow)", () => {
    const bad = `1
00:00:01,000 00:00:02,000
Missing arrow`;
    expect(parseSRT(bad)).toEqual([]);
  });

  test("skips blocks with non-numeric index", () => {
    const bad = `abc
00:00:01,000 --> 00:00:02,000
Bad index`;
    expect(parseSRT(bad)).toEqual([]);
  });

  test("skips blocks with fewer than 3 lines", () => {
    const bad = `1
00:00:01,000 --> 00:00:02,000`;
    expect(parseSRT(bad)).toEqual([]);
  });
});

describe("parseVTT", () => {
  const SAMPLE_VTT = `WEBVTT
Kind: captions
Language: en

00:00:01.000 --> 00:00:04.000
Hello from VTT

00:00:05.000 --> 00:00:08.000
Second cue`;

  test("parses well-formed VTT content", () => {
    const cues = parseVTT(SAMPLE_VTT);
    expect(cues).toHaveLength(2);
  });

  test("strips WEBVTT header and metadata lines", () => {
    const cues = parseVTT(SAMPLE_VTT);
    expect(cues[0].text).toBe("Hello from VTT");
  });

  test("auto-assigns sequential indices starting at 1", () => {
    const cues = parseVTT(SAMPLE_VTT);
    expect(cues[0].index).toBe(1);
    expect(cues[1].index).toBe(2);
  });

  test("parses dot-notation timestamps", () => {
    const cues = parseVTT(SAMPLE_VTT);
    expect(cues[0].startTime).toBe(1.0);
    expect(cues[0].endTime).toBe(4.0);
  });

  test("handles named cues", () => {
    const vtt = `WEBVTT

intro
00:00:00.500 --> 00:00:03.000
Welcome`;
    const cues = parseVTT(vtt);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("Welcome");
  });

  test("strips HTML-like cue tags from text", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:02.000
<c.highlight>Important</c>`;
    const cues = parseVTT(vtt);
    expect(cues[0].text).toBe("Important");
  });

  test("handles position metadata on timestamp line", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:02.000 position:10% align:start
Positioned text`;
    const cues = parseVTT(vtt);
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("Positioned text");
  });

  test("rejects cues where endTime <= startTime", () => {
    const vtt = `WEBVTT

00:00:05.000 --> 00:00:05.000
Same time`;
    const cues = parseVTT(vtt);
    expect(cues).toHaveLength(0);
  });

  test("returns empty array for header-only VTT", () => {
    expect(parseVTT("WEBVTT\n")).toEqual([]);
  });
});

describe("parseSubtitleFile", () => {
  test("routes .vtt files to VTT parser", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:02.000
VTT content`;
    const cues = parseSubtitleFile(vtt, "captions.vtt");
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("VTT content");
  });

  test("routes .VTT (uppercase) files to VTT parser", () => {
    const vtt = `WEBVTT

00:00:01.000 --> 00:00:02.000
VTT`;
    const cues = parseSubtitleFile(vtt, "CAPTIONS.VTT");
    expect(cues).toHaveLength(1);
  });

  test("defaults to SRT parser for .srt files", () => {
    const srt = `1
00:00:01,000 --> 00:00:02,000
SRT content`;
    const cues = parseSubtitleFile(srt, "sub.srt");
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("SRT content");
  });

  test("defaults to SRT parser for unknown extensions", () => {
    const srt = `1
00:00:01,000 --> 00:00:02,000
Unknown ext`;
    const cues = parseSubtitleFile(srt, "sub.txt");
    expect(cues).toHaveLength(1);
  });
});

// 
//  2. EDL PARSER
// 

describe("parseEDL", () => {
  const SAMPLE_EDL = `TITLE: My Project
FCM: NON-DROP FRAME

001  001      V     C    01:00:00:00 01:00:05:00 00:00:00:00 00:00:05:00
* FROM CLIP NAME: intro.mp4
002  002      V     C    01:00:05:00 01:00:10:00 00:00:05:00 00:00:10:00
* FROM CLIP NAME: main.mp4
003  003      A     C    01:00:10:00 01:00:15:00 00:00:10:00 00:00:15:00
* FROM CLIP NAME: narration.wav`;

  test("extracts title", () => {
    const result = parseEDL(SAMPLE_EDL);
    expect(result.title).toBe("My Project");
  });

  test("parses correct number of events", () => {
    const result = parseEDL(SAMPLE_EDL);
    expect(result.events).toHaveLength(3);
  });

  test("parses event edit numbers", () => {
    const result = parseEDL(SAMPLE_EDL);
    expect(result.events[0].editNumber).toBe(1);
    expect(result.events[1].editNumber).toBe(2);
    expect(result.events[2].editNumber).toBe(3);
  });

  test("parses track types (V, A)", () => {
    const result = parseEDL(SAMPLE_EDL);
    expect(result.events[0].trackType).toBe("V");
    expect(result.events[2].trackType).toBe("A");
  });

  test("parses transition type", () => {
    const result = parseEDL(SAMPLE_EDL);
    expect(result.events[0].transitionType).toBe("C");
  });

  test("parses clip names from comments", () => {
    const result = parseEDL(SAMPLE_EDL);
    expect(result.events[0].clipName).toBe("intro.mp4");
    expect(result.events[1].clipName).toBe("main.mp4");
    expect(result.events[2].clipName).toBe("narration.wav");
  });

  test("converts timecodes to seconds at default 30fps", () => {
    const result = parseEDL(SAMPLE_EDL);
    // 01:00:00:00 = 3600s
    expect(result.events[0].sourceIn).toBe(3600);
    // 01:00:05:00 = 3605s
    expect(result.events[0].sourceOut).toBe(3605);
    // record in = 00:00:00:00 = 0s
    expect(result.events[0].recordIn).toBe(0);
    // record out = 00:00:05:00 = 5s
    expect(result.events[0].recordOut).toBe(5);
  });

  test("handles custom fps for timecodes with frames", () => {
    const edl = `TITLE: FPS Test
001  001      V     C    00:00:00:12 00:00:00:24 00:00:00:00 00:00:00:12`;
    const result = parseEDL(edl, 24);
    // 00:00:00:12 at 24fps = 12/24 = 0.5s
    expect(result.events[0].sourceIn).toBeCloseTo(0.5, 4);
    // 00:00:00:24 at 24fps = 24/24 = 1.0s
    expect(result.events[0].sourceOut).toBeCloseTo(1.0, 4);
  });

  test("defaults title to Untitled when no TITLE line present", () => {
    const edl = `001  001      V     C    01:00:00:00 01:00:05:00 00:00:00:00 00:00:05:00`;
    const result = parseEDL(edl);
    expect(result.title).toBe("Untitled");
  });

  test("returns empty events for empty content", () => {
    const result = parseEDL("");
    expect(result.events).toEqual([]);
    expect(result.title).toBe("Untitled");
  });

  test("handles Windows-style line endings (CRLF)", () => {
    const edl = "TITLE: CRLF Test\r\n001  001      V     C    01:00:00:00 01:00:05:00 00:00:00:00 00:00:05:00\r\n* FROM CLIP NAME: test.mp4";
    const result = parseEDL(edl);
    expect(result.title).toBe("CRLF Test");
    expect(result.events).toHaveLength(1);
    expect(result.events[0].clipName).toBe("test.mp4");
  });

  test("event without clip name has undefined clipName", () => {
    const edl = `TITLE: No Clip
001  001      V     C    01:00:00:00 01:00:05:00 00:00:00:00 00:00:05:00`;
    const result = parseEDL(edl);
    expect(result.events[0].clipName).toBeUndefined();
  });
});

// 
//  3. LUT PARSER
// 

describe("parseCubeLUT", () => {
  function makeCube2(): string {
    // 2x2x2 = 8 entries, each with 3 values
    const header = `TITLE "Test LUT"
LUT_3D_SIZE 2
DOMAIN_MIN 0.0 0.0 0.0
DOMAIN_MAX 1.0 1.0 1.0`;
    const dataLines: string[] = [];
    for (let b = 0; b < 2; b++) {
      for (let g = 0; g < 2; g++) {
        for (let r = 0; r < 2; r++) {
          dataLines.push(`${r * 1.0} ${g * 1.0} ${b * 1.0}`);
        }
      }
    }
    return header + "\n" + dataLines.join("\n");
  }

  test("parses a valid 2x2x2 .cube file", () => {
    const lut = parseCubeLUT(makeCube2());
    expect(lut.title).toBe("Test LUT");
    expect(lut.size).toBe(2);
    expect(lut.data).toBeInstanceOf(Float32Array);
    expect(lut.data.length).toBe(2 * 2 * 2 * 3);
  });

  test("reads domain min and max correctly", () => {
    const lut = parseCubeLUT(makeCube2());
    expect(lut.domainMin).toEqual([0, 0, 0]);
    expect(lut.domainMax).toEqual([1, 1, 1]);
  });

  test("stores correct float values in data array", () => {
    const lut = parseCubeLUT(makeCube2());
    // First entry: r=0, g=0, b=0
    expect(lut.data[0]).toBe(0);
    expect(lut.data[1]).toBe(0);
    expect(lut.data[2]).toBe(0);
    // Second entry: r=1, g=0, b=0
    expect(lut.data[3]).toBe(1);
    expect(lut.data[4]).toBe(0);
    expect(lut.data[5]).toBe(0);
  });

  test("throws for missing LUT_3D_SIZE", () => {
    const bad = `TITLE "Bad LUT"
0.0 0.0 0.0`;
    expect(() => parseCubeLUT(bad)).toThrow("missing LUT_3D_SIZE");
  });

  test("throws for wrong number of data values", () => {
    const bad = `LUT_3D_SIZE 2
0.0 0.0 0.0
1.0 1.0 1.0`;
    // 2x2x2 = 8 entries needed, only 2 provided
    expect(() => parseCubeLUT(bad)).toThrow("expected");
  });

  test("ignores comment lines starting with #", () => {
    let cube = `# This is a comment
TITLE "Commented LUT"
# Another comment
LUT_3D_SIZE 2
DOMAIN_MIN 0.0 0.0 0.0
DOMAIN_MAX 1.0 1.0 1.0\n`;
    const dataLines: string[] = [];
    for (let i = 0; i < 8; i++) dataLines.push("0.5 0.5 0.5");
    cube += dataLines.join("\n");
    const lut = parseCubeLUT(cube);
    expect(lut.title).toBe("Commented LUT");
    expect(lut.size).toBe(2);
  });

  test("uses default domain and title when not specified", () => {
    let cube = `LUT_3D_SIZE 2\n`;
    const dataLines: string[] = [];
    for (let i = 0; i < 8; i++) dataLines.push("0.5 0.5 0.5");
    cube += dataLines.join("\n");
    const lut = parseCubeLUT(cube);
    expect(lut.title).toBe("Untitled LUT");
    expect(lut.domainMin).toEqual([0, 0, 0]);
    expect(lut.domainMax).toEqual([1, 1, 1]);
  });
});

describe("LUT store (registerLUT, getLUT, getAllLUTs)", () => {
  test("register and retrieve a LUT", () => {
    let cube = `TITLE "Store Test"\nLUT_3D_SIZE 2\n`;
    for (let i = 0; i < 8; i++) cube += "0.1 0.2 0.3\n";
    const lut = parseCubeLUT(cube);
    registerLUT("my-lut", lut);
    expect(getLUT("my-lut")).toBeDefined();
    expect(getLUT("my-lut")!.title).toBe("Store Test");
  });

  test("getAllLUTs returns registered LUTs", () => {
    const all = getAllLUTs();
    expect(all.length).toBeGreaterThanOrEqual(1);
    const found = all.find((l) => l.id === "my-lut");
    expect(found).toBeDefined();
    expect(found!.size).toBe(2);
  });

  test("getLUT returns undefined for unknown id", () => {
    expect(getLUT("non-existent-lut-id")).toBeUndefined();
  });
});

// 
//  4. LOTTIE UTILITIES
// 

describe("parseLottieJSON", () => {
  const VALID_LOTTIE = JSON.stringify({
    nm: "Bouncing Ball",
    w: 1920,
    h: 1080,
    fr: 30,
    ip: 0,
    op: 90,
    layers: [],
  });

  test("returns valid=true for well-formed Lottie JSON", () => {
    const result = parseLottieJSON(VALID_LOTTIE);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test("extracts metadata correctly", () => {
    const result = parseLottieJSON(VALID_LOTTIE);
    expect(result.metadata!.name).toBe("Bouncing Ball");
    expect(result.metadata!.width).toBe(1920);
    expect(result.metadata!.height).toBe(1080);
    expect(result.metadata!.fps).toBe(30);
    expect(result.metadata!.totalFrames).toBe(90);
    expect(result.metadata!.duration).toBe(3); // 90/30
  });

  test("calculates totalFrames as op - ip", () => {
    const json = JSON.stringify({ w: 100, h: 100, fr: 24, ip: 10, op: 34 });
    const result = parseLottieJSON(json);
    expect(result.metadata!.totalFrames).toBe(24);
    expect(result.metadata!.duration).toBe(1); // 24/24
  });

  test("defaults name to Untitled Animation when nm is missing", () => {
    const json = JSON.stringify({ w: 100, h: 100, fr: 30, ip: 0, op: 30 });
    const result = parseLottieJSON(json);
    expect(result.metadata!.name).toBe("Untitled Animation");
  });

  test("defaults ip to 0 when not present", () => {
    const json = JSON.stringify({ w: 100, h: 100, fr: 30, op: 60 });
    const result = parseLottieJSON(json);
    expect(result.metadata!.totalFrames).toBe(60);
  });

  test("returns valid=false for missing required fields (w)", () => {
    const json = JSON.stringify({ h: 100, fr: 30, op: 60 });
    const result = parseLottieJSON(json);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("missing");
  });

  test("returns valid=false for missing fr field", () => {
    const json = JSON.stringify({ w: 100, h: 100, op: 60 });
    const result = parseLottieJSON(json);
    expect(result.valid).toBe(false);
  });

  test("returns valid=false for invalid JSON string", () => {
    const result = parseLottieJSON("{not valid json}");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid JSON");
  });

  test("returns valid=false for completely empty object", () => {
    const result = parseLottieJSON("{}");
    expect(result.valid).toBe(false);
  });
});

describe("Lottie store (registerLottie, getLottieData, getAllLotties)", () => {
  test("register and retrieve Lottie data", () => {
    const data = { w: 100, h: 100, fr: 30, op: 60, layers: [] };
    registerLottie("bounce", data);
    expect(getLottieData("bounce")).toEqual(data);
  });

  test("getAllLotties returns registered IDs", () => {
    const all = getAllLotties();
    expect(all).toContain("bounce");
  });

  test("getLottieData returns undefined for unknown id", () => {
    expect(getLottieData("does-not-exist")).toBeUndefined();
  });
});

// 
//  5. MEDIA UTILITIES
// 

describe("getMediaTypeFromFile", () => {
  function makeFile(name: string, type: string): File {
    return new File([""], name, { type });
  }

  test("returns 'image' for image/* MIME types", () => {
    expect(getMediaTypeFromFile({ file: makeFile("photo.png", "image/png") })).toBe("image");
    expect(getMediaTypeFromFile({ file: makeFile("photo.jpg", "image/jpeg") })).toBe("image");
    expect(getMediaTypeFromFile({ file: makeFile("icon.svg", "image/svg+xml") })).toBe("image");
  });

  test("returns 'video' for video/* MIME types", () => {
    expect(getMediaTypeFromFile({ file: makeFile("clip.mp4", "video/mp4") })).toBe("video");
    expect(getMediaTypeFromFile({ file: makeFile("clip.webm", "video/webm") })).toBe("video");
  });

  test("returns 'audio' for audio/* MIME types", () => {
    expect(getMediaTypeFromFile({ file: makeFile("song.mp3", "audio/mpeg") })).toBe("audio");
    expect(getMediaTypeFromFile({ file: makeFile("track.wav", "audio/wav") })).toBe("audio");
  });

  test("returns null for unknown MIME types", () => {
    expect(getMediaTypeFromFile({ file: makeFile("doc.pdf", "application/pdf") })).toBeNull();
    expect(getMediaTypeFromFile({ file: makeFile("data.json", "application/json") })).toBeNull();
  });

  test("returns null for empty MIME type", () => {
    expect(getMediaTypeFromFile({ file: makeFile("file", "") })).toBeNull();
  });
});

describe("mediaSupportsAudio", () => {
  test("returns true for video media", () => {
    const media = { id: "1", type: "video" as const, name: "clip.mp4", file: new File([""], "clip.mp4") };
    expect(mediaSupportsAudio({ media })).toBe(true);
  });

  test("returns true for audio media", () => {
    const media = { id: "2", type: "audio" as const, name: "song.mp3", file: new File([""], "song.mp3") };
    expect(mediaSupportsAudio({ media })).toBe(true);
  });

  test("returns false for image media", () => {
    const media = { id: "3", type: "image" as const, name: "photo.png", file: new File([""], "photo.png") };
    expect(mediaSupportsAudio({ media })).toBe(false);
  });

  test("returns false for null media", () => {
    expect(mediaSupportsAudio({ media: null })).toBe(false);
  });

  test("returns false for undefined media", () => {
    expect(mediaSupportsAudio({ media: undefined })).toBe(false);
  });

  test("SUPPORTS_AUDIO contains audio and video", () => {
    expect(SUPPORTS_AUDIO).toContain("audio");
    expect(SUPPORTS_AUDIO).toContain("video");
    expect(SUPPORTS_AUDIO).not.toContain("image");
  });
});

// 
//  6. AUTO-CAPTION
// 

describe("generatePlaceholderCaptions", () => {
  test("generates correct number of segments for even duration", () => {
    const captions = generatePlaceholderCaptions(20, 5);
    expect(captions).toHaveLength(4);
  });

  test("generates correct number of segments for non-even duration", () => {
    const captions = generatePlaceholderCaptions(12, 5);
    // 0-5, 5-10, 10-12 = 3 segments
    expect(captions).toHaveLength(3);
  });

  test("segments span the entire duration without gaps", () => {
    const captions = generatePlaceholderCaptions(15, 5);
    expect(captions[0].startTime).toBe(0);
    expect(captions[0].endTime).toBe(5);
    expect(captions[1].startTime).toBe(5);
    expect(captions[1].endTime).toBe(10);
    expect(captions[2].startTime).toBe(10);
    expect(captions[2].endTime).toBe(15);
  });

  test("last segment endTime is clamped to duration", () => {
    const captions = generatePlaceholderCaptions(7, 5);
    expect(captions[1].endTime).toBe(7);
  });

  test("generates placeholder text with sequential numbering", () => {
    const captions = generatePlaceholderCaptions(10, 5);
    expect(captions[0].text).toBe("[Caption 1]");
    expect(captions[1].text).toBe("[Caption 2]");
  });

  test("uses default interval of 5 seconds", () => {
    const captions = generatePlaceholderCaptions(10);
    expect(captions).toHaveLength(2);
    expect(captions[0].endTime).toBe(5);
  });

  test("returns empty array for zero duration", () => {
    expect(generatePlaceholderCaptions(0)).toEqual([]);
  });

  test("handles very short duration (less than interval)", () => {
    const captions = generatePlaceholderCaptions(2, 5);
    expect(captions).toHaveLength(1);
    expect(captions[0].startTime).toBe(0);
    expect(captions[0].endTime).toBe(2);
  });
});

// 
//  7. EFFECTS REGISTRY
// 

describe("Effects registry", () => {
  const testEffectDef = {
    type: "test-glow",
    name: "Test Glow",
    keywords: ["glow", "shine"],
    params: [
      {
        key: "intensity",
        label: "Intensity",
        type: "number" as const,
        default: 50,
        min: 0,
        max: 100,
        step: 1,
      },
      {
        key: "color",
        label: "Color",
        type: "color" as const,
        default: "#ffffff",
      },
    ],
    renderer: {
      type: "webgl" as const,
      passes: [],
    },
  };

  test("registerEffect and hasEffect", () => {
    registerEffect({ definition: testEffectDef });
    expect(hasEffect({ effectType: "test-glow" })).toBe(true);
  });

  test("getEffect returns the registered definition", () => {
    const def = getEffect({ effectType: "test-glow" });
    expect(def.name).toBe("Test Glow");
    expect(def.keywords).toEqual(["glow", "shine"]);
  });

  test("getEffect throws for unknown effect type", () => {
    expect(() => getEffect({ effectType: "non-existent-effect" })).toThrow(
      "Unknown effect type"
    );
  });

  test("getAllEffects includes registered effects", () => {
    const effects = getAllEffects();
    const found = effects.find((e) => e.type === "test-glow");
    expect(found).toBeDefined();
  });

  test("hasEffect returns false for unregistered type", () => {
    expect(hasEffect({ effectType: "unregistered-xyz-123" })).toBe(false);
  });
});

describe("buildDefaultEffectInstance", () => {
  test("creates an effect instance with default param values", () => {
    // "test-glow" was registered in the previous describe block
    const instance = buildDefaultEffectInstance({ effectType: "test-glow" });
    expect(instance.type).toBe("test-glow");
    expect(instance.enabled).toBe(true);
    expect(instance.params.intensity).toBe(50);
    expect(instance.params.color).toBe("#ffffff");
  });

  test("generates a UUID for the effect instance", () => {
    const inst1 = buildDefaultEffectInstance({ effectType: "test-glow" });
    const inst2 = buildDefaultEffectInstance({ effectType: "test-glow" });
    expect(inst1.id).toBeTruthy();
    expect(inst2.id).toBeTruthy();
    expect(inst1.id).not.toBe(inst2.id);
  });

  test("throws when building instance for unknown effect", () => {
    expect(() =>
      buildDefaultEffectInstance({ effectType: "no-such-effect" })
    ).toThrow();
  });
});

// 
//  8. REMOTION TEMPLATES
// 

describe("Remotion Templates", () => {
  test("TEMPLATES is a non-empty array", () => {
    expect(TEMPLATES.length).toBeGreaterThan(0);
  });

  test("every template has required fields", () => {
    for (const t of TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.category).toBeTruthy();
      expect(typeof t.defaultDuration).toBe("number");
      expect(t.defaultDuration).toBeGreaterThan(0);
      expect(typeof t.code).toBe("string");
      expect(t.code.length).toBeGreaterThan(0);
      expect(Array.isArray(t.customizableProps)).toBe(true);
    }
  });

  test("every template ID is unique", () => {
    const ids = TEMPLATES.map((t) => t.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

describe("getTemplate", () => {
  test("returns template by ID", () => {
    const t = getTemplate("youtube-intro");
    expect(t).toBeDefined();
    expect(t!.name).toBe("YouTube Intro");
  });

  test("returns undefined for unknown ID", () => {
    expect(getTemplate("non-existent-template")).toBeUndefined();
  });

  test("finds lower-third template", () => {
    const t = getTemplate("lower-third");
    expect(t).toBeDefined();
    expect(t!.category).toBe("lower-third");
  });
});

describe("getTemplatesByCategory", () => {
  test("returns intro templates", () => {
    const intros = getTemplatesByCategory("intro");
    expect(intros.length).toBeGreaterThan(0);
    for (const t of intros) {
      expect(t.category).toBe("intro");
    }
  });

  test("returns overlay templates", () => {
    const overlays = getTemplatesByCategory("overlay");
    expect(overlays.length).toBeGreaterThan(0);
    for (const t of overlays) {
      expect(t.category).toBe("overlay");
    }
  });

  test("returns empty array for non-existent category", () => {
    expect(getTemplatesByCategory("nonexistent")).toEqual([]);
  });
});

describe("getAllTemplates", () => {
  test("returns a copy of TEMPLATES (not the same reference)", () => {
    const all = getAllTemplates();
    expect(all).toEqual(TEMPLATES);
    expect(all).not.toBe(TEMPLATES);
  });

  test("modifying the returned array does not affect TEMPLATES", () => {
    const all = getAllTemplates();
    const originalLength = TEMPLATES.length;
    all.pop();
    expect(TEMPLATES.length).toBe(originalLength);
  });
});

// 
//  9. STICKER ID
// 

describe("parseStickerId", () => {
  test("parses simple provider:value format", () => {
    const result = parseStickerId({ stickerId: "emoji:smile" });
    expect(result.providerId).toBe("emoji");
    expect(result.providerValue).toBe("smile");
  });

  test("parses nested colons (only first colon is separator)", () => {
    const result = parseStickerId({ stickerId: "icons:mdi:home" });
    expect(result.providerId).toBe("icons");
    expect(result.providerValue).toBe("mdi:home");
  });

  test("trims whitespace from input", () => {
    const result = parseStickerId({ stickerId: "  emoji:star  " });
    expect(result.providerId).toBe("emoji");
    expect(result.providerValue).toBe("star");
  });

  test("throws for empty string", () => {
    expect(() => parseStickerId({ stickerId: "" })).toThrow("non-empty");
  });

  test("throws for whitespace-only string", () => {
    expect(() => parseStickerId({ stickerId: "   " })).toThrow("non-empty");
  });

  test("throws for missing provider (starts with :)", () => {
    expect(() => parseStickerId({ stickerId: ":value" })).toThrow("Invalid sticker ID");
  });

  test("throws for missing value (ends with :)", () => {
    expect(() => parseStickerId({ stickerId: "provider:" })).toThrow("Invalid sticker ID");
  });

  test("throws for no colon separator", () => {
    expect(() => parseStickerId({ stickerId: "no-separator" })).toThrow("Invalid sticker ID");
  });
});

describe("buildStickerId", () => {
  test("builds provider:value format", () => {
    expect(
      buildStickerId({ providerId: "emoji", providerValue: "grinning" })
    ).toBe("emoji:grinning");
  });

  test("preserves nested colons in providerValue", () => {
    expect(
      buildStickerId({ providerId: "icons", providerValue: "mdi:close" })
    ).toBe("icons:mdi:close");
  });

  test("roundtrips through parse and build", () => {
    const original = "flags:country:US";
    const parsed = parseStickerId({ stickerId: original });
    const rebuilt = buildStickerId(parsed);
    expect(rebuilt).toBe(original);
  });
});

// 
//  10. SECURITY LOG
// 

describe("Security log", () => {
  test("logSecurity adds an entry to the log", () => {
    const beforeLen = getSecurityLog().length;
    logSecurity("info", "test-event-info");
    expect(getSecurityLog().length).toBe(beforeLen + 1);
  });

  test("logged entry has correct severity and event", () => {
    logSecurity("warn", "suspicious-activity", { ip: "1.2.3.4" });
    const log = getSecurityLog();
    const last = log[log.length - 1];
    expect(last.severity).toBe("warn");
    expect(last.event).toBe("suspicious-activity");
    expect(last.details).toEqual({ ip: "1.2.3.4" });
  });

  test("logged entry has an ISO timestamp", () => {
    logSecurity("error", "auth-failure");
    const log = getSecurityLog();
    const last = log[log.length - 1];
    // ISO 8601 format check
    expect(last.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  test("getSecurityLog returns a copy (not the internal array)", () => {
    const log1 = getSecurityLog();
    const log2 = getSecurityLog();
    expect(log1).not.toBe(log2);
    expect(log1).toEqual(log2);
  });

  test("supports all severity levels", () => {
    const severities = ["info", "warn", "error", "critical"] as const;
    for (const sev of severities) {
      logSecurity(sev, `test-${sev}`);
    }
    const log = getSecurityLog();
    const lastFour = log.slice(-4);
    expect(lastFour.map((e) => e.severity)).toEqual([
      "info",
      "warn",
      "error",
      "critical",
    ]);
  });

  test("details field is optional", () => {
    logSecurity("info", "no-details");
    const log = getSecurityLog();
    const last = log[log.length - 1];
    expect(last.details).toBeUndefined();
  });
});

// 
//  11. ACTION DEFINITIONS
// 

describe("ACTIONS constant", () => {
  test("ACTIONS is a non-empty object", () => {
    const keys = Object.keys(ACTIONS);
    expect(keys.length).toBeGreaterThan(0);
  });

  test("every action has a description and category", () => {
    for (const [key, def] of Object.entries(ACTIONS)) {
      expect(def.description).toBeTruthy();
      expect(def.category).toBeTruthy();
    }
  });

  test("contains expected actions", () => {
    expect(ACTIONS["toggle-play"]).toBeDefined();
    expect(ACTIONS.split).toBeDefined();
    expect(ACTIONS.undo).toBeDefined();
    expect(ACTIONS.redo).toBeDefined();
    expect(ACTIONS["delete-selected"]).toBeDefined();
  });

  test("toggle-play has space as default shortcut", () => {
    expect(ACTIONS["toggle-play"].defaultShortcuts).toContain("space");
  });
});

describe("getActionDefinition", () => {
  test("returns definition for toggle-play", () => {
    const def = getActionDefinition({ action: "toggle-play" });
    expect(def.description).toBe("Play/Pause");
    expect(def.category).toBe("playback");
  });

  test("returns definition for split", () => {
    const def = getActionDefinition({ action: "split" });
    expect(def.description).toBe("Split elements at playhead");
    expect(def.category).toBe("editing");
  });

  test("returns definition for undo", () => {
    const def = getActionDefinition({ action: "undo" });
    expect(def.category).toBe("history");
    expect(def.defaultShortcuts).toContain("ctrl+z");
  });
});

describe("getDefaultShortcuts", () => {
  test("returns a mapping of shortcut keys to actions", () => {
    const shortcuts = getDefaultShortcuts();
    expect(shortcuts["space"]).toBe("toggle-play");
  });

  test("maps k to toggle-play", () => {
    const shortcuts = getDefaultShortcuts();
    expect(shortcuts["k"]).toBe("toggle-play");
  });

  test("maps ctrl+z to undo", () => {
    const shortcuts = getDefaultShortcuts();
    expect(shortcuts["ctrl+z"]).toBe("undo");
  });

  test("maps s to split", () => {
    const shortcuts = getDefaultShortcuts();
    expect(shortcuts["s"]).toBe("split");
  });

  test("maps backspace and delete to delete-selected", () => {
    const shortcuts = getDefaultShortcuts();
    expect(shortcuts["backspace"]).toBe("delete-selected");
    expect(shortcuts["delete"]).toBe("delete-selected");
  });

  test("every mapped shortcut points to a valid action", () => {
    const shortcuts = getDefaultShortcuts();
    const actionKeys = Object.keys(ACTIONS);
    for (const action of Object.values(shortcuts)) {
      expect(actionKeys).toContain(action);
    }
  });
});

// 
//  12. ACTION REGISTRY (bind / unbind / invoke)
// 

describe("Action registry (bind / unbind / invoke)", () => {
  test("bindAction + invokeAction calls handler", () => {
    let called = false;
    const handler = () => { called = true; };
    bindAction("toggle-play", handler);
    invokeAction("toggle-play");
    expect(called).toBe(true);
    unbindAction("toggle-play", handler);
  });

  test("invokeAction passes trigger parameter", () => {
    let receivedTrigger: string | undefined;
    const handler = (_: undefined, trigger?: string) => {
      receivedTrigger = trigger;
    };
    bindAction("split", handler);
    invokeAction("split", undefined, "keypress");
    expect(receivedTrigger).toBe("keypress");
    unbindAction("split", handler);
  });

  test("unbindAction removes handler so it no longer fires", () => {
    let count = 0;
    const handler = () => { count++; };
    bindAction("undo", handler);
    invokeAction("undo");
    expect(count).toBe(1);
    unbindAction("undo", handler);
    invokeAction("undo");
    expect(count).toBe(1); // Should not increase
  });

  test("multiple handlers can be bound to same action", () => {
    let count1 = 0;
    let count2 = 0;
    const handler1 = () => { count1++; };
    const handler2 = () => { count2++; };
    bindAction("redo", handler1);
    bindAction("redo", handler2);
    invokeAction("redo");
    expect(count1).toBe(1);
    expect(count2).toBe(1);
    unbindAction("redo", handler1);
    unbindAction("redo", handler2);
  });

  test("unbinding one handler does not affect others", () => {
    let count1 = 0;
    let count2 = 0;
    const handler1 = () => { count1++; };
    const handler2 = () => { count2++; };
    bindAction("goto-start", handler1);
    bindAction("goto-start", handler2);
    unbindAction("goto-start", handler1);
    invokeAction("goto-start");
    expect(count1).toBe(0);
    expect(count2).toBe(1);
    unbindAction("goto-start", handler2);
  });

  test("invoking an action with no bound handlers does not throw", () => {
    expect(() => invokeAction("stop-playback")).not.toThrow();
  });

  test("unbinding a non-bound handler does not throw", () => {
    const handler = () => {};
    expect(() => unbindAction("toggle-snapping", handler)).not.toThrow();
  });
});

// 
//  13. GRADIENT PARSER
// 

describe("parseGradient", () => {
  test("parses a simple linear-gradient with two hex colors", () => {
    const result = parseGradient({ code: "linear-gradient(#ff0000, #0000ff)" });
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("linear-gradient");
    expect(result[0].colorStops).toHaveLength(2);
    expect(result[0].colorStops[0].type).toBe("hex");
    expect(result[0].colorStops[0].value).toBe("ff0000");
    expect(result[0].colorStops[1].value).toBe("0000ff");
  });

  test("parses linear-gradient with directional orientation", () => {
    const result = parseGradient({
      code: "linear-gradient(to right, red, blue)",
    });
    expect(result[0].orientation).toBeDefined();
    expect((result[0].orientation as any).type).toBe("directional");
    expect((result[0].orientation as any).value).toBe("right");
  });

  test("parses linear-gradient with angle", () => {
    const result = parseGradient({
      code: "linear-gradient(45deg, red, blue)",
    });
    expect(result[0].orientation).toBeDefined();
    expect((result[0].orientation as any).type).toBe("angular");
    expect((result[0].orientation as any).value).toBe("45");
  });

  test("parses gradient with rgb colors", () => {
    const result = parseGradient({
      code: "linear-gradient(rgb(255, 0, 0), rgb(0, 0, 255))",
    });
    expect(result[0].colorStops).toHaveLength(2);
    expect(result[0].colorStops[0].type).toBe("rgb");
    expect(result[0].colorStops[0].value).toEqual(["255", "0", "0"]);
  });

  test("parses gradient with rgba colors", () => {
    const result = parseGradient({
      code: "linear-gradient(rgba(255, 0, 0, 0.5), rgba(0, 0, 255, 1))",
    });
    expect(result[0].colorStops[0].type).toBe("rgba");
    expect(result[0].colorStops[0].value).toEqual(["255", "0", "0", "0.5"]);
  });

  test("parses gradient with percentage stops", () => {
    const result = parseGradient({
      code: "linear-gradient(red 0%, blue 100%)",
    });
    expect(result[0].colorStops[0].length).toBeDefined();
    expect(result[0].colorStops[0].length!.type).toBe("%");
    expect(result[0].colorStops[0].length!.value).toBe("0");
    expect(result[0].colorStops[1].length!.value).toBe("100");
  });

  test("parses three-stop gradient", () => {
    const result = parseGradient({
      code: "linear-gradient(red, green, blue)",
    });
    expect(result[0].colorStops).toHaveLength(3);
  });

  test("parses radial-gradient", () => {
    const result = parseGradient({
      code: "radial-gradient(circle, red, blue)",
    });
    expect(result[0].type).toBe("radial-gradient");
  });

  test("parses repeating-linear-gradient", () => {
    const result = parseGradient({
      code: "repeating-linear-gradient(red, blue 20px)",
    });
    expect(result[0].type).toBe("repeating-linear-gradient");
  });

  test("parses multiple gradients separated by comma", () => {
    const result = parseGradient({
      code: "linear-gradient(red, blue), linear-gradient(green, yellow)",
    });
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe("linear-gradient");
    expect(result[1].type).toBe("linear-gradient");
  });

  test("strips trailing semicolons", () => {
    const result = parseGradient({
      code: "linear-gradient(red, blue);",
    });
    expect(result).toHaveLength(1);
  });

  test("parses gradient with literal color names", () => {
    const result = parseGradient({
      code: "linear-gradient(red, blue)",
    });
    expect(result[0].colorStops[0].type).toBe("literal");
    expect(result[0].colorStops[0].value).toBe("red");
  });

  test("throws for invalid input", () => {
    expect(() => parseGradient({ code: "not-a-gradient()" })).toThrow();
  });
});

// 
//  14. TRANSCRIPTION CAPTIONS
// 

describe("buildCaptionChunks", () => {
  test("splits a single segment into chunks of N words", () => {
    const segments = [
      { text: "one two three four five six", start: 0, end: 6 },
    ];
    const chunks = buildCaptionChunks({ segments, wordsPerChunk: 3 });
    expect(chunks).toHaveLength(2);
    expect(chunks[0].text).toBe("one two three");
    expect(chunks[1].text).toBe("four five six");
  });

  test("each chunk has a startTime and positive duration", () => {
    const segments = [
      { text: "hello world", start: 0, end: 2 },
    ];
    const chunks = buildCaptionChunks({ segments, wordsPerChunk: 2 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0].startTime).toBe(0);
    expect(chunks[0].duration).toBeGreaterThan(0);
  });

  test("handles multiple segments", () => {
    const segments = [
      { text: "first segment words", start: 0, end: 3 },
      { text: "second segment here", start: 3, end: 6 },
    ];
    const chunks = buildCaptionChunks({ segments, wordsPerChunk: 3 });
    expect(chunks).toHaveLength(2);
    expect(chunks[0].text).toBe("first segment words");
    expect(chunks[1].text).toBe("second segment here");
  });

  test("respects minDuration parameter", () => {
    const segments = [
      { text: "a", start: 0, end: 0.1 }, // Very short segment
    ];
    const chunks = buildCaptionChunks({
      segments,
      wordsPerChunk: 3,
      minDuration: 1.0,
    });
    expect(chunks[0].duration).toBeGreaterThanOrEqual(1.0);
  });

  test("returns empty array for empty segments", () => {
    expect(buildCaptionChunks({ segments: [] })).toEqual([]);
  });

  test("skips segments with empty text", () => {
    const segments = [{ text: "", start: 0, end: 1 }];
    expect(buildCaptionChunks({ segments })).toEqual([]);
  });

  test("handles segment with more words than wordsPerChunk", () => {
    const segments = [
      { text: "one two three four five six seven", start: 0, end: 7 },
    ];
    const chunks = buildCaptionChunks({ segments, wordsPerChunk: 2 });
    // 7 words / 2 per chunk = 4 chunks (2, 2, 2, 1)
    expect(chunks).toHaveLength(4);
    expect(chunks[0].text).toBe("one two");
    expect(chunks[1].text).toBe("three four");
    expect(chunks[2].text).toBe("five six");
    expect(chunks[3].text).toBe("seven");
  });

  test("chunks do not overlap in time", () => {
    const segments = [
      { text: "a b c d e f", start: 0, end: 6 },
    ];
    const chunks = buildCaptionChunks({ segments, wordsPerChunk: 2 });
    for (let i = 1; i < chunks.length; i++) {
      const prevEnd = chunks[i - 1].startTime + chunks[i - 1].duration;
      expect(chunks[i].startTime).toBeGreaterThanOrEqual(prevEnd - 0.001);
    }
  });

  test("uses default wordsPerChunk of 3 when not specified", () => {
    const segments = [
      { text: "one two three four five six", start: 0, end: 6 },
    ];
    const chunks = buildCaptionChunks({ segments });
    expect(chunks).toHaveLength(2);
    expect(chunks[0].text).toBe("one two three");
  });
});
