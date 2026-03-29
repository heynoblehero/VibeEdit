"use client";

import { cn } from "@/utils/ui";
import type { ReactNode } from "react";

interface NeonBadgeProps {
	children: ReactNode;
	className?: string;
	variant?: "purple" | "lime" | "pink" | "cyan";
}

const variants = {
	purple: "bg-primary/10 text-primary border-primary/30 shadow-[0_0_10px_hsl(262_83%_58%/0.2)]",
	lime: "bg-accent-lime/10 text-accent-lime border-accent-lime/30 shadow-[0_0_10px_hsl(82_85%_60%/0.2)]",
	pink: "bg-accent-pink/10 text-accent-pink border-accent-pink/30 shadow-[0_0_10px_hsl(330_85%_65%/0.2)]",
	cyan: "bg-accent-cyan/10 text-accent-cyan border-accent-cyan/30 shadow-[0_0_10px_hsl(190_90%_55%/0.2)]",
};

export function NeonBadge({ children, className, variant = "purple" }: NeonBadgeProps) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
				variants[variant],
				className,
			)}
		>
			{children}
		</span>
	);
}
