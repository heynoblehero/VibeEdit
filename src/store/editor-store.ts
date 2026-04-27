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
  timelineZoom: 1,
  setTimelineZoom: (v) => set({ timelineZoom: Math.max(0.5, Math.min(8, v)) }),
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
}));
