"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

interface AnimatedSectionProps {
	children: ReactNode;
	className?: string;
	delay?: number;
}

export function AnimatedSection({ children, className, delay = 0 }: AnimatedSectionProps) {
	return (
		<motion.div
			initial={{ opacity: 0.01, y: 20 }}
			whileInView={{ opacity: 1, y: 0 }}
			viewport={{ once: true, margin: "-40px" }}
			transition={{ duration: 0.4, delay, ease: "easeOut" }}
			className={className}
			style={{ willChange: "opacity, transform" }}
		>
			{children}
		</motion.div>
	);
}
