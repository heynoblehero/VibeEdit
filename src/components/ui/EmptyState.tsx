"use client";

import type { ReactNode } from "react";
import { type AccentName, accent as accentTokens, cls } from "@/lib/design/tokens";

interface Props {
	icon: ReactNode;
	title: string;
	description?: ReactNode;
	primaryAction?: ReactNode;
	secondaryAction?: ReactNode;
	accent?: AccentName;
	className?: string;
}

/**
 * Empty state with a clear next action. Replaces the
 * "icon + sentence + nothing to click" pattern that's repeated
 * across audio, animate, and dashboard surfaces.
 */
export function EmptyState({
	icon,
	title,
	description,
	primaryAction,
	secondaryAction,
	accent: accentName,
	className,
}: Props) {
	const tone = accentName ? accentTokens[accentName] : null;
	return (
		<div
			className={cls(
				"flex flex-col items-center justify-center text-center gap-3 px-6 py-10",
				className,
			)}
		>
			<div
				className={cls(
					"h-12 w-12 rounded-full flex items-center justify-center",
					tone ? tone.bgSoft : "bg-neutral-800/40",
					tone?.text ?? "text-neutral-400",
				)}
			>
				{icon}
			</div>
			<div className="text-[14px] font-semibold text-neutral-100 max-w-md">
				{title}
			</div>
			{description ? (
				<div className="text-[12px] text-neutral-400 max-w-md leading-relaxed">
					{description}
				</div>
			) : null}
			{(primaryAction || secondaryAction) && (
				<div className="flex items-center gap-2 mt-1">
					{primaryAction}
					{secondaryAction}
				</div>
			)}
		</div>
	);
}
