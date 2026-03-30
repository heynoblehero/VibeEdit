import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { executeAIActions } from "@/lib/ai/executor";
import type { AIAction, AIActionTool } from "@/lib/ai/types";

/* 
 * Mock state accumulators
 *  */

let mockTracks: any[] = [];
let mockAssets: any[] = [];
let insertElementCalls: any[] = [];
let updateElementsCalls: any[] = [];
let deleteElementsCalls: any[] = [];
let moveElementCalls: any[] = [];
let splitElementsCalls: any[] = [];
let upsertKeyframesCalls: any[] = [];
let removeKeyframesCalls: any[] = [];
let addClipEffectCalls: any[] = [];
let updateClipEffectParamsCalls: any[] = [];
let seekCalls: any[] = [];
let undoCalls: number;
let redoCalls: number;
let addMediaAssetCalls: any[] = [];
let lastCanvasOps: string[] = [];

/* 
 * Canvas mock
 *  */

function createMockCtx() {
  const ops: string[] = [];
  lastCanvasOps = ops;
  return {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    fillRect: (...a: unknown[]) => ops.push(`fillRect(${a.join(",")})`),
    strokeRect: (...a: unknown[]) => ops.push(`strokeRect(${a.join(",")})`),
    beginPath: () => ops.push("beginPath"),
    moveTo: (...a: unknown[]) => ops.push(`moveTo(${a.join(",")})`),
    lineTo: (...a: unknown[]) => ops.push(`lineTo(${a.join(",")})`),
    stroke: () => ops.push("stroke"),
    arc: (...a: unknown[]) => ops.push(`arc(${a.join(",")})`),
    closePath: () => ops.push("closePath"),
    fill: () => ops.push("fill"),
    save: () => ops.push("save"),
    restore: () => ops.push("restore"),
    clearRect: (...a: unknown[]) => ops.push(`clearRect(${a.join(",")})`),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    _ops: ops,
  };
}

function createMockCanvas() {
  const ctx = createMockCtx();
  return {
    width: 0,
    height: 0,
    getContext: (type: string) => (type === "2d" ? ctx : null),
    toBlob: (cb: (b: Blob | null) => void, mime?: string) => {
      setTimeout(
        () => cb(new Blob(["fake-png"], { type: mime || "image/png" })),
        0
      );
    },
    toDataURL: () => "data:image/jpeg;base64,fakethumb",
    _ctx: ctx,
  };
}

/* 
 * Default tracks used by most tests (two tracks, each with one element)
 *  */

function defaultTracks() {
  return [
    {
      id: "track-video-1",
      type: "video",
      elements: [
        {
          id: "el-v1",
          type: "video",
          name: "Clip A",
          startTime: 0,
          duration: 10,
          trimStart: 0,
          trimEnd: 0,
          mediaId: "media-1",
          transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
          opacity: 1,
        },
      ],
    },
    {
      id: "track-text-1",
      type: "text",
      elements: [
        {
          id: "el-t1",
          type: "text",
          name: "Title",
          content: "Hello",
          startTime: 2,
          duration: 5,
          trimStart: 0,
          trimEnd: 0,
          fontSize: 48,
          fontFamily: "Inter",
          color: "#ffffff",
          transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
          opacity: 1,
        },
      ],
    },
    {
      id: "track-audio-1",
      type: "audio",
      elements: [
        {
          id: "el-a1",
          type: "audio",
          name: "Music",
          startTime: 0,
          duration: 30,
          trimStart: 0,
          trimEnd: 0,
          volume: 0.8,
          mediaId: "media-2",
        },
      ],
    },
  ];
}

/* 
 * Setup / Teardown
 *  */

let savedDocument: any;
let savedWindow: any;

