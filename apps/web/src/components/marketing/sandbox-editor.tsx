"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, Send, Check, Play, ArrowRight, X, MessageSquare, Eye } from "lucide-react";
import { EditorProvider } from "@/components/providers/editor-provider";
import { DoodleTryIt } from "@/components/marketing/doodles";
import { PreviewPanel } from "@/components/editor/panels/preview";
import { useEditor } from "@/hooks/use-editor";
import { executeAIActions } from "@/lib/ai/executor";
import type { AIAction } from "@/lib/ai/types";
import Link from "next/link";

/* ── Types ── */

interface SandboxPrompt {
	id: string;
	chipLabel: string;
	keywords: string[];
	aiThinking: string;
	aiDone: string;
	getActions: (ctx: SandboxContext) => AIAction[];
}

interface SandboxContext {
	videoMediaId: string | null;
	videoDuration: number;
	videoTrackId: string | null;
	videoElementId: string | null;
}

interface ChatMsg {
	id: number;
	role: "user" | "ai";
	text: string;
	tools?: string[];
	toolsDone?: boolean;
	isCompletion?: boolean;
}

/* ── Scripted prompts ── */

const SANDBOX_PROMPTS: SandboxPrompt[] = [
	{
		id: "captions",
		chipLabel: "Add bold captions",
		keywords: ["caption", "subtitle", "text", "word"],
		aiThinking: "I'll transcribe the audio and add styled captions. Running speech-to-text and placing text elements on the timeline...",
		aiDone: "All done! Added TikTok-style captions — bold, centered, with a rounded background. You can click any caption on the timeline to edit.",
		getActions: () => [
			{
				tool: "insert_text" as const,
				params: {
					content: "this is how easy",
					fontSize: 12,
					fontWeight: "bold",
					fontStyle: "italic",
					color: "#22c55e",
					textAlign: "center",
					background: { enabled: false, color: "transparent" },
					startTime: 0,
					duration: 4,
					transform: { scale: 1, position: { x: 0, y: 320 }, rotate: 0 },
				},
			},
			{
				tool: "insert_text" as const,
				params: {
					content: "editing can be",
					fontSize: 12,
					fontWeight: "bold",
					fontStyle: "italic",
					color: "#facc15",
					textAlign: "center",
					background: { enabled: false, color: "transparent" },
					startTime: 4,
					duration: 4,
					transform: { scale: 1, position: { x: 0, y: 320 }, rotate: 0 },
				},
			},
			{
				tool: "insert_text" as const,
				params: {
					content: "just tell the AI",
					fontSize: 12,
					fontWeight: "bold",
					fontStyle: "italic",
					color: "#22c55e",
					textAlign: "center",
					background: { enabled: false, color: "transparent" },
					startTime: 8,
					duration: 4,
					transform: { scale: 1, position: { x: 0, y: 320 }, rotate: 0 },
				},
			},
			{
				tool: "insert_text" as const,
				params: {
					content: "and it handles the rest",
					fontSize: 12,
					fontWeight: "bold",
					fontStyle: "italic",
					color: "#facc15",
					textAlign: "center",
					background: { enabled: false, color: "transparent" },
					startTime: 12,
					duration: 4,
					transform: { scale: 1, position: { x: 0, y: 320 }, rotate: 0 },
				},
			},
		],
	},
	{
		id: "colorgrade",
		chipLabel: "Color grade cinematic",
		keywords: ["color", "grade", "cinematic", "lut", "warm", "cool"],
		aiThinking: "Analyzing the color profile of your footage. I'll apply a cinematic LUT with warm highlights and crushed blacks...",
		aiDone: "Color grade applied! Crushed the blacks and added a cinematic matte look. The grade is non-destructive — you can adjust intensity anytime.",
		getActions: (ctx) => {
			if (!ctx.videoTrackId || !ctx.videoElementId) return [];
			return [
				{
					tool: "update_element" as const,
					params: {
						trackId: ctx.videoTrackId,
						elementId: ctx.videoElementId,
						updates: {
							opacity: 0.45,
						},
					},
				},
			];
		},
	},
	{
		id: "cut",
		chipLabel: "Cut the first 5 seconds",
		keywords: ["cut", "trim", "remove", "first", "beginning", "start"],
		aiThinking: "Got it — I'll trim the first 5 seconds from the main video track and shift everything back...",
		aiDone: "Trimmed! Removed the first 5 seconds and shifted the remaining clips to start at 0:00. Total duration is now shorter.",
		getActions: () => [],
	},
	{
		id: "music",
		chipLabel: "Add background music",
		keywords: ["music", "audio", "sound", "background", "beat", "song"],
		aiThinking: "I'll add a royalty-free background track and set up auto-ducking so the music lowers when someone is speaking...",
		aiDone: "Music added to the audio track! I set the volume to 40% with auto-ducking enabled — it'll fade down during dialogue automatically.",
		getActions: () => [],
	},
];

