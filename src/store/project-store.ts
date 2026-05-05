import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { throttledLocalStorage } from "./throttled-storage";
import {
  type AudioSfxClip,
  type BRoll,
  type CaptionStyle,
  type CaptionWord,
  type Cut,
  type Keyframe,
  type KeyframeProperty,
  type MusicBed,
  type Orientation,
  type Project,
  type ProjectUpload,
  type Scene,
  type StylePack,
  type Track,
  type Voiceover,
  DIMENSIONS,
  createId,
} from "@/lib/scene-schema";
import { dispatchAction } from "@/lib/actions/dispatch";
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

  /**
   * Drag/resize history coalescing. While `historyGroupDepth > 0`,
   * every mutation skips its own pushHistory and instead lets the
   * already-captured snapshot at `begin` time stand in for the whole
   * burst. The group ends when depth returns to 0.
   */
  historyGroupDepth: number;

  setProject: (p: Project) => void;
  renameProject: (name: string) => void;
  createProject: () => string;
  duplicateProject: (options?: { copyScenes?: boolean }) => string;
  switchProject: (id: string) => void;
  deleteProject: (id: string) => void;
  restoreProject: (id: string) => void;
  purgeProject: (id: string) => void;
  emptyTrash: () => void;

  setScript: (script: string) => void;
  setScenes: (scenes: Scene[]) => void;
  setOrientation: (o: Orientation) => void;
  setDimensions: (width: number, height: number) => void;
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
  setAudioMix: (patch: Partial<NonNullable<Project["audioMix"]>>) => void;
  /** Free-floating SFX clip CRUD on the project timeline. */
  addSfxClip: (clip: AudioSfxClip) => void;
  updateSfxClip: (id: string, patch: Partial<AudioSfxClip>) => void;
  removeSfxClip: (id: string) => void;
  addMarker: (marker: NonNullable<Project["markers"]>[number]) => void;
  removeMarker: (id: string) => void;
  updateMarker: (id: string, patch: Partial<NonNullable<Project["markers"]>[number]>) => void;
  addTrack: (track: Track) => void;
  removeTrack: (id: string) => void;
  updateTrack: (id: string, patch: Partial<Track>) => void;
  moveSceneToTrack: (sceneId: string, toTrackId: string, toIndex: number) => void;
  setCaptionStyle: (patch: Partial<CaptionStyle>) => void;
  setStylePack: (pack: StylePack | undefined) => void;
  setWorkflowId: (workflowId: string) => void;
  setWorkflowInputs: (patch: Record<string, unknown>) => void;
  setSystemPrompt: (prompt: string) => void;
  applyStylePreset: (presetId: string) => void;
  setGenerating: (v: boolean) => void;
  setRendering: (v: boolean) => void;
  setRenderProgress: (v: number) => void;
  /** Insert or replace a cut by from/to scene id pair. */
  upsertCut: (cut: Cut) => void;
  /** Remove a cut by id. */
  removeCut: (id: string) => void;
  /** Insert or replace a keyframe at a given (sceneId, property, frame). */
  upsertKeyframe: (sceneId: string, property: KeyframeProperty, kf: Keyframe) => void;
  /** Remove a keyframe by sceneId + property + frame. */
  removeKeyframe: (sceneId: string, property: KeyframeProperty, frame: number) => void;
  /** Wipe all keyframes on a scene's property. */
  clearKeyframes: (sceneId: string, property: KeyframeProperty) => void;
  /**
   * Premiere-style cut: split scene `sceneId` at frame `atFrameWithin`
   * (a 0-indexed frame relative to the scene's own start). Both halves
   * share the original's content fields (text, background, character,
   * effects, motion). Voiceover audioDurationSec is *not* split — the
   * second half keeps the same audioUrl but renderer trims via duration.
   * Returns the new (second-half) scene id, or null if nothing happened.
   */
  splitScene: (sceneId: string, atFrameWithin: number) => string | null;
  /** Insert a new blank scene at `index` (pushes the rest right). */
  insertSceneAt: (index: number, scene: Scene) => void;
  /** Add an upload to the project's per-project upload bin. */
  addUpload: (upload: ProjectUpload) => void;
  /** Remove an upload from the bin (does NOT delete the file on disk). */
  removeUpload: (id: string) => void;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  /**
   * Coalesce a burst of mutations into a single undoable history entry.
   * Call `beginHistoryGroup()` on a drag/resize "start" phase and
   * `endHistoryGroup()` on "end" — every push between is folded onto
   * the entry captured at `begin`. Without this, dragging a clip
   * emits 30+ history entries and the user has to spam Cmd+Z.
   */
  beginHistoryGroup: () => void;
  endHistoryGroup: () => void;
}

