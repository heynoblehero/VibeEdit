"use client";

import Link from "next/link";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { FloatingOrbs } from "@/components/ui/motion/floating-orbs";
import { AnimatedSection } from "@/components/ui/motion/animated-section";
import { GlassCard } from "@/components/ui/motion/glass-card";
import { StaggerChildren, StaggerItem } from "@/components/ui/motion/stagger-children";
import { NeonBadge } from "@/components/ui/motion/neon-badge";
import { motion, useScroll, useTransform } from "motion/react";
import {
	MessageSquare, Wand2, Sparkles, Package, Captions, Rocket,
	Play, Upload, Download, Zap, Shield, Clock, ChevronDown,
	Video, Scissors, Camera, Clapperboard, Smile, ArrowRight, Star, Check,
} from "lucide-react";
import { useState, useRef } from "react";

/* ── Data ───────────────────────────────────────────────────────── */

const features = [
	{ icon: MessageSquare, title: "AI Chat Editor", description: "Describe edits in plain English. Cuts, transitions, overlays — just say it.", color: "from-violet-500 to-purple-600" },
	{ icon: Wand2, title: "27 AI Tools", description: "Text, video, keyframes, effects, color grading — all AI-driven.", color: "from-fuchsia-500 to-pink-600" },
	{ icon: Sparkles, title: "Remotion Effects", description: "AI writes custom motion graphics with React-based rendering.", color: "from-cyan-500 to-blue-600" },
	{ icon: Package, title: "Import Anything", description: "PSD, LUT, Lottie, ZIP, SRT, EDL, Premiere XML — all supported.", color: "from-amber-500 to-orange-600" },
	{ icon: Captions, title: "Auto-Captions", description: "Generate timed captions from audio automatically.", color: "from-emerald-500 to-green-600" },
	{ icon: Rocket, title: "Export Everywhere", description: "One-click presets for YouTube, Instagram, TikTok, Twitter.", color: "from-rose-500 to-red-600" },
];

const tools = [
	{ icon: Video, label: "Record", desc: "Camera, screen, audio" },
	{ icon: Scissors, label: "Auto Clip", desc: "100s of viral clips" },
	{ icon: Clapperboard, label: "Storyboard", desc: "AI plans your video" },
	{ icon: Smile, label: "AI Avatar", desc: "Animated characters" },
	{ icon: Camera, label: "Beauty Filters", desc: "Face-aware effects" },
	{ icon: Wand2, label: "BG Replace", desc: "AI backgrounds" },
];

const pricingPlans = [
	{ name: "Starter", price: 5, credits: 100, detail: "~100 AI messages or ~20 renders", popular: false },
	{ name: "Pro", price: 20, credits: 500, detail: "~500 AI messages or ~100 renders", popular: true },
	{ name: "Studio", price: 50, credits: 1500, detail: "~1500 AI messages or ~300 renders", popular: false },
];

const faqs = [
	{ q: "What is VibeEdit?", a: "An AI video editor. Describe edits in plain English, and AI builds your video with 27 tools, Remotion effects, and smart automation." },
	{ q: "How do credits work?", a: "Each AI action costs credits. Buy packs, use at your pace. Credits never expire." },
	{ q: "What can I import?", a: "MP4, MOV, WebM, PSD, LUT, Lottie, ZIP packs, SRT, EDL, Premiere XML, and more." },
	{ q: "Can I use my own API keys?", a: "Yes. Connect ElevenLabs, Stability AI, and other providers in settings." },
	{ q: "Is my data secure?", a: "All processing uses encrypted storage. Files are private and never used for training." },
];

/* ── Components ─────────────────────────────────────────────────── */

function FAQItem({ q, a }: { q: string; a: string }) {
	const [open, setOpen] = useState(false);
	return (
		<button
			onClick={() => setOpen((v) => !v)}
			className="w-full rounded-2xl border border-border/40 bg-card/40 backdrop-blur-sm text-left transition-all duration-300 hover:bg-card/60 hover:border-primary/20"
		>
			<div className="flex items-center justify-between p-5">
				<span className="font-semibold font-[family-name:var(--font-display)] pr-4">{q}</span>
				<ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
			</div>
			<div className="overflow-hidden transition-all duration-300" style={{ maxHeight: open ? "200px" : "0px" }}>
				<p className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">{a}</p>
			</div>
		</button>
	);
}

