import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { throttledLocalStorage } from "./throttled-storage";
import {
  type BRoll,
  type CaptionStyle,
  type CaptionWord,
  type MusicBed,
  type Orientation,
  type Project,
  type Scene,
  type StylePack,
  type Voiceover,
  DIMENSIONS,
  createId,
} from "@/lib/scene-schema";
import { applyPresetToScene, getPreset } from "@/lib/style-presets";

const MAX_HISTORY = 50;

interface ProjectStore {
  project: Project;
  projects: Record<string, Project>;

  selectedSceneId: string | null;
  selectedSceneIds: string[];
  activePresetId: string | null;
  isGenerating: boolean;
  isRendering: boolean;
  renderProgress: number;

  history: Project[];
  future: Project[];

  setProject: (p: Project) => void;
  renameProject: (name: string) => void;
  createProject: () => string;
  duplicateProject: (options?: { copyScenes?: boolean }) => string;
  switchProject: (id: string) => void;
  deleteProject: (id: string) => void;

  setScript: (script: string) => void;
  setScenes: (scenes: Scene[]) => void;
  setOrientation: (o: Orientation) => void;
  addScene: (scene: Scene) => void;
  duplicateScene: (id: string) => string | null;
  updateScene: (id: string, patch: Partial<Scene>) => void;
  removeScene: (id: string) => void;
  removeScenes: (ids: string[]) => void;
  moveScene: (fromIdx: number, toIdx: number) => void;
  selectScene: (id: string | null, multi?: boolean) => void;
  selectAllScenes: () => void;
  clearSelection: () => void;

