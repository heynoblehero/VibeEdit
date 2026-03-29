import type { EditorCore } from "@/core";
import type { TProject, TProjectSettings, TTimelineViewState } from "@/types/project";
import type { Bookmark, TScene } from "@/types/timeline";
import { getProjectDurationFromScenes } from "@/lib/scenes";
import { clearEffects } from "@/lib/remotion/registry";

function normalizeBookmarks(raw: unknown): Bookmark[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item): Bookmark | null => {
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
    .filter((b): b is Bookmark => b !== null);
}

export async function restoreProjectFromSnapshot(
  editor: EditorCore,
  serializedProject: {
    metadata: { id: string; name: string; thumbnail?: string | null; duration?: number; createdAt: string; updatedAt: string };
    scenes: Array<{
      id: string; name: string; isMain: boolean;
      tracks: any[]; bookmarks: unknown;
      createdAt: string; updatedAt: string;
    }>;
    currentSceneId: string;
    settings: TProjectSettings;
    version: number;
    timelineViewState?: TTimelineViewState;
  },
): Promise<void> {
  editor.save.pause();

  try {
    // Deserialize scenes (ISO dates → Date objects, normalize bookmarks)
    const scenes: TScene[] = (serializedProject.scenes ?? []).map((scene) => ({
      id: scene.id,
      name: scene.name,
      isMain: scene.isMain,
      tracks: (scene.tracks ?? []).map((track: any) =>
        track.type === "video"
          ? { ...track, isMain: track.isMain ?? false }
          : track,
      ),
      bookmarks: normalizeBookmarks(scene.bookmarks),
      createdAt: new Date(scene.createdAt),
      updatedAt: new Date(scene.updatedAt),
    }));

    const project: TProject = {
      metadata: {
        id: serializedProject.metadata.id,
        name: serializedProject.metadata.name,
        thumbnail: serializedProject.metadata.thumbnail ?? undefined,
        duration: serializedProject.metadata.duration ?? getProjectDurationFromScenes({ scenes }),
        createdAt: new Date(serializedProject.metadata.createdAt),
        updatedAt: new Date(serializedProject.metadata.updatedAt),
      },
      scenes,
      currentSceneId: serializedProject.currentSceneId || "",
      settings: serializedProject.settings,
      version: serializedProject.version,
      timelineViewState: serializedProject.timelineViewState,
    };

    // Clear stale Remotion effects from after the snapshot point
    clearEffects();

    // Set active project and reinitialize scenes
    editor.project.setActiveProject({ project });
    editor.scenes.initializeScenes({
      scenes: project.scenes,
      currentSceneId: project.currentSceneId,
    });

    // Load fonts from restored tracks
    const allTracks = project.scenes.flatMap((scene) => scene.tracks);
    const { loadFonts } = await import("@/lib/fonts/google-fonts");
    const { collectFontFamilies } = await import("@/lib/timeline/element-utils");
    await loadFonts({ families: collectFontFamilies({ tracks: allTracks }) });

    // Media stays in OPFS — no reload needed. mediaId references remain valid.

    // Save the restored state
    await editor.project.saveCurrentProject();
  } finally {
    editor.save.resume();
  }
}
