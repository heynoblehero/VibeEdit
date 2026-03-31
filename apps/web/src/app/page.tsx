"use client";

import Link from "next/link";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { LiveDemo } from "@/components/marketing/live-demo";
import { AnimatedSection } from "@/components/ui/motion/animated-section";
import { GlassCard } from "@/components/ui/motion/glass-card";
import { StaggerChildren, StaggerItem } from "@/components/ui/motion/stagger-children";
import { NeonBadge } from "@/components/ui/motion/neon-badge";
import { motion, useScroll, useTransform } from "motion/react";
import {
	Sparkles, Zap, ChevronDown, ArrowRight, Check,
	Timer, DollarSign, Shield, X, Play,
	MessageSquare, Captions, Wand2, Palette, Share2, Volume2,
} from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { FAQJsonLd } from "@/components/json-ld";
import { Mascot } from "@/components/marketing/mascot";
import { EmojiReaction } from "@/components/marketing/floating-emojis";
import { SparkleCanvas, useConfetti } from "@/components/marketing/particles";
import { DoodleStars, DoodleArrow, DoodleWavy, DoodleBang, DoodleSparkle } from "@/components/marketing/doodles";
import { EditorComparison } from "@/components/marketing/editor-comparison";

/*  Mouse glow hook  */

function useMouseGlow() {
	const [pos, setPos] = useState({ x: 0, y: 0 });
	const handler = useCallback((e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY }), []);
	useEffect(() => {
		window.addEventListener("mousemove", handler);
		return () => window.removeEventListener("mousemove", handler);
	}, [handler]);
	return pos;
}

/*  Hand-drawn underline for hero  */

function ScribbleUnderline() {
	return (
		<svg
			viewBox="0 0 260 8"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			className="absolute left-[5%] right-[5%] -bottom-1 sm:-bottom-2 w-[90%] h-2 sm:h-3 pointer-events-none"
		>
			<motion.path
				d="M1 5.5C32 2 64 3 96 4.5c32 1.5 64 2 96 0s40-2.5 66-1"
				stroke="#a78bfa"
				strokeWidth="2"
				strokeLinecap="round"
				fill="none"
				initial={{ pathLength: 0, opacity: 0 }}
				animate={{ pathLength: 1, opacity: 0.6 }}
				transition={{ duration: 1, delay: 0.8, ease: "easeOut" }}
			/>
		</svg>
	);
}

/*  Pain list  */

const painList = [
	{ hours: "3 hrs", task: "learning Premiere keyboard shortcuts", fixed: "just talk" },
	{ hours: "2 hrs", task: "finding the right transition effect", fixed: "AI picks it" },
	{ hours: "4 hrs", task: "syncing audio to video manually", fixed: "auto-synced" },
	{ hours: "2 hrs", task: "adding captions word by word", fixed: "1 click" },
	{ hours: "1 hr",  task: "exporting in the right format for TikTok", fixed: "auto-export" },
	{ hours: "3 hrs", task: "color correcting each clip", fixed: "AI graded" },
	{ hours: "2 hrs", task: "figuring out why the render failed", fixed: "it won't" },
	{ hours: "\u221E hrs", task: "watching YouTube tutorials...", fixed: "not needed" },
];

/*  Pricing  */

const pricing = [
	{
		name: "Starter", price: 19, period: "/mo", subtitle: "200 credits/month", popular: false,
		features: ["~200 AI edits", "~40 video exports", "Auto-captions", "All formats"],
	},
	{
		name: "Pro", price: 49, period: "/mo", subtitle: "1,000 credits/month", popular: true,
		includesLabel: "Everything in Starter, plus:",
		features: ["~1,000 AI edits", "~200 exports", "AI Storyboard", "Priority support"],
	},
	{
		name: "Studio", price: 99, period: "/mo", subtitle: "3,000 credits/month", popular: false,
		includesLabel: "Everything in Pro, plus:",
		features: ["~3,000 AI edits", "~600 exports", "Team collaboration", "Custom presets"],
	},
];

/*  Example prompts  */

const prompts = [
	"Cut the first 10 seconds",
	"Add bold white captions",
	"Make it vertical for TikTok",
	"Overlay my logo at 2s",
	"Fade transition between clips",
	"Speed up 2x",
	"Add background music",
	"Color grade like a movie",
	"Split into 30s clips",
	"Export at 4K",
];

