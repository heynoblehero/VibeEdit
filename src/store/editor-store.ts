import { create } from "zustand";

export type EditTarget = "character" | "text" | "effects" | "background" | "counter" | "broll" | null;

interface EditorStore {
  editTarget: EditTarget;
  setEditTarget: (t: EditTarget) => void;
  isPaused: boolean;
  setPaused: (v: boolean) => void;
  previewFrame: number;
  setPreviewFrame: (f: number) => void;
  imageEditorBRollId: string | null;
  openImageEditor: (brollId: string | null) => void;
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
}));
