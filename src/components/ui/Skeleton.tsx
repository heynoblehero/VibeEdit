"use client";

import { cls } from "@/lib/design/tokens";

/**
 * Loading skeleton — pulses subtly. Use during fetch/decode for any
 * surface that would otherwise pop in. Default bg is `surface-2`,
 * which contrasts gently with surface-0 panels.
 */
export function Skeleton({
	className,
	rounded = "md",
}: {
	className?: string;
	rounded?: "sm" | "md" | "lg" | "full";
}) {
	const r =
		rounded === "full"
			? "rounded-full"
			: rounded === "lg"
				? "rounded-lg"
				: rounded === "sm"
					? "rounded"
					: "rounded-md";
	return (
		<div
			className={cls(
				"animate-pulse bg-neutral-800/60",
				r,
				className,
			)}
		/>
	);
}

export function SkeletonText({
	lines = 1,
	className,
}: {
	lines?: number;
	className?: string;
}) {
	return (
		<div className={cls("space-y-1.5", className)}>
			{Array.from({ length: lines }).map((_, i) => (
				<Skeleton
					key={i}
					rounded="sm"
					className={cls("h-3", i === lines - 1 ? "w-2/3" : "w-full")}
				/>
			))}
		</div>
	);
}
