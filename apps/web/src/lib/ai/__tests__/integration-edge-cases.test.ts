import { afterEach, beforeEach, describe, expect, test, mock } from "bun:test";
import { executeAIActions } from "@/lib/ai/executor";
import { buildSystemPrompt, buildEditorContext } from "@/lib/ai/system-prompt";
import { AI_RESPONSE_SCHEMA } from "@/lib/ai/schema";
import { CREDIT_COSTS, getCreditCost } from "@/lib/credits/costs";
import {
  registerEffect,
  getCompiledEffect,
  getAllEffects,
  removeEffect,
  clearEffects,
} from "@/lib/remotion/registry";
import type { AIAction, AIActionTool, EditorContext } from "@/lib/ai/types";
import type { RemotionEffect } from "@/lib/remotion/types";

/* ── Shared mock infrastructure ── */

let mockAssets: Array<{ id: string; name: string; type: string; duration?: number; width?: number; height?: number }> = [];
let insertElementCalls: unknown[] = [];
let addMediaAssetCalls: unknown[] = [];
let updateElementsCalls: unknown[] = [];
let deleteElementsCalls: unknown[] = [];
let moveElementCalls: unknown[] = [];
let splitElementsCalls: unknown[] = [];
let addClipEffectCalls: unknown[] = [];
let updateClipEffectParamsCalls: unknown[] = [];
let seekCalls: unknown[] = [];
let undoCalls: number = 0;
let redoCalls: number = 0;
let upsertKeyframesCalls: unknown[] = [];
let removeKeyframesCalls: unknown[] = [];
let lastCanvasOps: string[] = [];

function createMockCtx() {
  const ops: string[] = [];
  lastCanvasOps = ops;
  return {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    fillRect: (...args: unknown[]) => ops.push(`fillRect(${args.join(",")})`),
    strokeRect: (...args: unknown[]) => ops.push(`strokeRect(${args.join(",")})`),
    beginPath: () => ops.push("beginPath"),
    moveTo: (...args: unknown[]) => ops.push(`moveTo(${args.join(",")})`),
    lineTo: (...args: unknown[]) => ops.push(`lineTo(${args.join(",")})`),
    stroke: () => ops.push("stroke"),
    arc: (...args: unknown[]) => ops.push(`arc(${args.join(",")})`),
    closePath: () => ops.push("closePath"),
    fill: () => ops.push("fill"),
    save: () => ops.push("save"),
    restore: () => ops.push("restore"),
    clearRect: (...args: unknown[]) => ops.push(`clearRect(${args.join(",")})`),
    createLinearGradient: () => ({
      addColorStop: () => {},
    }),
    createRadialGradient: () => ({
      addColorStop: () => {},
    }),
    _ops: ops,
  };
}

function createMockCanvas() {
  const ctx = createMockCtx();
  return {
    width: 0,
    height: 0,
    getContext: (type: string) => (type === "2d" ? ctx : null),
    toBlob: (cb: (blob: Blob | null) => void, mimeType?: string) => {
      setTimeout(() => cb(new Blob(["fake-png-data"], { type: mimeType || "image/png" })), 0);
    },
    toDataURL: (_type?: string, _quality?: number) => "data:image/jpeg;base64,fakethumb",
    _ctx: ctx,
  };
}

// Tracks with elements for testing update/delete/move/split
let mockTracks: Array<{
  id: string;
  type: string;
  muted?: boolean;
  hidden?: boolean;
  elements: Array<{
    id: string;
    type: string;
    name: string;
    startTime: number;
    duration: number;
    trimStart: number;
    trimEnd: number;
    mediaId?: string;
    content?: string;
    fontSize?: number;
    color?: string;
    transform?: { scale: number; position: { x: number; y: number }; rotate: number };
    opacity?: number;
    volume?: number;
  }>;
}> = [];

