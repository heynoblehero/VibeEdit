"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

interface StaggerChildrenProps {
	children: ReactNode;
	className?: string;
	staggerDelay?: number;
}

const container = {
	hidden: {},
	visible: (staggerDelay: number) => ({
		transition: { staggerChildren: staggerDelay },
	}),
};

const item = {
	hidden: { opacity: 0.01, y: 16 },
	visible: {
		opacity: 1,
		y: 0,
		transition: { duration: 0.35, ease: [0.25, 0.4, 0.25, 1] as [number, number, number, number] },
	},
};

export function StaggerChildren({ children, className, staggerDelay = 0.06 }: StaggerChildrenProps) {
	return (
		<motion.div
			variants={container}
			initial="hidden"
			whileInView="visible"
			viewport={{ once: true, margin: "-30px" }}
			custom={staggerDelay}
			className={className}
		>
			{children}
		</motion.div>
	);
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<motion.div variants={item} className={className}>
			{children}
		</motion.div>
	);
}