function pushHistory(history: Project[], current: Project): Project[] {
  const next = [...history, current];
  if (next.length > MAX_HISTORY) next.shift();
  return next;
}

/**
 * Wrap a pushHistory call so it becomes a no-op while a history group
 * is active. Use this from any mutator that would otherwise emit a
 * snapshot during a drag burst. Mutators that already opt out of
 * history (selection, UI state) don't need this.
 */
function maybePushHistory(
  history: Project[],
  current: Project,
  groupDepth: number,
): Project[] {
  if (groupDepth > 0) return history;
  return pushHistory(history, current);
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
    workflowId: "blank",
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
      historyGroupDepth: 0,

      beginHistoryGroup: () =>
        set((s) => {
          if (s.historyGroupDepth === 0) {
            // Capture the pre-group snapshot once. Any push that would
            // have happened during the burst is suppressed; this single
            // entry stands in for the whole drag.
            return {
              historyGroupDepth: 1,
              history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
              future: [],
            };
          }
          return { historyGroupDepth: s.historyGroupDepth + 1 };
        }),

      endHistoryGroup: () =>
        set((s) => ({
          historyGroupDepth: Math.max(0, s.historyGroupDepth - 1),
        })),

      setProject: (p) => {
        // Stamp updatedAt so the dashboard can sort by recency. Every
        // mutation flows through setProject, so this single touch
        // covers undo/redo, scene edits, etc.
        const stamped: Project = { ...p, updatedAt: Date.now() };
        set((s) => ({
          project: stamped,
          projects: { ...s.projects, [stamped.id]: stamped },
          history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
          future: [],
        }));
      },
      renameProject: (name) =>
        set((s) => {
          const updated = { ...s.project, name };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
          };
        }),
      createProject: () => {
        const p: Project = { ...blankProject(), updatedAt: Date.now() };
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
          // Soft delete: stamp deletedAt so the dashboard hides it but
          // the user can restore from Trash. Hard purge happens via
          // purgeProject (manual) or emptyTrash (auto, 30-day cutoff).
          const target = s.projects[id];
          if (!target) return s;
          const stamped: Project = { ...target, deletedAt: Date.now() };
          const projects = { ...s.projects, [id]: stamped };
          // If the trashed project was active, switch to another live
          // project (or make a blank if none exist).
          let project = s.project;
          if (id === s.project.id) {
            const live = Object.values(projects).filter(
              (p) => p.id !== id && !p.deletedAt,
            );
            if (live.length > 0) {
              project = live[0];
            } else {
              project = blankProject();
              projects[project.id] = project;
            }
          }
          return {
            project,
            projects,
            selectedSceneId: null,
            selectedSceneIds: [],
            history: [],
            future: [],
          };
        }),

      restoreProject: (id) =>
        set((s) => {
          const target = s.projects[id];
          if (!target || !target.deletedAt) return s;
          const { deletedAt: _drop, ...rest } = target;
          return {
            projects: { ...s.projects, [id]: rest as Project },
          };
        }),

      purgeProject: (id) =>
        set((s) => {
          if (!(id in s.projects)) return s;
          const rest = { ...s.projects };
          delete rest[id];
          let project = s.project;
          let projects = rest;
          if (id === s.project.id) {
            const first = Object.values(rest).find((p) => !p.deletedAt);
            if (first) {
              project = first;
            } else {
              project = blankProject();
              projects = { ...rest, [project.id]: project };
            }
          }
          return {
            project,
            projects,
            selectedSceneId: null,
            selectedSceneIds: [],
          };
        }),

      emptyTrash: () =>
        set((s) => {
          const projects: Record<string, Project> = {};
          for (const [id, p] of Object.entries(s.projects)) {
            if (!p.deletedAt) projects[id] = p;
          }
          if (Object.keys(projects).length === 0) {
            const blank = blankProject();
            projects[blank.id] = blank;
            return { projects, project: blank };
          }
          return { projects };
        }),

      setScript: (script) =>
        set((s) => {
          const result = dispatchAction(s.project, "script.set", { script });
          if (!result.ok) return s;
          return {
            project: result.project,
            projects: { ...s.projects, [result.project.id]: result.project },
          };
        }),
      setScenes: (scenes) =>
        set((s) => {
          const updated = { ...s.project, scenes };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
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
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
            future: [],
          };
        }),
      setDimensions: (width, height) =>
        set((s) => {
          // Clamp to reasonable bounds. Even axes for codec compat.
          const w = Math.max(64, Math.min(7680, Math.round(width / 2) * 2));
          const h = Math.max(64, Math.min(7680, Math.round(height / 2) * 2));
          if (s.project.width === w && s.project.height === h) return s;
          const updated = { ...s.project, width: w, height: h };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
            future: [],
          };
        }),
      addScene: (scene) =>
        set((s) => {
          const newScenes = [...s.project.scenes, scene];
          // Auto-create a hard cut from the previous scene to this one so
          // every boundary has a Cut entry the UI can render a marker for.
          // Hard cut = durationFrames 0; renderer treats this as "no
          // <Transition> node between Sequences" → identical to a clean cut.
          const prev = s.project.scenes[s.project.scenes.length - 1];
          const newCuts = prev
            ? [
                ...(s.project.cuts ?? []),
                {
                  id: createId(),
                  fromSceneId: prev.id,
                  toSceneId: scene.id,
                  kind: "hard" as const,
                  durationFrames: 0,
                },
              ]
            : (s.project.cuts ?? []);
          const updated = {
            ...s.project,
            scenes: newScenes,
            cuts: newCuts.length > 0 ? newCuts : undefined,
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
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
          history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
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
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
            future: [],
          };
        }),
      removeScene: (id) =>
        set((s) => {
          const result = dispatchAction(s.project, "scene.remove", { id });
          if (!result.ok) return s;
          return {
            project: result.project,
            projects: { ...s.projects, [result.project.id]: result.project },
            selectedSceneId: s.selectedSceneId === id ? null : s.selectedSceneId,
            selectedSceneIds: s.selectedSceneIds.filter((x) => x !== id),
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
            future: [],
          };
        }),
      removeScenes: (ids) =>
        set((s) => {
          if (ids.length === 0) return s;
          const idSet = new Set(ids);
          // For bulk removal, drop every cut that touches any deleted
          // scene. We don't try to bridge multiple holes — the user
          // chose multi-select-delete, so they likely want a fresh
          // structure rather than a stitched-together one.
          const filteredCuts = (s.project.cuts ?? []).filter(
            (c) => !idSet.has(c.fromSceneId) && !idSet.has(c.toSceneId),
          );
          const updated = {
            ...s.project,
            scenes: s.project.scenes.filter((sc) => !idSet.has(sc.id)),
            cuts: filteredCuts.length > 0 ? filteredCuts : undefined,
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            selectedSceneId:
              s.selectedSceneId && idSet.has(s.selectedSceneId)
                ? null
                : s.selectedSceneId,
            selectedSceneIds: s.selectedSceneIds.filter((x) => !idSet.has(x)),
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
            future: [],
          };
        }),
      moveScene: (fromIdx, toIdx) =>
        set((s) => {
          // Locked scenes don't move and locked landing slots aren't
          // displaced — the move is silently ignored if either side is
          // locked. Keeps undo history clean.
          const from = s.project.scenes[fromIdx];
          const to = s.project.scenes[toIdx];
          if (from?.locked || to?.locked) return s;
          const scenes = [...s.project.scenes];
          const [moved] = scenes.splice(fromIdx, 1);
          scenes.splice(toIdx, 0, moved);
          const updated = { ...s.project, scenes };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
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
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
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
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
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
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
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
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
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
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
            future: [],
          };
        }),
      setAudioMix: (patch) =>
        set((s) => {
          const current = s.project.audioMix ?? {};
          const updated = {
            ...s.project,
            audioMix: { ...current, ...patch },
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            // Slider tweaks land in history so Cmd+Z works on mix moves.
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
            future: [],
          };
        }),
      addSfxClip: (clip) =>
        set((s) => {
          const updated = {
            ...s.project,
            sfxClips: [...(s.project.sfxClips ?? []), clip],
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
            future: [],
          };
        }),
      updateSfxClip: (id, patch) =>
        set((s) => {
          const updated = {
            ...s.project,
            sfxClips: (s.project.sfxClips ?? []).map((c) =>
              c.id === id ? { ...c, ...patch } : c,
            ),
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
            future: [],
          };
        }),
      removeSfxClip: (id) =>
        set((s) => {
          const updated = {
            ...s.project,
            sfxClips: (s.project.sfxClips ?? []).filter((c) => c.id !== id),
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
            future: [],
          };
        }),
      addMarker: (marker) =>
        set((s) => {
          const updated = {
            ...s.project,
            markers: [...(s.project.markers ?? []), marker],
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
            future: [],
          };
        }),
      removeMarker: (id) =>
        set((s) => {
          const updated = {
            ...s.project,
            markers: (s.project.markers ?? []).filter((m) => m.id !== id),
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
            future: [],
          };
        }),
      updateMarker: (id, patch) =>
        set((s) => {
          const updated = {
            ...s.project,
            markers: (s.project.markers ?? []).map((m) =>
              m.id === id ? { ...m, ...patch } : m,
            ),
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            // No history push — marker drag fires per pixel; would
            // explode the undo stack. Final position lands on next
            // user action that does push history.
          };
        }),
      // ----- Multi-track (M1) -----
      addTrack: (track) =>
        set((s) => {
          // First ever track add: lift the implicit single-track legacy
          // layout into project.tracks so we don't lose the existing
          // scene order.
          const existing =
            s.project.tracks ??
            (s.project.scenes.length > 0
              ? [
                  {
                    id: `track-${createId().slice(-8)}`,
                    kind: "video" as const,
                    name: "V1",
                    sceneIds: s.project.scenes.map((sc) => sc.id),
                  },
                ]
              : []);
          const updated = {
            ...s.project,
            tracks: [...existing, track],
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
            future: [],
          };
        }),
      removeTrack: (id) =>
        set((s) => {
          const tracks = s.project.tracks;
          if (!tracks) return s;
          const target = tracks.find((t) => t.id === id);
          if (!target || target.locked) return s;
          // Drop the track AND every scene that lives only on it. A scene
          // that's referenced by another track stays.
          const otherIds = new Set<string>();
          for (const t of tracks) {
            if (t.id === id) continue;
            for (const sid of t.sceneIds) otherIds.add(sid);
          }
          const orphaned = target.sceneIds.filter((sid) => !otherIds.has(sid));
          const filteredTracks = tracks.filter((t) => t.id !== id);
          const filteredScenes = s.project.scenes.filter(
            (sc) => !orphaned.includes(sc.id),
          );
          const updated = {
            ...s.project,
            tracks: filteredTracks.length === 0 ? undefined : filteredTracks,
            scenes: filteredScenes,
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
            future: [],
          };
        }),
      updateTrack: (id, patch) =>
        set((s) => {
          const tracks = s.project.tracks;
          if (!tracks) return s;
          const updatedTracks = tracks.map((t) =>
            t.id === id ? { ...t, ...patch } : t,
          );
          const updated = { ...s.project, tracks: updatedTracks };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
            future: [],
          };
        }),
      moveSceneToTrack: (sceneId, toTrackId, toIndex) =>
        set((s) => {
          const tracks = s.project.tracks;
          if (!tracks) return s;
          const target = tracks.find((t) => t.id === toTrackId);
          if (!target || target.locked) return s;
          // Remove sceneId from any track it currently belongs to, then
          // splice into the target at toIndex.
          const cleaned = tracks.map((t) => ({
            ...t,
            sceneIds: t.sceneIds.filter((id) => id !== sceneId),
          }));
          const updatedTracks = cleaned.map((t) => {
            if (t.id !== toTrackId) return t;
            const next = [...t.sceneIds];
            const idx = Math.max(0, Math.min(next.length, toIndex));
            next.splice(idx, 0, sceneId);
            return { ...t, sceneIds: next };
          });
          const updated = { ...s.project, tracks: updatedTracks };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
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
      setSystemPrompt: (prompt) =>
        set((s) => {
          const updated = {
            ...s.project,
            systemPrompt: prompt.trim() || undefined,
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
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
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
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
            future: [],
          };
        }),
      setGenerating: (v) => set({ isGenerating: v }),
      setRendering: (v) => set({ isRendering: v }),
      setRenderProgress: (v) => set({ renderProgress: v }),

      upsertCut: (cut) =>
        set((s) => {
          const existing = s.project.cuts ?? [];
          // Match by from/to pair — cut id may change but the boundary
          // is the natural identity. Allows re-saving the same cut after
          // edits without growing the array.
          const filtered = existing.filter(
            (c) =>
              !(c.fromSceneId === cut.fromSceneId && c.toSceneId === cut.toSceneId),
          );
          const updated = { ...s.project, cuts: [...filtered, cut] };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
            future: [],
          };
        }),
      removeCut: (id) =>
        set((s) => {
          const updated = {
            ...s.project,
            cuts: (s.project.cuts ?? []).filter((c) => c.id !== id),
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
            future: [],
          };
        }),
      upsertKeyframe: (sceneId, property, kf) =>
        set((s) => {
          const updated = {
            ...s.project,
            scenes: s.project.scenes.map((sc) => {
              if (sc.id !== sceneId) return sc;
              const existing = sc.keyframes?.[property] ?? [];
              const filtered = existing.filter((k) => k.frame !== kf.frame);
              const next = [...filtered, kf].sort((a, b) => a.frame - b.frame);
              return {
                ...sc,
                keyframes: { ...(sc.keyframes ?? {}), [property]: next },
              };
            }),
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
            future: [],
          };
        }),
      removeKeyframe: (sceneId, property, frame) =>
        set((s) => {
          const updated = {
            ...s.project,
            scenes: s.project.scenes.map((sc) => {
              if (sc.id !== sceneId) return sc;
              const existing = sc.keyframes?.[property];
              if (!existing) return sc;
              const filtered = existing.filter((k) => k.frame !== frame);
              return {
                ...sc,
                keyframes: { ...(sc.keyframes ?? {}), [property]: filtered },
              };
            }),
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
            future: [],
          };
        }),
      clearKeyframes: (sceneId, property) =>
        set((s) => {
          const updated = {
            ...s.project,
            scenes: s.project.scenes.map((sc) => {
              if (sc.id !== sceneId) return sc;
              const existing = { ...(sc.keyframes ?? {}) };
              delete existing[property];
              return { ...sc, keyframes: existing };
            }),
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
            future: [],
          };
        }),

      splitScene: (sceneId, atFrameWithin) => {
        const state = get();
        const idx = state.project.scenes.findIndex((sc) => sc.id === sceneId);
        if (idx < 0) return null;
        const original = state.project.scenes[idx];
        const fps = state.project.fps;
        const totalFrames = Math.max(1, Math.round(original.duration * fps));
        // Reject splits at the very start / end — those produce a 0-duration
        // scene which the renderer handles badly.
        if (atFrameWithin < 2 || atFrameWithin > totalFrames - 2) return null;
        const aDuration = atFrameWithin / fps;
        const bDuration = (totalFrames - atFrameWithin) / fps;
        // First half keeps the original id (so any external references —
        // selectedSceneId, focusedSceneId, etc. — stay valid).
        const sceneA: Scene = {
          ...original,
          duration: Number(aDuration.toFixed(3)),
          // Keyframes inside scene A: keep only the ones at frame ≤ split.
          keyframes: original.keyframes
            ? Object.fromEntries(
                Object.entries(original.keyframes).map(([k, kfs]) => [
                  k,
                  (kfs ?? []).filter((kf) => kf.frame <= atFrameWithin),
                ]),
              )
            : undefined,
        };
        const newId = createId();
        const sceneB: Scene = {
          ...original,
          id: newId,
          duration: Number(bDuration.toFixed(3)),
          // Voiceover: scene B keeps the audioUrl reference but we adjust
          // the duration. Renderer plays it from frame 0 of scene B; the
          // audio simply re-starts. Acceptable v1; future work could
          // ffmpeg-trim the audio for scene-A-end → scene-B-start continuity.
          // BRoll: shift each broll's startFrame so b-rolls anchored to
          // scene B's content keep their relative timing. Drop b-rolls
          // whose entire range lived in scene A.
          broll: original.broll
            ?.map((b) => ({
              ...b,
              id: createId(),
              startFrame: Math.max(0, b.startFrame - atFrameWithin),
            }))
            .filter((b) => b.startFrame + b.durationFrames > 0),
          keyframes: original.keyframes
            ? Object.fromEntries(
                Object.entries(original.keyframes).map(([k, kfs]) => [
                  k,
                  (kfs ?? [])
                    .filter((kf) => kf.frame >= atFrameWithin)
                    .map((kf) => ({ ...kf, frame: kf.frame - atFrameWithin })),
                ]),
              )
            : undefined,
        };
        // Cuts: original boundary cuts pointing AT the original become:
        //   - cut(prev → original) keeps targeting original (sceneA).
        //   - cut(original → next) needs to retarget to sceneB.
        // We also auto-insert a "hard" cut between the two halves so the
        // boundary has a Cut record (matches addScene's behavior).
        const renamedCuts = (state.project.cuts ?? []).map((c) => {
          if (c.fromSceneId === original.id) {
            return { ...c, fromSceneId: newId };
          }
          return c;
        });
        const splitCut = {
          id: createId(),
          fromSceneId: original.id,
          toSceneId: newId,
          kind: "hard" as const,
          durationFrames: 0,
        };
        const updated: Project = {
          ...state.project,
          scenes: [
            ...state.project.scenes.slice(0, idx),
            sceneA,
            sceneB,
            ...state.project.scenes.slice(idx + 1),
          ],
          cuts: [...renamedCuts, splitCut],
        };
        set((s) => ({
          project: updated,
          projects: { ...s.projects, [updated.id]: updated },
          history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
          future: [],
        }));
        return newId;
      },

      addUpload: (upload) =>
        set((s) => {
          const existing = s.project.uploads ?? [];
          // Dedupe by URL — re-uploading the same content (sha-hash
          // dedupe upstream) returns the same URL; we just bump
          // uploadedAt on the existing entry instead of growing the
          // list.
          const filtered = existing.filter((u) => u.url !== upload.url);
          const updated = {
            ...s.project,
            uploads: [...filtered, upload],
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
            future: [],
          };
        }),
      removeUpload: (id) =>
        set((s) => {
          const updated = {
            ...s.project,
            uploads: (s.project.uploads ?? []).filter((u) => u.id !== id),
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
            future: [],
          };
        }),

      insertSceneAt: (index, scene) =>
        set((s) => {
          const at = Math.max(0, Math.min(s.project.scenes.length, index));
          const before = s.project.scenes.slice(0, at);
          const after = s.project.scenes.slice(at);
          const newScenes = [...before, scene, ...after];
          // Auto-cut wiring: if there's a scene before, insert a hard cut
          // INTO this one; if there's a scene after, insert a hard cut
          // FROM this one TO the next. The cut that previously linked
          // before→after needs to be removed so we don't have a phantom
          // bypassing the new scene.
          const prev = before[before.length - 1];
          const next = after[0];
          let cuts = s.project.cuts ?? [];
          if (prev && next) {
            cuts = cuts.filter(
              (c) => !(c.fromSceneId === prev.id && c.toSceneId === next.id),
            );
          }
          const newCuts = [...cuts];
          if (prev) {
            newCuts.push({
              id: createId(),
              fromSceneId: prev.id,
              toSceneId: scene.id,
              kind: "hard",
              durationFrames: 0,
            });
          }
          if (next) {
            newCuts.push({
              id: createId(),
              fromSceneId: scene.id,
              toSceneId: next.id,
              kind: "hard",
              durationFrames: 0,
            });
          }
          const updated = {
            ...s.project,
            scenes: newScenes,
            cuts: newCuts.length > 0 ? newCuts : undefined,
          };
          return {
            project: updated,
            projects: { ...s.projects, [updated.id]: updated },
            history: maybePushHistory(s.history, s.project, s.historyGroupDepth),
            future: [],
          };
        }),

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
      version: 4,
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
        if (version < 4) {
          // v3 (now reverted) shipped demo scenes by default; v4 strips
          // them so users land on a clean Add-a-scene picker instead.
          // We can't tell user content from demo content reliably, so
          // we leave existing projects alone — the user can delete the
          // demos manually if they want.
        }
        return persisted;
      },
      // Recover from corrupted localStorage instead of white-screening.
      // If the persist hydrate throws (malformed JSON, schema drift),
      // wipe just our key, drop a one-shot recovery flag for the UI,
      // and let the store fall back to its initial state.
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          try {
            window.localStorage.removeItem("vibeedit-project");
            window.sessionStorage.setItem("vibeedit-recovery", "1");
          } catch {
            // best-effort
          }
          console.error("[project-store] rehydrate failed; storage cleared", error);
        }
      },
    },
  ),
);