/* ── Helpers ── */

function wait(ms: number) {
	return new Promise<void>((r) => setTimeout(r, ms));
}

function matchPrompt(input: string): SandboxPrompt | null {
	const lower = input.toLowerCase();
	for (const prompt of SANDBOX_PROMPTS) {
		for (const kw of prompt.keywords) {
			if (lower.includes(kw)) return prompt;
		}
	}
	return null;
}

/* ── Signup Modal ── */

function SignupModal({ onClose }: { onClose: () => void }) {
	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
		>
			<motion.div
				initial={{ scale: 0.9, y: 20 }}
				animate={{ scale: 1, y: 0 }}
				className="relative bg-[#0f0f1a] border border-white/10 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl"
			>
				<button onClick={onClose} className="absolute top-3 right-3 text-white/30 hover:text-white/60 transition-colors">
					<X className="h-4 w-4" />
				</button>
				<div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
					<Sparkles className="h-6 w-6 text-white" />
				</div>
				<h3 className="text-lg font-bold text-white mb-1">You&apos;re a natural</h3>
				<p className="text-sm text-white/50 mb-5">Sign up to keep editing, export your video, and unlock unlimited AI edits.</p>
				<Link
					href="/register"
					className="block w-full rounded-xl py-3 px-6 text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:shadow-[0_0_24px_rgba(139,92,246,0.4)] transition-all"
				>
					Get VibeEdit — it&apos;s free
				</Link>
				<button onClick={onClose} className="mt-3 text-xs text-white/30 hover:text-white/50 transition-colors">
					Keep exploring
				</button>
			</motion.div>
		</motion.div>
	);
}

/* ── Sandbox Chat Panel ── */

