"use client";

import { motion, AnimatePresence } from "motion/react";
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

type Phase = "typing" | "processing" | "done";

export function VibeEditSuccessScene() {
	const [phase, setPhase] = useState<Phase>("typing");

	useEffect(() => {
		const run = () => {
			setPhase("typing");
			setTimeout(() => setPhase("processing"), 2000);
			setTimeout(() => setPhase("done"), 4000);
		};
		run();
		const interval = setInterval(run, 7500);
		return () => clearInterval(interval);
	}, []);

	return (
		<div className="relative w-full select-none">
			{/* ── LAPTOP FRAME ── */}
			<div className="relative mx-auto w-full max-w-[340px]">
				{/* Screen bezel */}
				<div className="bg-[#1a1a1a] rounded-t-xl pt-2 px-2 pb-1.5 border border-white/[0.06] border-b-0 shadow-2xl shadow-violet-950/30">
					{/* Webcam dot */}
					<div className="flex justify-center mb-1.5">
						<div className="w-1.5 h-1.5 rounded-full bg-[#2a2a2a] ring-1 ring-white/[0.04]" />
					</div>
					{/* Screen content */}
					<div className="relative rounded-sm overflow-hidden border border-white/[0.04]">
				{/* Title bar */}
				<div className="flex items-center justify-between bg-[#0f0f1a] px-2 py-1 border-b border-white/5">
					<div className="flex items-center gap-1.5">
						<div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
						<div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
						<div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
					</div>
					<div className="flex items-center gap-1">
						<div className="w-2.5 h-2.5 rounded-full bg-violet-500/80" />
						<span className="text-[9px] text-white/50 font-medium tracking-wide">VibeEdit</span>
					</div>
					<div className="w-12" />
				</div>

				{/* Main workspace - chat + preview layout */}
				<div className="bg-[#0a0a14] flex">
					{/* Chat panel */}
					<div className="flex-1 p-2 min-h-[170px] flex flex-col justify-end gap-1.5">
						{/* User message */}
						<motion.div
							className="self-end max-w-[80%]"
							initial={{ opacity: 0, y: 5 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: 0.3 }}
						>
							<div className="bg-violet-600/20 border border-violet-500/20 rounded-lg rounded-br-sm px-2 py-1.5">
								<p className="text-[7.5px] text-violet-200/80">Add captions to my video and make the intro more cinematic</p>
							</div>
							<p className="text-[5px] text-white/20 text-right mt-0.5">You · just now</p>
						</motion.div>

						{/* AI response area */}
						<AnimatePresence mode="wait">
							{phase === "typing" && (
								<motion.div
									key="typing"
									className="self-start max-w-[80%]"
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
								>
									<div className="bg-white/5 border border-white/5 rounded-lg rounded-bl-sm px-2 py-1.5">
										<div className="flex items-center gap-1">
											<div className="flex gap-0.5">
												{[0, 1, 2].map((i) => (
													<motion.div
														key={i}
														className="w-1 h-1 rounded-full bg-violet-400/60"
														animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
														transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
													/>
												))}
											</div>
											<span className="text-[6px] text-white/25">AI is thinking...</span>
										</div>
									</div>
								</motion.div>
							)}

							{phase === "processing" && (
								<motion.div
									key="processing"
									className="self-start max-w-[85%]"
									initial={{ opacity: 0, y: 5 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0 }}
								>
									<div className="bg-white/5 border border-white/5 rounded-lg rounded-bl-sm px-2 py-1.5 space-y-1.5">
										<p className="text-[7px] text-white/60">Adding captions with auto-transcription...</p>
										{/* Progress bar */}
										<div className="h-1 bg-white/5 rounded-full overflow-hidden">
											<motion.div
												className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full"
												initial={{ width: "0%" }}
												animate={{ width: "85%" }}
												transition={{ duration: 1.8, ease: "easeOut" }}
											/>
										</div>
										{/* Tool badges */}
										<div className="flex items-center gap-1">
											<motion.div
												className="flex items-center gap-0.5 bg-violet-500/10 border border-violet-500/15 rounded px-1 py-0.5"
												initial={{ opacity: 0, scale: 0.8 }}
												animate={{ opacity: 1, scale: 1 }}
												transition={{ delay: 0.4 }}
											>
												<span className="text-[5px] text-violet-300">✦ Captions</span>
												<motion.span
													className="text-[5px] text-green-400"
													initial={{ opacity: 0 }}
													animate={{ opacity: 1 }}
													transition={{ delay: 1.0 }}
												>
													✓
												</motion.span>
											</motion.div>
											<motion.div
												className="flex items-center gap-0.5 bg-fuchsia-500/10 border border-fuchsia-500/15 rounded px-1 py-0.5"
												initial={{ opacity: 0, scale: 0.8 }}
												animate={{ opacity: 1, scale: 1 }}
												transition={{ delay: 0.8 }}
											>
												<span className="text-[5px] text-fuchsia-300">✦ Cinematic</span>
												<motion.span
													className="text-[5px] text-green-400"
													initial={{ opacity: 0 }}
													animate={{ opacity: 1 }}
													transition={{ delay: 1.4 }}
												>
													✓
												</motion.span>
											</motion.div>
										</div>
									</div>
								</motion.div>
							)}

							{phase === "done" && (
								<motion.div
									key="done"
									className="self-start max-w-[85%]"
									initial={{ opacity: 0, y: 5 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0 }}
								>
									<div className="bg-white/5 border border-emerald-500/15 rounded-lg rounded-bl-sm px-2 py-1.5 space-y-1.5">
										<div className="flex items-center gap-1">
											<motion.div
												className="w-3 h-3 rounded-full bg-emerald-500/20 flex items-center justify-center"
												initial={{ scale: 0 }}
												animate={{ scale: 1 }}
												transition={{ type: "spring", stiffness: 300, damping: 15 }}
											>
												<span className="text-[6px] text-emerald-400">✓</span>
											</motion.div>
											<p className="text-[7px] text-emerald-300/90 font-medium">Done! Video exported</p>
										</div>
										{/* Mini video preview */}
										<div className="relative rounded overflow-hidden border border-white/5">
											<div className="h-[35px] bg-gradient-to-br from-violet-900/40 to-fuchsia-900/30 flex items-center justify-center">
												<div className="text-center">
													<p className="text-[6px] text-white/50">my-video-final.mp4</p>
													<p className="text-[5px] text-white/25">1080p · 2:14 · 48MB</p>
												</div>
											</div>
											{/* Progress complete bar */}
											<motion.div
												className="h-[2px] bg-gradient-to-r from-emerald-500 to-green-400"
												initial={{ width: "0%" }}
												animate={{ width: "100%" }}
												transition={{ duration: 0.8, delay: 0.3 }}
											/>
										</div>
										<p className="text-[6px] text-white/30">Captions added · Intro enhanced · Color graded</p>
									</div>
									<p className="text-[5px] text-white/20 mt-0.5">AI · 2 min ago</p>
								</motion.div>
							)}
						</AnimatePresence>
					</div>

					{/* Preview panel (right sidebar) */}
					<div className="w-[90px] border-l border-white/5 bg-[#0d0d18] p-1">
						<div className="text-[6px] text-white/25 mb-1">Preview</div>
						<div className="relative rounded overflow-hidden bg-[#111120] aspect-video">
							<div className="absolute inset-0 bg-gradient-to-br from-violet-900/20 to-fuchsia-900/10" />
							{/* Play button */}
							<div className="absolute inset-0 flex items-center justify-center">
								<div className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center">
									<span className="text-[6px] text-white/50 ml-0.5">▶</span>
								</div>
							</div>
						</div>
						{/* Timeline mini */}
						<div className="mt-1 space-y-0.5">
							<div className="h-[3px] bg-violet-500/20 rounded-full" />
							<div className="h-[3px] bg-fuchsia-500/15 rounded-full" />
							<div className="h-[3px] bg-emerald-500/15 rounded-full" />
						</div>
						{/* Export status */}
						<AnimatePresence>
							{phase === "done" && (
								<motion.div
									className="mt-1.5 flex items-center gap-0.5 bg-emerald-500/10 rounded px-1 py-0.5"
									initial={{ opacity: 0, y: 3 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0 }}
								>
									<span className="text-[5px] text-emerald-400">✓ Ready</span>
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				</div>

				{/* Status bar */}
				<div className="flex items-center justify-between bg-[#0f0f1a] px-2 py-0.5 border-t border-white/5">
					<div className="flex items-center gap-1">
						<motion.div
							className="w-1.5 h-1.5 rounded-full"
							animate={{
								backgroundColor: phase === "done" ? "#22c55e" : "#a78bfa",
							}}
						/>
						<span className="text-[6px] text-white/30">
							{phase === "done" ? "Export complete" : phase === "processing" ? "Processing..." : "Ready"}
						</span>
					</div>
					<span className="text-[6px] text-white/20">GPU ✦ Fast</span>
				</div>
					</div>
				</div>
				{/* Laptop keyboard deck */}
				<div className="relative bg-[#1e1e1e] border-x border-white/[0.04] px-3 pt-2 pb-3" style={{ perspective: "600px" }}>
					<div style={{ transform: "rotateX(12deg)", transformOrigin: "top center" }}>
						{/* Keyboard rows */}
						<div className="flex flex-col gap-[3px]">
							<div className="flex gap-[2px]">
								{Array.from({ length: 14 }).map((_, i) => (
									<div key={`fn-${i}`} className="flex-1 h-[5px] rounded-[1px] bg-[#2a2a2a]" />
								))}
							</div>
							<div className="flex gap-[2px]">
								{Array.from({ length: 13 }).map((_, i) => (
									<div key={`num-${i}`} className="flex-1 h-[7px] rounded-[1px] bg-[#2a2a2a]" />
								))}
								<div className="flex-[1.8] h-[7px] rounded-[1px] bg-[#2a2a2a]" />
							</div>
							<div className="flex gap-[2px]">
								<div className="flex-[1.4] h-[7px] rounded-[1px] bg-[#2a2a2a]" />
								{Array.from({ length: 12 }).map((_, i) => (
									<div key={`q-${i}`} className="flex-1 h-[7px] rounded-[1px] bg-[#2a2a2a]" />
								))}
								<div className="flex-[1.2] h-[7px] rounded-[1px] bg-[#2a2a2a]" />
							</div>
							<div className="flex gap-[2px]">
								<div className="flex-[1.6] h-[7px] rounded-[1px] bg-[#2a2a2a]" />
								{Array.from({ length: 11 }).map((_, i) => (
									<div key={`h-${i}`} className="flex-1 h-[7px] rounded-[1px] bg-[#2a2a2a]" />
								))}
								<div className="flex-[2] h-[7px] rounded-[1px] bg-[#2a2a2a]" />
							</div>
							<div className="flex gap-[2px]">
								<div className="flex-[2] h-[7px] rounded-[1px] bg-[#2a2a2a]" />
								{Array.from({ length: 9 }).map((_, i) => (
									<div key={`b-${i}`} className="flex-1 h-[7px] rounded-[1px] bg-[#2a2a2a]" />
								))}
								<div className="flex-[2] h-[7px] rounded-[1px] bg-[#2a2a2a]" />
							</div>
							<div className="flex gap-[2px]">
								<div className="flex-[1.2] h-[7px] rounded-[1px] bg-[#2a2a2a]" />
								<div className="flex-[1.2] h-[7px] rounded-[1px] bg-[#2a2a2a]" />
								<div className="flex-[1.2] h-[7px] rounded-[1px] bg-[#2a2a2a]" />
								<div className="flex-[5] h-[7px] rounded-[1px] bg-[#2d2d2d]" />
								<div className="flex-[1.2] h-[7px] rounded-[1px] bg-[#2a2a2a]" />
								<div className="flex-[1.2] h-[7px] rounded-[1px] bg-[#2a2a2a]" />
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

			{/* ── 3D CHARACTER (back view, flips to happy face with coconut on hover) ── */}
			<CharFlip
				backSrc="/illustrations/chill-back.png"
				frontSrc="/illustrations/chill-front.png"
				frontOverlay={
					<>
						<motion.div
							className="absolute top-[15%] right-[10%] text-2xl"
							animate={{ rotate: [0, 5, -5, 0], y: [0, -2, 0] }}
							transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
						>
							🥥
						</motion.div>
						<motion.div
							className="absolute top-[10%] left-[15%] text-sm"
							animate={{ opacity: [0, 1, 0], scale: [0.8, 1.2, 0.8] }}
							transition={{ duration: 1.5, repeat: Infinity }}
						>
							✨
						</motion.div>
						<motion.div
							className="absolute top-[30%] right-[5%] text-xs"
							animate={{ opacity: [0, 1, 0], scale: [0.8, 1.2, 0.8] }}
							transition={{ duration: 1.5, repeat: Infinity, delay: 0.7 }}
						>
							✨
						</motion.div>
					</>
				}
			/>
		</div>
	);
}
