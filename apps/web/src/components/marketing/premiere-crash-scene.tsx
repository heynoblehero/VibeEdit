"use client";

import { motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";

function CharFlip({ backSrc, frontSrc, frontOverlay }: { backSrc: string; frontSrc: string; frontOverlay?: ReactNode }) {
	const [hovered, setHovered] = useState(false);
	return (
		<div
			className="relative mx-auto w-[140px] -mt-4 cursor-pointer grid"
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			{/* Back image */}
			<img
				src={backSrc}
				alt=""
				className={`col-start-1 row-start-1 w-full h-auto drop-shadow-[0_5px_15px_rgba(0,0,0,0.5)] transition-opacity duration-500 ${hovered ? "opacity-0" : "opacity-100"}`}
			/>
			{/* Front image + overlay (same grid cell) */}
			<div className={`col-start-1 row-start-1 relative transition-opacity duration-500 ${hovered ? "opacity-100" : "opacity-0"}`}>
				<img
					src={frontSrc}
					alt=""
					className="w-full h-auto drop-shadow-[0_5px_15px_rgba(0,0,0,0.5)]"
				/>
				{hovered && frontOverlay}
			</div>
		</div>
	);
}

export function PremiereCrashScene() {
	const [glitch, setGlitch] = useState(false);
	const [crashVisible, setCrashVisible] = useState(false);

	useEffect(() => {
		// Glitch every few seconds
		const glitchInterval = setInterval(() => {
			setGlitch(true);
			setTimeout(() => setGlitch(false), 180);
		}, 3000);

		// Show crash dialog after a delay
		const crashTimer = setTimeout(() => setCrashVisible(true), 1500);

		return () => {
			clearInterval(glitchInterval);
			clearTimeout(crashTimer);
		};
	}, []);

	return (
		<div className="relative w-full select-none">
			{/* ── LAPTOP FRAME ── */}
			<div className="relative mx-auto w-full max-w-[340px]">
				{/* Screen bezel */}
				<div className="bg-[#1a1a1a] rounded-t-xl pt-2 px-2 pb-1.5 border border-white/[0.06] border-b-0 shadow-2xl shadow-red-950/30">
					{/* Webcam dot */}
					<div className="flex justify-center mb-1.5">
						<div className="w-1.5 h-1.5 rounded-full bg-[#2a2a2a] ring-1 ring-white/[0.04]" />
					</div>
					{/* Screen content */}
					<div className="relative rounded-sm overflow-hidden border border-white/[0.04]">
				{/* Title bar */}
				<div className="flex items-center justify-between bg-[#1e1e2e] px-2 py-1 border-b border-white/5">
					<div className="flex items-center gap-1.5">
						<div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
						<div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
						<div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
					</div>
					<span className="text-[9px] text-white/40 font-medium tracking-wide">Adobe Premiere Pro</span>
					<div className="w-12" />
				</div>

				{/* Menu bar */}
				<div className="flex items-center gap-3 bg-[#232336] px-2 py-0.5 border-b border-white/5">
					{["File", "Edit", "Clip", "Sequence", "Window", "Help"].map((m) => (
						<span key={m} className="text-[7px] text-white/35">{m}</span>
					))}
				</div>

				{/* Main workspace */}
				<motion.div
					className="relative bg-[#1a1a2e]"
					animate={glitch ? { x: [0, -3, 4, -1, 0], opacity: [1, 0.6, 0.9, 0.7, 1] } : {}}
					transition={{ duration: 0.18 }}
				>
					{/* Source & Program monitors */}
					<div className="flex gap-px p-1">
						{/* Source monitor */}
						<div className="flex-1 bg-[#111120] rounded-sm overflow-hidden">
							<div className="flex items-center justify-between px-1.5 py-0.5 bg-[#1a1a30]">
								<span className="text-[6px] text-white/30">Source</span>
								<span className="text-[6px] text-white/20">00:02:14:08</span>
							</div>
							<div className="h-[55px] bg-[#0a0a15] flex items-center justify-center">
								<div className="w-[70%] h-[38px] bg-[#151525] rounded-sm" />
							</div>
							{/* Playback controls */}
							<div className="flex items-center justify-center gap-1 py-0.5 bg-[#151528]">
								{["◁", "◀", "▶", "▷", "○"].map((c, i) => (
									<span key={i} className="text-[6px] text-white/20">{c}</span>
								))}
							</div>
						</div>

						{/* Program monitor */}
						<div className="flex-1 bg-[#111120] rounded-sm overflow-hidden">
							<div className="flex items-center justify-between px-1.5 py-0.5 bg-[#1a1a30]">
								<span className="text-[6px] text-white/30">Program</span>
								<span className="text-[6px] text-red-400/60">OFFLINE</span>
							</div>
							<div className="h-[55px] bg-[#0a0a15] flex items-center justify-center relative">
								<div className="w-[70%] h-[38px] bg-[#151525] rounded-sm" />
								{/* Frozen frame indicator */}
								<motion.div
									className="absolute inset-0 bg-red-500/5"
									animate={{ opacity: [0, 0.15, 0] }}
									transition={{ duration: 1.5, repeat: Infinity }}
								/>
							</div>
							<div className="flex items-center justify-center gap-1 py-0.5 bg-[#151528]">
								{["◁", "◀", "■", "▷", "○"].map((c, i) => (
									<span key={i} className="text-[6px] text-white/20">{c}</span>
								))}
							</div>
						</div>
					</div>

					{/* ── TIMELINE PANEL ── */}
					<div className="bg-[#1a1a2e] border-t border-white/5 px-1 pb-1">
						{/* Timeline header */}
						<div className="flex items-center justify-between py-0.5">
							<div className="flex items-center gap-2">
								<span className="text-[6px] text-white/30">Timeline</span>
								<span className="text-[6px] text-white/20">Sequence 01</span>
							</div>
							<span className="text-[6px] text-white/15">00:00 ──────────── 05:00</span>
						</div>

						{/* Track labels + clips */}
						<div className="space-y-px">
							{/* V3 - titles */}
							<div className="flex items-center gap-0.5">
								<span className="text-[5px] text-white/20 w-4 shrink-0">V3</span>
								<div className="flex-1 h-[6px] bg-[#111120] rounded-[1px] relative overflow-hidden">
									<div className="absolute left-[20%] w-[15%] h-full bg-[#c050d0]/60 rounded-[1px]" />
									<div className="absolute left-[55%] w-[25%] h-full bg-[#c050d0]/40 rounded-[1px]" />
								</div>
							</div>
							{/* V2 - b-roll */}
							<div className="flex items-center gap-0.5">
								<span className="text-[5px] text-white/20 w-4 shrink-0">V2</span>
								<div className="flex-1 h-[6px] bg-[#111120] rounded-[1px] relative overflow-hidden">
									<div className="absolute left-[5%] w-[30%] h-full bg-[#3060d0]/60 rounded-[1px]" />
									<div className="absolute left-[40%] w-[20%] h-full bg-[#3060d0]/40 rounded-[1px]" />
									<div className="absolute left-[65%] w-[30%] h-full bg-[#3060d0]/50 rounded-[1px]" />
								</div>
							</div>
							{/* V1 - main footage */}
							<div className="flex items-center gap-0.5">
								<span className="text-[5px] text-white/20 w-4 shrink-0">V1</span>
								<div className="flex-1 h-[6px] bg-[#111120] rounded-[1px] relative overflow-hidden">
									<div className="absolute left-0 w-[45%] h-full bg-[#30c850]/50 rounded-[1px]" />
									<div className="absolute left-[48%] w-[35%] h-full bg-[#30c850]/40 rounded-[1px]" />
									<div className="absolute left-[86%] w-[12%] h-full bg-[#30c850]/50 rounded-[1px]" />
								</div>
							</div>
							{/* A1 - audio */}
							<div className="flex items-center gap-0.5">
								<span className="text-[5px] text-white/20 w-4 shrink-0">A1</span>
								<div className="flex-1 h-[6px] bg-[#111120] rounded-[1px] relative overflow-hidden">
									<div className="absolute left-0 w-[90%] h-full bg-[#30a0a0]/30 rounded-[1px]">
										{/* Audio waveform suggestion */}
										<div className="absolute inset-0 flex items-center gap-px px-0.5">
											{Array.from({ length: 30 }).map((_, i) => (
												<div key={i} className="flex-1 bg-[#30a0a0]/50 rounded-full" style={{ height: `${20 + ((i * 37 + 13) % 80)}%` }} />
											))}
										</div>
									</div>
								</div>
							</div>
							{/* A2 - music */}
							<div className="flex items-center gap-0.5">
								<span className="text-[5px] text-white/20 w-4 shrink-0">A2</span>
								<div className="flex-1 h-[6px] bg-[#111120] rounded-[1px] relative overflow-hidden">
									<div className="absolute left-[10%] w-[80%] h-full bg-[#e88030]/25 rounded-[1px]" />
								</div>
							</div>

							{/* Playhead */}
							<div className="relative h-0">
								<motion.div
									className="absolute left-[47%] -top-[38px] w-[1px] h-[38px] bg-red-500/80"
									animate={{ opacity: [0.5, 1, 0.5] }}
									transition={{ duration: 1, repeat: Infinity }}
								/>
							</div>
						</div>

						{/* Status bar */}
						<div className="flex items-center justify-between mt-1 pt-0.5 border-t border-white/5">
							<div className="flex items-center gap-1">
								<motion.div
									className="w-1.5 h-1.5 rounded-full bg-red-500"
									animate={{ opacity: [1, 0.3, 1] }}
									transition={{ duration: 0.8, repeat: Infinity }}
								/>
								<span className="text-[6px] text-red-400/80">Render Failed — Media Offline</span>
							</div>
							<span className="text-[6px] text-white/20">47% | ETA: ∞</span>
						</div>
					</div>

					{/* ── CRASH/ERROR DIALOG OVERLAY ── */}
					{crashVisible && (
						<motion.div
							className="absolute inset-0 bg-black/40 backdrop-blur-[1px] flex items-center justify-center z-10"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							transition={{ duration: 0.3 }}
						>
							<motion.div
								className="bg-[#2a2a3e] border border-white/10 rounded-md shadow-xl w-[75%] max-w-[220px]"
								initial={{ scale: 0.9, y: 10 }}
								animate={{ scale: 1, y: 0 }}
								transition={{ type: "spring", stiffness: 300, damping: 20 }}
							>
								{/* Dialog title bar */}
								<div className="flex items-center justify-between px-2 py-1 border-b border-white/5">
									<div className="flex items-center gap-1">
										<motion.div
											className="text-red-400 text-[8px]"
											animate={{ scale: [1, 1.2, 1] }}
											transition={{ duration: 1, repeat: Infinity }}
										>
											⚠
										</motion.div>
										<span className="text-[8px] text-white/70 font-medium">Error</span>
									</div>
									<span className="text-[8px] text-white/30 cursor-pointer">✕</span>
								</div>
								{/* Dialog content */}
								<div className="px-3 py-2.5">
									<p className="text-[8px] text-red-400/90 font-medium mb-1">Render Failed</p>
									<p className="text-[6.5px] text-white/40 leading-relaxed">
										Adobe Premiere Pro has encountered an error and needs to close. Your unsaved work may be lost.
									</p>
									<p className="text-[6px] text-white/25 mt-1.5 font-mono">
										Error code: 0xDEAD_BEEF
									</p>
									{/* Frozen progress bar */}
									<div className="mt-2 h-1.5 bg-[#111120] rounded-full overflow-hidden">
										<motion.div
											className="h-full bg-gradient-to-r from-red-500/60 to-red-400/40 rounded-full"
											style={{ width: "47%" }}
											animate={{ opacity: [0.6, 1, 0.6] }}
											transition={{ duration: 1.5, repeat: Infinity }}
										/>
									</div>
									<p className="text-[5.5px] text-white/20 mt-0.5">Encoding: 47% — Stuck for 2h 14m</p>
								</div>
								{/* Dialog buttons */}
								<div className="flex items-center justify-end gap-1.5 px-3 py-1.5 border-t border-white/5">
									<button className="px-2 py-0.5 text-[7px] bg-[#333350] text-white/50 rounded border border-white/5">Report</button>
									<button className="px-2 py-0.5 text-[7px] bg-red-500/20 text-red-400 rounded border border-red-500/20">Quit</button>
								</div>
							</motion.div>
						</motion.div>
					)}

					{/* Glitch scan lines overlay */}
					<motion.div
						className="absolute inset-0 pointer-events-none z-20"
						animate={glitch ? { opacity: [0, 1, 0] } : { opacity: 0 }}
						transition={{ duration: 0.15 }}
					>
						<div className="absolute inset-0 bg-gradient-to-b from-transparent via-red-500/10 to-transparent" style={{ backgroundSize: "100% 4px" }} />
						<div className="absolute top-1/3 left-0 right-0 h-[2px] bg-red-500/30" />
						<div className="absolute top-2/3 left-0 right-0 h-[1px] bg-cyan-500/20" />
					</motion.div>
				</motion.div>
					</div>
				</div>
				{/* Laptop keyboard deck */}
				<div className="relative bg-[#1e1e1e] border-x border-white/[0.04] px-3 pt-2 pb-3" style={{ perspective: "600px" }}>
					<div style={{ transform: "rotateX(12deg)", transformOrigin: "top center" }}>
						{/* Keyboard rows */}
						<div className="flex flex-col gap-[3px]">
							{/* Function row */}
							<div className="flex gap-[2px]">
								{Array.from({ length: 14 }).map((_, i) => (
									<div key={`fn-${i}`} className="flex-1 h-[5px] rounded-[1px] bg-[#2a2a2a]" />
								))}
							</div>
							{/* Number row */}
							<div className="flex gap-[2px]">
								{Array.from({ length: 13 }).map((_, i) => (
									<div key={`num-${i}`} className="flex-1 h-[7px] rounded-[1px] bg-[#2a2a2a]" />
								))}
								<div className="flex-[1.8] h-[7px] rounded-[1px] bg-[#2a2a2a]" />
							</div>
							{/* QWERTY row */}
							<div className="flex gap-[2px]">
								<div className="flex-[1.4] h-[7px] rounded-[1px] bg-[#2a2a2a]" />
								{Array.from({ length: 12 }).map((_, i) => (
									<div key={`q-${i}`} className="flex-1 h-[7px] rounded-[1px] bg-[#2a2a2a]" />
								))}
								<div className="flex-[1.2] h-[7px] rounded-[1px] bg-[#2a2a2a]" />
							</div>
							{/* Home row */}
							<div className="flex gap-[2px]">
								<div className="flex-[1.6] h-[7px] rounded-[1px] bg-[#2a2a2a]" />
								{Array.from({ length: 11 }).map((_, i) => (
									<div key={`h-${i}`} className="flex-1 h-[7px] rounded-[1px] bg-[#2a2a2a]" />
								))}
								<div className="flex-[2] h-[7px] rounded-[1px] bg-[#2a2a2a]" />
							</div>
							{/* Bottom row */}
							<div className="flex gap-[2px]">
								<div className="flex-[2] h-[7px] rounded-[1px] bg-[#2a2a2a]" />
								{Array.from({ length: 9 }).map((_, i) => (
									<div key={`b-${i}`} className="flex-1 h-[7px] rounded-[1px] bg-[#2a2a2a]" />
								))}
								<div className="flex-[2] h-[7px] rounded-[1px] bg-[#2a2a2a]" />
							</div>
							{/* Spacebar row */}
							<div className="flex gap-[2px]">
								<div className="flex-[1.2] h-[7px] rounded-[1px] bg-[#2a2a2a]" />
								<div className="flex-[1.2] h-[7px] rounded-[1px] bg-[#2a2a2a]" />
								<div className="flex-[1.2] h-[7px] rounded-[1px] bg-[#2a2a2a]" />
								<div className="flex-[5] h-[7px] rounded-[1px] bg-[#2d2d2d]" />
								<div className="flex-[1.2] h-[7px] rounded-[1px] bg-[#2a2a2a]" />
								<div className="flex-[1.2] h-[7px] rounded-[1px] bg-[#2a2a2a]" />
								{/* Arrow keys cluster */}
								<div className="flex-[0.6] h-[7px] rounded-[1px] bg-[#2a2a2a]" />
								<div className="flex flex-col gap-[1px] flex-[0.6]">
									<div className="h-[3px] rounded-[1px] bg-[#2a2a2a]" />
									<div className="h-[3px] rounded-[1px] bg-[#2a2a2a]" />
								</div>
								<div className="flex-[0.6] h-[7px] rounded-[1px] bg-[#2a2a2a]" />
							</div>
						</div>
						{/* Trackpad */}
						<div className="mt-2 mx-auto w-[45%] h-[30px] rounded-md bg-[#252525] border border-white/[0.03]" />
					</div>
				</div>
				{/* Bottom lip */}
				<div className="bg-[#1a1a1a] h-[4px] rounded-b-xl mx-[1px] border-x border-b border-white/[0.04]" />
				{/* Front edge */}
				<div className="bg-[#161616] h-[2px] rounded-b-2xl mx-2" />
			</div>

			{/* ── 3D CHARACTER (back view, flips to crying face on hover) ── */}
			<CharFlip
				backSrc="/illustrations/exhausted-back.png"
				frontSrc="/illustrations/exhausted-front.png"
				frontOverlay={
					<>
						<motion.div
							className="absolute top-[22%] left-[38%] text-lg"
							animate={{ y: [0, 15], opacity: [0.9, 0] }}
							transition={{ duration: 0.8, repeat: Infinity, ease: [0.4, 0, 1, 1], repeatDelay: 0.6 }}
						>
							😢
						</motion.div>
						<motion.div
							className="absolute top-[22%] right-[34%] text-lg"
							animate={{ y: [0, 15], opacity: [0.9, 0] }}
							transition={{ duration: 0.8, repeat: Infinity, ease: [0.4, 0, 1, 1], delay: 0.4, repeatDelay: 0.6 }}
						>
							😢
						</motion.div>
					</>
				}
			/>
		</div>
	);
}
