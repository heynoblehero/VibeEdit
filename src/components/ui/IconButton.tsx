"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cls } from "@/lib/design/tokens";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
	icon: ReactNode;
	/** Required — used as both `title` and aria-label for a11y. */
	label: string;
	variant?: "ghost" | "subtle" | "danger";
	size?: "xs" | "sm" | "md";
}

const SIZE_CLASS: Record<NonNullable<Props["size"]>, string> = {
	xs: "h-5 w-5",
	sm: "h-6 w-6",
	md: "h-7 w-7",
};

const VARIANT_CLASS: Record<NonNullable<Props["variant"]>, string> = {
	ghost: "text-neutral-400 hover:text-white hover:bg-neutral-800",
	subtle: "text-neutral-500 hover:text-neutral-200",
	danger: "text-neutral-500 hover:text-red-300 hover:bg-red-500/10",
};

/**
 * Square icon button — for toolbars, close buttons, and any
 * icon-only action. Always pass a `label` for accessibility; we
 * mirror it into both `title` and `aria-label`.
 */
export const IconButton = forwardRef<HTMLButtonElement, Props>(
	function IconButton(
		{ icon, label, variant = "ghost", size = "sm", className, ...rest },
		ref,
	) {
		return (
			<button
				ref={ref}
				type="button"
				title={label}
				aria-label={label}
				className={cls(
					"inline-flex items-center justify-center rounded transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-600",
					SIZE_CLASS[size],
					VARIANT_CLASS[variant],
					className,
				)}
				{...rest}
			>
				{icon}
			</button>
		);
	},
);
