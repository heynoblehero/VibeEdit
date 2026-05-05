"use client";

import { SceneEditor } from "@/components/editor/SceneEditor";

/**
 * Phone scene editor body.
 *
 * Tradeoff note: the original plan called for a parallel "phone-first
 * accordion" editor so we could lay out controls for thumbs. After
 * reading SceneEditor.tsx (2,800+ lines, 14+ panel sub-components, deep
 * shared state), the maintenance cost of keeping a fork in sync vastly
 * exceeds the layout win. SceneEditor's internal `Section` chrome is
 * already vertically stacked + scrollable; on phone we just give it the
 * full screen width (vs 288px on desktop) and the form fields breathe.
 *
 * Specific phone affordances (bigger sliders, accordion collapse) are
 * follow-up work — wire them inside SceneEditor itself behind a
 * `usePhoneMode()` check, not in a fork.
 */
export function PhoneSceneEditor() {
	return (
		<div className="flex flex-col h-full overflow-y-auto bg-neutral-950">
			<div className="sticky top-0 z-10 px-3 py-2 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur text-[11px] uppercase tracking-wider text-emerald-300 font-semibold">
				Properties
			</div>
			<SceneEditor />
		</div>
	);
}
