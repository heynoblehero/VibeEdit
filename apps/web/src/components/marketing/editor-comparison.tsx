"use client";

import { motion } from "motion/react";
import { PremiereCrashScene } from "./premiere-crash-scene";
import { VibeEditSuccessScene } from "./vibeedit-success-scene";

export function EditorComparison() {
	return (
		<div className="mx-auto max-w-5xl px-6">
			<div className="relative grid grid-cols-1 sm:grid-cols-2 gap-0 overflow-hidden rounded-2xl border border-white/[0.08]">
				{/* ── LEFT: Premiere Pro crashing ── */}
				<div className="relative bg-gradient-to-b from-red-950/60 to-[#0a0608] p-4 sm:p-6 border-b sm:border-b-0 sm:border-r border-white/[0.06]">
					<PremiereCrashScene />
					<div className="text-center mt-4">
						<p className="text-red-400 font-black font-[family-name:var(--font-display)] text-2xl sm:text-3xl">20+ hrs</p>
						<p className="text-white/50 text-sm sm:text-base mt-1 font-medium">&ldquo;You editing in Premiere&rdquo;</p>
					</div>
				</div>

				{/* ── RIGHT: VibeEdit success ── */}
				<div className="relative bg-gradient-to-b from-cyan-950/40 via-violet-950/30 to-[#0a0610] p-4 sm:p-6">
					<VibeEditSuccessScene />
					<div className="text-center mt-4">
						<p className="text-emerald-400 font-black font-[family-name:var(--font-display)] text-2xl sm:text-3xl">10 mins</p>
						<p className="text-white/50 text-sm sm:text-base mt-1 font-medium">&ldquo;You with VibeEdit&rdquo;</p>
					</div>
				</div>

				{/* ── VS Badge ── */}
				<div className="absolute inset-0 flex items-center justify-center pointer-events-none">
					{/* Ripple rings */}
					<motion.div
						className="absolute w-14 h-14 sm:w-18 sm:h-18 rounded-full border border-violet-400/25"
						animate={{ scale: [1, 2.2], opacity: [0.35, 0] }}
						transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
					/>
					<motion.div
						className="absolute w-14 h-14 sm:w-18 sm:h-18 rounded-full border border-violet-400/15"
						animate={{ scale: [1, 2], opacity: [0.25, 0] }}
						transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.8 }}
					/>
					{/* Badge */}
					<motion.div
						className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-[#08080c] border-2 border-white/20 flex items-center justify-center"
						animate={{
							scale: [1, 1.12, 1],
							boxShadow: [
								"0 0 0px rgba(167,139,250,0)",
								"0 0 25px rgba(167,139,250,0.5), 0 0 50px rgba(167,139,250,0.2)",
								"0 0 0px rgba(167,139,250,0)",
							],
						}}
						transition={{ duration: 2.5, repeat: Infinity, ease: [0.25, 0.4, 0.25, 1] }}
					>
						<span className="text-white/70 font-black text-sm sm:text-base font-[family-name:var(--font-display)]">VS</span>
					</motion.div>
				</div>
			</div>
		</div>
	);
}