function GradientMesh() {
	return (
		<div className="absolute inset-0 overflow-hidden">
			{/* Animated gradient blobs */}
			<div className="absolute -top-[40%] -left-[20%] w-[70%] h-[70%] rounded-full bg-gradient-to-br from-violet-600/20 via-purple-600/10 to-transparent blur-[100px] animate-[float_20s_ease-in-out_infinite]" />
			<div className="absolute -bottom-[30%] -right-[20%] w-[60%] h-[60%] rounded-full bg-gradient-to-tl from-fuchsia-600/15 via-pink-600/8 to-transparent blur-[100px] animate-[float_25s_ease-in-out_infinite_reverse]" />
			<div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] rounded-full bg-gradient-to-bl from-cyan-500/10 via-blue-500/5 to-transparent blur-[80px] animate-[float_18s_ease-in-out_infinite_2s]" />
			{/* Grid overlay */}
			<div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]" />
		</div>
	);
}

function EditorDemo() {
	return (
		<motion.div
			className="relative mx-auto max-w-5xl mt-16"
			initial={{ opacity: 0, y: 60, scale: 0.95 }}
			animate={{ opacity: 1, y: 0, scale: 1 }}
			transition={{ duration: 0.8, delay: 0.5, ease: [0.25, 0.4, 0.25, 1] }}
		>
			{/* Glow behind */}
			<div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-violet-600/20 via-fuchsia-600/20 to-cyan-600/20 blur-2xl opacity-60" />

			<div className="relative rounded-2xl border border-white/10 bg-black/60 backdrop-blur-2xl shadow-2xl overflow-hidden">
				{/* Browser chrome */}
				<div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-white/[0.02]">
					<div className="flex gap-1.5">
						<div className="w-3 h-3 rounded-full bg-white/10" />
						<div className="w-3 h-3 rounded-full bg-white/10" />
						<div className="w-3 h-3 rounded-full bg-white/10" />
					</div>
					<div className="flex-1 flex justify-center">
						<div className="rounded-full bg-white/5 px-4 py-1 text-[11px] text-white/30 font-mono">vibeedit.app/editor</div>
					</div>
				</div>

				{/* Editor layout */}
				<div className="flex" style={{ height: 380 }}>
					{/* Chat side */}
					<div className="w-[55%] border-r border-white/5 p-5 flex flex-col gap-3">
						<div className="flex items-center gap-2 mb-2">
							<div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
								<Sparkles className="h-3.5 w-3.5 text-white" />
							</div>
							<span className="text-xs font-semibold text-white/80">VibeEdit AI</span>
							<div className="ml-auto rounded-full bg-green-500/20 px-2 py-0.5 text-[9px] text-green-400 font-medium">Online</div>
						</div>

						{/* Messages */}
						<div className="flex justify-end">
							<div className="bg-violet-500/15 border border-violet-500/20 rounded-2xl rounded-tr-md px-3.5 py-2 text-xs text-white/90 max-w-[75%]">
								add intro_clip as the main video, overlay my logo from 2s to 5s with a fade in
							</div>
						</div>
						<div className="flex gap-2">
							<div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 shrink-0 mt-0.5 flex items-center justify-center">
								<Sparkles className="h-3 w-3 text-white" />
							</div>
							<div className="bg-white/5 border border-white/5 rounded-2xl rounded-tl-md px-3.5 py-2 text-xs text-white/80">
								Done! Added intro_clip.mp4 and overlaid your logo with fade-in.
								<div className="flex gap-1.5 mt-2">
									<span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-400">{"\u2713"} insert_video</span>
									<span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-400">{"\u2713"} insert_image</span>
									<span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-400">{"\u2713"} keyframe</span>
								</div>
							</div>
						</div>
						<div className="flex justify-end">
							<div className="bg-violet-500/15 border border-violet-500/20 rounded-2xl rounded-tr-md px-3.5 py-2 text-xs text-white/90 max-w-[75%]">
								add auto-captions with a bold white style
							</div>
						</div>
						<div className="flex gap-2">
							<div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 shrink-0 mt-0.5 flex items-center justify-center">
								<Sparkles className="h-3 w-3 text-white" />
							</div>
							<div className="bg-white/5 border border-white/5 rounded-2xl rounded-tl-md px-3.5 py-2 text-xs text-white/80">
								<div className="flex gap-1">
									<div className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
									<div className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
									<div className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
								</div>
							</div>
						</div>

						<div className="mt-auto">
							<div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-2.5">
								<span className="text-white/20 text-xs">{"\u{1F4CE}"}</span>
								<span className="text-xs text-white/25 flex-1">Describe your edit...</span>
								<div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
									<ArrowRight className="h-3.5 w-3.5 text-white" />
								</div>
							</div>
						</div>
					</div>

					{/* Preview side */}
					<div className="w-[45%] flex flex-col">
						<div className="px-4 py-2.5 border-b border-white/5 flex justify-between items-center">
							<span className="text-[10px] text-white/30 font-medium">Assets (3)</span>
							<div className="flex items-center gap-2">
								<span className="text-[10px] text-white/30">Timeline</span>
								<span className="text-[10px] bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white px-3 py-1 rounded-full font-semibold">Export</span>
							</div>
						</div>
						<div className="flex-1 bg-gradient-to-b from-black to-gray-950 flex items-center justify-center relative">
							{/* Fake video preview */}
							<div className="absolute inset-4 rounded-lg bg-gradient-to-br from-violet-900/30 via-black to-fuchsia-900/20 flex items-center justify-center">
								<div className="text-center">
									<div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/10 backdrop-blur flex items-center justify-center">
										<Play className="h-5 w-5 text-white/80 ml-0.5" />
									</div>
									<div className="text-white/70 text-sm font-bold font-[family-name:var(--font-display)]">MY PROJECT</div>
									<div className="text-white/25 text-[10px] mt-1 font-mono">1920{"\u00D7"}1080 {"\u2022"} 30fps</div>
								</div>
							</div>
						</div>
						<div className="px-4 py-2.5 border-t border-white/5 flex items-center gap-3">
							<div className="w-6 h-6 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center">
								<Play className="h-2.5 w-2.5 text-white ml-0.5 fill-white" />
							</div>
							<div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
								<div className="h-full w-[40%] bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full" />
							</div>
							<span className="text-[10px] text-white/30 tabular-nums font-mono">1:23 / 4:55</span>
						</div>
					</div>
				</div>
			</div>
		</motion.div>
	);
}

