"use client";

import { motion, useMotionValue, useTransform, useScroll, animate } from "motion/react";
import { useEffect, useState, useCallback } from "react";

export function Mascot() {
	const [mouse, setMouse] = useState({ x: 0, y: 0 });
	const [mood, setMood] = useState<"idle" | "happy" | "sleep">("idle");
	const { scrollYProgress } = useScroll();
	const bounceY = useMotionValue(0);

	const handler = useCallback((e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY }), []);
	useEffect(() => {
		window.addEventListener("mousemove", handler);
		return () => window.removeEventListener("mousemove", handler);
	}, [handler]);

	// Mood based on scroll position
	useEffect(() => {
		return scrollYProgress.on("change", (v) => {
			if (v > 0.85) setMood("sleep");
			else if (v > 0.5) setMood("happy");
			else setMood("idle");
		});
	}, [scrollYProgress]);

	// Eye tracking — compute pupil offset relative to mascot position (bottom-right)
	const eyeX = Math.max(-4, Math.min(4, (mouse.x - (typeof window !== "undefined" ? window.innerWidth - 52 : 0)) / 80));
	const eyeY = Math.max(-3, Math.min(3, (mouse.y - (typeof window !== "undefined" ? window.innerHeight - 52 : 0)) / 80));

	const bounce = () => {
		animate(bounceY, [0, -8, 0], { duration: 0.4, ease: "easeOut" });
	};

	return (
		<motion.div
			className="fixed bottom-6 right-6 z-50 cursor-pointer select-none hidden md:block"
			style={{ y: bounceY }}
			onHoverStart={bounce}
			onClick={bounce}
			initial={{ opacity: 0, scale: 0, y: 20 }}
			animate={{ opacity: 1, scale: 1, y: 0 }}
			transition={{ delay: 2, type: "spring", stiffness: 260, damping: 20 }}
			title="Hi! I'm Vee 👋"
		>
			<svg width="56" height="56" viewBox="0 0 56 56" fill="none" xmlns="http://www.w3.org/2000/svg">
				{/* Body — gradient blob */}
				<motion.ellipse
					cx="28" cy="30" rx="22" ry="20"
					fill="url(#mascotGrad)"
					animate={{
						ry: mood === "happy" ? [20, 18, 20] : mood === "sleep" ? 21 : 20,
						rx: mood === "happy" ? [22, 24, 22] : 22,
					}}
					transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
				/>

				{/* Shine */}
				<ellipse cx="20" cy="22" rx="8" ry="5" fill="white" opacity="0.12" />

				{/* Left eye */}
				<ellipse cx="21" cy="28" rx="4.5" ry={mood === "sleep" ? 0.8 : 5} fill="white" />
				{mood !== "sleep" && (
					<circle cx={21 + eyeX} cy={28 + eyeY} r="2.2" fill="#1a1a2e" />
				)}

				{/* Right eye */}
				<ellipse cx="35" cy="28" rx="4.5" ry={mood === "sleep" ? 0.8 : 5} fill="white" />
				{mood !== "sleep" && (
					<circle cx={35 + eyeX} cy={28 + eyeY} r="2.2" fill="#1a1a2e" />
				)}

				{/* Mouth */}
				{mood === "happy" ? (
					<path d="M23 36 Q28 41 33 36" stroke="#1a1a2e" strokeWidth="1.8" strokeLinecap="round" fill="none" />
				) : mood === "sleep" ? (
					<>
						<path d="M24 36 Q28 38 32 36" stroke="#1a1a2e" strokeWidth="1.5" strokeLinecap="round" fill="none" />
						{/* Zzz */}
						<motion.text
							x="40" y="16" fill="#a78bfa" fontSize="10" fontWeight="bold" fontFamily="sans-serif"
							animate={{ opacity: [0, 1, 0], y: [16, 10, 6] }}
							transition={{ duration: 2, repeat: Infinity }}
						>
							z
						</motion.text>
					</>
				) : (
					<path d="M25 36 Q28 38 31 36" stroke="#1a1a2e" strokeWidth="1.5" strokeLinecap="round" fill="none" />
				)}

				{/* Blush */}
				{mood === "happy" && (
					<>
						<circle cx="15" cy="33" r="3" fill="#f472b6" opacity="0.3" />
						<circle cx="41" cy="33" r="3" fill="#f472b6" opacity="0.3" />
					</>
				)}

				<defs>
					<linearGradient id="mascotGrad" x1="6" y1="10" x2="50" y2="50">
						<stop offset="0%" stopColor="#8b5cf6" />
						<stop offset="100%" stopColor="#d946ef" />
					</linearGradient>
				</defs>
			</svg>
		</motion.div>
	);
}