/*  FAQ  */

const faqs = [
	{ q: "Do I need editing experience?", a: "No. If you can type a sentence, you can edit video. The AI handles cuts, transitions, timing, effects \u2014 everything." },
	{ q: "How fast is it?", a: "Most edits happen in seconds. A full video that takes 4 hours in Premiere takes about 5 minutes here." },
	{ q: "What if the AI gets it wrong?", a: "Just tell it. \u201CMake the text bigger\u201D or \u201Cundo that.\u201D It\u2019s a conversation. You can edit any previous message to redo from that point." },
	{ q: "What formats are supported?", a: "Import: MP4, MOV, WebM, PSD, LUT, SRT, EDL, Premiere XML, and more. Export: YouTube, TikTok, Instagram, Twitter presets built in." },
	{ q: "How do credits work?", a: "1 credit per AI message, 5 per render. Pick a monthly plan and get fresh credits every month. Unused credits roll over." },
	{ q: "Can I cancel?", a: "Yes, cancel anytime from your account. You keep your remaining credits until the end of the billing period. No cancellation fees." },
];

/*  Feature deep-dives  */

const features = [
	{ icon: MessageSquare, title: "AI Chat Editor", desc: "Describe your edit in plain English. The AI handles cuts, transitions, timing, and effects. Undo with a message.", iconBg: "bg-violet-500/10 border-violet-500/20", iconColor: "text-violet-400" },
	{ icon: Captions, title: "Auto Captions", desc: "One command generates perfectly timed captions. Style them, move them, translate them — all by asking.", iconBg: "bg-fuchsia-500/10 border-fuchsia-500/20", iconColor: "text-fuchsia-400" },
	{ icon: Wand2, title: "Smart Cuts", desc: "\"Remove the ums\" — AI detects silence, filler words, and dead air, then cuts them automatically.", iconBg: "bg-pink-500/10 border-pink-500/20", iconColor: "text-pink-400" },
	{ icon: Palette, title: "Color Grading", desc: "\"Make it look cinematic\" applies film-grade color correction. Import LUTs or let the AI match any style.", iconBg: "bg-cyan-500/10 border-cyan-500/20", iconColor: "text-cyan-400" },
	{ icon: Volume2, title: "Audio Sync", desc: "Drop in a music track and the AI syncs cuts to the beat. Automatic volume ducking under voiceover.", iconBg: "bg-emerald-500/10 border-emerald-500/20", iconColor: "text-emerald-400" },
	{ icon: Share2, title: "One-Click Export", desc: "YouTube, TikTok, Instagram, Twitter — each with the right resolution, bitrate, and format. One click.", iconBg: "bg-orange-500/10 border-orange-500/20", iconColor: "text-orange-400" },
];

/*  Comparison  */

const competitors = [
	{ feature: "Learning curve", vibe: "None — just type", premiere: "Months", capcut: "Days", davinci: "Months" },
	{ feature: "AI editing", vibe: "Built-in", premiere: "Limited", capcut: "Basic", davinci: "None" },
	{ feature: "Auto captions", vibe: "One command", premiere: "Plugin needed", capcut: "Yes", davinci: "Manual" },
	{ feature: "Time per video", vibe: "~5 min", premiere: "2-4 hrs", capcut: "30-60 min", davinci: "2-4 hrs" },
	{ feature: "Price", vibe: "From $19/mo", premiere: "$55/mo", capcut: "Free / $8/mo", davinci: "Free / $295" },
	{ feature: "Export presets", vibe: "All platforms", premiere: "Manual setup", capcut: "Limited", davinci: "Manual setup" },
	{ feature: "Runs in browser", vibe: "Yes", premiere: "No", capcut: "Yes", davinci: "No" },
];

/*  Testimonials  */

const testimonials = [
	{ name: "Sarah K.", role: "YouTube Creator, 240K subs", quote: "I used to spend an entire Sunday editing one video. Now I batch-edit five videos on Monday morning before lunch.", avatar: "SK" },
	{ name: "Marcus J.", role: "TikTok Agency Owner", quote: "We replaced a $4K/month editor with VibeEdit. Output went from 8 videos/week to 30. Not even close.", avatar: "MJ" },
	{ name: "Priya M.", role: "Course Creator", quote: "I'm not technical at all. I literally type 'add captions and make it vertical' and it just... does it. Magic.", avatar: "PM" },
	{ name: "Alex R.", role: "Podcast Host", quote: "Cutting a 2-hour podcast into clips used to take my editor a full day. VibeEdit does it in minutes. Insane.", avatar: "AR" },
	{ name: "David L.", role: "Real Estate Agent", quote: "Property tour videos used to cost me $200 each from a freelancer. Now I make them myself in 5 minutes.", avatar: "DL" },
	{ name: "Jenna W.", role: "Social Media Manager", quote: "Managing 6 client accounts means constant content. VibeEdit is the only reason I haven't burned out.", avatar: "JW" },
];

