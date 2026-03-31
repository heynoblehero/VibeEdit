"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";

interface FloatingEmojiProps {
	emoji: string;
	delay?: number;
	x?: number; // offset from left/right edge
	side?: "left" | "right";
}

function FloatingEmoji({ emoji, delay = 0, x = 0, side = "right" }: FloatingEmojiProps) {
	return (
		<motion.span
			className={`absolute top-0 ${side === "right" ? "right-0" : "left-0"} text-xl pointer-events-none select-none`}
			style={{ [side]: x }}
			initial={{ opacity: 0, y: 20, rotate: -10 }}
			animate={{ opacity: [0, 1, 1, 0], y: [20, 0, -20, -40], rotate: [-10, 5, -5, 10] }}
			transition={{ duration: 2, delay, ease: "easeOut" }}
		>
			{emoji}
		</motion.span>
	);
}

export function EmojiReaction({
	emojis,
	className,
}: {
	emojis: { emoji: string; delay?: number; x?: number; side?: "left" | "right" }[];
	className?: string;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const inView = useInView(ref, { once: true, margin: "-100px" });

	return (
		<div ref={ref} className={`relative ${className ?? ""}`}>
			{inView &&
				emojis.map((e, i) => (
					<FloatingEmoji key={`${e.emoji}-${i}`} {...e} />
				))}
		</div>
	);
}
