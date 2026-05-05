"use client";

import { Bookmark, Copy, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import { useActivityStore } from "@/store/activity-store";
import { useProjectStore } from "@/store/project-store";
import { useSceneTemplatesStore } from "@/store/scene-templates-store";

/**
 * Floating bulk-action bar for multi-selected scenes. Anchors to the
 * bottom of the editor when 2+ scenes are selected. Verbs available:
 *   - Duplicate selection
 *   - Save first as template (covers the common "extract style" path)
 *   - Delete selection
 *   - Clear selection
 *
 * Single-select cases use the existing context menu / keyboard shortcuts.
 */
export function BulkSceneBar() {
	const project = useProjectStore((s) => s.project);
	const ids = useProjectStore((s) => s.selectedSceneIds);
	const removeScenes = useProjectStore((s) => s.removeScenes);
	const duplicateScene = useProjectStore((s) => s.duplicateScene);
	const clearSelection = useProjectStore((s) => s.clearSelection);
	const saveTemplate = useSceneTemplatesStore((s) => s.save);

	if (ids.length < 2) return null;
	const first = project.scenes.find((s) => s.id === ids[0]);

	const handleDuplicate = () => {
		ids.forEach((id) => duplicateScene(id));
		toast.success(`Duplicated ${ids.length} scene${ids.length === 1 ? "" : "s"}`);
		useActivityStore.getState().log({
			projectId: project.id,
			kind: "scene-add",
			label: `Duplicated ${ids.length} scenes`,
		});
	};
	const handleDelete = () => {
		// Hard confirm above 10; otherwise rely on the in-store undo
		// stack (Cmd+Z) and surface a 5-second toast nudge.
		if (ids.length > 10) {
			const ok = window.confirm(
				`Delete ${ids.length} scenes? You can still Cmd+Z to recover, but this is a big delete.`,
			);
			if (!ok) return;
		}
		removeScenes(ids);
		toast.info(`Deleted ${ids.length} scene${ids.length === 1 ? "" : "s"}`, {
			description: "Cmd+Z to undo",
			duration: 5000,
		});
		useActivityStore.getState().log({
			projectId: project.id,
			kind: "scene-delete",
			label: `Deleted ${ids.length} scenes`,
		});
	};
	const handleSaveTemplate = () => {
		if (!first) return;
		const name = window.prompt(
			"Template name?",
			first.label || `Scene template`,
		);
		if (!name) return;
		saveTemplate(name, first);
		toast.success(`Saved "${name}" to scene templates`);
	};

	return (
		<div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 px-2 py-1.5 rounded-full bg-neutral-900 border border-emerald-500/40 shadow-[0_8px_24px_rgba(16,185,129,0.18)] motion-pop">
			<span className="px-2 text-[11px] text-emerald-200 font-semibold">
				{ids.length} selected
			</span>
			<div className="h-4 w-px bg-neutral-800" />
			<Button
				variant="ghost"
				size="xs"
				onClick={handleDuplicate}
				leadingIcon={<Copy className="h-3 w-3" />}
			>
				Duplicate
			</Button>
			<Button
				variant="ghost"
				size="xs"
				onClick={handleSaveTemplate}
				leadingIcon={<Bookmark className="h-3 w-3" />}
			>
				Save first as template
			</Button>
			<Button
				variant="ghost"
				size="xs"
				onClick={handleDelete}
				leadingIcon={<Trash2 className="h-3 w-3" />}
				className="text-red-300 hover:bg-red-500/10"
			>
				Delete
			</Button>
			<button
				type="button"
				onClick={clearSelection}
				title="Clear selection (Esc)"
				className="p-1 rounded text-neutral-500 hover:text-white"
			>
				<X className="h-3 w-3" />
			</button>
		</div>
	);
}
