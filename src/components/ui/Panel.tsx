"use client";

import { type HTMLAttributes, type ReactNode } from "react";
import { type AccentName, accent as accentTokens, cls } from "@/lib/design/tokens";

interface Props extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
	title?: ReactNode;
	icon?: ReactNode;
	actions?: ReactNode;
	accent?: AccentName;
	/** "default" = subtle border, "raised" = ring + shadow. */
	variant?: "default" | "raised" | "dashed";
	/** Compact reduces padding; useful inside lists. */
	dense?: boolean;
}

/**
 * Panel — the standard container for any group of controls.
 * Replaces the ~12 different `rounded-md border border-X/30
 * bg-neutral-950/60 p-3 space-y-3` snippets I counted across
 * audio + animate components.
 *
 * Accent picks a workspace-tinted border + title color when set.
 */
export function Panel({
	title,
	icon,
	actions,
	accent: accentName,
	variant = "default",
	dense = false,
	className,
	children,
	...rest
}: Props) {
	const tone = accentName ? accentTokens[accentName] : null;

	const variantCls =
		variant === "dashed"
			? "border border-dashed border-neutral-800 bg-transparent"
			: variant === "raised"
				? `${tone?.border ?? "border-neutral-800"} border bg-neutral-925 shadow-md shadow-black/30`
				: `${tone?.border ?? "border-neutral-800"} border bg-neutral-950/60`;

	return (
		<div
			className={cls(
				"rounded-md",
				variantCls,
				dense ? "p-2 space-y-2" : "p-3 space-y-3",
				className,
			)}
			{...rest}
		>
			{(title || actions) && (
				<div className="flex items-center justify-between gap-2">
					<div className="flex items-center gap-1.5 min-w-0">
						{icon ? (
							<span className={cls("shrink-0", tone?.text)}>{icon}</span>
						) : null}
						{title ? (
							<span
								className={cls(
									"text-[11px] uppercase tracking-wider font-semibold truncate",
									tone?.text ?? "text-neutral-300",
								)}
							>
								{title}
							</span>
						) : null}
					</div>
					{actions ? <div className="flex items-center gap-1 shrink-0">{actions}</div> : null}
				</div>
			)}
			{children}
		</div>
	);
}
