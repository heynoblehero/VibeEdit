import { create } from "zustand";
import type {
  Storyboard,
  StoryboardScene,
  StoryboardState,
} from "@/types/storyboard";

interface StoryboardStoreState {
  isOpen: boolean;
  state: StoryboardState;
  storyboard: Storyboard | null;
  concept: string;
  targetDuration: number;
  style: string;
  currentExecutingScene: number;
  error: string | null;

  // Actions
  open: () => void;
  close: () => void;
  setConcept: (concept: string) => void;
  setTargetDuration: (duration: number) => void;
  setStyle: (style: string) => void;
  setState: (state: StoryboardState) => void;
  setStoryboard: (storyboard: Storyboard) => void;
  approveScene: (sceneId: string) => void;
  rejectScene: (sceneId: string) => void;
  approveAll: () => void;
  setExecuting: (sceneIndex: number) => void;
  markSceneDone: (sceneId: string) => void;
  markSceneError: (sceneId: string, error: string) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useStoryboardStore = create<StoryboardStoreState>()(
  (set, get) => ({
    isOpen: false,
    state: "idle",
    storyboard: null,
    concept: "",
    targetDuration: 60,
    style: "professional",
    currentExecutingScene: -1,
    error: null,

    open: () =>
      set({
        isOpen: true,
        state: "idle",
        error: null,
      }),

    close: () =>
      set({
        isOpen: false,
        state: "idle",
        storyboard: null,
        concept: "",
        targetDuration: 60,
        style: "professional",
        currentExecutingScene: -1,
        error: null,
      }),

    setConcept: (concept) => set({ concept }),
    setTargetDuration: (targetDuration) => set({ targetDuration }),
    setStyle: (style) => set({ style }),
    setState: (state) => set({ state }),

    setStoryboard: (storyboard) =>
      set({ storyboard, state: "reviewing" }),

    approveScene: (sceneId) =>
      set((prev) => {
        if (!prev.storyboard) return prev;
        return {
          storyboard: {
            ...prev.storyboard,
            scenes: prev.storyboard.scenes.map((s) =>
              s.id === sceneId ? { ...s, approved: true } : s
            ),
          },
        };
      }),

    rejectScene: (sceneId) =>
      set((prev) => {
        if (!prev.storyboard) return prev;
        return {
          storyboard: {
            ...prev.storyboard,
            scenes: prev.storyboard.scenes.map((s) =>
              s.id === sceneId ? { ...s, approved: false } : s
            ),
          },
        };
      }),

    approveAll: () =>
      set((prev) => {
        if (!prev.storyboard) return prev;
        return {
          storyboard: {
            ...prev.storyboard,
            scenes: prev.storyboard.scenes.map((s) => ({
              ...s,
              approved: true,
            })),
          },
        };
      }),

    setExecuting: (sceneIndex) =>
      set({ currentExecutingScene: sceneIndex, state: "executing" }),

    markSceneDone: (sceneId) =>
      set((prev) => {
        if (!prev.storyboard) return prev;
        const updatedScenes = prev.storyboard.scenes.map((s) =>
          s.id === sceneId ? { ...s, executed: true } : s
        );
        const allDone = updatedScenes
          .filter((s) => s.approved)
          .every((s) => s.executed);
        return {
          storyboard: {
            ...prev.storyboard,
            scenes: updatedScenes,
          },
          state: allDone ? "done" : prev.state,
        };
      }),

    markSceneError: (sceneId, error) =>
      set((prev) => {
        if (!prev.storyboard) return prev;
        return {
          storyboard: {
            ...prev.storyboard,
            scenes: prev.storyboard.scenes.map((s) =>
              s.id === sceneId
                ? { ...s, notes: `Error: ${error}` }
                : s
            ),
          },
        };
      }),

    setError: (error) =>
      set({
        error,
        state: error ? "error" : get().state,
      }),

    reset: () =>
      set({
        isOpen: false,
        state: "idle",
        storyboard: null,
        concept: "",
        targetDuration: 60,
        style: "professional",
        currentExecutingScene: -1,
        error: null,
      }),
  })
);
