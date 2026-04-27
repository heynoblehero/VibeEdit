import { create } from "zustand";

export type EditTarget = "character" | "text" | "effects" | "background" | "counter" | "broll" | "keyframes" | null;

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
   * MRU list of action card ids the user has used. Bumped to head
   * each time the Timeline accepts an effect/transition/look/title/
   * ai-action drop. ActionsPanel renders the top 5 as a quick tray.
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
  loopRange: { start: number; end: number } | null;
  setLoopStart: (frame: number) => void;
  setLoopEnd: (frame: number) => void;
  clearLoopRange: () => void;
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
  zenMode: false,
  setZenMode: (v) => set({ zenMode: v }),
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
}));