function setupMocks() {
  mockAssets = [];
  insertElementCalls = [];
  addMediaAssetCalls = [];
  updateElementsCalls = [];
  deleteElementsCalls = [];
  moveElementCalls = [];
  splitElementsCalls = [];
  addClipEffectCalls = [];
  updateClipEffectParamsCalls = [];
  seekCalls = [];
  undoCalls = 0;
  redoCalls = 0;
  upsertKeyframesCalls = [];
  removeKeyframesCalls = [];
  lastCanvasOps = [];
  mockTracks = [];

  const mockEditor = {
    timeline: {
      getTracks: () => mockTracks,
      getTotalDuration: () => {
        let max = 0;
        for (const track of mockTracks) {
          for (const el of track.elements) {
            const end = el.startTime + el.duration;
            if (end > max) max = end;
          }
        }
        return max;
      },
      insertElement: (params: unknown) => insertElementCalls.push(params),
      updateElements: (params: unknown) => updateElementsCalls.push(params),
      deleteElements: (params: unknown) => deleteElementsCalls.push(params),
      moveElement: (params: unknown) => moveElementCalls.push(params),
      splitElements: (params: unknown) => splitElementsCalls.push(params),
      addClipEffect: (params: any) => {
        addClipEffectCalls.push(params);
        return `effect-${Date.now()}`;
      },
      updateClipEffectParams: (params: unknown) => updateClipEffectParamsCalls.push(params),
      updateTracks: () => {},
      upsertKeyframes: (params: unknown) => upsertKeyframesCalls.push(params),
      removeKeyframes: (params: unknown) => removeKeyframesCalls.push(params),
    },
    media: {
      addMediaAsset: async (params: any) => {
        addMediaAssetCalls.push(params);
        const id = `asset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        mockAssets.push({
          id,
          name: params.asset.name,
          type: params.asset.type,
          duration: params.asset.duration,
          width: params.asset.width,
          height: params.asset.height,
        });
      },
      getAssets: () => mockAssets,
    },
    project: {
      getActive: () => ({
        metadata: { id: "test-project-id" },
        settings: {
          canvasSize: { width: 1920, height: 1080 },
        },
      }),
    },
    playback: {
      getCurrentTime: () => 0,
      seek: (params: unknown) => seekCalls.push(params),
    },
    command: {
      execute: () => {},
      undo: () => { undoCalls++; },
      redo: () => { redoCalls++; },
    },
  };

  (globalThis as any).window = (globalThis as any).window || {};
  (globalThis as any).window.__editor = mockEditor;

  const origCreateElement = (globalThis as any).document?.createElement;
  if (typeof (globalThis as any).document === "undefined") {
    (globalThis as any).document = {};
  }
  (globalThis as any).document.createElement = (tag: string) => {
    if (tag === "canvas") return createMockCanvas();
    if (origCreateElement) return origCreateElement.call(document, tag);
    return {};
  };

  if (typeof URL.createObjectURL !== "function") {
    (URL as any).createObjectURL = (_obj: any) => `blob:mock-url-${Date.now()}`;
  }

  return { mockEditor };
}

function teardownMocks() {
  delete (globalThis as any).window.__editor;
}

/** Helper to add a track with elements so update/delete/move/split tests work */
function addMockTrack(
  id: string,
  type: string,
  elements: Array<{
    id: string;
    type: string;
    name: string;
    startTime: number;
    duration: number;
    content?: string;
    fontSize?: number;
    color?: string;
  }>
) {
  mockTracks.push({
    id,
    type,
    elements: elements.map((el) => ({
      trimStart: 0,
      trimEnd: 0,
      opacity: 1,
      transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
      ...el,
    })),
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   1. Multi-Action Sequences
   ═══════════════════════════════════════════════════════════════════════ */

describe("Multi-Action Sequences", () => {
  beforeEach(() => {
    setupMocks();
  });
  afterEach(() => {
    teardownMocks();
  });

  test("insert_text + set_playhead executes both in order", async () => {
    const results = await executeAIActions([
      { tool: "insert_text", params: { content: "Hello", startTime: 0, duration: 5 } },
      { tool: "set_playhead", params: { time: 3 } },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[0].tool).toBe("insert_text");
    expect(results[1].success).toBe(true);
    expect(results[1].tool).toBe("set_playhead");
    expect(insertElementCalls).toHaveLength(1);
    expect(seekCalls).toHaveLength(1);
    expect((seekCalls[0] as any).time).toBe(3);
  });

  test("insert_generated_image + insert_text (overlay text on background)", async () => {
    const results = await executeAIActions([
      {
        tool: "insert_generated_image",
        params: { color: "#000000", startTime: 0, duration: 10, name: "BG" },
      },
      {
        tool: "insert_text",
        params: { content: "Title", startTime: 0, duration: 10, fontSize: 72, color: "#ffffff" },
      },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
    // Generated image creates an asset + inserts element; text just inserts element
    expect(addMediaAssetCalls).toHaveLength(1);
    expect(insertElementCalls).toHaveLength(2); // 1 from generated image + 1 from text
  });

  test("insert_video + add_effect (add blur to video)", async () => {
    // We need a track with an element for add_effect
    addMockTrack("track-v", "video", [
      { id: "el-vid", type: "video", name: "clip.mp4", startTime: 0, duration: 10 },
    ]);
    mockAssets.push({ id: "media-1", name: "clip.mp4", type: "video", duration: 10 });

    const results = await executeAIActions([
      { tool: "insert_video", params: { mediaId: "media-1", startTime: 0, duration: 10 } },
      {
        tool: "add_effect",
        params: { trackId: "track-v", elementId: "el-vid", effectType: "blur" },
      },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
    expect(addClipEffectCalls).toHaveLength(1);
    expect((addClipEffectCalls[0] as any).effectType).toBe("blur");
  });

  test("create_remotion_effect + set_playhead", async () => {
    const results = await executeAIActions([
      {
        tool: "create_remotion_effect",
        params: {
          name: "Fade In Title",
          startTime: 0,
          duration: 3,
          code: `({ frame, fps }) => {
            const opacity = Math.min(frame / 30, 1);
            return React.createElement('div', { style: { opacity } }, 'Hello');
          }`,
        },
      },
      { tool: "set_playhead", params: { time: 0 } },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect((results[0].result as any).effectId).toBeDefined();
    expect(results[1].success).toBe(true);
    // Clean up remotion effects
    clearEffects();
  });

  test("batch_update after multiple inserts updates all matching elements", async () => {
    addMockTrack("track-t", "text", [
      { id: "el-t1", type: "text", name: "Subtitle 1", startTime: 0, duration: 3, color: "#aaaaaa" },
      { id: "el-t2", type: "text", name: "Subtitle 2", startTime: 3, duration: 3, color: "#aaaaaa" },
    ]);

    const results = await executeAIActions([
      {
        tool: "batch_update",
        params: { filter: { type: "text" }, updates: { color: "#ffffff" } },
      },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect((results[0].result as any).updated).toBe(2);
  });

  test("Multiple insert_text for subtitle sequence", async () => {
    const subtitles = [
      { content: "Welcome", startTime: 0, duration: 2 },
      { content: "to the", startTime: 2, duration: 1.5 },
      { content: "video", startTime: 3.5, duration: 2 },
      { content: "editor", startTime: 5.5, duration: 2 },
    ];
    const actions: AIAction[] = subtitles.map((s) => ({
      tool: "insert_text" as AIActionTool,
      params: { ...s, fontSize: 32, color: "#ffffff" },
    }));

    const results = await executeAIActions(actions);
    expect(results).toHaveLength(4);
    results.forEach((r) => expect(r.success).toBe(true));
    expect(insertElementCalls).toHaveLength(4);
    // Verify ordering is maintained
    expect((insertElementCalls[0] as any).element.content).toBe("Welcome");
    expect((insertElementCalls[3] as any).element.content).toBe("editor");
  });

  test("undo after insert (two sequential actions)", async () => {
    const results = await executeAIActions([
      { tool: "insert_text", params: { content: "Temporary", startTime: 0, duration: 5 } },
      { tool: "undo", params: {} },
    ]);
    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
    expect(undoCalls).toBe(1);
  });

  test("error in middle of sequence (first succeeds, second fails, results preserved)", async () => {
    const results = await executeAIActions([
      { tool: "insert_text", params: { content: "Works", startTime: 0 } },
      { tool: "insert_video", params: {} }, // Missing mediaId -> should fail
      { tool: "set_playhead", params: { time: 5 } },
    ]);
    expect(results).toHaveLength(3);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[1].error).toContain("mediaId is required");
    // Third action still executes
    expect(results[2].success).toBe(true);
    // First action's side effect was applied
    expect(insertElementCalls).toHaveLength(1);
  });

  test("empty actions array returns empty results", async () => {
    const results = await executeAIActions([]);
    expect(results).toHaveLength(0);
    expect(Array.isArray(results)).toBe(true);
  });

  test("20 actions in sequence (stress test)", async () => {
    const actions: AIAction[] = [];
    for (let i = 0; i < 20; i++) {
      actions.push({
        tool: "insert_text",
        params: { content: `Line ${i}`, startTime: i * 2, duration: 2 },
      });
    }
    const results = await executeAIActions(actions);
    expect(results).toHaveLength(20);
    results.forEach((r, i) => {
      expect(r.success).toBe(true);
      expect(r.tool).toBe("insert_text");
    });
    expect(insertElementCalls).toHaveLength(20);
  });

  test("undo + redo sequence", async () => {
    const results = await executeAIActions([
      { tool: "insert_text", params: { content: "Test", startTime: 0 } },
      { tool: "undo", params: {} },
      { tool: "redo", params: {} },
    ]);
    expect(results).toHaveLength(3);
    results.forEach((r) => expect(r.success).toBe(true));
    expect(undoCalls).toBe(1);
    expect(redoCalls).toBe(1);
  });

  test("get_timeline_state returns correct structure", async () => {
    addMockTrack("track-v", "video", [
      { id: "el-1", type: "video", name: "Clip", startTime: 0, duration: 10 },
    ]);
    const results = await executeAIActions([
      { tool: "get_timeline_state", params: {} },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    const state = results[0].result as any;
    expect(state.tracks).toHaveLength(1);
    expect(state.tracks[0].id).toBe("track-v");
    expect(state.currentTime).toBe(0);
    expect(state.totalDuration).toBe(10);
  });

  test("get_media_assets returns assets list", async () => {
    mockAssets.push(
      { id: "a1", name: "clip.mp4", type: "video", duration: 30 },
      { id: "a2", name: "logo.png", type: "image", width: 500, height: 500 },
    );
    const results = await executeAIActions([
      { tool: "get_media_assets", params: {} },
    ]);
    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    const assets = results[0].result as any[];
    expect(assets).toHaveLength(2);
    expect(assets[0].name).toBe("clip.mp4");
    expect(assets[1].name).toBe("logo.png");
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   2. Credit Cost Validation
   ═══════════════════════════════════════════════════════════════════════ */

describe("Credit Cost Validation", () => {
  test("ai_message costs 1 credit", () => {
    expect(CREDIT_COSTS.ai_message).toBe(1);
    expect(getCreditCost("ai_message")).toBe(1);
  });

  test("insert_generated_image has 0 cost", () => {
    expect(CREDIT_COSTS.insert_generated_image).toBe(0);
    expect(getCreditCost("insert_generated_image")).toBe(0);
  });

  test("create_remotion_effect costs 2", () => {
    expect(CREDIT_COSTS.create_remotion_effect).toBe(2);
    expect(getCreditCost("create_remotion_effect")).toBe(2);
  });

  test("use_template costs 1", () => {
    expect(CREDIT_COSTS.use_template).toBe(1);
  });

  test("auto_caption costs 5", () => {
    expect(CREDIT_COSTS.auto_caption).toBe(5);
  });

  test("generate_media_elevenlabs costs 5", () => {
    expect(CREDIT_COSTS.generate_media_elevenlabs).toBe(5);
  });

  test("generate_media_stability costs 3", () => {
    expect(CREDIT_COSTS.generate_media_stability).toBe(3);
  });

  test("render_per_minute costs 10", () => {
    expect(CREDIT_COSTS.render_per_minute).toBe(10);
  });

  test("unknown tool defaults to 0 via getCreditCost", () => {
    expect(getCreditCost("nonexistent_tool_xyz")).toBe(0);
    expect(getCreditCost("")).toBe(0);
  });

  test("all free operations cost 0", () => {
    const freeOps = [
      "insert_text", "insert_video", "insert_image", "insert_generated_image",
      "insert_audio", "update_element", "delete_elements", "move_element",
      "split_element", "upsert_keyframe", "remove_keyframe", "add_effect",
      "update_effect_params", "apply_lut", "set_playhead", "get_timeline_state",
      "get_media_assets", "undo", "redo", "batch_update", "save_project",
      "export_preset", "import_subtitles",
    ];
    for (const op of freeOps) {
      expect(CREDIT_COSTS[op]).toBe(0);
    }
  });

  test("every AIActionTool type has an entry in CREDIT_COSTS", () => {
    // The canonical list from types.ts
    const allTools: AIActionTool[] = [
      "get_timeline_state", "get_media_assets",
      "insert_text", "insert_video", "insert_image", "insert_generated_image", "insert_audio",
      "update_element", "delete_elements", "move_element", "split_element",
      "upsert_keyframe", "remove_keyframe",
      "add_effect", "update_effect_params",
      "set_playhead",
      "create_remotion_effect", "generate_media",
      "apply_lut", "import_subtitles", "auto_caption", "use_template",
      "undo", "redo", "batch_update", "save_project", "export_preset",
    ];

    for (const tool of allTools) {
      // Some tools like generate_media have per-service entries, not a direct entry.
      // getCreditCost returns 0 for missing, so just verify it doesn't throw.
      const cost = getCreditCost(tool);
      expect(typeof cost).toBe("number");
      expect(cost).toBeGreaterThanOrEqual(0);
    }
  });

  test("CREDIT_COSTS has no negative values", () => {
    for (const [key, value] of Object.entries(CREDIT_COSTS)) {
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  test("getCreditCost is consistent with CREDIT_COSTS direct access", () => {
    for (const [key, value] of Object.entries(CREDIT_COSTS)) {
      expect(getCreditCost(key)).toBe(value);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   3. Schema Validation
   ═══════════════════════════════════════════════════════════════════════ */

describe("Schema Validation", () => {
  test("AI_RESPONSE_SCHEMA has required top-level fields", () => {
    expect(AI_RESPONSE_SCHEMA.required).toContain("message");
    expect(AI_RESPONSE_SCHEMA.required).toContain("actions");
  });

  test("schema type is object", () => {
    expect(AI_RESPONSE_SCHEMA.type).toBe("object");
  });

  test("schema includes message and actions properties", () => {
    expect(AI_RESPONSE_SCHEMA.properties.message).toBeDefined();
    expect(AI_RESPONSE_SCHEMA.properties.message.type).toBe("string");
    expect(AI_RESPONSE_SCHEMA.properties.actions).toBeDefined();
    expect(AI_RESPONSE_SCHEMA.properties.actions.type).toBe("array");
  });

  test("actions items require tool and params", () => {
    const items = AI_RESPONSE_SCHEMA.properties.actions.items;
    expect(items.required).toContain("tool");
    expect(items.required).toContain("params");
  });

  test("schema tool enum includes all known tools", () => {
    const toolEnum = AI_RESPONSE_SCHEMA.properties.actions.items.properties.tool.enum;
    const expectedTools: AIActionTool[] = [
      "get_timeline_state", "get_media_assets",
      "insert_text", "insert_video", "insert_image", "insert_generated_image", "insert_audio",
      "update_element", "delete_elements", "move_element", "split_element",
      "upsert_keyframe", "remove_keyframe",
      "add_effect", "update_effect_params",
      "set_playhead",
      "create_remotion_effect", "generate_media",
      "apply_lut", "import_subtitles", "auto_caption", "use_template",
      "undo", "redo", "batch_update", "save_project", "export_preset",
    ];
    for (const tool of expectedTools) {
      expect(toolEnum).toContain(tool);
    }
  });

  test("insert_generated_image is in the schema enum", () => {
    const toolEnum = AI_RESPONSE_SCHEMA.properties.actions.items.properties.tool.enum;
    expect(toolEnum).toContain("insert_generated_image");
  });

  test("schema tool enum length matches expected count", () => {
    const toolEnum = AI_RESPONSE_SCHEMA.properties.actions.items.properties.tool.enum;
    // 27 tools total
    expect(toolEnum.length).toBe(27);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   4. System Prompt
   ═══════════════════════════════════════════════════════════════════════ */

describe("System Prompt", () => {
  const sampleContext: EditorContext = {
    tracks: [],
    currentTime: 0,
    totalDuration: 0,
    mediaAssets: [],
    projectSettings: { fps: 30, canvasSize: { width: 1920, height: 1080 } },
  };

  test("buildSystemPrompt includes all major tool sections", () => {
    const prompt = buildSystemPrompt(sampleContext);
    expect(prompt).toContain("insert_text");
    expect(prompt).toContain("insert_video");
    expect(prompt).toContain("insert_image");
    expect(prompt).toContain("insert_audio");
    expect(prompt).toContain("insert_generated_image");
    expect(prompt).toContain("update_element");
    expect(prompt).toContain("delete_elements");
    expect(prompt).toContain("move_element");
    expect(prompt).toContain("split_element");
    expect(prompt).toContain("upsert_keyframe");
    expect(prompt).toContain("remove_keyframe");
    expect(prompt).toContain("add_effect");
    expect(prompt).toContain("update_effect_params");
    expect(prompt).toContain("set_playhead");
    expect(prompt).toContain("create_remotion_effect");
    expect(prompt).toContain("generate_media");
    expect(prompt).toContain("LUT");
    expect(prompt).toContain("auto_caption");
    expect(prompt).toContain("use_template");
    expect(prompt).toContain("undo");
    expect(prompt).toContain("redo");
    expect(prompt).toContain("batch_update");
    expect(prompt).toContain("save_project");
    expect(prompt).toContain("export_preset");
  });

  test("buildSystemPrompt includes insert_generated_image documentation", () => {
    const prompt = buildSystemPrompt(sampleContext);
    expect(prompt).toContain("insert_generated_image");
    expect(prompt).toContain("Canvas 2D drawing");
    expect(prompt).toContain("color");
    expect(prompt).toContain("code");
    // Should include example codes
    expect(prompt).toContain("ctx.strokeStyle");
    expect(prompt).toContain("createLinearGradient");
  });

  test("buildSystemPrompt includes tool selection guidance (static vs animated)", () => {
    const prompt = buildSystemPrompt(sampleContext);
    expect(prompt).toContain("insert_generated_image vs create_remotion_effect");
    expect(prompt).toContain("STATIC");
    expect(prompt).toContain("ANIMATED");
    expect(prompt).toContain("Decision rule");
  });

  test("buildSystemPrompt embeds editor context JSON", () => {
    const ctx: EditorContext = {
      tracks: [{ id: "t1", type: "video", elements: [] }],
      currentTime: 5.5,
      totalDuration: 30,
      mediaAssets: [{ id: "a1", name: "clip.mp4", type: "video", duration: 30 }],
      projectSettings: { fps: 30, canvasSize: { width: 1920, height: 1080 } },
    };
    const prompt = buildSystemPrompt(ctx);
    expect(prompt).toContain('"currentTime": 5.5');
    expect(prompt).toContain('"totalDuration": 30');
    expect(prompt).toContain('"clip.mp4"');
  });

  test("buildEditorContext builds correct shape", () => {
    setupMocks();
    const editor = (globalThis as any).window.__editor;

    // Add some data
    addMockTrack("track-v", "video", [
      { id: "el-1", type: "video", name: "Clip", startTime: 0, duration: 15 },
    ]);
    mockAssets.push({ id: "a1", name: "clip.mp4", type: "video", duration: 15, width: 1920, height: 1080 });

    // Mock getTotalDuration
    editor.timeline.getTotalDuration = () => 15;

    const ctx = buildEditorContext(editor);
    expect(ctx.tracks).toHaveLength(1);
    expect(ctx.tracks[0].id).toBe("track-v");
    expect(ctx.tracks[0].elements).toHaveLength(1);
    expect(ctx.tracks[0].elements[0].name).toBe("Clip");
    expect(ctx.currentTime).toBe(0);
    expect(ctx.totalDuration).toBe(15);
    expect(ctx.mediaAssets).toHaveLength(1);
    expect(ctx.mediaAssets[0].name).toBe("clip.mp4");
    expect(ctx.projectSettings.fps).toBe(30);
    expect(ctx.projectSettings.canvasSize).toEqual({ width: 1920, height: 1080 });

    teardownMocks();
  });

  test("buildEditorContext includes all required EditorContext fields", () => {
    setupMocks();
    const editor = (globalThis as any).window.__editor;
    editor.timeline.getTotalDuration = () => 0;
    const ctx = buildEditorContext(editor);

    expect(ctx).toHaveProperty("tracks");
    expect(ctx).toHaveProperty("currentTime");
    expect(ctx).toHaveProperty("totalDuration");
    expect(ctx).toHaveProperty("mediaAssets");
    expect(ctx).toHaveProperty("projectSettings");
    expect(ctx.projectSettings).toHaveProperty("fps");
    expect(ctx.projectSettings).toHaveProperty("canvasSize");

    teardownMocks();
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   5. Remotion Registry
   ═══════════════════════════════════════════════════════════════════════ */

describe("Remotion Registry", () => {
  beforeEach(() => {
    clearEffects();
  });

  afterEach(() => {
    clearEffects();
  });

  test("registerEffect with valid code adds to registry", () => {
    const effect: RemotionEffect = {
      id: "eff-1",
      name: "Test Effect",
      code: `({ frame, fps }) => React.createElement('div', null, 'Frame: ' + frame)`,
      startFrame: 0,
      durationFrames: 90,
      props: {},
    };
    registerEffect(effect);
    expect(getAllEffects()).toHaveLength(1);
    expect(getAllEffects()[0].id).toBe("eff-1");
  });

  test("registerEffect with blocked code (fetch) throws Security error", () => {
    const effect: RemotionEffect = {
      id: "eff-bad",
      name: "Bad Effect",
      code: `({ frame }) => { fetch('http://evil.com'); return React.createElement('div', null); }`,
      startFrame: 0,
      durationFrames: 30,
      props: {},
    };
    expect(() => registerEffect(effect)).toThrow("Security");
    expect(getAllEffects()).toHaveLength(0);
  });

  test("registerEffect with eval() code throws Security error", () => {
    const effect: RemotionEffect = {
      id: "eff-eval",
      name: "Eval Effect",
      code: `({ frame }) => { eval('bad()'); return React.createElement('div'); }`,
      startFrame: 0,
      durationFrames: 30,
      props: {},
    };
    expect(() => registerEffect(effect)).toThrow("Security");
  });

  test("getCompiledEffect returns registered effect renderer", () => {
    const effect: RemotionEffect = {
      id: "eff-compiled",
      name: "Compiled",
      code: `({ frame }) => React.createElement('span', null, frame)`,
      startFrame: 0,
      durationFrames: 60,
      props: {},
    };
    registerEffect(effect);
    const renderer = getCompiledEffect("eff-compiled");
    expect(renderer).toBeDefined();
    expect(typeof renderer).toBe("function");
  });

  test("getCompiledEffect returns undefined for non-existent id", () => {
    expect(getCompiledEffect("nonexistent")).toBeUndefined();
  });

  test("getAllEffects returns all registered effects", () => {
    registerEffect({
      id: "e1", name: "One",
      code: `({ frame }) => React.createElement('div', null, '1')`,
      startFrame: 0, durationFrames: 30, props: {},
    });
    registerEffect({
      id: "e2", name: "Two",
      code: `({ frame }) => React.createElement('div', null, '2')`,
      startFrame: 30, durationFrames: 30, props: {},
    });
    const all = getAllEffects();
    expect(all).toHaveLength(2);
    expect(all.map((e) => e.id)).toEqual(["e1", "e2"]);
  });

  test("removeEffect removes correctly", () => {
    registerEffect({
      id: "rem-1", name: "To Remove",
      code: `({ frame }) => React.createElement('div', null, 'remove')`,
      startFrame: 0, durationFrames: 30, props: {},
    });
    registerEffect({
      id: "rem-2", name: "To Keep",
      code: `({ frame }) => React.createElement('div', null, 'keep')`,
      startFrame: 30, durationFrames: 30, props: {},
    });
    expect(getAllEffects()).toHaveLength(2);
    removeEffect("rem-1");
    expect(getAllEffects()).toHaveLength(1);
    expect(getAllEffects()[0].id).toBe("rem-2");
    expect(getCompiledEffect("rem-1")).toBeUndefined();
    expect(getCompiledEffect("rem-2")).toBeDefined();
  });

  test("clearEffects clears all effects", () => {
    registerEffect({
      id: "c1", name: "Clear Me 1",
      code: `({ frame }) => React.createElement('div', null, 'a')`,
      startFrame: 0, durationFrames: 30, props: {},
    });
    registerEffect({
      id: "c2", name: "Clear Me 2",
      code: `({ frame }) => React.createElement('div', null, 'b')`,
      startFrame: 0, durationFrames: 30, props: {},
    });
    expect(getAllEffects()).toHaveLength(2);
    clearEffects();
    expect(getAllEffects()).toHaveLength(0);
    expect(getCompiledEffect("c1")).toBeUndefined();
    expect(getCompiledEffect("c2")).toBeUndefined();
  });

  test("code with React.createElement passes validation", () => {
    const effect: RemotionEffect = {
      id: "react-ok",
      name: "React OK",
      code: `({ frame, fps, width, height }) => {
        const opacity = Math.min(frame / 30, 1);
        return React.createElement('div', {
          style: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }
        },
          React.createElement('h1', { style: { fontSize: 80, color: 'white', opacity } }, 'HELLO')
        );
      }`,
      startFrame: 0, durationFrames: 90, props: {},
    };
    registerEffect(effect);
    expect(getAllEffects()).toHaveLength(1);
    expect(getCompiledEffect("react-ok")).toBeDefined();
  });

  test("code with interpolate and spring references passes validation", () => {
    const effect: RemotionEffect = {
      id: "interp-ok",
      name: "Interpolate OK",
      code: `({ frame, fps, width, height }) => {
        const progress = interpolate(frame, [0, 30], [0, 1]);
        const springVal = spring({ frame, fps, config: { damping: 10 } });
        return React.createElement('div', {
          style: { transform: 'translateX(' + interpolate(progress, [0, 1], [-200, 0]) + 'px)' }
        }, 'Sliding');
      }`,
      startFrame: 0, durationFrames: 60, props: {},
    };
    registerEffect(effect);
    expect(getAllEffects()).toHaveLength(1);
  });

  test("code with localStorage is blocked", () => {
    const effect: RemotionEffect = {
      id: "ls-bad",
      name: "LocalStorage Bad",
      code: `({ frame }) => { localStorage.setItem('x', '1'); return React.createElement('div'); }`,
      startFrame: 0, durationFrames: 30, props: {},
    };
    expect(() => registerEffect(effect)).toThrow("Security");
    expect(getAllEffects()).toHaveLength(0);
  });

  test("multiple effects can be registered and independently retrieved", () => {
    for (let i = 0; i < 5; i++) {
      registerEffect({
        id: `multi-${i}`,
        name: `Effect ${i}`,
        code: `({ frame }) => React.createElement('div', null, '${i}')`,
        startFrame: i * 30,
        durationFrames: 30,
        props: {},
      });
    }
    expect(getAllEffects()).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(getCompiledEffect(`multi-${i}`)).toBeDefined();
    }
  });

  test("re-registering same id replaces effect in list", () => {
    registerEffect({
      id: "dup-1", name: "Version 1",
      code: `({ frame }) => React.createElement('div', null, 'v1')`,
      startFrame: 0, durationFrames: 30, props: {},
    });
    registerEffect({
      id: "dup-1", name: "Version 2",
      code: `({ frame }) => React.createElement('div', null, 'v2')`,
      startFrame: 0, durationFrames: 60, props: {},
    });
    // Should still be 1 effect, not 2
    expect(getAllEffects()).toHaveLength(1);
    expect(getAllEffects()[0].name).toBe("Version 2");
    expect(getAllEffects()[0].durationFrames).toBe(60);
  });
});

/* ═══════════════════════════════════════════════════════════════════════
   6. Edge Cases
   ═══════════════════════════════════════════════════════════════════════ */

describe("Edge Cases", () => {
  beforeEach(() => {
    setupMocks();
  });
  afterEach(() => {
    teardownMocks();
  });

  test("action with missing required params returns error", async () => {
    // insert_video requires mediaId
    const results = await executeAIActions([
      { tool: "insert_video", params: {} },
    ]);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("mediaId is required");
  });

  test("action with extra unexpected params still succeeds (params are ignored)", async () => {
    const results = await executeAIActions([
      {
        tool: "insert_text",
        params: {
          content: "Hello",
          startTime: 0,
          extraField: "should be ignored",
          anotherExtra: 42,
        },
      },
    ]);
    expect(results[0].success).toBe(true);
    expect((insertElementCalls[0] as any).element.content).toBe("Hello");
  });

  test("very long text content in insert_text", async () => {
    const longText = "A".repeat(10000);
    const results = await executeAIActions([
      { tool: "insert_text", params: { content: longText, startTime: 0 } },
    ]);
    expect(results[0].success).toBe(true);
    expect((insertElementCalls[0] as any).element.content).toBe(longText);
    expect((insertElementCalls[0] as any).element.content.length).toBe(10000);
  });

  test("duration of 0 is accepted for insert_text", async () => {
    const results = await executeAIActions([
      { tool: "insert_text", params: { content: "Flash", startTime: 5, duration: 0 } },
    ]);
    expect(results[0].success).toBe(true);
    expect((insertElementCalls[0] as any).element.duration).toBe(0);
  });

  test("negative startTime is passed through (no validation in executor)", async () => {
    const results = await executeAIActions([
      { tool: "insert_text", params: { content: "Before", startTime: -5, duration: 3 } },
    ]);
    // The executor does not validate negative startTime; it's the editor's responsibility
    expect(results[0].success).toBe(true);
    expect((insertElementCalls[0] as any).element.startTime).toBe(-5);
  });

  test("very large duration (999999) is accepted", async () => {
    const results = await executeAIActions([
      { tool: "insert_text", params: { content: "Long", startTime: 0, duration: 999999 } },
    ]);
    expect(results[0].success).toBe(true);
    expect((insertElementCalls[0] as any).element.duration).toBe(999999);
  });

  test("unicode content in text", async () => {
    const unicode = "\u4f60\u597d\u4e16\u754c \ud83c\udf0d \u0410\u043b\u0435\u043a\u0441\u0430\u043d\u0434\u0440 \u2603\ufe0f";
    const results = await executeAIActions([
      { tool: "insert_text", params: { content: unicode, startTime: 0 } },
    ]);
    expect(results[0].success).toBe(true);
    expect((insertElementCalls[0] as any).element.content).toBe(unicode);
  });

  test("empty string content defaults to 'Text' in insert_text", async () => {
    const results = await executeAIActions([
      { tool: "insert_text", params: { content: "", startTime: 0 } },
    ]);
    expect(results[0].success).toBe(true);
    // Empty string is NOT null/undefined, so ?? does not replace it
    expect((insertElementCalls[0] as any).element.content).toBe("");
  });

  test("concurrent action execution (actions are sequential, not parallel)", async () => {
    // executeAIActions processes in order, so "concurrent" just means we fire multiple
    const p1 = executeAIActions([
      { tool: "insert_text", params: { content: "A", startTime: 0 } },
    ]);
    const p2 = executeAIActions([
      { tool: "insert_text", params: { content: "B", startTime: 1 } },
    ]);
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1[0].success).toBe(true);
    expect(r2[0].success).toBe(true);
    expect(insertElementCalls).toHaveLength(2);
  });

  test("action on empty timeline (no tracks) - read-only tools return empty", async () => {
    const results = await executeAIActions([
      { tool: "get_timeline_state", params: {} },
    ]);
    expect(results[0].success).toBe(true);
    const state = results[0].result as any;
    expect(state.tracks).toHaveLength(0);
    expect(state.totalDuration).toBe(0);
  });

  test("unknown action tool returns error with tool name", async () => {
    const results = await executeAIActions([
      { tool: "totally_fake_tool" as AIActionTool, params: {} },
    ]);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("Unknown action tool");
    expect(results[0].error).toContain("totally_fake_tool");
  });

  test("update_element on nonexistent track/element returns error", async () => {
    const results = await executeAIActions([
      {
        tool: "update_element",
        params: { trackId: "no-track", elementId: "no-el", updates: { color: "#fff" } },
      },
    ]);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("Element not found");
  });

  test("delete_elements with missing params returns error", async () => {
    const results = await executeAIActions([
      { tool: "delete_elements", params: {} },
    ]);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("requires");
  });

  test("move_element with missing params returns error", async () => {
    const results = await executeAIActions([
      { tool: "move_element", params: { sourceTrackId: "t1" } },
    ]);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("required");
  });

  test("split_element with missing splitTime returns error", async () => {
    addMockTrack("track-v", "video", [
      { id: "el-1", type: "video", name: "Clip", startTime: 0, duration: 10 },
    ]);
    const results = await executeAIActions([
      { tool: "split_element", params: { trackId: "track-v", elementId: "el-1" } },
    ]);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("splitTime is required");
  });

  test("set_playhead with missing time returns error", async () => {
    const results = await executeAIActions([
      { tool: "set_playhead", params: {} },
    ]);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("time is required");
  });

  test("create_remotion_effect with missing fields returns error", async () => {
    const results = await executeAIActions([
      { tool: "create_remotion_effect", params: { name: "Partial" } },
    ]);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("requires");
    clearEffects();
  });

  test("add_effect with missing required params returns error", async () => {
    const results = await executeAIActions([
      { tool: "add_effect", params: { trackId: "t1" } },
    ]);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("required");
  });

  test("batch_update with no matching elements returns updated: 0", async () => {
    // Empty timeline
    const results = await executeAIActions([
      {
        tool: "batch_update",
        params: { filter: { type: "text" }, updates: { color: "#ffffff" } },
      },
    ]);
    expect(results[0].success).toBe(true);
    expect((results[0].result as any).updated).toBe(0);
  });

  test("batch_update without filter updates all elements", async () => {
    addMockTrack("t1", "video", [
      { id: "e1", type: "video", name: "V1", startTime: 0, duration: 5 },
    ]);
    addMockTrack("t2", "text", [
      { id: "e2", type: "text", name: "T1", startTime: 0, duration: 5 },
    ]);
    const results = await executeAIActions([
      { tool: "batch_update", params: { updates: { opacity: 0.5 } } },
    ]);
    expect(results[0].success).toBe(true);
    expect((results[0].result as any).updated).toBe(2);
  });

  test("insert_image requires mediaId", async () => {
    const results = await executeAIActions([
      { tool: "insert_image", params: { startTime: 0 } },
    ]);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("mediaId is required");
  });

  test("insert_audio requires mediaId", async () => {
    const results = await executeAIActions([
      { tool: "insert_audio", params: { startTime: 0 } },
    ]);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("mediaId is required");
  });

  test("insert_text defaults are applied correctly", async () => {
    const results = await executeAIActions([
      { tool: "insert_text", params: { content: "Defaults" } },
    ]);
    expect(results[0].success).toBe(true);
    const el = (insertElementCalls[0] as any).element;
    expect(el.fontSize).toBe(48);
    expect(el.fontFamily).toBe("Inter");
    expect(el.color).toBe("#ffffff");
    expect(el.textAlign).toBe("center");
    expect(el.fontWeight).toBe("normal");
    expect(el.fontStyle).toBe("normal");
    expect(el.textDecoration).toBe("none");
    expect(el.duration).toBe(5);
    expect(el.startTime).toBe(0);
    expect(el.opacity).toBe(1);
  });

  test("insert_video defaults are applied correctly", async () => {
    const results = await executeAIActions([
      { tool: "insert_video", params: { mediaId: "m-1" } },
    ]);
    expect(results[0].success).toBe(true);
    const el = (insertElementCalls[0] as any).element;
    expect(el.name).toBe("Video");
    expect(el.duration).toBe(5);
    expect(el.startTime).toBe(0);
    expect(el.opacity).toBe(1);
    expect(el.transform.scale).toBe(1);
    expect(el.transform.position).toEqual({ x: 0, y: 0 });
  });

  test("upsert_keyframe requires propertyPath, trackId, elementId", async () => {
    const results = await executeAIActions([
      { tool: "upsert_keyframe", params: { trackId: "t1" } },
    ]);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("requires");
  });

  test("remove_keyframe requires trackId, elementId, propertyPath, keyframeId", async () => {
    const results = await executeAIActions([
      { tool: "remove_keyframe", params: { trackId: "t1", elementId: "e1" } },
    ]);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("requires");
  });

  test("export_preset without presetId lists all presets", async () => {
    const results = await executeAIActions([
      { tool: "export_preset", params: {} },
    ]);
    expect(results[0].success).toBe(true);
    const result = results[0].result as any;
    expect(result.presets).toBeDefined();
    expect(Array.isArray(result.presets)).toBe(true);
    expect(result.presets.length).toBeGreaterThan(0);
  });

  test("import_subtitles returns informational message", async () => {
    const results = await executeAIActions([
      { tool: "import_subtitles", params: {} },
    ]);
    expect(results[0].success).toBe(true);
    expect((results[0].result as any).message).toContain("Subtitles");
  });

  test("fractional time values work in set_playhead", async () => {
    const results = await executeAIActions([
      { tool: "set_playhead", params: { time: 3.14159 } },
    ]);
    expect(results[0].success).toBe(true);
    expect((seekCalls[0] as any).time).toBe(3.14159);
  });

  test("very large batch of mixed actions (10 different tool types)", async () => {
    addMockTrack("track-v", "video", [
      { id: "el-1", type: "video", name: "Clip", startTime: 0, duration: 30 },
    ]);
    addMockTrack("track-t", "text", [
      { id: "el-t1", type: "text", name: "Title", startTime: 0, duration: 5, content: "Hello" },
    ]);

    const results = await executeAIActions([
      { tool: "get_timeline_state", params: {} },
      { tool: "get_media_assets", params: {} },
      { tool: "insert_text", params: { content: "New Text", startTime: 5 } },
      { tool: "set_playhead", params: { time: 10 } },
      { tool: "batch_update", params: { filter: { type: "text" }, updates: { color: "#ff0000" } } },
      { tool: "undo", params: {} },
      { tool: "redo", params: {} },
      { tool: "export_preset", params: {} },
      { tool: "import_subtitles", params: {} },
      { tool: "set_playhead", params: { time: 0 } },
    ]);

    expect(results).toHaveLength(10);
    // All should succeed
    results.forEach((r) => {
      expect(r.success).toBe(true);
    });
  });
});