/* ── Page ────────────────────────────────────────────────────────── */

export default function Home() {
	const heroRef = useRef<HTMLDivElement>(null);
	const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
	const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
	const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

	return (
		<div className="min-h-screen bg-background text-foreground overflow-x-hidden">
			<MarketingNav />

			{/* ── Hero ────────────────────────────────────────────── */}
			<section ref={heroRef} className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
				<GradientMesh />

				<motion.div
					className="relative z-10 mx-auto max-w-6xl px-6 pt-20 pb-12 text-center"
					style={{ y: heroY, opacity: heroOpacity }}
				>
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5 }}
					>
						<NeonBadge variant="purple" className="mb-8">
							<Sparkles className="h-3 w-3" />
							AI-Powered Video Editing
						</NeonBadge>
					</motion.div>

					<motion.h1
						className="text-5xl sm:text-6xl lg:text-8xl font-extrabold tracking-tight font-[family-name:var(--font-display)] leading-[0.95]"
						initial={{ opacity: 0, y: 30 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.1 }}
					>
						Edit videos by
						<br />
						<span className="gradient-text">talking to AI</span>
					</motion.h1>

					<motion.p
						className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5, delay: 0.2 }}
					>
						Upload media. Describe your vision. Watch it come to life.
						<br className="hidden sm:block" />
						27 AI tools. Auto-captions. Export everywhere.
					</motion.p>

					<motion.div
						className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5, delay: 0.3 }}
					>
						<Link
							href="/register"
							className="group relative inline-flex items-center gap-2 rounded-full gradient-primary px-8 py-4 text-base font-semibold text-white shadow-[0_0_30px_hsl(262_83%_58%/0.3)] hover:shadow-[0_0_50px_hsl(262_83%_58%/0.5)] transition-all duration-300 hover:brightness-110"
						>
							Start Creating Free
							<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
						</Link>
						<Link
							href="/pricing"
							className="inline-flex items-center gap-2 rounded-full border border-border/40 bg-card/40 backdrop-blur-sm px-8 py-4 text-base font-medium text-foreground hover:bg-card/60 hover:border-primary/30 transition-all duration-300"
						>
							View Pricing
						</Link>
					</motion.div>

					{/* Social proof */}
					<motion.div
						className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ duration: 0.5, delay: 0.5 }}
					>
						<div className="flex -space-x-2">
							{[...Array(5)].map((_, i) => (
								<div key={i} className="w-7 h-7 rounded-full border-2 border-background bg-gradient-to-br from-violet-400 to-fuchsia-500" style={{ opacity: 1 - i * 0.12 }} />
							))}
						</div>
						<span className="ml-2">
							<span className="text-foreground font-semibold">1,200+</span> creators editing with AI
						</span>
						<div className="flex items-center gap-0.5 ml-2 text-amber-400">
							{[...Array(5)].map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}
						</div>
					</motion.div>

					<EditorDemo />
				</motion.div>
			</section>

			{/* ── Stats ──────────────────────────────────────────── */}
			<section className="relative py-16 border-y border-border/20">
				<div className="mx-auto max-w-4xl px-6 grid grid-cols-3 gap-8 text-center">
					{[
						{ val: "27+", label: "AI Tools" },
						{ val: "15+", label: "Import Formats" },
						{ val: "6", label: "Creative Modes" },
					].map((s) => (
						<AnimatedSection key={s.label}>
							<div className="text-4xl font-extrabold font-[family-name:var(--font-display)] gradient-text inline-block">{s.val}</div>
							<div className="text-sm text-muted-foreground mt-1">{s.label}</div>
						</AnimatedSection>
					))}
				</div>
			</section>

			{/* ── Features ───────────────────────────────────────── */}
			<section className="py-28 px-6">
				<div className="mx-auto max-w-6xl">
					<AnimatedSection className="text-center mb-16">
						<p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">Features</p>
						<h2 className="text-4xl sm:text-5xl font-extrabold font-[family-name:var(--font-display)] tracking-tight">
							Everything you need
						</h2>
						<p className="mt-4 text-muted-foreground max-w-lg mx-auto text-lg">
							A complete AI toolkit. No timeline juggling required.
						</p>
					</AnimatedSection>

					<StaggerChildren className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{features.map((f) => (
							<StaggerItem key={f.title}>
								<GlassCard className="p-6 h-full group">
									<div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${f.color} shadow-lg mb-4 group-hover:scale-110 transition-transform duration-300`}>
										<f.icon className="h-5 w-5 text-white" />
									</div>
									<h3 className="text-base font-bold font-[family-name:var(--font-display)] mb-1.5">{f.title}</h3>
									<p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
								</GlassCard>
							</StaggerItem>
						))}
					</StaggerChildren>
				</div>
			</section>

			{/* ── Tools Grid ─────────────────────────────────────── */}
			<section className="py-24 px-6 relative overflow-hidden">
				<div className="absolute inset-0 bg-gradient-to-b from-card/30 via-card/50 to-card/30" />
				<div className="relative mx-auto max-w-5xl">
					<AnimatedSection className="text-center mb-14">
						<p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">Creative Suite</p>
						<h2 className="text-4xl sm:text-5xl font-extrabold font-[family-name:var(--font-display)] tracking-tight">
							6 creative modes
						</h2>
					</AnimatedSection>

					<StaggerChildren className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{tools.map((t) => (
							<StaggerItem key={t.label}>
								<GlassCard className="flex items-center gap-4 p-5 group">
									<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl gradient-primary shadow-lg group-hover:scale-110 transition-transform duration-300">
										<t.icon className="h-5 w-5 text-white" />
									</div>
									<div>
										<h3 className="font-bold font-[family-name:var(--font-display)]">{t.label}</h3>
										<p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
									</div>
								</GlassCard>
							</StaggerItem>
						))}
					</StaggerChildren>
				</div>
			</section>

			{/* ── How It Works ───────────────────────────────────── */}
			<section className="py-28 px-6">
				<div className="mx-auto max-w-4xl">
					<AnimatedSection className="text-center mb-16">
						<p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">How it works</p>
						<h2 className="text-4xl sm:text-5xl font-extrabold font-[family-name:var(--font-display)] tracking-tight">
							Three simple steps
						</h2>
					</AnimatedSection>

					<StaggerChildren className="grid gap-8 sm:grid-cols-3">
						{[
							{ n: "01", icon: Upload, title: "Upload", desc: "Drag & drop your files or attach them in chat." },
							{ n: "02", icon: MessageSquare, title: "Describe", desc: "Tell the AI what you want. It handles the rest." },
							{ n: "03", icon: Download, title: "Export", desc: "One-click render for any platform." },
						].map((step) => (
							<StaggerItem key={step.n}>
								<div className="text-center">
									<div className="mx-auto mb-4 relative">
										<div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary shadow-[0_0_30px_hsl(262_83%_58%/0.2)] mx-auto">
											<step.icon className="h-7 w-7 text-white" />
										</div>
										<span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-background border border-border/40 flex items-center justify-center text-xs font-bold text-primary font-[family-name:var(--font-display)]">{step.n}</span>
									</div>
									<h3 className="text-lg font-bold font-[family-name:var(--font-display)] mb-1">{step.title}</h3>
									<p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
								</div>
							</StaggerItem>
						))}
					</StaggerChildren>
				</div>
			</section>

			{/* ── Pricing ────────────────────────────────────────── */}
			<section className="py-28 px-6 relative overflow-hidden">
				<div className="absolute inset-0 bg-gradient-to-b from-transparent via-card/40 to-transparent" />
				<div className="relative mx-auto max-w-5xl">
					<AnimatedSection className="text-center mb-14">
						<p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">Pricing</p>
						<h2 className="text-4xl sm:text-5xl font-extrabold font-[family-name:var(--font-display)] tracking-tight">
							Simple credits. No subscriptions.
						</h2>
						<p className="mt-4 text-muted-foreground text-lg">Buy credits, use them whenever. They never expire.</p>
					</AnimatedSection>

					<StaggerChildren className="grid gap-5 sm:grid-cols-3">
						{pricingPlans.map((plan) => (
							<StaggerItem key={plan.name}>
								<GlassCard
									className={`relative p-7 h-full flex flex-col ${plan.popular ? "ring-2 ring-primary/40 shadow-[0_0_30px_hsl(262_83%_58%/0.1)]" : ""}`}
									glow={plan.popular}
								>
									{plan.popular && (
										<NeonBadge className="absolute -top-3 left-1/2 -translate-x-1/2">Most Popular</NeonBadge>
									)}
									<h3 className="text-lg font-bold font-[family-name:var(--font-display)]">{plan.name}</h3>
									<div className="mt-3 flex items-baseline gap-1">
										<span className="text-5xl font-extrabold font-[family-name:var(--font-display)]">${plan.price}</span>
									</div>
									<p className="mt-1 text-sm text-muted-foreground">{plan.credits} credits</p>
									<p className="mt-3 text-xs text-muted-foreground leading-relaxed flex-1">{plan.detail}</p>
									<Link
										href="/register"
										className={`mt-6 block w-full rounded-full py-3 text-center text-sm font-semibold transition-all duration-300 ${
											plan.popular
												? "gradient-primary text-white hover:shadow-[0_0_25px_hsl(262_83%_58%/0.3)]"
												: "border border-border/40 text-foreground hover:bg-accent hover:border-primary/30"
										}`}
									>
										Get Started
									</Link>
								</GlassCard>
							</StaggerItem>
						))}
					</StaggerChildren>

					{/* Trust badges */}
					<div className="mt-10 flex items-center justify-center gap-8 text-xs text-muted-foreground">
						<span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" /> No subscription</span>
						<span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" /> Credits never expire</span>
						<span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-primary" /> Cancel anytime</span>
					</div>
				</div>
			</section>

			{/* ── FAQ ────────────────────────────────────────────── */}
			<section className="py-28 px-6">
				<div className="mx-auto max-w-2xl">
					<AnimatedSection className="text-center mb-12">
						<p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">FAQ</p>
						<h2 className="text-4xl sm:text-5xl font-extrabold font-[family-name:var(--font-display)] tracking-tight">
							Questions?
						</h2>
					</AnimatedSection>

					<StaggerChildren className="space-y-3">
						{faqs.map((faq) => (
							<StaggerItem key={faq.q}>
								<FAQItem {...faq} />
							</StaggerItem>
						))}
					</StaggerChildren>
				</div>
			</section>

			{/* ── CTA ────────────────────────────────────────────── */}
			<section className="relative py-32 px-6 overflow-hidden">
				<GradientMesh />
				<AnimatedSection className="relative z-10 mx-auto max-w-2xl text-center">
					<h2 className="text-4xl sm:text-5xl font-extrabold font-[family-name:var(--font-display)] tracking-tight">
						Ready to create?
					</h2>
					<p className="mt-4 text-lg text-muted-foreground">
						Start editing videos with AI today. 10 free credits on signup.
					</p>
					<div className="mt-8">
						<Link
							href="/register"
							className="group inline-flex items-center gap-2 rounded-full gradient-primary px-10 py-4 text-base font-semibold text-white shadow-[0_0_30px_hsl(262_83%_58%/0.3)] hover:shadow-[0_0_50px_hsl(262_83%_58%/0.5)] transition-all duration-300 hover:brightness-110"
						>
							<Zap className="h-5 w-5" />
							Get Started Free
							<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
						</Link>
					</div>
					<div className="mt-8 flex items-center justify-center gap-8 text-sm text-muted-foreground">
						<span className="flex items-center gap-2"><Shield className="h-4 w-4" /> Secure</span>
						<span className="flex items-center gap-2"><Clock className="h-4 w-4" /> No subscription</span>
						<span className="flex items-center gap-2"><Zap className="h-4 w-4" /> Instant setup</span>
					</div>
				</AnimatedSection>
			</section>

			<MarketingFooter />
		</div>
	);
}
