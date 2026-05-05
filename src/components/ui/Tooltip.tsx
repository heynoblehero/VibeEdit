"use client";

import {
	cloneElement,
	type ReactElement,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";

type Placement = "top" | "bottom" | "left" | "right";

interface Props {
	content: React.ReactNode;
	placement?: Placement;
	delayMs?: number;
	/** The trigger element. Receives ref + handlers. Single child only. */
	children: ReactElement<{
		ref?: React.Ref<HTMLElement>;
		onMouseEnter?: (e: React.MouseEvent) => void;
		onMouseLeave?: (e: React.MouseEvent) => void;
		onFocus?: (e: React.FocusEvent) => void;
		onBlur?: (e: React.FocusEvent) => void;
		"aria-describedby"?: string;
	}>;
}

/**
 * Single-source tooltip primitive. Replaces the mix of `title=`,
 * hand-rolled hover cards, and Radix-style implementations scattered
 * across the editor. Renders via portal so it's never clipped by
 * `overflow-hidden` ancestors. Hover + focus both trigger; Escape
 * dismisses; respects `prefers-reduced-motion`.
 *
 * Usage: wrap a single child element. The tooltip auto-positions on
 * mount and on scroll. For purely decorative `title` text, this is
 * overkill — use `title=` directly. For actionable affordances or any
 * tooltip that needs styling, reach for this.
 */
export function Tooltip({
	content,
	placement = "top",
	delayMs = 350,
	children,
}: Props) {
	const id = useId();
	const triggerRef = useRef<HTMLElement | null>(null);
	const [open, setOpen] = useState(false);
	const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
	const showTimer = useRef<number | null>(null);

	const measure = () => {
		const el = triggerRef.current;
		if (!el) return;
		const r = el.getBoundingClientRect();
		const gap = 6;
		switch (placement) {
			case "top":
				setPos({ top: r.top - gap, left: r.left + r.width / 2 });
				break;
			case "bottom":
				setPos({ top: r.bottom + gap, left: r.left + r.width / 2 });
				break;
			case "left":
				setPos({ top: r.top + r.height / 2, left: r.left - gap });
				break;
			case "right":
				setPos({ top: r.top + r.height / 2, left: r.right + gap });
				break;
		}
	};

	useEffect(() => {
		if (!open) return;
		measure();
		const onScroll = () => measure();
		window.addEventListener("scroll", onScroll, true);
		window.addEventListener("resize", onScroll);
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener("scroll", onScroll, true);
			window.removeEventListener("resize", onScroll);
			window.removeEventListener("keydown", onKey);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	const show = () => {
		if (showTimer.current) window.clearTimeout(showTimer.current);
		showTimer.current = window.setTimeout(() => setOpen(true), delayMs);
	};
	const hide = () => {
		if (showTimer.current) window.clearTimeout(showTimer.current);
		setOpen(false);
	};

	const child = cloneElement(children, {
		ref: (node: HTMLElement | null) => {
			triggerRef.current = node;
			const original = (children as { ref?: React.Ref<HTMLElement> }).ref;
			if (typeof original === "function") original(node);
			else if (original && typeof original === "object")
				(original as { current: HTMLElement | null }).current = node;
		},
		onMouseEnter: (e: React.MouseEvent) => {
			children.props.onMouseEnter?.(e);
			show();
		},
		onMouseLeave: (e: React.MouseEvent) => {
			children.props.onMouseLeave?.(e);
			hide();
		},
		onFocus: (e: React.FocusEvent) => {
			children.props.onFocus?.(e);
			show();
		},
		onBlur: (e: React.FocusEvent) => {
			children.props.onBlur?.(e);
			hide();
		},
		"aria-describedby": id,
	});

	const transform =
		placement === "top"
			? "translate(-50%, -100%)"
			: placement === "bottom"
				? "translate(-50%, 0)"
				: placement === "left"
					? "translate(-100%, -50%)"
					: "translate(0, -50%)";

	return (
		<>
			{child}
			{open && pos && typeof document !== "undefined"
				? createPortal(
						<div
							id={id}
							role="tooltip"
							className="pointer-events-none fixed z-[200] px-2 py-1 rounded-md text-[11px] text-neutral-100 bg-neutral-900/95 border border-neutral-700 shadow-[0_8px_24px_rgba(0,0,0,0.45)] motion-fade backdrop-blur-sm"
							style={{ top: pos.top, left: pos.left, transform, maxWidth: 280 }}
						>
							{content}
						</div>,
						document.body,
					)
				: null}
		</>
	);
}
