"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createId, type Scene } from "@/lib/scene-schema";

export interface SceneTemplate {
	id: string;
	name: string;
	scene: Scene;
	createdAt: number;
}

interface SceneTemplatesStore {
	templates: SceneTemplate[];
	save: (name: string, scene: Scene) => SceneTemplate;
	remove: (id: string) => void;
}

/**
 * Cross-project scene templates. Save a styled scene as a template,
 * apply it to a fresh scene with one click. Like saved styles but
 * scoped to a whole scene (background, text items, transitions).
 */
export const useSceneTemplatesStore = create<SceneTemplatesStore>()(
	persist(
		(set) => ({
			templates: [],
			save: (name, scene) => {
				// Strip the id so applying creates a fresh scene.
				const { id: _drop, ...rest } = scene;
				const template: SceneTemplate = {
					id: createId(),
					name,
					scene: { ...(rest as Scene), id: "" },
					createdAt: Date.now(),
				};
				set((s) => ({ templates: [template, ...s.templates] }));
				return template;
			},
			remove: (id) =>
				set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),
		}),
		{
			name: "vibeedit-scene-templates",
			storage: createJSONStorage(() => localStorage),
		},
	),
);
