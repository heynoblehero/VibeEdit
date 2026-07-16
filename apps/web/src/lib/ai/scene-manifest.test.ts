import { describe, expect, it } from "bun:test";
import {
  getScene,
  parseScenes,
  replaceScene,
  resolveSceneAtTime,
  sceneSummary,
} from "./scene-manifest";

const HTML = `<div id="root" data-composition-id="demo" data-width="1920" data-height="1080" data-start="0" data-duration="25">
  <div class="scene" data-scene-id="scene-1" data-scene-start="0" data-scene-duration="10">
    <div class="bg"></div>
    <h1>Hi</h1>
  </div>
  <div class="scene" data-scene-id="scene-2" data-scene-start="10" data-scene-duration="5">
    <img src="assets/pic.png" />
    <div class="caption"><div class="pill">yo</div></div>
  </div>
  <div class="scene" data-scene-id="scene-3" data-scene-start="15" data-scene-duration="10">
    <p>end</p>
  </div>
</div>
<script>
  // stray tokens that must NOT break scene parsing
  const html = "<div>not a scene</div>";
  const tl = gsap.timeline({ paused: true });
</script>`;

describe("parseScenes", () => {
  it("finds each top-level scene with its time range", () => {
    const scenes = parseScenes(HTML);
    expect(scenes.map((s) => s.id)).toEqual(["scene-1", "scene-2", "scene-3"]);
    expect(scenes[0].start).toBe(0);
    expect(scenes[0].duration).toBe(10);
    expect(scenes[1].start).toBe(10);
  });

  it("handles nested divs inside a scene without leaking the boundary", () => {
    const scene = getScene(HTML, "scene-2");
    expect(scene).not.toBeNull();
    expect(scene?.html).toContain('<div class="pill">yo</div>');
    expect(scene?.html.endsWith("</div>")).toBe(true);
    // Must not swallow scene-3.
    expect(scene?.html).not.toContain("scene-3");
  });

  it("ignores <div> tokens inside <script>", () => {
    const scenes = parseScenes(HTML);
    // Only the three real scenes — the script's "<div>not a scene</div>" is skipped.
    expect(scenes.length).toBe(3);
  });

  it("returns [] for legacy comps with no markers", () => {
    expect(parseScenes("<div id=root><h1>hello</h1></div>")).toEqual([]);
  });
});

describe("resolveSceneAtTime", () => {
  it("maps a playhead time to the scene whose window contains it", () => {
    expect(resolveSceneAtTime(HTML, 3)?.id).toBe("scene-1");
    expect(resolveSceneAtTime(HTML, 12)?.id).toBe("scene-2");
    expect(resolveSceneAtTime(HTML, 20)?.id).toBe("scene-3");
  });

  it("falls back to the latest scene starting at or before the time", () => {
    expect(resolveSceneAtTime(HTML, 100)?.id).toBe("scene-3");
  });
});

describe("replaceScene", () => {
  it("swaps only the targeted scene and leaves the rest intact", () => {
    const next = replaceScene(
      HTML,
      "scene-2",
      '<div class="scene" data-scene-id="scene-2" data-scene-start="10" data-scene-duration="5"><b>new</b></div>',
    );
    expect(next).not.toBeNull();
    expect(next).toContain("<b>new</b>");
    expect(next).not.toContain('<img src="assets/pic.png" />');
    // Siblings untouched.
    expect(next).toContain("scene-1");
    expect(next).toContain("scene-3");
    // Still parses to three scenes.
    expect(parseScenes(next as string).length).toBe(3);
  });

  it("returns null for an unknown scene id", () => {
    expect(replaceScene(HTML, "nope", "x")).toBeNull();
  });
});

describe("sceneSummary", () => {
  it("lists scenes for the agent", () => {
    const summary = sceneSummary(HTML);
    expect(summary).toContain("scene-1");
    expect(summary).toContain("starts 0s");
  });

  it("explains the fallback when there are no scenes", () => {
    expect(sceneSummary("<div>x</div>")).toContain("No addressable scenes");
  });
});