function setupMocks(tracks?: any[]) {
  mockTracks = tracks ?? defaultTracks();
  mockAssets = [
    { id: "media-1", name: "clip.mp4", type: "video", duration: 30 },
    { id: "media-2", name: "song.mp3", type: "audio", duration: 120 },
    { id: "media-3", name: "photo.jpg", type: "image", width: 1920, height: 1080 },
  ];
  insertElementCalls = [];
  updateElementsCalls = [];
  deleteElementsCalls = [];
  moveElementCalls = [];
  splitElementsCalls = [];
  upsertKeyframesCalls = [];
  removeKeyframesCalls = [];
  addClipEffectCalls = [];
  updateClipEffectParamsCalls = [];
  seekCalls = [];
  undoCalls = 0;
  redoCalls = 0;
  addMediaAssetCalls = [];
  lastCanvasOps = [];

  const mockEditor = {
    timeline: {
      getTracks: () => mockTracks,
      getTotalDuration: () => 60,
      insertElement: (p: any) => insertElementCalls.push(p),
      updateElements: (p: any) => updateElementsCalls.push(p),
      deleteElements: (p: any) => deleteElementsCalls.push(p),
      moveElement: (p: any) => moveElementCalls.push(p),
      splitElements: (p: any) => splitElementsCalls.push(p),
      upsertKeyframes: (p: any) => upsertKeyframesCalls.push(p),
      removeKeyframes: (p: any) => removeKeyframesCalls.push(p),
      addClipEffect: (p: any) => {
        addClipEffectCalls.push(p);
        return "effect-" + addClipEffectCalls.length;
      },
      updateClipEffectParams: (p: any) => updateClipEffectParamsCalls.push(p),
    },
    media: {
      getAssets: () => mockAssets,
      addMediaAsset: async (p: any) => {
        addMediaAssetCalls.push(p);
        const id = `asset-gen-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        mockAssets.push({ id, name: p.asset.name, type: p.asset.type });
      },
    },
    project: {
      getActive: () => ({
        metadata: { id: "proj-1", name: "Test Project" },
        settings: {
          canvasSize: { width: 1920, height: 1080 },
          background: { type: "color", color: "#000000" },
        },
        scenes: [{ tracks: mockTracks }],
      }),
    },
    playback: {
      getCurrentTime: () => 5,
      seek: (p: any) => seekCalls.push(p),
    },
    command: {
      undo: () => { undoCalls++; },
      redo: () => { redoCalls++; },
    },
  };

  savedWindow = (globalThis as any).window;
  savedDocument = (globalThis as any).document;

  (globalThis as any).window = (globalThis as any).window || {};
  (globalThis as any).window.__editor = mockEditor;

  // document.createElement mock for canvas and anchor (<a>) elements
  if (typeof (globalThis as any).document === "undefined") {
    (globalThis as any).document = {};
  }
  const origCreate = (globalThis as any).document?.createElement;
  (globalThis as any).document.createElement = (tag: string) => {
    if (tag === "canvas") return createMockCanvas();
    if (tag === "a") return { href: "", download: "", click: () => {} };
    if (origCreate) return origCreate.call(document, tag);
    return {};
  };
  // downloadProject calls document.body.appendChild / removeChild
  if (!(globalThis as any).document.body) {
    (globalThis as any).document.body = {
      appendChild: () => {},
      removeChild: () => {},
    };
  }

  // URL.createObjectURL / revokeObjectURL
  if (typeof URL.createObjectURL !== "function") {
    (URL as any).createObjectURL = () => `blob:mock-${Date.now()}`;
  }
  if (typeof URL.revokeObjectURL !== "function") {
    (URL as any).revokeObjectURL = () => {};
  }

  return mockEditor;
}

function teardownMocks() {
  delete (globalThis as any).window?.__editor;
}

/* 
 * Helpers
 *  */

async function run(tool: AIActionTool | string, params: Record<string, unknown> = {}) {
  const action: AIAction = { tool: tool as AIActionTool, params };
  const results = await executeAIActions([action]);
  return results[0];
}

/* 
 * 1. insert_text
 *  */

describe("insert_text", () => {
  beforeEach(() => setupMocks());
  afterEach(teardownMocks);

  test("inserts text with all defaults", async () => {
    const r = await run("insert_text", {});
    expect(r.success).toBe(true);
    expect(insertElementCalls).toHaveLength(1);
    const el = insertElementCalls[0].element;
    expect(el.type).toBe("text");
    expect(el.content).toBe("Text");
    expect(el.fontSize).toBe(48);
    expect(el.fontFamily).toBe("Inter");
    expect(el.color).toBe("#ffffff");
    expect(el.textAlign).toBe("center");
    expect(el.duration).toBe(5);
    expect(el.startTime).toBe(0);
    expect(el.opacity).toBe(1);
    expect(insertElementCalls[0].placement).toEqual({ mode: "auto", trackType: "text" });
  });

  test("inserts text with custom content and styling", async () => {
    const r = await run("insert_text", {
      content: "Subscribe!",
      fontSize: 72,
      fontFamily: "Arial",
      color: "#ff0000",
      textAlign: "left",
      fontWeight: "bold",
      fontStyle: "italic",
      textDecoration: "underline",
      duration: 3,
      startTime: 10,
      opacity: 0.5,
      name: "CTA",
    });
    expect(r.success).toBe(true);
    const el = insertElementCalls[0].element;
    expect(el.content).toBe("Subscribe!");
    expect(el.fontSize).toBe(72);
    expect(el.fontFamily).toBe("Arial");
    expect(el.color).toBe("#ff0000");
    expect(el.textAlign).toBe("left");
    expect(el.fontWeight).toBe("bold");
    expect(el.fontStyle).toBe("italic");
    expect(el.textDecoration).toBe("underline");
    expect(el.duration).toBe(3);
    expect(el.startTime).toBe(10);
    expect(el.opacity).toBe(0.5);
    expect(el.name).toBe("CTA");
  });

  test("uses content as default name when name not provided", async () => {
    const r = await run("insert_text", { content: "My Title" });
    expect(r.success).toBe(true);
    expect(insertElementCalls[0].element.name).toBe("My Title");
  });

  test("handles custom transform and background", async () => {
    const r = await run("insert_text", {
      content: "Positioned",
      transform: { scale: 2, position: { x: 100, y: -200 }, rotate: 45 },
      background: { enabled: true, color: "#333333" },
    });
    expect(r.success).toBe(true);
    const el = insertElementCalls[0].element;
    expect(el.transform).toEqual({ scale: 2, position: { x: 100, y: -200 }, rotate: 45 });
    expect(el.background).toEqual({ enabled: true, color: "#333333" });
  });

  test("fails when editor is not available", async () => {
    delete (globalThis as any).window.__editor;
    const r = await run("insert_text", { content: "fail" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("EditorCore not available");
  });
});

/* 
 * 2. insert_video
 *  */

describe("insert_video", () => {
  beforeEach(() => setupMocks());
  afterEach(teardownMocks);

  test("inserts video with mediaId and defaults", async () => {
    const r = await run("insert_video", { mediaId: "media-1" });
    expect(r.success).toBe(true);
    const el = insertElementCalls[0].element;
    expect(el.type).toBe("video");
    expect(el.mediaId).toBe("media-1");
    expect(el.name).toBe("Video");
    expect(el.duration).toBe(5);
    expect(insertElementCalls[0].placement.trackType).toBe("video");
  });

  test("fails without mediaId", async () => {
    const r = await run("insert_video", {});
    expect(r.success).toBe(false);
    expect(r.error).toContain("mediaId is required");
  });

  test("accepts custom params", async () => {
    const r = await run("insert_video", {
      mediaId: "media-1",
      name: "Intro Clip",
      duration: 15,
      startTime: 5,
      trimStart: 2,
      trimEnd: 1,
      scale: 0.5,
      position: { x: 50, y: 50 },
      opacity: 0.9,
    });
    expect(r.success).toBe(true);
    const el = insertElementCalls[0].element;
    expect(el.name).toBe("Intro Clip");
    expect(el.duration).toBe(15);
    expect(el.startTime).toBe(5);
    expect(el.trimStart).toBe(2);
    expect(el.trimEnd).toBe(1);
    expect(el.opacity).toBe(0.9);
  });
});

/* 
 * 3. insert_image
 *  */

describe("insert_image", () => {
  beforeEach(() => setupMocks());
  afterEach(teardownMocks);

  test("inserts image with mediaId", async () => {
    const r = await run("insert_image", { mediaId: "media-3" });
    expect(r.success).toBe(true);
    const el = insertElementCalls[0].element;
    expect(el.type).toBe("image");
    expect(el.mediaId).toBe("media-3");
    expect(insertElementCalls[0].placement.trackType).toBe("video");
  });

  test("fails without mediaId", async () => {
    const r = await run("insert_image", {});
    expect(r.success).toBe(false);
    expect(r.error).toContain("mediaId is required");
  });

  test("applies custom transform object", async () => {
    const r = await run("insert_image", {
      mediaId: "media-3",
      transform: { scale: 1.5, position: { x: 0, y: 100 }, rotate: 15 },
    });
    expect(r.success).toBe(true);
    expect(insertElementCalls[0].element.transform).toEqual({
      scale: 1.5,
      position: { x: 0, y: 100 },
      rotate: 15,
    });
  });

  test("defaults name to 'Image'", async () => {
    await run("insert_image", { mediaId: "media-3" });
    expect(insertElementCalls[0].element.name).toBe("Image");
  });
});

/* 
 * 4. insert_audio
 *  */

describe("insert_audio", () => {
  beforeEach(() => setupMocks());
  afterEach(teardownMocks);

  test("inserts audio with mediaId and defaults", async () => {
    const r = await run("insert_audio", { mediaId: "media-2" });
    expect(r.success).toBe(true);
    const el = insertElementCalls[0].element;
    expect(el.type).toBe("audio");
    expect(el.sourceType).toBe("upload");
    expect(el.mediaId).toBe("media-2");
    expect(el.volume).toBe(1);
    expect(insertElementCalls[0].placement.trackType).toBe("audio");
  });

  test("fails without mediaId", async () => {
    const r = await run("insert_audio", {});
    expect(r.success).toBe(false);
    expect(r.error).toContain("mediaId is required");
  });

  test("accepts custom volume and timing", async () => {
    const r = await run("insert_audio", {
      mediaId: "media-2",
      volume: 0.5,
      startTime: 3,
      duration: 20,
      name: "Background Music",
    });
    expect(r.success).toBe(true);
    const el = insertElementCalls[0].element;
    expect(el.volume).toBe(0.5);
    expect(el.startTime).toBe(3);
    expect(el.duration).toBe(20);
    expect(el.name).toBe("Background Music");
  });
});

/* 
 * 5. insert_generated_image
 *  */

describe("insert_generated_image", () => {
  beforeEach(() => setupMocks());
  afterEach(teardownMocks);

  test("solid color creates asset and inserts element", async () => {
    const r = await run("insert_generated_image", {
      color: "#ff0000",
      startTime: 0,
      duration: 10,
      name: "Red BG",
    });
    expect(r.success).toBe(true);
    expect(addMediaAssetCalls).toHaveLength(1);
    expect(insertElementCalls).toHaveLength(1);
    expect((r.result as any).message).toContain("Generated and inserted");
  });

  test("fails without both color and code", async () => {
    const r = await run("insert_generated_image", { startTime: 0 });
    expect(r.success).toBe(false);
    expect(r.error).toContain("requires at least one of color or code");
  });

  test("blocks dangerous code via security validator", async () => {
    const r = await run("insert_generated_image", {
      code: "eval('alert(1)')",
      startTime: 0,
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain("Security");
  });

  test("caps dimensions at 4096", async () => {
    await run("insert_generated_image", {
      color: "#000",
      width: 9999,
      height: 9999,
      startTime: 0,
    });
    const asset = addMediaAssetCalls[0].asset;
    expect(asset.width).toBe(4096);
    expect(asset.height).toBe(4096);
  });

  test("uses project canvas size as default dimensions", async () => {
    await run("insert_generated_image", { color: "#000", startTime: 0 });
    const asset = addMediaAssetCalls[0].asset;
    expect(asset.width).toBe(1920);
    expect(asset.height).toBe(1080);
  });

  test("handles code runtime errors gracefully", async () => {
    const r = await run("insert_generated_image", {
      code: "var x; x.boom();",
      startTime: 0,
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain("Canvas drawing code error");
  });
});

/* 
 * 6. update_element
 *  */

describe("update_element", () => {
  beforeEach(() => setupMocks());
  afterEach(teardownMocks);

  test("updates existing element", async () => {
    const r = await run("update_element", {
      trackId: "track-text-1",
      elementId: "el-t1",
      updates: { content: "Goodbye", fontSize: 64 },
    });
    expect(r.success).toBe(true);
    expect(updateElementsCalls).toHaveLength(1);
    const upd = updateElementsCalls[0].updates[0];
    expect(upd.trackId).toBe("track-text-1");
    expect(upd.elementId).toBe("el-t1");
    expect(upd.updates.content).toBe("Goodbye");
    expect(upd.updates.fontSize).toBe(64);
  });

  test("fails for nonexistent element", async () => {
    const r = await run("update_element", {
      trackId: "track-text-1",
      elementId: "no-such-element",
      updates: { content: "X" },
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain("Element not found");
  });

  test("fails for nonexistent track", async () => {
    const r = await run("update_element", {
      trackId: "no-track",
      elementId: "el-t1",
      updates: {},
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain("Element not found");
  });

  test("fails when trackId or elementId is missing", async () => {
    const r = await run("update_element", { updates: { content: "X" } });
    expect(r.success).toBe(false);
    expect(r.error).toContain("trackId and elementId are required");
  });
});

/* 
 * 7. delete_elements
 *  */

describe("delete_elements", () => {
  beforeEach(() => setupMocks());
  afterEach(teardownMocks);

  test("deletes single element via trackId+elementId", async () => {
    const r = await run("delete_elements", {
      trackId: "track-video-1",
      elementId: "el-v1",
    });
    expect(r.success).toBe(true);
    expect(deleteElementsCalls).toHaveLength(1);
    expect(deleteElementsCalls[0].elements).toEqual([
      { trackId: "track-video-1", elementId: "el-v1" },
    ]);
  });

  test("deletes multiple elements via array", async () => {
    const r = await run("delete_elements", {
      elements: [
        { trackId: "track-video-1", elementId: "el-v1" },
        { trackId: "track-text-1", elementId: "el-t1" },
      ],
    });
    expect(r.success).toBe(true);
    expect(deleteElementsCalls[0].elements).toHaveLength(2);
  });

  test("fails when element does not exist", async () => {
    const r = await run("delete_elements", {
      trackId: "track-video-1",
      elementId: "ghost",
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain("Element not found");
  });

  test("fails when neither elements array nor trackId+elementId given", async () => {
    const r = await run("delete_elements", {});
    expect(r.success).toBe(false);
    expect(r.error).toContain("requires elements array or trackId + elementId");
  });
});

/* 
 * 8. move_element
 *  */

describe("move_element", () => {
  beforeEach(() => setupMocks());
  afterEach(teardownMocks);

  test("moves element to a new track and time", async () => {
    const r = await run("move_element", {
      sourceTrackId: "track-video-1",
      targetTrackId: "track-video-1",
      elementId: "el-v1",
      newStartTime: 20,
    });
    expect(r.success).toBe(true);
    expect(moveElementCalls).toHaveLength(1);
    expect(moveElementCalls[0].newStartTime).toBe(20);
  });

  test("fails when source element does not exist", async () => {
    const r = await run("move_element", {
      sourceTrackId: "track-video-1",
      targetTrackId: "track-video-1",
      elementId: "nope",
      newStartTime: 0,
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain("Element not found");
  });

  test("fails when target track does not exist", async () => {
    const r = await run("move_element", {
      sourceTrackId: "track-video-1",
      targetTrackId: "nonexistent-track",
      elementId: "el-v1",
      newStartTime: 0,
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain("Track not found");
  });

  test("fails when required params are missing", async () => {
    const r = await run("move_element", { sourceTrackId: "track-video-1" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("sourceTrackId, targetTrackId, elementId, and newStartTime are required");
  });
});

/* 
 * 9. split_element
 *  */

describe("split_element", () => {
  beforeEach(() => setupMocks());
  afterEach(teardownMocks);

  test("splits element at given time", async () => {
    const r = await run("split_element", {
      trackId: "track-video-1",
      elementId: "el-v1",
      splitTime: 5,
    });
    expect(r.success).toBe(true);
    expect(splitElementsCalls).toHaveLength(1);
    expect(splitElementsCalls[0].splitTime).toBe(5);
    expect(splitElementsCalls[0].elements).toEqual([
      { trackId: "track-video-1", elementId: "el-v1" },
    ]);
  });

  test("splits multiple elements via array", async () => {
    const r = await run("split_element", {
      elements: [
        { trackId: "track-video-1", elementId: "el-v1" },
        { trackId: "track-text-1", elementId: "el-t1" },
      ],
      splitTime: 4,
    });
    expect(r.success).toBe(true);
    expect(splitElementsCalls[0].elements).toHaveLength(2);
  });

  test("fails when splitTime is missing", async () => {
    const r = await run("split_element", {
      trackId: "track-video-1",
      elementId: "el-v1",
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain("splitTime is required");
  });

  test("fails when element does not exist", async () => {
    const r = await run("split_element", {
      trackId: "track-video-1",
      elementId: "nope",
      splitTime: 5,
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain("Element not found");
  });
});

/* 
 * 10. upsert_keyframe
 *  */

describe("upsert_keyframe", () => {
  beforeEach(() => setupMocks());
  afterEach(teardownMocks);

  test("single keyframe via flat params", async () => {
    const r = await run("upsert_keyframe", {
      trackId: "track-video-1",
      elementId: "el-v1",
      propertyPath: "opacity",
      time: 2,
      value: 0.5,
    });
    expect(r.success).toBe(true);
    expect(upsertKeyframesCalls).toHaveLength(1);
    expect(upsertKeyframesCalls[0].keyframes[0].propertyPath).toBe("opacity");
  });

  test("batched keyframes via keyframes array", async () => {
    const r = await run("upsert_keyframe", {
      keyframes: [
        { trackId: "track-video-1", elementId: "el-v1", propertyPath: "opacity", time: 0, value: 1 },
        { trackId: "track-video-1", elementId: "el-v1", propertyPath: "opacity", time: 5, value: 0 },
      ],
    });
    expect(r.success).toBe(true);
    expect(upsertKeyframesCalls[0].keyframes).toHaveLength(2);
  });

  test("fails when required params are missing", async () => {
    const r = await run("upsert_keyframe", { trackId: "track-video-1" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("upsert_keyframe requires");
  });

  test("fails when referenced element does not exist", async () => {
    const r = await run("upsert_keyframe", {
      trackId: "track-video-1",
      elementId: "ghost",
      propertyPath: "opacity",
      time: 0,
      value: 1,
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain("Element not found");
  });
});

/* 
 * 11. remove_keyframe
 *  */

describe("remove_keyframe", () => {
  beforeEach(() => setupMocks());
  afterEach(teardownMocks);

  test("removes keyframe via flat params", async () => {
    const r = await run("remove_keyframe", {
      trackId: "track-video-1",
      elementId: "el-v1",
      propertyPath: "opacity",
      keyframeId: "kf-1",
    });
    expect(r.success).toBe(true);
    expect(removeKeyframesCalls).toHaveLength(1);
    expect(removeKeyframesCalls[0].keyframes[0].keyframeId).toBe("kf-1");
  });

  test("removes batched keyframes", async () => {
    const r = await run("remove_keyframe", {
      keyframes: [
        { trackId: "track-video-1", elementId: "el-v1", propertyPath: "opacity", keyframeId: "kf-1" },
        { trackId: "track-video-1", elementId: "el-v1", propertyPath: "opacity", keyframeId: "kf-2" },
      ],
    });
    expect(r.success).toBe(true);
    expect(removeKeyframesCalls[0].keyframes).toHaveLength(2);
  });

  test("fails when required params are missing", async () => {
    const r = await run("remove_keyframe", { trackId: "track-video-1" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("remove_keyframe requires");
  });

  test("fails when element does not exist", async () => {
    const r = await run("remove_keyframe", {
      trackId: "track-video-1",
      elementId: "ghost",
      propertyPath: "opacity",
      keyframeId: "kf-1",
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain("Element not found");
  });
});

/* 
 * 12. add_effect
 *  */

describe("add_effect", () => {
  beforeEach(() => setupMocks());
  afterEach(teardownMocks);

  test("adds effect and returns effectId", async () => {
    const r = await run("add_effect", {
      trackId: "track-video-1",
      elementId: "el-v1",
      effectType: "blur",
    });
    expect(r.success).toBe(true);
    expect((r.result as any).effectId).toBe("effect-1");
    expect(addClipEffectCalls[0].effectType).toBe("blur");
  });

  test("fails when required params are missing", async () => {
    const r = await run("add_effect", { trackId: "track-video-1" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("trackId, elementId, and effectType are required");
  });

  test("fails when element does not exist", async () => {
    const r = await run("add_effect", {
      trackId: "track-video-1",
      elementId: "ghost",
      effectType: "blur",
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain("Element not found");
  });
});

/* 
 * 13. update_effect_params
 *  */

describe("update_effect_params", () => {
  beforeEach(() => setupMocks());
  afterEach(teardownMocks);

  test("updates effect params", async () => {
    const r = await run("update_effect_params", {
      trackId: "track-video-1",
      elementId: "el-v1",
      effectId: "eff-1",
      params: { intensity: 0.8 },
    });
    expect(r.success).toBe(true);
    expect(updateClipEffectParamsCalls).toHaveLength(1);
    expect(updateClipEffectParamsCalls[0].params.intensity).toBe(0.8);
  });

  test("fails when required params are missing", async () => {
    const r = await run("update_effect_params", {
      trackId: "track-video-1",
      elementId: "el-v1",
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain("trackId, elementId, effectId, and params are required");
  });

  test("fails when element does not exist", async () => {
    const r = await run("update_effect_params", {
      trackId: "track-video-1",
      elementId: "ghost",
      effectId: "eff-1",
      params: { x: 1 },
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain("Element not found");
  });
});

/* 
 * 14. set_playhead
 *  */

describe("set_playhead", () => {
  beforeEach(() => setupMocks());
  afterEach(teardownMocks);

  test("sets playhead to given time", async () => {
    const r = await run("set_playhead", { time: 42 });
    expect(r.success).toBe(true);
    expect(seekCalls).toHaveLength(1);
    expect(seekCalls[0]).toEqual({ time: 42 });
  });

  test("sets playhead to 0", async () => {
    const r = await run("set_playhead", { time: 0 });
    expect(r.success).toBe(true);
    expect(seekCalls[0]).toEqual({ time: 0 });
  });

  test("fails when time is missing", async () => {
    const r = await run("set_playhead", {});
    expect(r.success).toBe(false);
    expect(r.error).toContain("time is required");
  });
});

/* 
 * 15. create_remotion_effect
 *  */

describe("create_remotion_effect", () => {
  beforeEach(() => setupMocks());
  afterEach(teardownMocks);

  test("creates effect with valid code", async () => {
    const code = `({ frame, fps }) => {
      const opacity = Math.min(frame / (fps * 0.5), 1);
      return React.createElement("div", { style: { opacity } }, "Hello");
    }`;
    const r = await run("create_remotion_effect", {
      name: "Fade In",
      startTime: 0,
      duration: 2,
      code,
    });
    expect(r.success).toBe(true);
    const res = r.result as any;
    expect(res.effectId).toBeDefined();
    expect(res.name).toBe("Fade In");
    expect(res.startFrame).toBe(0);
    expect(res.durationFrames).toBe(60); // 2s * 30fps
  });

  test("calculates correct frames from time", async () => {
    const code = `({ frame }) => React.createElement("div", null, frame)`;
    const r = await run("create_remotion_effect", {
      name: "Counter",
      startTime: 1.5,
      duration: 3,
      code,
    });
    expect(r.success).toBe(true);
    const res = r.result as any;
    expect(res.startFrame).toBe(45); // 1.5 * 30
    expect(res.durationFrames).toBe(90); // 3 * 30
  });

  test("fails when required params are missing", async () => {
    const r = await run("create_remotion_effect", { name: "X" });
    expect(r.success).toBe(false);
    expect(r.error).toContain("requires name, startTime, duration, and code");
  });

  test("blocks unsafe code (eval)", async () => {
    const r = await run("create_remotion_effect", {
      name: "Evil",
      startTime: 0,
      duration: 1,
      code: `({ frame }) => { eval("alert(1)"); return null; }`,
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain("Security");
  });

  test("blocks code containing fetch", async () => {
    const r = await run("create_remotion_effect", {
      name: "Evil",
      startTime: 0,
      duration: 1,
      code: `({ frame }) => { fetch("/api"); return null; }`,
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain("Security");
  });
});

/* 
 * 16. use_template
 *  */

describe("use_template", () => {
  beforeEach(() => setupMocks());
  afterEach(teardownMocks);

  test("applies valid template", async () => {
    const r = await run("use_template", {
      templateId: "lower-third",
      startTime: 5,
    });
    expect(r.success).toBe(true);
    const res = r.result as any;
    expect(res.effectId).toBeDefined();
    expect(res.template).toBe("Lower Third");
  });

  test("applies template with custom props", async () => {
    const r = await run("use_template", {
      templateId: "lower-third",
      startTime: 0,
      customProps: { name: "Jane Doe", title: "CTO" },
    });
    expect(r.success).toBe(true);
  });

  test("fails for nonexistent template", async () => {
    const r = await run("use_template", { templateId: "no-such-template" });
    expect(r.success).toBe(false);
    expect(r.error).toContain('Template "no-such-template" not found');
    expect(r.error).toContain("Available:");
  });

  test("uses default startTime of 0", async () => {
    const r = await run("use_template", { templateId: "youtube-intro" });
    expect(r.success).toBe(true);
  });
});

/* 
 * 17. batch_update
 *  */

describe("batch_update", () => {
  beforeEach(() => setupMocks());
  afterEach(teardownMocks);

  test("updates all elements when no filter", async () => {
    const r = await run("batch_update", {
      updates: { opacity: 0.5 },
    });
    expect(r.success).toBe(true);
    const res = r.result as any;
    // 3 elements across 3 tracks
    expect(res.updated).toBe(3);
    expect(updateElementsCalls).toHaveLength(1);
    expect(updateElementsCalls[0].updates).toHaveLength(3);
  });

  test("filters by element type", async () => {
    const r = await run("batch_update", {
      filter: { type: "text" },
      updates: { fontSize: 72 },
    });
    expect(r.success).toBe(true);
    const res = r.result as any;
    expect(res.updated).toBe(1);
    expect(updateElementsCalls[0].updates[0].elementId).toBe("el-t1");
  });

  test("filters by name substring", async () => {
    const r = await run("batch_update", {
      filter: { name: "Clip" },
      updates: { opacity: 0.8 },
    });
    expect(r.success).toBe(true);
    expect((r.result as any).updated).toBe(1);
  });

  test("returns zero updated when no match", async () => {
    const r = await run("batch_update", {
      filter: { type: "shape" },
      updates: { opacity: 0 },
    });
    expect(r.success).toBe(true);
    expect((r.result as any).updated).toBe(0);
    expect(updateElementsCalls).toHaveLength(0);
  });

  test("fails when updates object is missing", async () => {
    const r = await run("batch_update", {});
    expect(r.success).toBe(false);
    expect(r.error).toContain("batch_update requires updates object");
  });
});

/* 
 * 18. undo / redo
 *  */

describe("undo", () => {
  beforeEach(() => setupMocks());
  afterEach(teardownMocks);

  test("calls editor command.undo()", async () => {
    const r = await run("undo");
    expect(r.success).toBe(true);
    expect(undoCalls).toBe(1);
    expect((r.result as any).message).toBe("Undone");
  });

  test("can be called multiple times", async () => {
    await run("undo");
    await run("undo");
    await run("undo");
    expect(undoCalls).toBe(3);
  });

  test("fails when editor is not available", async () => {
    delete (globalThis as any).window.__editor;
    const r = await run("undo");
    expect(r.success).toBe(false);
    expect(r.error).toContain("EditorCore not available");
  });
});

describe("redo", () => {
  beforeEach(() => setupMocks());
  afterEach(teardownMocks);

  test("calls editor command.redo()", async () => {
    const r = await run("redo");
    expect(r.success).toBe(true);
    expect(redoCalls).toBe(1);
    expect((r.result as any).message).toBe("Redone");
  });

  test("can be called multiple times", async () => {
    await run("redo");
    await run("redo");
    expect(redoCalls).toBe(2);
  });

  test("fails when editor is not available", async () => {
    delete (globalThis as any).window.__editor;
    const r = await run("redo");
    expect(r.success).toBe(false);
    expect(r.error).toContain("EditorCore not available");
  });
});

/* 
 * 19. save_project
 *  */

describe("save_project", () => {
  beforeEach(() => setupMocks());
  afterEach(teardownMocks);

  test("exports and downloads the project", async () => {
    const r = await run("save_project");
    expect(r.success).toBe(true);
    const res = r.result as any;
    expect(res.name).toBeDefined();
    expect(res.message).toContain("Saved");
  });

  test("includes project name in result", async () => {
    const r = await run("save_project");
    expect(r.success).toBe(true);
    const res = r.result as any;
    // The mock project name is "Test Project" (or "Untitled" from exportProject fallback)
    expect(typeof res.name).toBe("string");
  });

  test("fails when editor is not available", async () => {
    delete (globalThis as any).window.__editor;
    const r = await run("save_project");
    expect(r.success).toBe(false);
    expect(r.error).toContain("EditorCore not available");
  });
});

/* 
 * 20. export_preset
 *  */

describe("export_preset", () => {
  beforeEach(() => setupMocks());
  afterEach(teardownMocks);

  test("lists all presets when no presetId", async () => {
    const r = await run("export_preset", {});
    expect(r.success).toBe(true);
    const res = r.result as any;
    expect(res.presets).toBeDefined();
    expect(Array.isArray(res.presets)).toBe(true);
    expect(res.presets.length).toBeGreaterThan(0);
    expect(res.message).toContain("Available");
  });

  test("returns settings for valid presetId", async () => {
    const r = await run("export_preset", { presetId: "youtube-1080" });
    expect(r.success).toBe(true);
    const res = r.result as any;
    expect(res.preset).toBe("YouTube 1080p");
    expect(res.settings).toBeDefined();
    expect(res.settings.width).toBe(1920);
    expect(res.settings.height).toBe(1080);
    expect(res.settings.fps).toBe(30);
  });

  test("returns error for invalid presetId (does not throw)", async () => {
    const r = await run("export_preset", { presetId: "invalid-preset" });
    expect(r.success).toBe(true); // Note: it doesn't throw, returns error in result
    const res = r.result as any;
    expect(res.error).toContain('Unknown preset "invalid-preset"');
  });

  test("returns instagram reel settings", async () => {
    const r = await run("export_preset", { presetId: "instagram-reel" });
    expect(r.success).toBe(true);
    const res = r.result as any;
    expect(res.settings.width).toBe(1080);
    expect(res.settings.height).toBe(1920);
  });
});

/* 
 * 21. Unknown tool handling
 *  */

describe("unknown tool", () => {
  beforeEach(() => setupMocks());
  afterEach(teardownMocks);

  test("returns failure for unknown tool name", async () => {
    const r = await run("totally_fake_tool" as any, {});
    expect(r.success).toBe(false);
    expect(r.error).toContain("Unknown action tool: totally_fake_tool");
  });

  test("returns the tool name in the result", async () => {
    const r = await run("does_not_exist" as any, {});
    expect(r.tool).toBe("does_not_exist");
    expect(r.success).toBe(false);
  });

  test("does not throw -- wraps in error result", async () => {
    // Should not throw even for garbage input
    const results = await executeAIActions([
      { tool: "bogus" as any, params: {} },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
  });
});

/* 
 * get_timeline_state (bonus -- always good to test)
 *  */

describe("get_timeline_state", () => {
  beforeEach(() => setupMocks());
  afterEach(teardownMocks);

  test("returns tracks, currentTime, and totalDuration", async () => {
    const r = await run("get_timeline_state");
    expect(r.success).toBe(true);
    const state = r.result as any;
    expect(state.tracks).toHaveLength(3);
    expect(state.currentTime).toBe(5);
    expect(state.totalDuration).toBe(60);
  });

  test("serializes element properties correctly", async () => {
    const r = await run("get_timeline_state");
    const state = r.result as any;
    const videoEl = state.tracks[0].elements[0];
    expect(videoEl.id).toBe("el-v1");
    expect(videoEl.type).toBe("video");
    expect(videoEl.mediaId).toBe("media-1");
    expect(videoEl.startTime).toBe(0);
    expect(videoEl.duration).toBe(10);
  });

  test("includes text-specific properties", async () => {
    const r = await run("get_timeline_state");
    const state = r.result as any;
    const textEl = state.tracks[1].elements[0];
    expect(textEl.content).toBe("Hello");
    expect(textEl.fontSize).toBe(48);
    expect(textEl.fontFamily).toBe("Inter");
    expect(textEl.color).toBe("#ffffff");
  });

  test("includes audio volume", async () => {
    const r = await run("get_timeline_state");
    const state = r.result as any;
    const audioEl = state.tracks[2].elements[0];
    expect(audioEl.volume).toBe(0.8);
  });
});

/* 
 * get_media_assets
 *  */

describe("get_media_assets", () => {
  beforeEach(() => setupMocks());
  afterEach(teardownMocks);

  test("returns all media assets", async () => {
    const r = await run("get_media_assets");
    expect(r.success).toBe(true);
    const assets = r.result as any[];
    expect(assets).toHaveLength(3);
  });

  test("includes asset metadata", async () => {
    const r = await run("get_media_assets");
    const assets = r.result as any[];
    const video = assets.find((a: any) => a.id === "media-1");
    expect(video.name).toBe("clip.mp4");
    expect(video.type).toBe("video");
    expect(video.duration).toBe(30);
  });

  test("includes dimensions for image assets", async () => {
    const r = await run("get_media_assets");
    const assets = r.result as any[];
    const img = assets.find((a: any) => a.id === "media-3");
    expect(img.width).toBe(1920);
    expect(img.height).toBe(1080);
  });

  test("omits undefined optional fields", async () => {
    // media-1 has no width/height
    const r = await run("get_media_assets");
    const assets = r.result as any[];
    const video = assets.find((a: any) => a.id === "media-1");
    expect("width" in video).toBe(false);
    expect("height" in video).toBe(false);
  });
});

/* 
 * apply_lut
 *  */

describe("apply_lut", () => {
  beforeEach(() => setupMocks());
  afterEach(teardownMocks);

  test("adds lut effect and returns effectId", async () => {
    const r = await run("apply_lut", {
      trackId: "track-video-1",
      elementId: "el-v1",
      lutId: "warm-tone",
    });
    expect(r.success).toBe(true);
    const res = r.result as any;
    expect(res.effectId).toBeDefined();
    expect(res.lutId).toBe("warm-tone");
    expect(addClipEffectCalls[0].effectType).toBe("lut");
    // Also updates params with lutId
    expect(updateClipEffectParamsCalls[0].params.lutId).toBe("warm-tone");
  });

  test("adds lut effect without lutId", async () => {
    const r = await run("apply_lut", {
      trackId: "track-video-1",
      elementId: "el-v1",
    });
    expect(r.success).toBe(true);
    expect(addClipEffectCalls).toHaveLength(1);
    // No updateClipEffectParams call when lutId is falsy
    expect(updateClipEffectParamsCalls).toHaveLength(0);
  });

  test("fails when trackId and elementId are missing", async () => {
    const r = await run("apply_lut", {});
    expect(r.success).toBe(false);
    expect(r.error).toContain("apply_lut requires trackId and elementId");
  });

  test("fails when element does not exist", async () => {
    const r = await run("apply_lut", {
      trackId: "track-video-1",
      elementId: "ghost",
    });
    expect(r.success).toBe(false);
    expect(r.error).toContain("Element not found");
  });
});

/* 
 * import_subtitles (no-op pass-through)
 *  */

describe("import_subtitles", () => {
  beforeEach(() => setupMocks());
  afterEach(teardownMocks);

  test("returns success with informational message", async () => {
    const r = await run("import_subtitles", {});
    expect(r.success).toBe(true);
    expect((r.result as any).message).toContain("Subtitles are imported by attaching");
  });
});

/* 
 * executeAIActions - multi-action sequences
 *  */

describe("executeAIActions multi-action", () => {
  beforeEach(() => setupMocks());
  afterEach(teardownMocks);

  test("executes multiple actions in sequence", async () => {
    const results = await executeAIActions([
      { tool: "insert_text", params: { content: "Hello" } },
      { tool: "set_playhead", params: { time: 10 } },
      { tool: "undo", params: {} },
    ]);
    expect(results).toHaveLength(3);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
    expect(results[2].success).toBe(true);
    expect(insertElementCalls).toHaveLength(1);
    expect(seekCalls).toHaveLength(1);
    expect(undoCalls).toBe(1);
  });

  test("continues after a failure in one action", async () => {
    const results = await executeAIActions([
      { tool: "insert_text", params: { content: "OK" } },
      { tool: "insert_video", params: {} }, // missing mediaId => fail
      { tool: "set_playhead", params: { time: 0 } },
    ]);
    expect(results).toHaveLength(3);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[2].success).toBe(true);
  });

  test("returns empty array for empty input", async () => {
    const results = await executeAIActions([]);
    expect(results).toHaveLength(0);
  });

  test("each result contains the correct tool name", async () => {
    const results = await executeAIActions([
      { tool: "undo", params: {} },
      { tool: "redo", params: {} },
    ]);
    expect(results[0].tool).toBe("undo");
    expect(results[1].tool).toBe("redo");
  });
});

/* 
 * Edge cases and robustness
 *  */

describe("edge cases", () => {
  beforeEach(() => setupMocks());
  afterEach(teardownMocks);

  test("insert_text with zero duration", async () => {
    const r = await run("insert_text", { content: "Flash", duration: 0 });
    expect(r.success).toBe(true);
    expect(insertElementCalls[0].element.duration).toBe(0);
  });

  test("set_playhead to zero (falsy but valid)", async () => {
    const r = await run("set_playhead", { time: 0 });
    expect(r.success).toBe(true);
    expect(seekCalls[0]).toEqual({ time: 0 });
  });

  test("move_element with newStartTime 0 (falsy but valid)", async () => {
    const r = await run("move_element", {
      sourceTrackId: "track-video-1",
      targetTrackId: "track-video-1",
      elementId: "el-v1",
      newStartTime: 0,
    });
    expect(r.success).toBe(true);
  });

  test("batch_update on empty timeline returns zero updated", async () => {
    mockTracks.length = 0; // clear all tracks
    const r = await run("batch_update", { updates: { opacity: 0 } });
    expect(r.success).toBe(true);
    expect((r.result as any).updated).toBe(0);
  });

  test("delete_elements with empty array succeeds", async () => {
    const r = await run("delete_elements", { elements: [] });
    expect(r.success).toBe(true);
    expect(deleteElementsCalls[0].elements).toHaveLength(0);
  });

  test("update_element with empty updates object succeeds", async () => {
    const r = await run("update_element", {
      trackId: "track-video-1",
      elementId: "el-v1",
      updates: {},
    });
    expect(r.success).toBe(true);
    expect(updateElementsCalls[0].updates[0].updates).toEqual({});
  });

  test("upsert_keyframe with interpolation param", async () => {
    const r = await run("upsert_keyframe", {
      trackId: "track-video-1",
      elementId: "el-v1",
      propertyPath: "opacity",
      time: 0,
      value: 1,
      interpolation: "ease-in-out",
    });
    expect(r.success).toBe(true);
    expect(upsertKeyframesCalls[0].keyframes[0].interpolation).toBe("ease-in-out");
  });

  test("add_effect returns incrementing effectIds", async () => {
    await run("add_effect", {
      trackId: "track-video-1",
      elementId: "el-v1",
      effectType: "blur",
    });
    const r2 = await run("add_effect", {
      trackId: "track-video-1",
      elementId: "el-v1",
      effectType: "brightness",
    });
    expect((r2.result as any).effectId).toBe("effect-2");
  });

  test("export_preset lists each preset with id, name, platform", async () => {
    const r = await run("export_preset", {});
    const presets = (r.result as any).presets;
    for (const p of presets) {
      expect(p.id).toBeDefined();
      expect(p.name).toBeDefined();
      expect(p.platform).toBeDefined();
    }
  });
});
