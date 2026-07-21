import { describe, expect, test } from "bun:test";
import { buildCaptionLayer, type OverlayCue } from "./overlay-generator.js";
import { CAPTION_PRESETS } from "./presets.js";

const cues: OverlayCue[] = [
  { text: "hello world", start: 0, end: 1.5 },
  { text: "second cue", start: 1.5, end: 3 },
];

function build(presetId: keyof typeof CAPTION_PRESETS = "bold") {
  return buildCaptionLayer({ cues, width: 1080, height: 1920, totalDuration: 3, presetId });
}

describe("buildCaptionLayer", () => {
  test("registers exactly one 'captions' timeline (no colliding master)", () => {
    const html = build();
    const registrations = html.match(/window\.__timelines\[/g) ?? [];
    // Assignment line only (the `||` guard uses a different form).
    expect(html).toContain('window.__timelines["captions"]=tl;');
    expect(registrations.length).toBe(1);
    expect(html).not.toContain('"main"');
  });

  test("emits one cue div per cue with global-time data attributes", () => {
    const html = build();
    const cueCount = (html.match(/class="vibe-cue"/g) ?? []).length;
    expect(cueCount).toBe(2);
    expect(html).toContain('data-start="0"');
    expect(html).toContain('data-end="1.5"');
  });

  test("pads the timeline to the total duration", () => {
    const html = build();
    expect(html).toContain("tl.to({},{duration:3});");
  });

  test("escapes caption text (no raw injection)", () => {
    const html = buildCaptionLayer({
      cues: [{ text: "<script>alert(1)</script>", start: 0, end: 1 }],
      width: 1080,
      height: 1920,
      totalDuration: 1,
    });
    // The caption text must not create a real, un-namespaced <script> tag.
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    // Only the generator's own timeline <script> should exist.
    expect((html.match(/<script>/g) ?? []).length).toBe(1);
  });

  test("word-pop presets animate words; minimal presets do not", () => {
    expect(build("bold")).toContain("back.out(2.2)");
    expect(build("minimal")).not.toContain("back.out(2.2)");
  });

  test("distributes words evenly when no per-word timings are given", () => {
    const html = build("bold");
    // "hello world" over [0,1.5] → split at 0.75.
    expect(html).toContain('<span class="vibe-word" data-start="0" data-end="0.75">hello</span>');
    expect(html).toContain('data-start="0.75" data-end="1.5">world</span>');
  });

  test("gradient presets skip the color-swap that would fight the clip fill", () => {
    const html = build("gradient");
    expect(html).toContain("background-clip:text");
    // No inline color tweens for gradient presets (they'd override the clip).
    expect(html).not.toMatch(/tl\.set\(w,\{color:/);
  });
});
