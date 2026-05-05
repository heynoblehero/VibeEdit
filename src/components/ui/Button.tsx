"use client";

import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { type AccentName, cls } from "@/lib/design/tokens";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "xs" | "sm" | "md";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size"> {
	variant?: Variant;
	size?: Size;
	accent?: AccentName;
	loading?: boolean;
	leadingIcon?: ReactNode;
	trailingIcon?: ReactNode;
	fullWidth?: boolean;
}

const SIZE_CLASS: Record<Size, string> = {
	xs: "h-6 px-2 text-[11px] gap-1",
	sm: "h-7 px-2.5 text-[12px] gap-1.5",
	md: "h-9 px-3.5 text-[13px] gap-1.5",
};

const ACCENT_PRIMARY: Record<AccentName, string> = {
	video:
		"bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-black ring-emerald-300/40",
	audio:
		"bg-orange-500 hover:bg-orange-400 active:bg-orange-600 text-black ring-orange-300/40",
	animate:
		"bg-fuchsia-500 hover:bg-fuchsia-400 active:bg-fuchsia-600 text-black ring-fuchsia-300/40",
};

const ACCENT_SECONDARY: Record<AccentName, string> = {
	video: "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200",
	audio: "bg-orange-500/15 hover:bg-orange-500/25 text-orange-200",
	animate: "bg-fuchsia-500/15 hover:bg-fuchsia-500/25 text-fuchsia-200",
};

/**
 * Single button primitive. `variant` controls visual style; `accent`
 * picks the workspace tint (video/audio/animate). Use `accent` only
 * with primary/secondary — ghost/danger ignore it.
 *
 * Replaces ~30 ad-hoc inline button styles across the audio + animate
 * panels.
 */
export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
	{
		variant = "secondary",
		size = "sm",
		accent = "video",
		loading = false,
		leadingIcon,
		trailingIcon,
		fullWidth = false,
		className,
		children,
		disabled,
		...rest
	},
	ref,
) {
	const base =
		"inline-flex items-center justify-center rounded-md font-semibold transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:cursor-not-allowed";

	let variantCls = "";
	switch (variant) {
		case "primary":
			variantCls = `${ACCENT_PRIMARY[accent]} shadow-sm`;
			break;
		case "secondary":
			variantCls = ACCENT_SECONDARY[accent];
			break;
		case "ghost":
			variantCls = "text-neutral-300 hover:bg-neutral-800/70 hover:text-white";
			break;
		case "danger":
			variantCls = "text-red-300 hover:bg-red-500/10";
			break;
	}

	return (
		<button
			ref={ref}
			disabled={disabled || loading}
			className={cls(
				base,
				SIZE_CLASS[size],
				variantCls,
				fullWidth && "w-full",
				className,
			)}
			{...rest}
		>
			{loading ? (
				<Loader2 className="h-3.5 w-3.5 animate-spin" />
			) : (
				leadingIcon
			)}
			{children}
			{!loading && trailingIcon}
		</button>
	);
});
