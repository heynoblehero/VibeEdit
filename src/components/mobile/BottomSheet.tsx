"use client";

import { type ReactNode, useCallback, useEffect, useRef } from "react";

export interface BottomSheetAction {
	label: string;
	onSelect: () => void;
	icon?: ReactNode;
	tone?: "default" | "danger";
}

interface Props {
	open: boolean;
	title?: string;
	actions: BottomSheetAction[];
	onClose: () => void;
}

/**
 * Touch-friendly action sheet that slides up from the bottom of the
 * viewport. Replaces right-click / context menus on coarse-pointer
 * devices — long-press the source element, hand the resulting actions
 * to this sheet. Backdrop taps and Escape close it.
 *
 * Render this near the root of a workspace; the sheet positions itself
 * via fixed inset and motion-slide-up. Action `tone="danger"` tints
 * the row red (delete affordances).
 */
export function BottomSheet({ open, title, actions, onClose }: Props) {
	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div
			className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 backdrop-blur-sm motion-fade"
			onClick={onClose}
			onKeyDown={() => {}}
			role="presentation"
		>
			<div
				className="w-full sm:max-w-md rounded-t-2xl bg-neutral-900 border-t border-x border-neutral-800 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] motion-slide-up pb-[env(safe-area-inset-bottom)]"
				onClick={(e) => e.stopPropagation()}
				onKeyDown={(e) => e.stopPropagation()}
				role="dialog"
				aria-label={title ?? "Actions"}
			>
				<div className="flex justify-center pt-2 pb-1">
					<span className="block h-1 w-10 rounded-full bg-neutral-700" />
				</div>
				{title ? (
					<div className="px-4 pb-2 text-[12px] uppercase tracking-wider text-neutral-500">
						{title}
					</div>
				) : null}
				<div className="px-2 pb-2">
					{actions.map((a) => (
						<button
							key={a.label}
							type="button"
							onClick={() => {
								a.onSelect();
								onClose();
							}}
							className={`w-full flex items-center gap-3 px-3 py-3 rounded-md text-left text-[14px] transition-colors ${
								a.tone === "danger"
									? "text-red-300 hover:bg-red-500/10"
									: "text-neutral-200 hover:bg-neutral-800"
							}`}
						>
							{a.icon ? <span className="shrink-0">{a.icon}</span> : null}
							<span className="flex-1">{a.label}</span>
						</button>
					))}
				</div>
			</div>
		</div>
	);
}

interface LongPressHandlers {
	onPointerDown: (e: React.PointerEvent) => void;
	onPointerUp: (e: React.PointerEvent) => void;
	onPointerCancel: (e: React.PointerEvent) => void;
	onPointerMove: (e: React.PointerEvent) => void;
}

/**
 * Long-press detector hook. Fires `onLongPress` after `delay` ms of
 * sustained press on a coarse pointer; movement beyond `tolerance` px
 * cancels. Spread the returned handlers onto the target element.
 *
 * Mouse pointers are intentionally ignored — desktop users have
 * onContextMenu and the affordance would feel laggy on a real mouse.
 */
export function useLongPress(
	onLongPress: (info: { clientX: number; clientY: number }) => void,
	{ delay = 500, tolerance = 6 }: { delay?: number; tolerance?: number } = {},
): LongPressHandlers {
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const startRef = useRef({ x: 0, y: 0 });
	const cbRef = useRef(onLongPress);
	useEffect(() => {
		cbRef.current = onLongPress;
	}, [onLongPress]);

	const clear = useCallback(() => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const onPointerDown = useCallback(
		(e: React.PointerEvent) => {
			if (e.pointerType === "mouse") return;
			startRef.current = { x: e.clientX, y: e.clientY };
			const x = e.clientX;
			const y = e.clientY;
			clear();
			timerRef.current = setTimeout(() => {
				timerRef.current = null;
				cbRef.current({ clientX: x, clientY: y });
			}, delay);
		},
		[clear, delay],
	);

	const onPointerMove = useCallback(
		(e: React.PointerEvent) => {
			if (!timerRef.current) return;
			const dx = Math.abs(e.clientX - startRef.current.x);
			const dy = Math.abs(e.clientY - startRef.current.y);
			if (dx > tolerance || dy > tolerance) clear();
		},
		[clear, tolerance],
	);

	useEffect(() => () => clear(), [clear]);

	return {
		onPointerDown,
		onPointerMove,
		onPointerUp: clear,
		onPointerCancel: clear,
	};
}
