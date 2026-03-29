"use client";

import { motion } from "motion/react";

interface FloatingOrbsProps {
	className?: string;
}

const orbs = [
	{ size: 300, x: "20%", y: "15%", color: "hsl(262 83% 58% / 0.12)", duration: 20 },
	{ size: 250, x: "70%", y: "60%", color: "hsl(330 85% 65% / 0.08)", duration: 25 },
	{ size: 200, x: "80%", y: "20%", color: "hsl(190 90% 55% / 0.06)", duration: 22 },
	{ size: 180, x: "10%", y: "70%", color: "hsl(270 90% 70% / 0.07)", duration: 18 },
];

export function FloatingOrbs({ className }: FloatingOrbsProps) {
	return (
		<div className={`pointer-events-none absolute inset-0 overflow-hidden ${className ?? ""}`}>
			{orbs.map((orb, i) => (
				<motion.div
					key={i}
					className="absolute rounded-full blur-3xl"
					style={{
						width: orb.size,
						height: orb.size,
						left: orb.x,
						top: orb.y,
						background: orb.color,
					}}
					animate={{
						x: [0, 30, -20, 10, 0],
						y: [0, -20, 15, -10, 0],
					}}
					transition={{
						duration: orb.duration,
						repeat: Infinity,
						ease: "easeInOut",
					}}
				/>
			))}
		</div>
	);
}
