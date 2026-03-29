"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Play, ArrowRight, Check } from "lucide-react";

/* ── Demo script — what happens step by step ───────────────────── */

interface DemoStep {
	type: "user" | "ai" | "tool" | "progress" | "pause";
	text?: string;
	tools?: string[];
	progress?: number; // 0-100 for timeline
	delay: number; // ms before this step shows
}

const DEMO_SCRIPT: DemoStep[] = [
	{ type: "user", text: "add my intro clip as the main video", delay: 800 },
	{ type: "ai", text: "Adding intro_clip.mp4 to the main track...", delay: 1200 },
	{ type: "tool", tools: ["insert_video"], delay: 600 },
	{ type: "progress", progress: 25, delay: 400 },

	{ type: "user", text: "overlay the logo from 2s to 5s, fade in", delay: 1500 },
	{ type: "ai", text: "Overlaying logo with a fade-in keyframe animation.", delay: 1000 },
	{ type: "tool", tools: ["insert_image", "upsert_keyframe"], delay: 600 },
	{ type: "progress", progress: 50, delay: 400 },

	{ type: "user", text: "add bold white auto-captions", delay: 1500 },
	{ type: "ai", text: "Transcribing audio and generating timed captions...", delay: 1400 },
	{ type: "tool", tools: ["auto_caption"], delay: 600 },
	{ type: "progress", progress: 75, delay: 400 },

	{ type: "user", text: "export for TikTok", delay: 1500 },
	{ type: "ai", text: "Rendering 1080\u00D71920 vertical video at 30fps...", delay: 1200 },
	{ type: "tool", tools: ["export_preset"], delay: 600 },
	{ type: "progress", progress: 100, delay: 800 },

	{ type: "pause", delay: 3000 }, // pause before restart
];

interface Message {
	id: number;
	role: "user" | "ai";
	text: string;
	tools?: string[];
	toolsDone?: boolean;
}

