import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { assetStorage } from "@/lib/storage/asset-storage";

/**
 * Tracks which workspace tab (Video / Audio) is active per project.
 * Persists to localStorage so reload preserves intent. The route
 * `/projects/[id]` reads this to decide what to render; URL `?tab=`
 * is used as a one-shot override that wins on first paint.
 */

export type WorkspaceTab = "video" | "audio" | "animate";

interface WorkspaceStore {
	/** Map of projectId → last active tab. */
	activeTabs: Record<string, WorkspaceTab>;
	getTab(projectId: string): WorkspaceTab;
	setTab(projectId: string, tab: WorkspaceTab): void;
}

export const useWorkspaceStore = create<WorkspaceStore>()(
	persist(
		(set, get) => ({
			activeTabs: {},
			getTab: (projectId) => get().activeTabs[projectId] ?? "video",
			setTab: (projectId, tab) =>
				set((s) => ({ activeTabs: { ...s.activeTabs, [projectId]: tab } })),
		}),
		{
			name: "vibeedit-workspace-tabs",
			storage: createJSONStorage(() => assetStorage),
		},
	),
);