  addBRoll: (sceneId: string, broll: BRoll) => void;
  removeBRoll: (sceneId: string, brollId: string) => void;
  updateBRoll: (sceneId: string, brollId: string, patch: Partial<BRoll>) => void;
  setSceneVoiceover: (sceneId: string, voiceover: Voiceover | undefined) => void;
  setSceneCaptions: (sceneId: string, captions: CaptionWord[] | undefined) => void;
  setMusic: (music: MusicBed | undefined) => void;
  setCaptionStyle: (patch: Partial<CaptionStyle>) => void;
  setStylePack: (pack: StylePack | undefined) => void;
  setWorkflowId: (workflowId: string) => void;
  setWorkflowInputs: (patch: Record<string, unknown>) => void;
  applyStylePreset: (presetId: string) => void;
  setGenerating: (v: boolean) => void;
  setRendering: (v: boolean) => void;
  setRenderProgress: (v: number) => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

function pushHistory(history: Project[], current: Project): Project[] {
  const next = [...history, current];
  if (next.length > MAX_HISTORY) next.shift();
  return next;
}

function blankProject(name = "Draft"): Project {
  return {
    id: createId(),
    name,
    script: "",
    scenes: [],
    fps: 30,
    width: 1920,
    height: 1080,
  };
}

const initialProject = blankProject();

export const useProjectStore = create<ProjectStore>()(
  persist(
    (set, get) => ({
      project: initialProject,
      projects: { [initialProject.id]: initialProject },
      selectedSceneId: null,
      selectedSceneIds: [],
      activePresetId: null,
      isGenerating: false,
      isRendering: false,
      renderProgress: 0,
      history: [],
      future: [],

      setProject: (p) =>
        set((s) => ({
          project: p,
          projects: { ...s.projects, [p.id]: p },
          history: pushHistory(s.history, s.project),
          future: [],
        })),
      renameProject: (name) =>
        set((s) => {
          const updated = { ...s.project, name };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
          };
        }),
      createProject: () => {
        const p = blankProject();
        set((s) => ({
          project: p,
          projects: { ...s.projects, [p.id]: p },
          selectedSceneId: null,
          selectedSceneIds: [],
          activePresetId: null,
          history: [],
          future: [],
        }));
        return p.id;
      },
      duplicateProject: (options = {}) => {
        const s = get();
        const src = s.project;
        const copy: Project = {
          ...src,
          id: createId(),
          name: `${src.name} (copy)`,
          script: options.copyScenes ? src.script : "",
          scenes: options.copyScenes
            ? src.scenes.map((sc) => ({
                ...sc,
                id: createId(),
                broll: sc.broll?.map((b) => ({ ...b, id: createId() })),
              }))
            : [],
          workflowInputs: options.copyScenes
            ? src.workflowInputs
            : Object.fromEntries(
                Object.entries(src.workflowInputs ?? {}).filter(
                  // Keep style-ish inputs, drop content ones (script, images, clips, items).
                  ([k]) => !["script", "story", "images", "clips", "panels", "items", "steps", "timestamps"].includes(k),
                ),
              ),
        };
        set({
          project: copy,
          projects: { ...s.projects, [src.id]: src, [copy.id]: copy },
          selectedSceneId: null,
          selectedSceneIds: [],
          activePresetId: null,
          history: [],
          future: [],
        });
        return copy.id;
      },
      switchProject: (id) => {
        const s = get();
        if (id === s.project.id) return;
        const target = s.projects[id];
        if (!target) return;
        // save the current project snapshot back into the map
        const nextProjects = { ...s.projects, [s.project.id]: s.project };
        set({
          project: target,
          projects: nextProjects,
          selectedSceneId: null,
          selectedSceneIds: [],
          activePresetId: null,
          history: [],
          future: [],
        });
      },
      deleteProject: (id) =>
        set((s) => {
          if (!(id in s.projects)) return s;
          const rest = { ...s.projects };
          delete rest[id];
          // if the deleted project was active, switch to another (or make a blank)
          let project = s.project;
          let projectsMap = rest;
          if (id === s.project.id) {
            const first = Object.values(rest)[0];
            if (first) {
              project = first;
            } else {
              project = blankProject();
              projectsMap = { [project.id]: project };
            }
          }
          return {
            project,
            projects: projectsMap,
            selectedSceneId: null,
            selectedSceneIds: [],
            history: [],
            future: [],
          };
        }),

      setScript: (script) =>
        set((s) => {
          const updated = { ...s.project, script };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
          };
        }),
      setScenes: (scenes) =>
        set((s) => {
          const updated = { ...s.project, scenes };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: pushHistory(s.history, s.project),
            future: [],
          };
        }),
      setOrientation: (o) =>
        set((s) => {
          const dims = DIMENSIONS[o];
          if (s.project.width === dims.width && s.project.height === dims.height) {
            return s;
          }
          const updated = { ...s.project, ...dims };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: pushHistory(s.history, s.project),
            future: [],
          };
        }),
      addScene: (scene) =>
        set((s) => {
          const updated = { ...s.project, scenes: [...s.project.scenes, scene] };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: pushHistory(s.history, s.project),
            future: [],
          };
        }),
      duplicateScene: (id) => {
        const state = get();
        const idx = state.project.scenes.findIndex((sc) => sc.id === id);
        if (idx < 0) return null;
        const src = state.project.scenes[idx];
        const copy: Scene = {
          ...src,
          id: createId(),
          broll: src.broll?.map((b) => ({ ...b, id: createId() })),
        };
        const scenes = [
          ...state.project.scenes.slice(0, idx + 1),
          copy,
          ...state.project.scenes.slice(idx + 1),
        ];
        const updated = { ...state.project, scenes };
        set((s) => ({
          project: updated,
          projects: { ...s.projects, [updated.id]: updated },
          selectedSceneId: copy.id,
          selectedSceneIds: [copy.id],
          history: pushHistory(s.history, s.project),
          future: [],
        }));
        return copy.id;
      },
      updateScene: (id, patch) =>
        set((s) => {
          const updated = {
            ...s.project,
            scenes: s.project.scenes.map((sc) =>
              sc.id === id ? { ...sc, ...patch } : sc,
            ),
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: pushHistory(s.history, s.project),
            future: [],
          };
        }),
      removeScene: (id) =>
        set((s) => {
          const updated = {
            ...s.project,
            scenes: s.project.scenes.filter((sc) => sc.id !== id),
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            selectedSceneId: s.selectedSceneId === id ? null : s.selectedSceneId,
            selectedSceneIds: s.selectedSceneIds.filter((x) => x !== id),
            history: pushHistory(s.history, s.project),
            future: [],
          };
        }),
      removeScenes: (ids) =>
        set((s) => {
          if (ids.length === 0) return s;
          const idSet = new Set(ids);
          const updated = {
            ...s.project,
            scenes: s.project.scenes.filter((sc) => !idSet.has(sc.id)),
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            selectedSceneId:
              s.selectedSceneId && idSet.has(s.selectedSceneId)
                ? null
                : s.selectedSceneId,
            selectedSceneIds: s.selectedSceneIds.filter((x) => !idSet.has(x)),
            history: pushHistory(s.history, s.project),
            future: [],
          };
        }),
      moveScene: (fromIdx, toIdx) =>
        set((s) => {
          const scenes = [...s.project.scenes];
          const [moved] = scenes.splice(fromIdx, 1);
          scenes.splice(toIdx, 0, moved);
          const updated = { ...s.project, scenes };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: pushHistory(s.history, s.project),
            future: [],
          };
        }),
      selectScene: (id, multi = false) =>
        set((s) => {
          if (id === null) {
            return { selectedSceneId: null, selectedSceneIds: [] };
          }
          if (multi) {
            const exists = s.selectedSceneIds.includes(id);
            const next = exists
              ? s.selectedSceneIds.filter((x) => x !== id)
              : [...s.selectedSceneIds, id];
            return {
              selectedSceneIds: next,
              selectedSceneId: next[next.length - 1] ?? null,
            };
          }
          return { selectedSceneId: id, selectedSceneIds: [id] };
        }),
      selectAllScenes: () =>
        set((s) => {
          const ids = s.project.scenes.map((sc) => sc.id);
          return {
            selectedSceneIds: ids,
            selectedSceneId: ids[ids.length - 1] ?? null,
          };
        }),
      clearSelection: () => set({ selectedSceneId: null, selectedSceneIds: [] }),

      addBRoll: (sceneId, broll) =>
        set((s) => {
          const updated = {
            ...s.project,
            scenes: s.project.scenes.map((sc) =>
              sc.id === sceneId
                ? { ...sc, broll: [...(sc.broll ?? []), broll] }
                : sc,
            ),
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: pushHistory(s.history, s.project),
            future: [],
          };
        }),
      removeBRoll: (sceneId, brollId) =>
        set((s) => {
          const updated = {
            ...s.project,
            scenes: s.project.scenes.map((sc) =>
              sc.id === sceneId
                ? { ...sc, broll: (sc.broll ?? []).filter((b) => b.id !== brollId) }
                : sc,
            ),
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: pushHistory(s.history, s.project),
            future: [],
          };
        }),
      updateBRoll: (sceneId, brollId, patch) =>
        set((s) => {
          const updated = {
            ...s.project,
            scenes: s.project.scenes.map((sc) =>
              sc.id === sceneId
                ? {
                    ...sc,
                    broll: (sc.broll ?? []).map((b) =>
                      b.id === brollId ? { ...b, ...patch } : b,
                    ),
                  }
                : sc,
            ),
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: pushHistory(s.history, s.project),
            future: [],
          };
        }),
      setSceneVoiceover: (sceneId, voiceover) =>
        set((s) => {
          const updated = {
            ...s.project,
            scenes: s.project.scenes.map((sc) => {
              if (sc.id !== sceneId) return sc;
              const next: Scene = { ...sc, voiceover };
              if (voiceover) {
                // Auto-lengthen scene to fit the voiceover plus a small tail.
                const target = Math.max(sc.duration, voiceover.audioDurationSec + 0.3);
                next.duration = Number(target.toFixed(2));
              }
              return next;
            }),
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: pushHistory(s.history, s.project),
            future: [],
          };
        }),
      setSceneCaptions: (sceneId, captions) =>
        set((s) => {
          const updated = {
            ...s.project,
            scenes: s.project.scenes.map((sc) => {
              if (sc.id !== sceneId) return sc;
              if (!sc.voiceover) return sc;
              return { ...sc, voiceover: { ...sc.voiceover, captions } };
            }),
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
          };
        }),
      setMusic: (music) =>
        set((s) => {
          const updated = { ...s.project, music };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: pushHistory(s.history, s.project),
            future: [],
          };
        }),
      setWorkflowId: (workflowId) =>
        set((s) => {
          const updated = { ...s.project, workflowId };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
          };
        }),
      setWorkflowInputs: (patch) =>
        set((s) => {
          const current = s.project.workflowInputs ?? {};
          const updated = {
            ...s.project,
            workflowInputs: { ...current, ...patch },
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
          };
        }),
      setStylePack: (pack) =>
        set((s) => {
          const patch: Partial<CaptionStyle> | undefined = pack?.captionStyle;
          const currentCaption = s.project.captionStyle ?? {
            fontSize: 64,
            color: "#ffffff",
            strokeColor: "#000000",
            position: "auto" as const,
            maxWordsPerChunk: 3,
            uppercase: true,
          };
          const updated = {
            ...s.project,
            stylePack: pack,
            captionStyle: patch
              ? { ...currentCaption, ...patch }
              : s.project.captionStyle,
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: pushHistory(s.history, s.project),
            future: [],
          };
        }),
      setCaptionStyle: (patch) =>
        set((s) => {
          const current = s.project.captionStyle ?? {
            fontSize: 64,
            color: "#ffffff",
            strokeColor: "#000000",
            position: "auto" as const,
            maxWordsPerChunk: 3,
            uppercase: true,
          };
          const updated = {
            ...s.project,
            captionStyle: { ...current, ...patch },
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
          };
        }),
      applyStylePreset: (presetId) =>
        set((s) => {
          const preset = getPreset(presetId);
          if (!preset) return s;
          const updated = {
            ...s.project,
            scenes: s.project.scenes.map((sc, i) => applyPresetToScene(sc, preset, i)),
          };
          return {
            activePresetId: presetId,
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: pushHistory(s.history, s.project),
            future: [],
          };
        }),
      setGenerating: (v) => set({ isGenerating: v }),
      setRendering: (v) => set({ isRendering: v }),
      setRenderProgress: (v) => set({ renderProgress: v }),

      undo: () =>
        set((s) => {
          if (s.history.length === 0) return s;
          const prev = s.history[s.history.length - 1];
          return {
            project: prev,
            projects: { ...s.projects, [prev.id]: prev },
            history: s.history.slice(0, -1),
            future: [...s.future, s.project],
          };
        }),
      redo: () =>
        set((s) => {
          if (s.future.length === 0) return s;
          const next = s.future[s.future.length - 1];
          return {
            project: next,
            projects: { ...s.projects, [next.id]: next },
            history: [...s.history, s.project],
            future: s.future.slice(0, -1),
          };
        }),
      canUndo: () => get().history.length > 0,
      canRedo: () => get().future.length > 0,
    }),
    {
      name: "vibeedit-project",
      version: 2,
      storage: createJSONStorage(() => throttledLocalStorage()),
      partialize: (s) => ({
        project: s.project,
        projects: s.projects,
        selectedSceneId: s.selectedSceneId,
        activePresetId: s.activePresetId,
      }),
      migrate: (persisted, version) => {
        if (!persisted || typeof persisted !== "object") return persisted;
        const p = persisted as { project?: Project; projects?: Record<string, Project> };
        if (version < 2 && p.project && !p.projects) {
          return { ...p, projects: { [p.project.id]: p.project } };
        }
        return persisted;
      },
    },
  ),
);
