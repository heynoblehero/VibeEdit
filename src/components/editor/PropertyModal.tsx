"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
	open: boolean;
	onClose: () => void;
	title: string;
	subtitle?: string;
	children: React.ReactNode;
	/** Visual accent color — drives the header underline + close-button hover. */
	accent?: "emerald" | "purple" | "cyan" | "amber" | "sky" | "pink";
	width?: "narrow" | "default" | "wide" | "huge";
}

const ACCENT: Record<NonNullable<Props["accent"]>, { ring: string; text: string; line: string }> = {
	emerald: { ring: "ring-emerald-500/40", text: "text-emerald-300", line: "bg-emerald-500/60" },
	purple: { ring: "ring-purple-500/40", text: "text-purple-300", line: "bg-purple-500/60" },
	cyan: { ring: "ring-cyan-500/40", text: "text-cyan-300", line: "bg-cyan-500/60" },
	amber: { ring: "ring-amber-500/40", text: "text-amber-300", line: "bg-amber-500/60" },
	sky: { ring: "ring-sky-500/40", text: "text-sky-300", line: "bg-sky-500/60" },
	pink: { ring: "ring-pink-500/40", text: "text-pink-300", line: "bg-pink-500/60" },
};

const WIDTH: Record<NonNullable<Props["width"]>, string> = {
	narrow: "max-w-sm",
	default: "max-w-md",
	wide: "max-w-2xl",
	huge: "max-w-5xl",
};

/**
 * Animated modal/overlay. Used for the heavier property groups (color
 * grade, effects, animation, keying) that crowd the inline panel and
 * benefit from a focused workspace.
 *
 * Behaviour:
 * - Mounts via a portal so backdrop + card sit above any z-index war.
 * - Fades the backdrop and slide-ups the card (CSS transitions, no lib).
 * - Esc closes. Click on the backdrop closes. Body scroll locked while
 *   open so the user doesn't accidentally scroll the page underneath.
 */
export function PropertyModal({
	open,
	onClose,
	title,
	subtitle,
	children,
	accent = "emerald",
	width = "default",
}: Props) {
	// Mount/unmount with a frame delay so the enter transition runs.
	const [mounted, setMounted] = useState(false);
	const [shown, setShown] = useState(false);

	useEffect(() => {
		if (open) {
			setMounted(true);
			// Next frame so the initial styles paint before the "shown" class.
			requestAnimationFrame(() => setShown(true));
		} else {
			setShown(false);
			const t = setTimeout(() => setMounted(false), 200);
			return () => clearTimeout(t);
		}
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKey);
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = prev;
		};
	}, [open, onClose]);

	if (!mounted) return null;
	if (typeof document === "undefined") return null;

	const a = ACCENT[accent];

	return createPortal(
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
			onClick={onClose}
		>
			<div
				aria-hidden
				className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-200"
				style={{ opacity: shown ? 1 : 0 }}
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={title}
				onClick={(e) => e.stopPropagation()}
				className={`relative w-full ${WIDTH[width]} max-h-[85vh] flex flex-col rounded-xl bg-neutral-900 border border-neutral-700 shadow-2xl ring-1 ${a.ring} transition-all duration-200`}
				style={{
					opacity: shown ? 1 : 0,
					transform: shown ? "translateY(0) scale(1)" : "translateY(16px) scale(0.97)",
				}}
			>
				<header className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 shrink-0">
					<div className="min-w-0">
						<div className={`text-[12px] font-semibold uppercase tracking-wider ${a.text}`}>
							{title}
						</div>
						{subtitle && (
							<div className="text-[10px] text-neutral-500 mt-0.5 truncate">{subtitle}</div>
						)}
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						title="Close (Esc)"
						className="p-1.5 rounded-md text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors"
					>
						<X className="h-4 w-4" />
					</button>
				</header>
				<div className={`h-0.5 ${a.line} shrink-0`} />
				<div className="overflow-y-auto px-4 py-4 space-y-3">{children}</div>
			</div>
		</div>,
		document.body,
	);
}

/**
 * Trigger button that goes inside a property panel. Opens its
 * accompanying PropertyModal. Visually consistent across panels so the
 * "click to open more controls" affordance reads at a glance.
 */
export function ModalTrigger({
	onClick,
	icon,
	label,
	hint,
	accent = "emerald",
}: {
	onClick: () => void;
	icon: React.ReactNode;
	label: string;
	hint?: string;
	accent?: NonNullable<Props["accent"]>;
}) {
	const a = ACCENT[accent];
	return (
		<button
			type="button"
			onClick={onClick}
			className={`group w-full flex items-center gap-2.5 px-3 py-2 rounded-md border border-neutral-800 hover:border-neutral-600 bg-neutral-950 hover:bg-neutral-900 transition-colors text-left`}
		>
			<span
				className={`shrink-0 inline-flex items-center justify-center w-7 h-7 rounded ${a.text} bg-neutral-900 group-hover:bg-neutral-800 transition-colors`}
			>
				{icon}
			</span>
			<span className="flex-1 min-w-0">
				<span className={`block text-[12px] font-semibold ${a.text}`}>{label}</span>
				{hint && (
					<span className="block text-[10px] text-neutral-500 truncate">{hint}</span>
				)}
			</span>
			<span className="text-neutral-600 group-hover:text-white text-[14px]">→</span>
		</button>
	);
}
