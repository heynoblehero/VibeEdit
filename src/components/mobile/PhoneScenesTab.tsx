"use client";

import { useEffect, useRef } from "react";
import { SceneList } from "@/components/editor/SceneList";
import { useProjectStore } from "@/store/project-store";

interface Props {
	onOpenEdit: () => void;
}

/**
 * Phone tab #1 — vertical scrollable list of scenes.
 *
 * Reuses the existing `<SceneList />`: it already has the touch-friendly
 * dnd-kit drag, long-press → context-menu, scene cards with thumbnails,
 * empty-state CTA + aspect picker for the first scene.
 *
 * UX bridge: when the user picks a scene we want to jump to the Edit
 * tab (otherwise tapping a card does nothing visible — the editor that
 * would render is on the next tab). Care: only fire when the selection
 * actually CHANGES from one we've already seen on this tab. Without
 * that guard, mounting with a pre-selected scene (re-entering the
 * Scenes tab while a scene is selected) would auto-jump immediately,
 * making the tab unreachable.
 */
export function PhoneScenesTab({ onOpenEdit }: Props) {
	const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
	const lastSeenRef = useRef<string | null | undefined>(undefined);

	useEffect(() => {
		// First render after mount: just record the current value, do
		// nothing. Subsequent changes are real selection events.
		if (lastSeenRef.current === undefined) {
			lastSeenRef.current = selectedSceneId;
			return;
		}
		if (selectedSceneId && selectedSceneId !== lastSeenRef.current) {
			lastSeenRef.current = selectedSceneId;
			onOpenEdit();
		} else {
			lastSeenRef.current = selectedSceneId;
		}
	}, [selectedSceneId, onOpenEdit]);

	return (
		<div className="flex-1 overflow-y-auto">
			<SceneList />
		</div>
	);
}
