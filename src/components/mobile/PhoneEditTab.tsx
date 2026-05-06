"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { PhoneSceneEditor } from "@/components/mobile/PhoneSceneEditor";
import { haptics } from "@/lib/haptics";
import { useProjectStore } from "@/store/project-store";
import type { Scene } from "@/lib/scene-schema";

const Preview = dynamic(
	() => import("@/components/editor/Preview").then((m) => m.Preview),
	{
		ssr: false,
		loading: () => (
			<div className="aspect-video bg-black flex items-center justify-center text-neutral-600 text-[12px]">
				Loading preview…
			</div>
		),
	},
);

/**
 * Phone tab #2 — preview + scene properties.
 *
 * Layout: full-bleed Preview at the top (height proportional to project
 * aspect ratio so portrait projects get more vertical room), then the
 * accordion `<PhoneSceneEditor />` below.
 *
 * If no scene is selected (e.g. user opened the tab directly via the
 * tab bar) we auto-select the first scene so the page isn't empty.
 */
export function PhoneEditTab() {
	const selectedSceneId = useProjectStore((s) => s.selectedSceneId);
	// Read scenes by reference so React's `===` compare on the selector
	// stays cheap — `.map(s => s.id)` would mint a new array per render
	// and put us in a render loop with the auto-select effect below.
	const scenes = useProjectStore((s) => s.project.scenes);
	const firstSceneId = scenes[0]?.id;
	const selectScene = useProjectStore((s) => s.selectScene);

	// Fire the "if no scene picked, pick the first one" exactly once per
	// mount instead of every render whose deps changed — defensive
	// against any selector that subtly mutates the dep array.
	const didAutoSelectRef = useRef(false);
	useEffect(() => {
		if (didAutoSelectRef.current) return;
		if (!selectedSceneId && firstSceneId) {
			didAutoSelectRef.current = true;
			selectScene(firstSceneId);
		}
	}, [selectedSceneId, firstSceneId, selectScene]);

	// Swipe-between-scenes on the preview surface.
	// Threshold tuned to match the scroll-vs-swipe inflection iOS/Android
	// users expect: 60px horizontal travel + horizontal-dominant
	// (|dx| > 1.5 * |dy|) so vertical scrolls of the editor below don't
	// accidentally jump scenes.
	const swipeStart = useRef<{ x: number; y: number } | null>(null);
	const onTouchStart = (e: React.TouchEvent) => {
		const t = e.touches[0];
		if (!t) return;
		swipeStart.current = { x: t.clientX, y: t.clientY };
	};
	const onTouchEnd = (e: React.TouchEvent) => {
		const start = swipeStart.current;
		swipeStart.current = null;
		if (!start) return;
		const t = e.changedTouches[0];
		if (!t) return;
		const dx = t.clientX - start.x;
		const dy = t.clientY - start.y;
		if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
		const idx = scenes.findIndex((scene: Scene) => scene.id === selectedSceneId);
		if (idx < 0) return;
		const next = dx < 0 ? idx + 1 : idx - 1;
		const target = scenes[next]?.id;
		if (target) {
			haptics.medium();
			selectScene(target);
		}
	};

	if (!firstSceneId) {
		return (
			<div className="flex-1 flex items-center justify-center px-6 text-center text-[12px] text-neutral-500">
				No scenes yet — open the Scenes tab and tap + to add one.
			</div>
		);
	}

	return (
		<div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
			<div
				className="shrink-0 bg-black border-b border-neutral-800"
				onTouchStart={onTouchStart}
				onTouchEnd={onTouchEnd}
			>
				<Preview />
			</div>
			<div className="flex-1 min-h-0">
				<PhoneSceneEditor />
			</div>
		</div>
	);
}