/*  Showcase  */

const showcaseItems = [
	{ label: "YouTube Long-form", time: "4 min edit", gradient: "from-red-500 to-orange-500" },
	{ label: "TikTok Clips", time: "30 sec edit", gradient: "from-cyan-500 to-blue-500" },
	{ label: "Instagram Reels", time: "2 min edit", gradient: "from-fuchsia-500 to-pink-500" },
	{ label: "Podcast Highlights", time: "3 min edit", gradient: "from-violet-500 to-purple-500" },
	{ label: "Course Content", time: "5 min edit", gradient: "from-emerald-500 to-teal-500" },
	{ label: "Product Demos", time: "3 min edit", gradient: "from-amber-500 to-yellow-500" },
];

/*  Marquee  */

const marqueeText = "MP4 \u00B7 MOV \u00B7 WebM \u00B7 PSD \u00B7 LUT \u00B7 SRT \u00B7 EDL \u00B7 XML \u00B7 Lottie \u00B7 ZIP \u00B7 TTF \u00B7 WOFF2";

/*  Components  */

function FAQItem({ q, a }: { q: string; a: string }) {
	const [open, setOpen] = useState(false);
	return (
		<button onClick={() => setOpen(v => !v)} className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] text-left transition-all hover:bg-white/[0.05]">
			<div className="flex items-center justify-between p-5">
				<span className="font-bold font-[family-name:var(--font-display)] text-white text-[15px]">{q}</span>
				<ChevronDown className={`h-4 w-4 text-white/40 shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
			</div>
			<div className="overflow-hidden transition-all duration-300" style={{ maxHeight: open ? "200px" : "0" }}>
				<p className="px-5 pb-5 text-[15px] text-white/60 leading-relaxed">{a}</p>
			</div>
		</button>
	);
}

/*  Page  */

export default function Home() {
	const heroRef = useRef<HTMLDivElement>(null);
	const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
	const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
	const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);
	const mouse = useMouseGlow();
	const confetti = useConfetti();

	return (
		<div className="min-h-screen bg-[#08080c] text-white overflow-x-hidden">
			<FAQJsonLd items={faqs} />
			<MarketingNav />
			<Mascot />

			{/*  HERO  */}
			<section ref={heroRef} className="relative overflow-hidden">
				{/* BG gradient blobs */}
				<div className="absolute inset-0">
					<div className="absolute -top-[30%] -left-[15%] w-[60%] h-[60%] rounded-full bg-violet-600/20 blur-[120px]" />
					<div className="absolute -bottom-[20%] -right-[15%] w-[50%] h-[50%] rounded-full bg-fuchsia-600/15 blur-[120px]" />
					<div className="absolute top-[30%] right-[5%] w-[30%] h-[30%] rounded-full bg-cyan-500/10 blur-[80px]" />
					<div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
				</div>

				{/* Mouse-tracking glow */}
				<div
					className="pointer-events-none fixed inset-0 z-0 transition-opacity duration-300"
					style={{
						background: `radial-gradient(600px circle at ${mouse.x}px ${mouse.y}px, rgba(139,92,246,0.04), transparent 40%)`,
					}}
				/>

				{/* Cursor sparkle trail */}
				<SparkleCanvas />

				<motion.div className="relative z-10 mx-auto max-w-5xl px-6 pt-32 pb-8 text-center" style={{ y: heroY, opacity: heroOpacity }}>
					{/* Badge */}
					<motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
						<NeonBadge variant="purple" className="mb-6">
							<Sparkles className="h-3 w-3" />
							Now in public beta
						</NeonBadge>
					</motion.div>

					{/* Main headline — BIG and BOLD */}
					<motion.h1
						className="text-[3.2rem] sm:text-[4.5rem] lg:text-[6rem] font-black tracking-tight font-[family-name:var(--font-display)] leading-[0.9]"
						initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.05 }}
					>
						Edit videos
						<br />
						<span className="relative inline-block">
							<span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">in minutes, not hours</span>
							<ScribbleUnderline />
						</span>
					</motion.h1>

					{/* Sub — readable, NOT faded out */}
					<motion.p
						className="mt-6 text-xl sm:text-2xl text-white/80 max-w-2xl mx-auto leading-relaxed font-medium"
						initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}
					>
						Drop your files. Describe the edit. Get a finished video.
						<br className="hidden sm:block" />
						<span className="text-white/50">No timeline. No learning curve. No complexity.</span>
					</motion.p>

					{/* CTAs */}
					<motion.div
						className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
						initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}
					>
						<Link href="/register" onClick={(e) => confetti(e.clientX, e.clientY)} className="group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-600 px-8 py-4 text-lg font-bold text-white shadow-[0_0_40px_hsl(262_83%_58%/0.35)] hover:shadow-[0_0_60px_hsl(262_83%_58%/0.5)] transition-all duration-300 hover:scale-[1.02]">
							Get VibeEdit — it&apos;s free
							<ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
						</Link>
						<a href="#demo" className="inline-flex items-center gap-2 rounded-full border border-white/15 px-7 py-4 text-lg font-semibold text-white/80 hover:bg-white/5 hover:text-white transition-all duration-200">
							<Play className="h-5 w-5" />
							See how it works
						</a>
					</motion.div>

					{/* Formats marquee */}
					<motion.div className="mt-10 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
						<div className="flex whitespace-nowrap animate-[marquee_25s_linear_infinite]">
							<span className="text-sm text-white/25 tracking-[0.2em] mx-10 font-medium">{marqueeText}</span>
							<span className="text-sm text-white/25 tracking-[0.2em] mx-10 font-medium">{marqueeText}</span>
							<span className="text-sm text-white/25 tracking-[0.2em] mx-10 font-medium">{marqueeText}</span>
						</div>
					</motion.div>

					{/* LIVE DEMO — the actual product running */}
					<div id="demo" className="mt-6">
						<LiveDemo />
					</div>
				</motion.div>
			</section>

			{/*  EDITOR COMPARISON — stressed vs chill  */}
			<section className="py-20 border-t border-white/[0.05]">
				<AnimatedSection>
					<EditorComparison />
				</AnimatedSection>
			</section>

			{/*  PAIN BREAKDOWN  */}
			<section className="py-28 px-6">
				<div className="mx-auto max-w-3xl">
					<AnimatedSection className="text-center mb-14">
						<h2 className="text-4xl sm:text-5xl font-black font-[family-name:var(--font-display)] tracking-tight text-white">
							Traditional editing is a{" "}
							<span className="relative inline-block">
								<span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">time sink</span>
								<DoodleWavy className="absolute -bottom-1 left-0 w-full h-2" />
							</span>
						</h2>
						<p className="mt-4 text-lg text-white/60">Here&apos;s where your hours go. Every. Single. Video.</p>
					</AnimatedSection>

					<StaggerChildren className="space-y-2">
						{painList.map((p) => (
							<StaggerItem key={p.task}>
								<div className="group flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-3.5 hover:scale-[1.03] hover:bg-emerald-500/[0.08] hover:border-emerald-500/25 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-200 cursor-default">
									<X className="h-4 w-4 text-red-400 shrink-0 group-hover:hidden" />
									<Check className="h-4 w-4 text-emerald-400 shrink-0 hidden group-hover:block" />
									<span className="text-[15px] text-white/80 flex-1 group-hover:line-through group-hover:text-white/40 transition-colors">{p.task}</span>
									<span className="text-sm font-bold font-mono shrink-0 text-red-400 group-hover:text-emerald-400 transition-colors">
										<span className="group-hover:hidden">{p.hours}</span>
										<span className="hidden group-hover:inline">{p.fixed}</span>
									</span>
								</div>
							</StaggerItem>
						))}
					</StaggerChildren>

					{/* Total */}
					<AnimatedSection delay={0.2} className="mt-6 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-6 text-center">
						<div className="text-4xl font-black font-[family-name:var(--font-display)] text-red-400">17+ hours of headaches</div>
						<p className="text-base text-white/50 mt-1">...per video. Every single time.</p>
					</AnimatedSection>

					{/* The flip */}
					<AnimatedSection delay={0.3} className="mt-8 text-center">
						<p className="text-white/40 mb-4 font-medium">With VibeEdit:</p>
						<a href="#pricing" className="group relative block rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-6 hover:scale-[1.03] hover:bg-emerald-500/[0.12] hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/15 transition-all duration-200 cursor-pointer">
							<DoodleArrow className="absolute -top-9 -left-10 w-10 h-10 hidden sm:block" />
							<div className="text-4xl font-black font-[family-name:var(--font-display)] bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">5 minutes. Done.</div>
							<p className="text-base text-white/50 mt-1 group-hover:text-white/70 transition-colors">&ldquo;Add captions, cut the intro, export for TikTok.&rdquo; That&apos;s the whole edit.</p>
							<span className="inline-block mt-3 px-5 py-2 rounded-full bg-emerald-500/20 text-emerald-400 text-sm font-bold opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200">Try VibeEdit free →</span>
						</a>
					</AnimatedSection>
				</div>
			</section>

			{/*  OUTCOMES  */}
			<section className="py-20 px-6">
				<div className="mx-auto max-w-5xl relative">
					<DoodleBang className="absolute -top-4 -left-8 w-6 h-10 hidden lg:block" />
					<EmojiReaction emojis={[{ emoji: "\ud83d\ude80", delay: 0.3, x: 8, side: "right" }]} className="absolute -top-2 right-0 hidden sm:block" />
					<StaggerChildren className="grid gap-5 sm:grid-cols-3">
						{[
							{ metric: "90%", label: "less time editing", detail: "4 hours \u2192 5 minutes." },
							{ metric: "5x", label: "more output", detail: "More videos = more reach = more growth." },
							{ metric: "80%", label: "cheaper than Premiere", detail: "No $55/mo Adobe tax. Everything in one tool." },
						].map((o) => (
							<StaggerItem key={o.label}>
								<div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
									<div className="text-5xl font-black font-[family-name:var(--font-display)] bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">{o.metric}</div>
									<p className="text-base font-bold text-white mt-3">{o.label}</p>
									<p className="text-sm text-white/50 mt-1">{o.detail}</p>
								</div>
							</StaggerItem>
						))}
					</StaggerChildren>
				</div>
			</section>

			{/*  HOW IT WORKS  */}
			<section className="py-28 px-6 border-t border-white/[0.05]">
				<div className="mx-auto max-w-3xl">
					<AnimatedSection className="text-center mb-14">
						<div className="relative inline-block">
							<p className="text-violet-400 font-bold uppercase tracking-widest text-sm mb-3">How it works</p>
							<DoodleStars className="absolute -top-2 -right-16 w-16 h-8 hidden sm:block" />
						</div>
						<h2 className="text-4xl sm:text-5xl font-black font-[family-name:var(--font-display)] tracking-tight text-white">
							Three steps. That&apos;s it.
						</h2>
					</AnimatedSection>

					<StaggerChildren className="space-y-4">
						{[
							{ n: "1", t: "Drop your files in", d: "Videos, images, audio \u2014 any format. Just drag them into the chat." },
							{ n: "2", t: "Tell the AI what to do", d: "\u201CCut the boring intro, add captions, overlay my logo, export for TikTok.\u201D" },
							{ n: "3", t: "Download your video", d: "One click. YouTube, TikTok, Instagram, Twitter \u2014 every format built in." },
						].map((s) => (
							<StaggerItem key={s.n}>
								<div className="flex items-start gap-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
									<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-lg font-black font-[family-name:var(--font-display)]">{s.n}</div>
									<div>
										<h3 className="text-lg font-bold font-[family-name:var(--font-display)] text-white">{s.t}</h3>
										<p className="text-[15px] text-white/60 mt-1 leading-relaxed">{s.d}</p>
									</div>
								</div>
							</StaggerItem>
						))}
					</StaggerChildren>
				</div>
			</section>

			{/*  FEATURE DEEP-DIVES  */}
			<section className="py-28 px-6">
				<div className="mx-auto max-w-5xl">
					<AnimatedSection className="text-center mb-14">
						<p className="text-violet-400 font-bold uppercase tracking-widest text-sm mb-3">Features</p>
						<h2 className="text-4xl sm:text-5xl font-black font-[family-name:var(--font-display)] tracking-tight text-white">
							Everything you need,{" "}
							<span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">nothing you don&apos;t</span>
						</h2>
						<p className="mt-4 text-lg text-white/60 max-w-2xl mx-auto">No plugins. No add-ons. No third-party tools. Every feature works through the same chat interface.</p>
					</AnimatedSection>

					<StaggerChildren className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
						{features.map((f) => (
							<StaggerItem key={f.title}>
								<GlassCard className="p-6 h-full border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05] transition-colors group">
									<div className={`flex h-11 w-11 items-center justify-center rounded-xl border ${f.iconBg} mb-4`}>
										<f.icon className={`h-5 w-5 ${f.iconColor}`} />
									</div>
									<h3 className="text-lg font-bold font-[family-name:var(--font-display)] text-white">{f.title}</h3>
									<p className="text-[15px] text-white/60 mt-2 leading-relaxed">{f.desc}</p>
								</GlassCard>
							</StaggerItem>
						))}
					</StaggerChildren>
				</div>
			</section>

			{/*  WHAT CAN YOU SAY?  */}
			<section className="py-20 px-6">
				<div className="mx-auto max-w-4xl">
					<AnimatedSection className="text-center mb-10">
						<h2 className="text-3xl sm:text-4xl font-black font-[family-name:var(--font-display)] tracking-tight text-white">
							Just say what you want
						</h2>
						<p className="mt-3 text-lg text-white/60">Real commands. Real results.</p>
					</AnimatedSection>

					<StaggerChildren className="flex flex-wrap justify-center gap-2.5">
						{prompts.map((p) => (
							<StaggerItem key={p}>
								<div className="rounded-full border border-white/[0.08] bg-white/[0.03] px-5 py-2.5 text-sm text-white/70 hover:text-white hover:border-violet-500/40 hover:bg-violet-500/[0.06] transition-all duration-200 cursor-default font-medium">
									&ldquo;{p}&rdquo;
								</div>
							</StaggerItem>
						))}
					</StaggerChildren>
				</div>
			</section>

			{/*  VIDEO SHOWCASE  */}
			<section className="py-28 px-6 border-t border-white/[0.05]">
				<div className="mx-auto max-w-5xl">
					<AnimatedSection className="text-center mb-14">
						<p className="text-violet-400 font-bold uppercase tracking-widest text-sm mb-3">Showcase</p>
						<h2 className="text-4xl sm:text-5xl font-black font-[family-name:var(--font-display)] tracking-tight text-white">
							Made with VibeEdit
						</h2>
						<p className="mt-4 text-lg text-white/60">From raw footage to finished video — in minutes, not hours.</p>
					</AnimatedSection>

					<StaggerChildren className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{showcaseItems.map((item) => (
							<StaggerItem key={item.label}>
								<div className="group relative rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden hover:border-white/[0.15] transition-all cursor-pointer">
									{/* Video placeholder */}
									<div className={`aspect-video bg-gradient-to-br ${item.gradient} opacity-10 group-hover:opacity-20 transition-opacity`} />
									<div className="absolute inset-0 flex items-center justify-center">
										<div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm border border-white/20 group-hover:scale-110 transition-transform">
											<Play className="h-6 w-6 text-white ml-0.5" />
										</div>
									</div>
									<div className="p-4">
										<h3 className="font-bold font-[family-name:var(--font-display)] text-white">{item.label}</h3>
										<p className="text-sm text-white/50 mt-0.5">{item.time}</p>
									</div>
								</div>
							</StaggerItem>
						))}
					</StaggerChildren>
				</div>
			</section>

			{/*  COMPARISON TABLE  */}
			<section className="py-28 px-6">
				<div className="mx-auto max-w-4xl">
					<AnimatedSection className="text-center mb-14">
						<p className="text-violet-400 font-bold uppercase tracking-widest text-sm mb-3">Compare</p>
						<h2 className="text-4xl sm:text-5xl font-black font-[family-name:var(--font-display)] tracking-tight text-white">
							VibeEdit vs the old way
						</h2>
						<p className="mt-4 text-lg text-white/60">See how we stack up against traditional editors.</p>
					</AnimatedSection>

					<AnimatedSection>
						<div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
							{/* Header */}
							<div className="grid grid-cols-5 gap-px bg-white/[0.05] border-b border-white/[0.08]">
								<div className="p-4" />
								<div className="p-4 text-center">
									<span className="text-sm font-bold font-[family-name:var(--font-display)] bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">VibeEdit</span>
								</div>
								<div className="p-4 text-center"><span className="text-sm font-bold text-white/50">Premiere</span></div>
								<div className="p-4 text-center"><span className="text-sm font-bold text-white/50">CapCut</span></div>
								<div className="p-4 text-center"><span className="text-sm font-bold text-white/50">DaVinci</span></div>
							</div>
							{/* Rows */}
							{competitors.map((row, i) => (
								<div key={row.feature} className={`grid grid-cols-5 gap-px ${i < competitors.length - 1 ? "border-b border-white/[0.05]" : ""}`}>
									<div className="p-4 text-sm text-white/70 font-medium">{row.feature}</div>
									<div className="p-4 text-center text-sm text-emerald-400 font-semibold">{row.vibe}</div>
									<div className="p-4 text-center text-sm text-white/40">{row.premiere}</div>
									<div className="p-4 text-center text-sm text-white/40">{row.capcut}</div>
									<div className="p-4 text-center text-sm text-white/40">{row.davinci}</div>
								</div>
							))}
						</div>
					</AnimatedSection>
				</div>
			</section>

			{/*  PRICING  */}
			<section className="py-28 px-6 border-t border-white/[0.05]">
				<div className="mx-auto max-w-4xl">
					<AnimatedSection className="text-center mb-14">
						<p className="text-violet-400 font-bold uppercase tracking-widest text-sm mb-3">Pricing</p>
						<h2 className="text-4xl sm:text-5xl font-black font-[family-name:var(--font-display)] tracking-tight text-white">
							Pay for what you use
						</h2>
						<p className="mt-4 text-lg text-white/60">Simple monthly plans. Credits refresh every month. Cancel anytime.</p>
					</AnimatedSection>

					<StaggerChildren className="grid gap-5 sm:grid-cols-3">
						{pricing.map((p) => (
							<StaggerItem key={p.name}>
								<GlassCard
									className={`relative p-7 h-full flex flex-col border-white/[0.08] bg-white/[0.03] ${p.popular ? "ring-2 ring-violet-500/50 shadow-[0_0_40px_hsl(262_83%_58%/0.12)] bg-white/[0.05]" : ""}`}
									glow={p.popular}
								>
									{p.popular && <NeonBadge className="absolute -top-3 left-1/2 -translate-x-1/2">Most Popular</NeonBadge>}
									<h3 className="text-xl font-black font-[family-name:var(--font-display)] text-white">{p.name}</h3>
									<p className="text-sm text-white/50 mt-1">{p.subtitle}</p>
									<div className="mt-4 flex items-baseline gap-1">
										<span className="text-5xl font-black font-[family-name:var(--font-display)] text-white">${p.price}</span>
										<span className="text-lg text-white/30 font-medium">{p.period}</span>
									</div>

									{/* Features */}
									<div className="mt-5 space-y-2.5 flex-1">
										{p.includesLabel && <p className="text-xs text-white/40 font-medium">{p.includesLabel}</p>}
										{p.features.map((f) => (
											<div key={f} className="flex items-center gap-2.5">
												<Check className="h-4 w-4 text-emerald-400 shrink-0" />
												<span className="text-sm text-white/70">{f}</span>
											</div>
										))}
									</div>

									<Link href="/register" className={`mt-6 block w-full rounded-full py-3.5 text-center text-sm font-bold transition-all duration-300 ${p.popular ? "bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white hover:shadow-[0_0_25px_hsl(262_83%_58%/0.3)] hover:scale-[1.02]" : "border border-white/15 text-white hover:bg-white/5"}`}>
										Get VibeEdit
									</Link>
								</GlassCard>
							</StaggerItem>
						))}
					</StaggerChildren>

					<div className="mt-10 flex items-center justify-center gap-8 text-sm text-white/40 font-medium">
						<span className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Cancel anytime</span>
						<span className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Credits never expire</span>
						<span className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Nothing to cancel</span>
					</div>
				</div>
			</section>

			{/*  TESTIMONIALS  */}
			<section className="py-28 px-6">
				<div className="mx-auto max-w-5xl">
					<AnimatedSection className="text-center mb-14 relative">
						<p className="text-violet-400 font-bold uppercase tracking-widest text-sm mb-3">Testimonials</p>
						<h2 className="text-4xl sm:text-5xl font-black font-[family-name:var(--font-display)] tracking-tight text-white relative inline-block">
							Creators love VibeEdit
							<DoodleSparkle className="absolute -top-4 -right-8 w-6 h-6 hidden sm:block" />
						</h2>
						<p className="mt-4 text-lg text-white/60">Don&apos;t take our word for it.</p>
						<EmojiReaction
							emojis={[
								{ emoji: "\ud83d\udd25", delay: 0.2, x: 16, side: "left" },
								{ emoji: "\u2764\ufe0f", delay: 0.6, x: 16, side: "right" },
							]}
							className="absolute inset-0 hidden sm:block"
						/>
					</AnimatedSection>

					<StaggerChildren className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
						{testimonials.map((t) => (
							<StaggerItem key={t.name}>
								<GlassCard className="p-6 h-full border-white/[0.08] bg-white/[0.03] flex flex-col">
									<p className="text-[15px] text-white/70 leading-relaxed flex-1">&ldquo;{t.quote}&rdquo;</p>
									<div className="flex items-center gap-3 mt-5 pt-5 border-t border-white/[0.06]">
										<div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-xs font-bold text-white">{t.avatar}</div>
										<div>
											<p className="text-sm font-bold text-white">{t.name}</p>
											<p className="text-xs text-white/40">{t.role}</p>
										</div>
									</div>
								</GlassCard>
							</StaggerItem>
						))}
					</StaggerChildren>
				</div>
			</section>

			{/*  FAQ  */}
			<section className="py-28 px-6">
				<div className="mx-auto max-w-2xl">
					<AnimatedSection className="text-center mb-12">
						<h2 className="text-4xl font-black font-[family-name:var(--font-display)] tracking-tight text-white">Frequently asked</h2>
					</AnimatedSection>
					<StaggerChildren className="space-y-3">
						{faqs.map((f) => <StaggerItem key={f.q}><FAQItem {...f} /></StaggerItem>)}
					</StaggerChildren>
				</div>
			</section>

			{/*  FINAL CTA  */}
			<section className="relative py-32 px-6 overflow-hidden">
				<div className="absolute inset-0">
					<div className="absolute -top-[30%] left-[10%] w-[50%] h-[50%] rounded-full bg-violet-600/15 blur-[100px]" />
					<div className="absolute -bottom-[20%] right-[10%] w-[40%] h-[40%] rounded-full bg-fuchsia-600/10 blur-[100px]" />
				</div>
				<AnimatedSection className="relative z-10 mx-auto max-w-2xl text-center">
					<h2 className="text-4xl sm:text-5xl font-black font-[family-name:var(--font-display)] tracking-tight text-white">
						Stop wasting weekends editing
					</h2>
					<p className="mt-4 text-xl text-white/60 font-medium">10 free credits. No card required. Start in 30 seconds.</p>
					<div className="mt-8">
						<Link href="/register" onClick={(e) => confetti(e.clientX, e.clientY)} className="group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-600 px-10 py-5 text-lg font-bold text-white shadow-[0_0_40px_hsl(262_83%_58%/0.35)] hover:shadow-[0_0_60px_hsl(262_83%_58%/0.5)] transition-all duration-300 hover:scale-[1.02]">
							<Zap className="h-5 w-5" />
							Get VibeEdit — it&apos;s free
							<ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
						</Link>
					</div>
					<div className="mt-8 flex items-center justify-center gap-8 text-sm text-white/40 font-medium">
						<span className="flex items-center gap-2"><Timer className="h-4 w-4" /> 30 sec signup</span>
						<span className="flex items-center gap-2"><Shield className="h-4 w-4" /> No card needed</span>
						<span className="flex items-center gap-2"><DollarSign className="h-4 w-4" /> 10 free credits</span>
					</div>
				</AnimatedSection>
			</section>

			{/*  BUILT BY HUMANS  */}
			<section className="py-16 px-6 border-t border-white/[0.05]">
				<div className="mx-auto max-w-md text-center">
					<p className="text-white/30 text-sm leading-relaxed">
						Built with too much coffee and not enough sleep by a human who
						got tired of watching progress bars in Premiere.
						<br />
						<span className="text-white/20 italic">No templates were harmed in the making of this page.</span>
					</p>
				</div>
			</section>

			<MarketingFooter />
		</div>
	);
}