export function LiveDemo() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [typing, setTyping] = useState<"user" | "ai" | null>(null);
	const [typingText, setTypingText] = useState("");
	const [progress, setProgress] = useState(0);
	const [currentTool, setCurrentTool] = useState<string[] | null>(null);
	const scrollRef = useRef<HTMLDivElement>(null);
	const msgId = useRef(0);
	const running = useRef(true);

	useEffect(() => {
		running.current = true;
		runDemo();
		return () => { running.current = false; };
	}, []);

	// Auto-scroll
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [messages, typing, currentTool]);

	async function wait(ms: number) {
		return new Promise<void>((r) => setTimeout(r, ms));
	}

	async function typeOut(text: string, role: "user" | "ai") {
		if (!running.current) return;
		setTyping(role);
		setTypingText("");

		// Type character by character
		for (let i = 0; i <= text.length; i++) {
			if (!running.current) return;
			setTypingText(text.slice(0, i));
			await wait(role === "user" ? 30 : 18);
		}

		await wait(200);
		setTyping(null);
		setTypingText("");

		const id = ++msgId.current;
		setMessages((prev) => [...prev, { id, role, text }]);
	}

	async function runDemo() {
		while (running.current) {
			// Reset
			setMessages([]);
			setProgress(0);
			setCurrentTool(null);
			msgId.current = 0;

			for (const step of DEMO_SCRIPT) {
				if (!running.current) return;
				await wait(step.delay);
				if (!running.current) return;

				switch (step.type) {
					case "user":
						await typeOut(step.text!, "user");
						break;
					case "ai":
						await typeOut(step.text!, "ai");
						break;
					case "tool":
						setCurrentTool(step.tools!);
						await wait(800);
						// Mark last AI message with tools
						setMessages((prev) => {
							const copy = [...prev];
							const lastAi = [...copy].reverse().find((m) => m.role === "ai");
							if (lastAi) lastAi.tools = step.tools;
							if (lastAi) lastAi.toolsDone = true;
							return copy;
						});
						setCurrentTool(null);
						break;
					case "progress":
						setProgress(step.progress!);
						break;
					case "pause":
						await wait(step.delay);
						break;
				}
			}
		}
	}

	return (
		<motion.div
			className="relative mx-auto max-w-5xl mt-14"
			initial={{ opacity: 0, y: 60, scale: 0.96 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={{ duration: 0.8, delay: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
		>
			{/* Glow */}
			<div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-violet-600/20 via-fuchsia-600/15 to-cyan-600/15 blur-2xl opacity-50" />

			<div className="relative rounded-2xl border border-white/[0.08] bg-[#0a0a0f]/90 backdrop-blur-2xl shadow-2xl overflow-hidden">
				{/* Browser chrome */}
				<div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.04] bg-white/[0.015]">
					<div className="flex gap-1.5">
						<div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
						<div className="w-2.5 h-2.5 rounded-full bg-[#fdbc40]" />
						<div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
					</div>
					<div className="flex-1 flex justify-center">
						<div className="rounded-md bg-white/[0.04] px-16 py-1 text-[10px] text-white/25 font-mono">vibeedit.app/editor</div>
					</div>
					<div className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[8px] text-emerald-400 font-semibold tracking-wide uppercase">Live Demo</div>
				</div>

				{/* Editor */}
				<div className="flex" style={{ height: 400 }}>
					{/* Chat */}
					<div className="w-[55%] border-r border-white/[0.04] flex flex-col">
						{/* Chat header */}
						<div className="px-4 py-2.5 border-b border-white/[0.04] flex items-center gap-2">
							<div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
								<Sparkles className="h-3 w-3 text-white" />
							</div>
							<span className="text-[11px] font-semibold text-white/70">VibeEdit AI</span>
							<div className="ml-auto flex items-center gap-1">
								<div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
								<span className="text-[9px] text-emerald-400/70">Ready</span>
							</div>
						</div>

						{/* Messages */}
						<div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-hidden">
							<AnimatePresence>
								{messages.map((msg) => (
									<motion.div
										key={msg.id}
										initial={{ opacity: 0, y: 8 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ duration: 0.25 }}
										className={msg.role === "user" ? "flex justify-end" : "flex gap-1.5"}
									>
										{msg.role === "ai" && (
											<div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-600 shrink-0 mt-0.5 flex items-center justify-center">
												<Sparkles className="h-2.5 w-2.5 text-white" />
											</div>
										)}
										<div className={
											msg.role === "user"
												? "bg-violet-500/12 border border-violet-500/15 rounded-xl rounded-tr-sm px-3 py-1.5 text-[11px] text-white/85 max-w-[80%]"
												: "bg-white/[0.03] border border-white/[0.04] rounded-xl rounded-tl-sm px-3 py-1.5 text-[11px] text-white/70 max-w-[85%]"
										}>
											{msg.text}
											{msg.tools && msg.toolsDone && (
												<div className="flex flex-wrap gap-1 mt-1.5">
													{msg.tools.map((t) => (
														<span key={t} className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/15 px-1.5 py-0.5 text-[9px] text-emerald-400">
															<Check className="h-2 w-2" /> {t}
														</span>
													))}
												</div>
											)}
										</div>
									</motion.div>
								))}
							</AnimatePresence>

							{/* Typing indicator */}
							{typing && (
								<motion.div
									initial={{ opacity: 0, y: 6 }}
									animate={{ opacity: 1, y: 0 }}
									className={typing === "user" ? "flex justify-end" : "flex gap-1.5"}
								>
									{typing === "ai" && (
										<div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-600 shrink-0 mt-0.5 flex items-center justify-center">
											<Sparkles className="h-2.5 w-2.5 text-white" />
										</div>
									)}
									<div className={
										typing === "user"
											? "bg-violet-500/12 border border-violet-500/15 rounded-xl rounded-tr-sm px-3 py-1.5 text-[11px] text-white/85 max-w-[80%]"
											: "bg-white/[0.03] border border-white/[0.04] rounded-xl rounded-tl-sm px-3 py-1.5 text-[11px] text-white/70 max-w-[85%]"
									}>
										{typingText}
										<span className="inline-block w-0.5 h-3 bg-white/40 ml-0.5 animate-pulse" />
									</div>
								</motion.div>
							)}

							{/* Tool execution indicator */}
							{currentTool && (
								<motion.div
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									className="flex gap-1.5 items-center pl-6"
								>
									<div className="h-3 w-3 rounded-full border border-violet-400/30 border-t-violet-400 animate-spin" />
									<span className="text-[9px] text-violet-400/60">
										Running {currentTool.join(", ")}...
									</span>
								</motion.div>
							)}
						</div>

						{/* Input */}
						<div className="p-2.5 border-t border-white/[0.04]">
							<div className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
								<span className="text-white/15 text-[11px]">Describe your edit...</span>
								<div className="ml-auto w-5 h-5 rounded-md bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center opacity-50">
									<ArrowRight className="h-2.5 w-2.5 text-white" />
								</div>
							</div>
						</div>
					</div>

					{/* Preview */}
					<div className="w-[45%] flex flex-col">
						{/* Toolbar */}
						<div className="px-3 py-2 border-b border-white/[0.04] flex justify-between items-center">
							<span className="text-[9px] text-white/25">Preview</span>
							<span className="text-[9px] bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white px-2.5 py-0.5 rounded-full font-semibold">Export</span>
						</div>

						{/* Video preview area */}
						<div className="flex-1 bg-[#050508] flex items-center justify-center relative overflow-hidden">
							{/* Animated preview content based on progress */}
							<div className="absolute inset-3 rounded-md overflow-hidden">
								{progress === 0 && (
									<div className="h-full flex items-center justify-center">
										<div className="text-center">
											<div className="w-10 h-10 mx-auto mb-2 rounded-full bg-white/5 flex items-center justify-center">
												<Play className="h-4 w-4 text-white/30 ml-0.5" />
											</div>
											<div className="text-white/20 text-[10px]">No media yet</div>
										</div>
									</div>
								)}
								{progress >= 25 && (
									<motion.div
										initial={{ opacity: 0, scale: 0.95 }}
										animate={{ opacity: 1, scale: 1 }}
										className="h-full bg-gradient-to-br from-indigo-900/60 via-[#0a0a0f] to-purple-900/40 flex items-center justify-center"
									>
										<div className="text-center">
											<div className="text-white/60 text-xs font-bold font-[family-name:var(--font-display)]">
												intro_clip.mp4
											</div>
											<div className="text-white/20 text-[9px] mt-0.5 font-mono">1920{"\u00D7"}1080</div>
											{progress >= 50 && (
												<motion.div
													initial={{ opacity: 0, scale: 0 }}
													animate={{ opacity: 1, scale: 1 }}
													className="mt-3 mx-auto w-8 h-8 rounded bg-white/90 flex items-center justify-center shadow-lg"
												>
													<span className="text-[8px] font-bold text-black">LOGO</span>
												</motion.div>
											)}
											{progress >= 75 && (
												<motion.div
													initial={{ opacity: 0, y: 10 }}
													animate={{ opacity: 1, y: 0 }}
													className="mt-4 mx-auto bg-black/70 backdrop-blur rounded px-3 py-1"
												>
													<span className="text-[10px] text-white font-bold">This is auto-captioned text</span>
												</motion.div>
											)}
										</div>
									</motion.div>
								)}
								{progress >= 100 && (
									<motion.div
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center"
									>
										<div className="text-center">
											<motion.div
												initial={{ scale: 0 }}
												animate={{ scale: 1 }}
												transition={{ type: "spring", damping: 10 }}
												className="w-10 h-10 mx-auto mb-2 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center"
											>
												<Check className="h-5 w-5 text-emerald-400" />
											</motion.div>
											<div className="text-emerald-400 text-[10px] font-semibold">Exported!</div>
											<div className="text-white/20 text-[8px] mt-0.5">TikTok 1080{"\u00D7"}1920</div>
										</div>
									</motion.div>
								)}
							</div>
						</div>

						{/* Timeline / progress bar */}
						<div className="px-3 py-2 border-t border-white/[0.04] flex items-center gap-2">
							<div className="w-5 h-5 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
								<Play className="h-2 w-2 text-white ml-0.5 fill-white" />
							</div>
							<div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
								<motion.div
									className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full"
									animate={{ width: `${progress}%` }}
									transition={{ duration: 0.5, ease: "easeOut" }}
								/>
							</div>
							<span className="text-[9px] text-white/20 tabular-nums font-mono w-14 text-right">
								{progress === 0 ? "0:00" : progress <= 25 ? "0:30" : progress <= 50 ? "1:45" : progress <= 75 ? "3:12" : "4:55"} / 4:55
							</span>
						</div>
					</div>
				</div>
			</div>
		</motion.div>
	);
}
