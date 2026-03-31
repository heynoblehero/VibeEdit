"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";

const draw = { hidden: { pathLength: 0, opacity: 0 }, visible: { pathLength: 1, opacity: 1 } };

function useDoodleInView() {
	const ref = useRef<SVGSVGElement>(null);
	const inView = useInView(ref, { once: true, margin: "-80px" });
	return { ref, inView };
}

/** Three small stars that draw themselves */
export function DoodleStars({ className }: { className?: string }) {
	const { ref, inView } = useDoodleInView();
	return (
		<svg ref={ref} viewBox="0 0 80 40" fill="none" className={`pointer-events-none ${className ?? ""}`} xmlns="http://www.w3.org/2000/svg">
			{/* Star 1 */}
			<motion.path
				d="M12 8l2 5 5 1-4 3 1 5-4-3-5 2 2-5-3-4 5 0z"
				stroke="#a78bfa" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
				variants={draw} initial="hidden" animate={inView ? "visible" : "hidden"}
				transition={{ duration: 0.6, delay: 0 }}
			/>
			{/* Star 2 — bigger */}
			<motion.path
				d="M40 4l3 7 7 1-5 5 1 7-6-4-7 3 2-7-5-5 7-1z"
				stroke="#d946ef" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
				variants={draw} initial="hidden" animate={inView ? "visible" : "hidden"}
				transition={{ duration: 0.6, delay: 0.2 }}
			/>
			{/* Star 3 */}
			<motion.path
				d="M66 12l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 5 0z"
				stroke="#f472b6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"
				variants={draw} initial="hidden" animate={inView ? "visible" : "hidden"}
				transition={{ duration: 0.6, delay: 0.4 }}
			/>
		</svg>
	);
}

/** Arrow pointing down-right */
export function DoodleArrow({ className }: { className?: string }) {
	const { ref, inView } = useDoodleInView();
	return (
		<svg ref={ref} viewBox="0 0 60 50" fill="none" className={`pointer-events-none ${className ?? ""}`} xmlns="http://www.w3.org/2000/svg">
			<motion.path
				d="M8 8c8 10 18 22 30 30"
				stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" fill="none"
				variants={draw} initial="hidden" animate={inView ? "visible" : "hidden"}
				transition={{ duration: 0.7 }}
			/>
			<motion.path
				d="M30 38l10 2-3-10"
				stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"
				variants={draw} initial="hidden" animate={inView ? "visible" : "hidden"}
				transition={{ duration: 0.3, delay: 0.6 }}
			/>
		</svg>
	);
}

/** Wavy underline */
export function DoodleWavy({ className }: { className?: string }) {
	const { ref, inView } = useDoodleInView();
	return (
		<svg ref={ref} viewBox="0 0 200 12" fill="none" className={`pointer-events-none ${className ?? ""}`} xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
			<motion.path
				d="M2 6c16-6 32 6 48 0s32-6 48 0 32 6 48 0 32-6 50 0"
				stroke="#f472b6" strokeWidth="2.5" strokeLinecap="round" fill="none"
				variants={draw} initial="hidden" animate={inView ? "visible" : "hidden"}
				transition={{ duration: 0.8 }}
			/>
		</svg>
	);
}

/** Exclamation marks (!! or !!!) */
export function DoodleBang({ className }: { className?: string }) {
	const { ref, inView } = useDoodleInView();
	return (
		<svg ref={ref} viewBox="0 0 30 40" fill="none" className={`pointer-events-none ${className ?? ""}`} xmlns="http://www.w3.org/2000/svg">
			<motion.path d="M8 4l1 20" stroke="#d946ef" strokeWidth="2.5" strokeLinecap="round" fill="none"
				variants={draw} initial="hidden" animate={inView ? "visible" : "hidden"} transition={{ duration: 0.3 }} />
			<motion.circle cx="9" cy="32" r="2" fill="#d946ef"
				initial={{ scale: 0 }} animate={inView ? { scale: 1 } : { scale: 0 }} transition={{ delay: 0.3 }} />
			<motion.path d="M20 6l1 18" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" fill="none"
				variants={draw} initial="hidden" animate={inView ? "visible" : "hidden"} transition={{ duration: 0.3, delay: 0.15 }} />
			<motion.circle cx="21" cy="32" r="2" fill="#a78bfa"
				initial={{ scale: 0 }} animate={inView ? { scale: 1 } : { scale: 0 }} transition={{ delay: 0.45 }} />
		</svg>
	);
}

/** Squiggle/sparkle accent */
export function DoodleSparkle({ className }: { className?: string }) {
	const { ref, inView } = useDoodleInView();
	return (
		<svg ref={ref} viewBox="0 0 24 24" fill="none" className={`pointer-events-none ${className ?? ""}`} xmlns="http://www.w3.org/2000/svg">
			<motion.path
				d="M12 2v8M12 14v8M2 12h8M14 12h8M4 4l5 5M15 15l5 5M4 20l5-5M15 9l5-5"
				stroke="#f472b6" strokeWidth="1.5" strokeLinecap="round" fill="none"
				variants={draw} initial="hidden" animate={inView ? "visible" : "hidden"}
				transition={{ duration: 0.8 }}
			/>
		</svg>
	);
}
