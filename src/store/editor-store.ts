import { create } from "zustand";

export type EditTarget = "character" | "text" | "effects" | "background" | "counter" | "broll" | "keyframes" | "media" | "shape" | null;

interface EditorStore {
  editTarget: EditTarget;
  setEditTarget: (t: EditTarget) => void;
  isPaused: boolean;
  setPaused: (v: boolean) => void;
  previewFrame: number;
  setPreviewFrame: (f: number) => void;
  imageEditorBRollId: string | null;
  openImageEditor: (brollId: string | null) => void;
  /** Scene currently in frame during full-video playback. SceneList +
      timeline read this to show a "now playing" pulse. */
  playingSceneId: string | null;
  setPlayingSceneId: (id: string | null) => void;
  /**
   * Scene the user has deliberately scoped the agent to. Distinct from
   * playingSceneId (passive preview state) and from selectedSceneId
   * (transient highlight). When set, the chat passes it to the agent
   * route, the SYSTEM_PROMPT narrows scope to this scene, and tools
   * default sceneId-less calls to it.
   */
  focusedSceneId: string | null;
  setFocusedSceneId: (id: string | null) => void;
  /**
   * Pro-mode keyframe editor toggle. v1 keyframe UI offers value +
   * named easing only; flipping this on (Settings dialog) unlocks
   * draggable bezier handles per keyframe. UI wiring lands in a
   * follow-up; this flag reserves the data path.
   */
  proKeyframes: boolean;
  setProKeyframes: (v: boolean) => void;
  /**
   * Cut tool active state — when true, Timeline clicks split the scene
   * under the cursor at that frame instead of seeking. Bound to the
   * `C` key from KeyboardShortcuts; `V` turns it off.
   */
  cutMode: boolean;
  setCutMode: (v: boolean) => void;
  /**
   * Timeline horizontal zoom multiplier. 1 = fit-to-width (current
   * default behaviour). > 1 stretches the track so longer videos can
   * be edited frame-accurately. Cmd+= / Cmd+- bind to inc/dec.
   */
  timelineZoom: number;
  setTimelineZoom: (v: number) => void;
  /**
   * MRU list of effect/transition/look ids the user has applied via
   * Timeline drops. Currently no consumer renders this, but Timeline
   * keeps writing to it for future "recently used" surfaces.
   */
  recentActions: Array<{ kind: string; value: string; at: number }>;
  pushRecentAction: (kind: string, value: string) => void;
  /**
   * Loop range on the global timeline. Set via [ and ] keys at the
   * playhead. Preview wraps to start when frame ≥ end. null = no loop.
   */
  /** Composition guides toggled on the preview canvas. */
  showThirds: boolean;
  setShowThirds: (v: boolean) => void;
  showSafeArea: boolean;
  setShowSafeArea: (v: boolean) => void;
  showLetterbox: boolean;
  setShowLetterbox: (v: boolean) => void;
  /** Hides the chrome (sidebars / chat / config tabs) so the preview
   *  fills the screen. Z key toggles. */
  zenMode: boolean;
  setZenMode: (v: boolean) => void;
  /**
   * Top-level UI mode. 'agent' is default: chat sidebar wide and
   * always-open, manual editor surfaces (SceneList / LayeredTimeline /
   * topbar Uploads + Tracks pop-outs) hidden. 'manual' surfaces the
   * full editor. Persisted across reloads.
   */
  editorMode: "agent" | "manual";
  setEditorMode: (m: "agent" | "manual") => void;
  loopRange: { start: number; end: number } | null;
  setLoopStart: (frame: number) => void;
  setLoopEnd: (frame: number) => void;
  clearLoopRange: () => void;
  /**
   * Layered-timeline state (sprint 19). `expandedLayers` controls
   * which layer rows are open; default keeps a sensible baseline.
   * `selectedItemId` tracks which TimelineItem block is highlighted —
   * format `{sceneId}:{kind}[:{index}]`. Sprint 20 drag handlers
   * read this.
   */
  expandedLayers: Record<string, boolean>;
  toggleExpandedLayer: (kind: string) => void;
  selectedItemId: string | null;
  setSelectedItemId: (id: string | null) => void;
  /** Which clip is selected in the Audio workspace timeline. Format
   *  `{kind}:{id}` — e.g. `vo:scene_abc`, `music:project`, `sfx:scene_xyz`. */
  audioSelectedClipId: string | null;
  setAudioSelectedClipId: (id: string | null) => void;
  /**
   * Per-scene "show layers nested inside this card" toggle for the
   * SceneList. Persisted across reloads. Scene ids that aren't in the
   * map default to collapsed.
   */
  expandedSceneIds: Record<string, boolean>;
  toggleSceneExpanded: (sceneId: string) => void;
  /**
   * Which specific layer inside the selected scene the user is
   * currently editing. Format strings:
   *   - "text:emphasis" | "text:main" | "text:subtitle"
   *   - "media:bg" | "media:character" | "media:broll:<id>"
   *   - "effect:<index>"
   * Null = no layer focused, the Properties panel shows scene-level
   * properties (duration, transition, bg color, etc.).
   */
  selectedLayerId: string | null;
  setSelectedLayerId: (id: string | null) => void;
  /** Animate / keyframe editor modal — open from anywhere via setAnimateModalOpen(true). */
  animateModalOpen: boolean;
  setAnimateModalOpen: (v: boolean) => void;
}

