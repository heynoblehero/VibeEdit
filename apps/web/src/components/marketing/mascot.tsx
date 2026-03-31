"use client";

import { motion, useMotionValue, useScroll, animate } from "motion/react";
import { useEffect, useState, useCallback } from "react";

export function Mascot() {
	const [mouse, setMouse] = useState({ x: 0, y: 0 });
	const [mood, setMood] = useState<"idle" | "happy" | "sleep">("idle");
	const [mounted, setMounted] = useState(false);
	const { scrollYProgress } = useScroll();
	const bounceY = useMotionValue(0);

	useEffect(() => setMounted(true), []);

	const handler = useCallback((e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY }), []);
	useEffect(() => {
		window.addEventListener("mousemove", handler);
		return () => window.removeEventListener("mousemove", handler);
	}, [handler]);

	useEffect(() => {
		return scrollYProgress.on("change", (v) => {
			if (v > 0.85) setMood("sleep");
			else if (v > 0.5) setMood("happy");
			else setMood("idle");
		});
	}, [scrollYProgress]);

	// Eye tracking — only after mount to avoid hydration mismatch
	const eyeX = mounted ? Math.max(-3, Math.min(3, (mouse.x - (window.innerWidth - 40)) / 100)) : 0;
	const eyeY = mounted ? Math.max(-2.5, Math.min(2.5, (mouse.y - (window.innerHeight - 40)) / 100)) : 0;

	const bounce = () => {
		animate(bounceY, [0, -10, 0], { duration: 0.4, ease: "easeOut" });
	};

	return (
		<motion.div
			className="fixed bottom-5 right-5 z-50 cursor-pointer select-none hidden md:block"
			style={{ y: bounceY }}
			onHoverStart={bounce}
			onClick={bounce}
			initial={{ opacity: 0, scale: 0 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ delay: 2, type: "spring", stiffness: 200, damping: 15 }}
			title="Hi! I'm Vee"
		>
			<svg width="48" height="48" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
				{/* Shadow */}
				<ellipse cx="50" cy="92" rx="20" ry="4" fill="black" opacity="0.15" />

				{/* Body — round blob */}
				<motion.circle
					cx="50" cy="52" r="34"
					fill="url(#veeGrad)"
					animate={mood === "happy" ? { scale: [1, 1.04, 1] } : { scale: 1 }}
					transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
				/>

				{/* Highlight */}
				<circle cx="38" cy="36" r="12" fill="white" opacity="0.1" />

				{/* Left eye */}
				<ellipse cx="38" cy="50" rx="6" ry={mood === "sleep" ? 1 : 7} fill="white" />
				{mood !== "sleep" && (
					<>
						<circle cx={38 + eyeX} cy={50 + eyeY} r="3.5" fill="#1e1b4b" />
						<circle cx={36.5 + eyeX * 0.5} cy={48 + eyeY * 0.5} r="1.2" fill="white" />
					</>
				)}

				{/* Right eye */}
				<ellipse cx="62" cy="50" rx="6" ry={mood === "sleep" ? 1 : 7} fill="white" />
				{mood !== "sleep" && (
					<>
						<circle cx={62 + eyeX} cy={50 + eyeY} r="3.5" fill="#1e1b4b" />
						<circle cx={60.5 + eyeX * 0.5} cy={48 + eyeY * 0.5} r="1.2" fill="white" />
					</>
				)}

				{/* Mouth */}
				{mood === "happy" ? (
					<path d="M40 64 Q50 74 60 64" stroke="#1e1b4b" strokeWidth="2.5" strokeLinecap="round" fill="none" />
				) : mood === "sleep" ? (
					<path d="M43 64 Q50 67 57 64" stroke="#1e1b4b" strokeWidth="2" strokeLinecap="round" fill="none" />
				) : (
					<path d="M43 63 Q50 67 57 63" stroke="#1e1b4b" strokeWidth="2" strokeLinecap="round" fill="none" />
				)}

				{/* Blush cheeks (happy) */}
				{mood === "happy" && (
					<>
						<circle cx="28" cy="60" r="5" fill="#f472b6" opacity="0.25" />
						<circle cx="72" cy="60" r="5" fill="#f472b6" opacity="0.25" />
					</>
				)}

				{/* Zzz (sleep) */}
				{mood === "sleep" && (
					<motion.text
						x="68" y="30" fill="#a78bfa" fontSize="14" fontWeight="800" fontFamily="system-ui"
						animate={{ opacity: [0, 1, 0], y: [30, 22, 16] }}
						transition={{ duration: 2.5, repeat: Infinity }}
					>
						z
					</motion.text>
				)}

				<defs>
					<radialGradient id="veeGrad" cx="40%" cy="35%" r="60%">
						<stop offset="0%" stopColor="#a78bfa" />
						<stop offset="100%" stopColor="#7c3aed" />
					</radialGradient>
				</defs>
			</svg>
		</motion.div>
	);
}
