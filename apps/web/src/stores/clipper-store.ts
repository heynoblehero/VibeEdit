import { create } from "zustand";
import type {
  ClipMoment,
  ClipJob,
  PipelineState,
  PipelineProgress,
  ClipperSettings,
} from "@/types/clipper";
import { DEFAULT_CLIPPER_SETTINGS } from "@/types/clipper";

interface ClipperState {
  isOpen: boolean;
  pipelineState: PipelineState;
  progress: PipelineProgress | null;
  moments: ClipMoment[];
  jobs: ClipJob[];
  settings: ClipperSettings;
  error: string | null;
  sourceFile: File | null;
  selectedMomentIds: Set<string>;

  // Actions
  open: () => void;
  close: () => void;
  setSourceFile: (file: File | null) => void;
  setPipelineState: (state: PipelineState) => void;
  setProgress: (progress: PipelineProgress | null) => void;
  setMoments: (moments: ClipMoment[]) => void;
  setJobs: (jobs: ClipJob[]) => void;
  updateSettings: (partial: Partial<ClipperSettings>) => void;
  setError: (error: string | null) => void;
  toggleMoment: (momentId: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  reset: () => void;
}

export const useClipperStore = create<ClipperState>()((set, get) => ({
  isOpen: false,
  pipelineState: "idle",
  progress: null,
  moments: [],
  jobs: [],
  settings: DEFAULT_CLIPPER_SETTINGS,
  error: null,
  sourceFile: null,
  selectedMomentIds: new Set<string>(),

  open: () =>
    set({
      isOpen: true,
      pipelineState: "idle",
      error: null,
    }),

  close: () =>
    set({
      isOpen: false,
      pipelineState: "idle",
      progress: null,
      error: null,
    }),

  setSourceFile: (file) => set({ sourceFile: file, error: null }),

  setPipelineState: (state) =>
    set({ pipelineState: state, error: state === "error" ? get().error : null }),

  setProgress: (progress) => set({ progress }),

  setMoments: (moments) => {
    const ids = new Set(moments.map((m) => m.id));
    set({ moments, selectedMomentIds: ids });
  },

  setJobs: (jobs) => set({ jobs }),

  updateSettings: (partial) =>
    set((prev) => ({
      settings: { ...prev.settings, ...partial },
    })),

  setError: (error) =>
    set({ error, pipelineState: error ? "error" : get().pipelineState }),

  toggleMoment: (momentId) =>
    set((prev) => {
      const next = new Set(prev.selectedMomentIds);
      if (next.has(momentId)) {
        next.delete(momentId);
      } else {
        next.add(momentId);
      }
      return { selectedMomentIds: next };
    }),

  selectAll: () =>
    set((prev) => ({
      selectedMomentIds: new Set(prev.moments.map((m) => m.id)),
    })),

  deselectAll: () => set({ selectedMomentIds: new Set<string>() }),

  reset: () =>
    set({
      isOpen: false,
      pipelineState: "idle",
      progress: null,
      moments: [],
      jobs: [],
      settings: DEFAULT_CLIPPER_SETTINGS,
      error: null,
      sourceFile: null,
      selectedMomentIds: new Set<string>(),
    }),
}));