export const useEditorStore = create<EditorStore>((set) => ({
  editTarget: null,
  setEditTarget: (t) => set({ editTarget: t, isPaused: true }),
  isPaused: true,
  setPaused: (v) => set({ isPaused: v }),
  previewFrame: 18,
  setPreviewFrame: (f) => set({ previewFrame: f }),
  imageEditorBRollId: null,
  openImageEditor: (brollId) => set({ imageEditorBRollId: brollId }),
  playingSceneId: null,
  setPlayingSceneId: (id) => set({ playingSceneId: id }),
  focusedSceneId: null,
  setFocusedSceneId: (id) => set({ focusedSceneId: id }),
  proKeyframes: false,
  setProKeyframes: (v) => set({ proKeyframes: v }),
  cutMode: false,
  setCutMode: (v) => set({ cutMode: v }),
  timelineZoom: (() => {
    if (typeof window === "undefined") return 1;
    const saved = Number(window.localStorage.getItem("vibeedit:timeline-zoom"));
    return saved >= 0.5 && saved <= 8 ? saved : 1;
  })(),
  setTimelineZoom: (v) => {
    const clamped = Math.max(0.5, Math.min(8, v));
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("vibeedit:timeline-zoom", String(clamped));
      } catch {
        // ignore quota / private mode
      }
    }
    set({ timelineZoom: clamped });
  },
  recentActions: [],
  pushRecentAction: (kind, value) =>
    set((s) => {
      const next = [
        { kind, value, at: Date.now() },
        ...s.recentActions.filter(
          (r) => !(r.kind === kind && r.value === value),
        ),
      ].slice(0, 8);
      return { recentActions: next };
    }),
  showThirds: (() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("vibeedit:show-thirds") === "1";
  })(),
  setShowThirds: (v) => {
    if (typeof window !== "undefined")
      window.localStorage.setItem("vibeedit:show-thirds", v ? "1" : "0");
    set({ showThirds: v });
  },
  showSafeArea: (() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("vibeedit:show-safe-area") === "1";
  })(),
  setShowSafeArea: (v) => {
    if (typeof window !== "undefined")
      window.localStorage.setItem("vibeedit:show-safe-area", v ? "1" : "0");
    set({ showSafeArea: v });
  },
  showLetterbox: (() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("vibeedit:show-letterbox") === "1";
  })(),
  setShowLetterbox: (v) => {
    if (typeof window !== "undefined")
      window.localStorage.setItem("vibeedit:show-letterbox", v ? "1" : "0");
    set({ showLetterbox: v });
  },
  zenMode: (() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("vibeedit:zen-mode") === "1";
  })(),
  setZenMode: (v) => {
    if (typeof window !== "undefined")
      window.localStorage.setItem("vibeedit:zen-mode", v ? "1" : "0");
    set({ zenMode: v });
  },
  editorMode: (() => {
    if (typeof window === "undefined") return "agent";
    const saved = window.localStorage.getItem("vibeedit:editor-mode");
    return saved === "manual" ? "manual" : "agent";
  })(),
  setEditorMode: (m) => {
    if (typeof window !== "undefined")
      window.localStorage.setItem("vibeedit:editor-mode", m);
    set({ editorMode: m });
  },
  loopRange: null,
  setLoopStart: (frame) =>
    set((s) => {
      const end = s.loopRange?.end ?? frame + 30;
      return { loopRange: { start: frame, end: Math.max(end, frame + 1) } };
    }),
  setLoopEnd: (frame) =>
    set((s) => {
      const start = s.loopRange?.start ?? Math.max(0, frame - 30);
      return { loopRange: { start: Math.min(start, frame - 1), end: frame } };
    }),
  clearLoopRange: () => set({ loopRange: null }),
  expandedLayers: (() => {
    // Sensible default: scene blocks + bg + main text + voiceover are
    // expanded so a typical scene shows its key moves at a glance
    // without doubling the timeline's vertical height.
    const fallback: Record<string, boolean> = {
      scenes: true,
      bg: true,
      "text-main": true,
      "text-emphasis": true,
      voiceover: true,
      character: true,
      broll: true,
      effects: true,
      "text-subtitle": false,
      montage: true,
      stat: true,
      bullets: true,
      quote: true,
      "bar-chart": true,
      three: true,
      split: true,
      counter: true,
    };
    if (typeof window === "undefined") return fallback;
    try {
      const raw = window.localStorage.getItem("vibeedit:expanded-layers");
      if (!raw) return fallback;
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      return { ...fallback, ...parsed };
    } catch {
      return fallback;
    }
  })(),
  toggleExpandedLayer: (kind) =>
    set((s) => {
      const next = { ...s.expandedLayers, [kind]: !s.expandedLayers[kind] };
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            "vibeedit:expanded-layers",
            JSON.stringify(next),
          );
        } catch {
          // localStorage unavailable — non-critical
        }
      }
      return { expandedLayers: next };
    }),
  selectedItemId: null,
  setSelectedItemId: (id) => set({ selectedItemId: id }),
  audioSelectedClipId: null,
  setAudioSelectedClipId: (id) => set({ audioSelectedClipId: id }),
  expandedSceneIds: (() => {
    if (typeof window === "undefined") return {};
    try {
      const raw = window.localStorage.getItem("vibeedit:expanded-scene-ids");
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  })(),
  toggleSceneExpanded: (sceneId) =>
    set((s) => {
      const next = { ...s.expandedSceneIds, [sceneId]: !s.expandedSceneIds[sceneId] };
      if (typeof window !== "undefined") {
        try {
          window.localStorage.setItem(
            "vibeedit:expanded-scene-ids",
            JSON.stringify(next),
          );
        } catch {}
      }
      return { expandedSceneIds: next };
    }),
  selectedLayerId: null,
  setSelectedLayerId: (id) => set({ selectedLayerId: id }),
  animateModalOpen: false,
  setAnimateModalOpen: (v) => set({ animateModalOpen: v }),
}));
