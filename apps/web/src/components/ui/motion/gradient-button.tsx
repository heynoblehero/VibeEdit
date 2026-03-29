"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/utils/ui";
import Link from "next/link";

interface GradientButtonProps {
	children: ReactNode;
	href?: string;
	size?: "default" | "lg" | "sm";
	variant?: "gradient" | "outline" | "ghost";
	className?: string;
	onClick?: () => void;
	disabled?: boolean;
	type?: "button" | "submit" | "reset";
}

const sizes = {
	sm: "px-4 py-2 text-sm",
	default: "px-6 py-3 text-sm",
	lg: "px-8 py-4 text-base",
};

export function GradientButton({ children, className, href, size = "default", variant = "gradient", onClick, disabled, type }: GradientButtonProps) {
	const baseClasses = cn(
		"relative inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all duration-200",
		sizes[size],
		variant === "gradient" && "gradient-primary text-white hover:shadow-[0_0_30px_hsl(262_83%_58%/0.4)] hover:brightness-110",
		variant === "outline" && "border border-border bg-background text-foreground hover:bg-accent hover:border-primary/30",
		variant === "ghost" && "text-muted-foreground hover:text-foreground hover:bg-accent",
		className,
	);

	if (href) {
		return (
			<motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
				<Link href={href} className={baseClasses}>
					{children}
				</Link>
			</motion.div>
		);
	}

	return (
		<motion.button
			whileHover={{ scale: 1.02 }}
			whileTap={{ scale: 0.98 }}
			className={baseClasses}
			onClick={onClick}
			disabled={disabled}
			type={type}
		>
			{children}
		</motion.button>
	);
}