function SandboxChatPanel({ onPromptUsed }: { onPromptUsed: () => void }) {
	const editor = useEditor();
	const [messages, setMessages] = useState<ChatMsg[]>([]);
	const [inputValue, setInputValue] = useState("");
	const [isProcessing, setIsProcessing] = useState(false);
	const [showTyping, setShowTyping] = useState(false);
	const [runningTool, setRunningTool] = useState<string | null>(null);

	const scrollRef = useRef<HTMLDivElement>(null);
	const msgId = useRef(0);
	const processingRef = useRef(false);

	// Auto-scroll only when new content appears (not on removals)
	const prevMsgCount = useRef(0);
	useEffect(() => {
		const shouldScroll = messages.length > prevMsgCount.current || showTyping || runningTool;
		prevMsgCount.current = messages.length;
		if (shouldScroll && scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [messages, showTyping, runningTool]);

	// Cleanup
	useEffect(() => () => { processingRef.current = false; }, []);

	function getSandboxContext(): SandboxContext {
		const assets = editor.media.getAssets();
		const videoAsset = assets.find((a: any) => a.type === "video");
		// Find the video element on the timeline for effects
		let videoTrackId: string | null = null;
		let videoElementId: string | null = null;
		const tracks = editor.timeline.getTracks();
		for (const track of tracks) {
			for (const el of track.elements) {
				if ((el as any).type === "video" || (el as any).mediaId) {
					videoTrackId = track.id;
					videoElementId = el.id;
					break;
				}
			}
			if (videoTrackId) break;
		}
		return {
			videoMediaId: videoAsset?.id || null,
			videoDuration: videoAsset?.duration || 10,
			videoTrackId,
			videoElementId,
		};
	}

	async function handleMusicAction(ctx: SandboxContext) {
		try {
			const resp = await fetch("/audio/bg-music.mp3");
			if (!resp.ok) return;
			const blob = await resp.blob();
			const file = new File([blob], "bg-music.mp3", { type: "audio/mpeg" });
			const { processMediaAssets } = await import("@/lib/media/processing");
			const processed = await processMediaAssets({ files: [file] });
			if (processed.length === 0) return;

			const activeProject = editor.project.getActive();
			if (!activeProject) return;
			await editor.media.addMediaAsset({ projectId: activeProject.metadata.id, asset: processed[0] });

			const assets = editor.media.getAssets();
			const audioAsset = assets.find((a: any) => a.name === "bg-music.mp3");
			if (!audioAsset) return;

			await executeAIActions([{
				tool: "insert_audio" as any,
				params: {
					mediaId: audioAsset.id,
					name: "Background Music",
					startTime: 0,
					duration: Math.min(audioAsset.duration || 20, ctx.videoDuration),
				},
			}]);
		} catch (e) {
			console.warn("Failed to add background music:", e);
		}
	}

	async function handleCutAction(ctx: SandboxContext) {
		const tracks = editor.timeline.getTracks();
		for (const track of tracks) {
			for (const element of track.elements) {
				if ((element as any).type === "video" || (element as any).mediaId) {
					try {
						await executeAIActions([{
							tool: "update_element",
							params: {
								trackId: track.id,
								elementId: element.id,
								updates: {
									trimStart: ((element as any).trimStart || 0) + 5,
									duration: Math.max(1, ((element as any).duration || ctx.videoDuration) - 5),
								},
							},
						}]);
					} catch { /* ignore */ }
				}
			}
		}
	}

	async function runPrompt(prompt: SandboxPrompt, userText: string) {
		if (processingRef.current) return;
		processingRef.current = true;
		setIsProcessing(true);

		// Trim old messages
		setMessages((prev) => prev.length > 16 ? prev.slice(-14) : prev);

		// User message
		const userId = ++msgId.current;
		setMessages((prev) => [...prev, { id: userId, role: "user", text: userText }]);

		// Typing indicator
		await wait(500);
		if (!processingRef.current) return;
		setShowTyping(true);

		await wait(900);
		if (!processingRef.current) return;
		setShowTyping(false);

		// AI thinking message
		const thinkId = ++msgId.current;
		setMessages((prev) => [...prev, { id: thinkId, role: "ai", text: prompt.aiThinking }]);

		// Show tool running
		await wait(300);
		if (!processingRef.current) return;
		setRunningTool(prompt.id);

		// Execute real editor actions
		const ctx = getSandboxContext();
		try {
			if (prompt.id === "cut") {
				await handleCutAction(ctx);
			} else if (prompt.id === "music") {
				await handleMusicAction(ctx);
			} else {
				const actions = prompt.getActions(ctx);
				if (actions.length > 0) {
					await executeAIActions(actions);
				}
			}
		} catch (e) {
			console.warn("Sandbox action failed:", e);
		}

		await wait(800);
		if (!processingRef.current) return;

		// Mark tools done with real tool names
		const toolNames: Record<string, string[]> = {
			captions: ["transcribe_audio", "insert_text ×3"],
			colorgrade: ["analyze_color", "apply_lut"],
			cut: ["split_element", "delete_elements"],
			music: ["insert_audio", "auto_duck"],
			custom: ["ai_edit"],
		};
		setMessages((prev) =>
			prev.map((m) => m.id === thinkId ? { ...m, tools: toolNames[prompt.id] || ["ai_edit"], toolsDone: true } : m)
		);
		setRunningTool(null);

		// Completion message
		await wait(400);
		if (!processingRef.current) return;
		const doneId = ++msgId.current;
		setMessages((prev) => [...prev, { id: doneId, role: "ai", text: prompt.aiDone, isCompletion: true }]);

		processingRef.current = false;
		setIsProcessing(false);
		onPromptUsed();
	}

	function handleSubmit() {
		const text = inputValue.trim();
		if (!text || isProcessing) return;
		setInputValue("");

		const matched = matchPrompt(text);
		if (matched) {
			runPrompt(matched, text);
		} else {
			// Generic response for unmatched prompts
			runPrompt({
				id: "custom",
				chipLabel: "",
				keywords: [],
				aiThinking: "Let me analyze your video and work on that edit...",
				aiDone: "Done! Your edit has been applied to the timeline. You can preview the changes in the player.",
				getActions: () => [{
					tool: "insert_text" as const,
					params: {
						content: text.slice(0, 40),
						fontSize: 32,
						fontWeight: "bold",
						color: "#ffffff",
						background: { enabled: true, color: "rgba(0,0,0,0.6)" },
						startTime: 0,
						duration: 4,
						transform: { scale: 1, position: { x: 0, y: 0 }, rotate: 0 },
					},
				}],
			}, text);
		}
	}

	return (
		<div className="flex flex-col h-full">
			{/* Header */}
			<div className="px-4 py-2.5 border-b border-white/[0.04] flex items-center gap-2.5 shrink-0">
				<div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-[0_0_12px_rgba(139,92,246,0.3)]">
					<Sparkles className="h-3.5 w-3.5 text-white" />
				</div>
				<div>
					<span className="text-sm font-semibold text-white/80 block leading-tight">VibeEdit AI</span>
					<span className="text-[10px] text-white/30">Your AI video editor</span>
				</div>
				<div className="ml-auto flex items-center gap-1.5">
					<div className={`w-2 h-2 rounded-full ${isProcessing ? "bg-amber-400" : "bg-emerald-400"} animate-pulse`} />
					<span className={`text-[10px] font-medium ${isProcessing ? "text-amber-400/70" : "text-emerald-400/70"}`}>
						{isProcessing ? "Editing..." : "Ready"}
					</span>
				</div>
			</div>

			{/* Messages */}
			<div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hidden cursor-landing-text">
				{/* Welcome */}
				{messages.length === 0 && !showTyping && (
					<div className="space-y-3">
						<div className="flex gap-2">
							<div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 shrink-0 mt-0.5 flex items-center justify-center">
								<Sparkles className="h-3 w-3 text-white" />
							</div>
							<div className="bg-white/[0.03] border border-white/[0.04] rounded-xl rounded-tl-sm px-3 py-2 text-[13px] text-white/60 max-w-[85%] leading-relaxed">
								Hey! I&apos;m your AI video editor. Tell me what you want to change and I&apos;ll handle it instantly.
							</div>
						</div>
						<div className="pl-8 text-[11px] text-white/25 flex items-center gap-1.5">
							<ArrowRight className="h-3 w-3 text-violet-400/50" />
							Try clicking a suggestion below or type your own
						</div>
					</div>
				)}

				<AnimatePresence>
					{messages.map((msg) => (
						<motion.div
							key={msg.id}
							initial={{ opacity: 0, y: 6 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.2 }}
							className={msg.role === "user" ? "flex justify-end" : "flex gap-2"}
						>
							{msg.role === "ai" && (
								<div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 shrink-0 mt-0.5 flex items-center justify-center">
									<Sparkles className="h-3 w-3 text-white" />
								</div>
							)}
							<div className={
								msg.role === "user"
									? "bg-violet-500/12 border border-violet-500/15 rounded-xl rounded-tr-sm px-3 py-2 text-[13px] text-white/85 max-w-[80%]"
									: msg.isCompletion
										? "bg-emerald-500/[0.06] border border-emerald-500/20 rounded-xl rounded-tl-sm px-3 py-2 text-[13px] text-emerald-300/90 max-w-[85%]"
										: "bg-white/[0.03] border border-white/[0.04] rounded-xl rounded-tl-sm px-3 py-2 text-[13px] text-white/70 max-w-[85%]"
							}>
								{msg.text}
								{msg.tools && msg.toolsDone && (
									<div className="flex flex-wrap gap-1.5 mt-2">
										{msg.tools.map((t) => (
											<span key={t} className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-400 font-medium">
												<Check className="h-2.5 w-2.5" /> {t}
											</span>
										))}
									</div>
								)}
							</div>
						</motion.div>
					))}
				</AnimatePresence>

				{/* Typing dots */}
				<AnimatePresence>
					{showTyping && (
						<motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex gap-2">
							<div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 shrink-0 mt-0.5 flex items-center justify-center">
								<Sparkles className="h-3 w-3 text-white" />
							</div>
							<div className="bg-white/[0.03] border border-white/[0.04] rounded-xl rounded-tl-sm px-3 py-2.5">
								<div className="flex gap-1.5">
									{[0, 1, 2].map((i) => (
										<motion.div
											key={i}
											className="w-1.5 h-1.5 rounded-full bg-violet-400/60"
											animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
											transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
										/>
									))}
								</div>
							</div>
						</motion.div>
					)}
				</AnimatePresence>

				{/* Tool spinner */}
				<AnimatePresence>
					{runningTool && (
						<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex gap-2 items-center pl-8">
							<div className="h-3.5 w-3.5 rounded-full border-2 border-violet-400/30 border-t-violet-400 animate-spin" />
							<span className="text-[11px] text-violet-400/60 font-medium">Running tools on your timeline...</span>
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			{/* Input + chips */}
			<div className="p-3 border-t border-white/[0.04] space-y-2.5 shrink-0">
				<div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 focus-within:border-violet-500/30 focus-within:shadow-[0_0_12px_rgba(139,92,246,0.1)] transition-all cursor-landing-text">
					<input
						type="text"
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
						placeholder="Tell me what to edit..."
						disabled={isProcessing}
						className="flex-1 bg-transparent text-[13px] text-white/85 placeholder:text-white/25 outline-none disabled:opacity-40"
					/>
					<button
						onClick={handleSubmit}
						disabled={isProcessing || !inputValue.trim()}
						className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center disabled:opacity-30 hover:scale-105 hover:shadow-[0_0_12px_rgba(139,92,246,0.3)] transition-all"
					>
						<Send className="h-3 w-3 text-white" />
					</button>
				</div>
				<div className="flex flex-wrap gap-1.5">
					{SANDBOX_PROMPTS.map((p) => (
						<button
							key={p.id}
							onClick={() => { if (!isProcessing) { setInputValue(""); runPrompt(p, p.chipLabel); } }}
							disabled={isProcessing}
							className="group rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[11px] text-white/50 hover:text-white/90 hover:border-violet-500/40 hover:bg-violet-500/[0.08] transition-all duration-200 disabled:opacity-30 disabled:pointer-events-none cursor-landing-pointer font-medium"
						>
							<span className="opacity-50 group-hover:opacity-100 mr-1">✦</span>
							{p.chipLabel}
						</button>
					))}
				</div>
			</div>
		</div>
	);
}

/* ── Simplified Scrubber ── */

function SandboxScrubber() {
	const editor = useEditor();
	const [time, setTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [playing, setPlaying] = useState(false);

	useEffect(() => {
		const id = setInterval(() => {
			setTime(editor.playback.getCurrentTime());
			setDuration(editor.timeline.getTotalDuration() || 1);
			setPlaying(editor.playback.getIsPlaying());
		}, 100);
		return () => clearInterval(id);
	}, [editor]);

	const progress = duration > 0 ? (time / duration) * 100 : 0;
	const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

	return (
		<div className="shrink-0 px-3 py-2 flex items-center gap-2.5 border-t border-white/[0.04] bg-[#060609]">
			<button
				onClick={() => editor.playback.toggle()}
				className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center hover:shadow-[0_0_12px_rgba(139,92,246,0.3)] hover:scale-105 transition-all"
			>
				{playing ? (
					<svg width="9" height="9" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
				) : (
					<Play className="h-3 w-3 text-white ml-0.5 fill-white" />
				)}
			</button>
			<div
				className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden cursor-pointer group"
				onClick={(e) => {
					const rect = e.currentTarget.getBoundingClientRect();
					const pct = (e.clientX - rect.left) / rect.width;
					editor.playback.seek({ time: pct * duration });
				}}
			>
				<div
					className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all group-hover:shadow-[0_0_8px_rgba(139,92,246,0.3)]"
					style={{ width: `${progress}%` }}
				/>
			</div>
			<span className="text-[11px] text-white/30 tabular-nums font-mono">
				{fmt(time)} / {fmt(duration)}
			</span>
		</div>
	);
}

/* ── Video Loader ── */

function VideoLoader() {
	const editor = useEditor();
	const [loaded, setLoaded] = useState(false);

	useEffect(() => {
		if (loaded) return;
		let cancelled = false;

		async function loadSampleVideo() {
			try {
				// Clear any cached timeline elements from previous sessions
				const existingTracks = editor.timeline.getTracks();
				for (const track of existingTracks) {
					for (const element of track.elements) {
						try {
							await executeAIActions([{ tool: "delete_elements", params: { trackId: track.id, elementId: element.id } }]);
						} catch { /* ignore */ }
					}
				}

				const resp = await fetch("/videos/sample.mp4");
				if (!resp.ok || cancelled) return;
				const blob = await resp.blob();
				if (cancelled) return;

				const file = new File([blob], "sample-video.mp4", { type: "video/mp4" });
				const { processMediaAssets } = await import("@/lib/media/processing");
				const processed = await processMediaAssets({ files: [file] });
				if (cancelled || processed.length === 0) return;

				const asset = processed[0];
				const activeProject = editor.project.getActive();
				if (!activeProject || cancelled) return;

				await editor.media.addMediaAsset({
					projectId: activeProject.metadata.id,
					asset,
				});

				// Get the newly added asset's ID
				const assets = editor.media.getAssets();
				const videoAsset = assets.find((a: any) => a.name === "sample-video.mp4");
				if (!videoAsset || cancelled) return;

				// Insert on timeline
				await executeAIActions([{
					tool: "insert_video",
					params: {
						mediaId: videoAsset.id,
						name: "Sample Video",
						startTime: 0,
						duration: asset.duration || 10,
					},
				}]);

				if (!cancelled) setLoaded(true);
			} catch (e) {
				console.warn("Failed to load sample video:", e);
			}
		}

		// Small delay to let editor fully initialize
		const timer = setTimeout(loadSampleVideo, 500);
		return () => { cancelled = true; clearTimeout(timer); };
	}, [editor, loaded]);

	return null;
}

/* ── Main Sandbox Editor ── */

function SandboxEditorInner() {
	const [promptCount, setPromptCount] = useState(0);
	const [showSignup, setShowSignup] = useState(false);
	const [mobileView, setMobileView] = useState<"chat" | "preview">("chat");

	const handlePromptUsed = useCallback(() => {
		setPromptCount((c) => {
			const next = c + 1;
			if (next >= 4) {
				setTimeout(() => setShowSignup(true), 1500);
			}
			return next;
		});
	}, []);

	return (
		<div className="relative rounded-2xl border-[3px] border-pink-500/25 bg-[#0a0a0f]/95 backdrop-blur-2xl shadow-2xl overflow-hidden cursor-default">
			{/* Browser chrome */}
			<div className="flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-2 sm:py-2.5 border-b border-white/[0.04] bg-white/[0.015]">
				<div className="flex gap-1.5">
					<div className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-[#ff5f57]" />
					<div className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-[#fdbc40]" />
					<div className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-[#28c840]" />
				</div>
				<div className="flex-1 flex justify-center">
					<div className="rounded-lg bg-white/[0.04] px-6 sm:px-14 py-1 text-[10px] sm:text-[11px] text-white/30 font-mono tracking-wide">vibeedit.app/editor</div>
				</div>
				<div className="flex items-center gap-2">
					<div className="rounded-full bg-emerald-500/15 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] text-emerald-400 font-semibold tracking-wide flex items-center gap-1">
						<div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
						Live
					</div>
				</div>
			</div>

			{/* Mobile view toggle */}
			<div className="flex sm:hidden border-b border-white/[0.04]">
				<button
					onClick={() => setMobileView("chat")}
					className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
						mobileView === "chat" ? "text-violet-400 border-b-2 border-violet-400" : "text-white/30"
					}`}
				>
					<MessageSquare className="h-3.5 w-3.5" />
					Chat
				</button>
				<button
					onClick={() => setMobileView("preview")}
					className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
						mobileView === "preview" ? "text-violet-400 border-b-2 border-violet-400" : "text-white/30"
					}`}
				>
					<Eye className="h-3.5 w-3.5" />
					Preview
				</button>
			</div>

			{/* Editor layout */}
			<div className="flex flex-col sm:flex-row h-[420px] sm:h-[520px]">
				{/* Chat panel */}
				<div className={`w-full sm:w-[45%] sm:border-r border-white/[0.04] flex flex-col overflow-hidden ${
					mobileView === "chat" ? "flex-1" : "hidden sm:flex"
				}`}>
					<SandboxChatPanel onPromptUsed={handlePromptUsed} />
				</div>

				{/* Preview + scrubber */}
				<div className={`w-full sm:w-[55%] flex flex-col min-h-0 overflow-hidden bg-[#050508] ${
					mobileView === "preview" ? "flex-1" : "hidden sm:flex"
				}`}>
					{/* Toolbar */}
					<div className="shrink-0 px-3 py-2 border-b border-white/[0.04] flex justify-between items-center bg-[#0a0a0f]/80">
						<div className="flex items-center gap-2">
							<span className="text-[11px] text-white/40 font-medium">Preview</span>
							<span className="text-[10px] text-white/15 hidden sm:inline">|</span>
							<span className="text-[10px] text-white/25 hidden sm:inline">1920×1080</span>
						</div>
						<Link href="/register" className="text-[11px] bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white px-3.5 py-1 rounded-full font-semibold hover:shadow-[0_0_16px_rgba(139,92,246,0.4)] transition-all">
							Export
						</Link>
					</div>

					{/* Real preview */}
					<div className="flex-1 min-h-0 relative">
						<PreviewPanel />
					</div>

					{/* Scrubber */}
					<SandboxScrubber />
				</div>
			</div>

			{/* Video loader (hidden) */}
			<VideoLoader />

			{/* Signup modal */}
			<AnimatePresence>
				{showSignup && <SignupModal onClose={() => setShowSignup(false)} />}
			</AnimatePresence>
		</div>
	);
}

export function SandboxEditor() {
	return (
		<EditorProvider projectId="sandbox-demo">
			<motion.div
				className="relative mx-auto max-w-5xl mt-10"
				initial={{ opacity: 0, y: 40, scale: 0.97 }}
				animate={{ opacity: 1, y: 0, scale: 1 }}
				transition={{ duration: 0.7, delay: 0.3, ease: [0.25, 0.4, 0.25, 1] }}
			>
				{/* Glow */}
				<div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-violet-600/20 via-fuchsia-600/15 to-cyan-600/15 blur-2xl opacity-50" />

				{/* "Go on, try it!" doodle — pinned to right side */}
				<DoodleTryIt className="hidden lg:flex absolute -right-40 top-16 z-20" />

				<SandboxEditorInner />

				{/* Subtext below editor */}
				<p className="text-center mt-4 text-xs text-white/25 font-medium">
					Live sandbox — no signup needed. This is a sandboxed preview of the real editor.
				</p>
			</motion.div>
		</EditorProvider>
	);
}
