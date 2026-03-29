"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/utils/ui";

interface GlassCardProps {
	children: ReactNode;
	className?: string;
	hover?: boolean;
	glow?: boolean;
}

export function GlassCard({ children, className, hover = true, glow = false }: GlassCardProps) {
	return (
		<motion.div
			className={cn(
				"rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl",
				glow && "shadow-[0_0_20px_hsl(262_83%_58%/0.1)]",
				className,
			)}
			{...(hover ? {
				whileHover: {
					y: -4,
					boxShadow: "0 12px 40px rgba(0,0,0,0.12), 0 0 20px hsl(262 83% 58% / 0.08)",
				},
				transition: { duration: 0.25, ease: "easeOut" },
			} : {})}
		>
			{children}
		</motion.div>
	);
}
