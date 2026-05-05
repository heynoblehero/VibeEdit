"use client";

import { type ReactNode, useEffect } from "react";

interface Props {
	open: boolean;
	side: "left" | "right";
	onClose: () => void;
	children: ReactNode;
	title?: string;
}

/**
 * Slide-out drawer for narrow viewports. Wraps a workspace rail in a
 * fixed overlay so the editor body keeps the full width on phones,
 * but the user can still summon the scene list / properties pane on
 * demand. Tap-backdrop and Escape close.
 *
 * On desktop / tablet we keep the rails in-flow (side-by-side); this
 * component is only mounted when `open` is true and a phone-shaped
 * shell decides to use it.
 */
export function MobileDrawer({ open, side, onClose, children, title }: Props) {
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		// Push a sentinel history entry so Android's hardware back
		// button (which the WebView translates to popstate) closes
		// this drawer instead of leaving the editor. The pop is
		// triggered by `history.back()` from onClose; the popstate
		// handler also runs onClose if the user mashes back directly.
		window.history.pushState({ vibeedit_drawer: true }, "");
		const onPop = () => onClose();
		window.addEventListener("popstate", onPop);
		return () => {
			window.removeEventListener("keydown", onKey);
			window.removeEventListener("popstate", onPop);
		};
	}, [open, onClose]);

	if (!open) return null;

	const sideClasses =
		side === "left"
			? "left-0 border-r motion-slide-in-left"
			: "right-0 border-l motion-slide-in-right";

	return (
		<div
			className="fixed inset-0 z-[110] motion-fade"
			onClick={onClose}
			onKeyDown={() => {}}
			role="presentation"
		>
			<div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
			<div
				className={`absolute top-0 bottom-0 w-[85vw] max-w-sm bg-neutral-900 border-neutral-800 shadow-2xl flex flex-col ${sideClasses}`}
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
				role="dialog"
				aria-label={title ?? "Drawer"}
			>
				{title ? (
					<div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
						<span className="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">
							{title}
						</span>
						<button
							type="button"
							onClick={onClose}
							className="text-neutral-500 hover:text-white text-[14px] px-1"
							aria-label="Close drawer"
						>
							×
						</button>
					</div>
				) : null}
				<div className="flex-1 overflow-y-auto">{children}</div>
			</div>
		</div>
	);
}
