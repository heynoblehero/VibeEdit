import { create } from "zustand";
import type { RenderPresetId } from "@/lib/scene-schema";

export type QueueState = "queued" | "rendering" | "done" | "failed" | "downloaded";

export interface QueueItem {
  jobId: string;
  projectId: string;
  projectName: string;
  presetId: RenderPresetId;
  state: QueueState;
  progress: number;
  renderedFrames: number;
  totalFrames: number;
  error: string | null;
  sizeBytes: number | null;
  createdAt: number;
  /** Final mp4 URL once `state` reaches "done". Used by the recent-
   *  renders strip + the in-app preview modal. */
  outputUrl?: string;
  /** Poster frame URL written by the render pipeline. */
  posterUrl?: string;
}

interface RenderQueueStore {
  items: QueueItem[];
  panelOpen: boolean;

  add: (item: Omit<QueueItem, "state" | "progress" | "renderedFrames" | "totalFrames" | "error" | "sizeBytes" | "createdAt"> & { state?: QueueState }) => void;
  update: (jobId: string, patch: Partial<QueueItem>) => void;
  remove: (jobId: string) => void;
  clearDone: () => void;
  setPanelOpen: (v: boolean) => void;
  togglePanel: () => void;
}

export const useRenderQueueStore = create<RenderQueueStore>((set) => ({
  items: [],
  panelOpen: false,

  add: (item) =>
    set((s) => ({
      items: [
        ...s.items,
        {
          state: "queued",
          progress: 0,
          renderedFrames: 0,
          totalFrames: 0,
          error: null,
          sizeBytes: null,
          createdAt: Date.now(),
          ...item,
        },
      ],
      panelOpen: true,
    })),
  update: (jobId, patch) =>
    set((s) => ({
      items: s.items.map((it) => (it.jobId === jobId ? { ...it, ...patch } : it)),
    })),
  remove: (jobId) =>
    set((s) => ({ items: s.items.filter((it) => it.jobId !== jobId) })),
  clearDone: () =>
    set((s) => ({
      items: s.items.filter(
        (it) => it.state !== "done" && it.state !== "downloaded" && it.state !== "failed",
      ),
    })),
  setPanelOpen: (v) => set({ panelOpen: v }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
}));
