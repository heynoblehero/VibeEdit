"use client";

import { useEffect } from "react";
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
 * empty-state CTA + aspect picker for the first scene. We just give it
 * its own scroll container and bridge a side-effect: when the user
 * selects a scene, jump them straight to the Edit tab so the flow is
 * obvious. Without this jump, users tap a card and nothing visible
 * changes (the editor that would render is on the next tab).
 */
export function PhoneScenesTab({ onOpenEdit }: Props) {
	const selectedSceneId = useProjectStore((s) => s.selectedSceneId);

	useEffect(() => {
		if (selectedSceneId) {
			// Defer one frame so the user sees the selection ring on the
			// card briefly before the tab swap — feels less abrupt.
			const id = requestAnimationFrame(() => onOpenEdit());
			return () => cancelAnimationFrame(id);
		}
	}, [selectedSceneId, onOpenEdit]);

	return (
		<div className="flex-1 overflow-y-auto">
			<SceneList />
		</div>
	);
}
