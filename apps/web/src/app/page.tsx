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
} from "lucide-react";
import { useState, useRef } from "react";

/* ── Pain list ────────────────────────────────────────────────── */

const painList = [
	{ hours: "3 hrs", task: "learning Premiere keyboard shortcuts" },
	{ hours: "2 hrs", task: "finding the right transition effect" },
	{ hours: "4 hrs", task: "syncing audio to video manually" },
	{ hours: "2 hrs", task: "adding captions word by word" },
	{ hours: "1 hr",  task: "exporting in the right format for TikTok" },
	{ hours: "3 hrs", task: "color correcting each clip" },
	{ hours: "2 hrs", task: "figuring out why the render failed" },
	{ hours: "\u221E hrs", task: "watching YouTube tutorials..." },
];

/* ── Pricing ──────────────────────────────────────────────────── */

const pricing = [
	{
		name: "Starter", price: 5, subtitle: "100 credits", popular: false,
		features: ["~100 AI edits", "~20 video exports", "Auto-captions", "All import formats", "TikTok/YouTube/IG presets"],
	},
	{
		name: "Pro", price: 20, subtitle: "500 credits", popular: true,
		includesLabel: "Everything in Starter, plus:",
		features: ["~500 AI edits", "~100 video exports", "AI Storyboard", "Background removal", "Priority support"],
	},
	{
		name: "Studio", price: 50, subtitle: "1,500 credits", popular: false,
		includesLabel: "Everything in Pro, plus:",
		features: ["~1,500 AI edits", "~300 video exports", "Team collaboration", "Custom export presets"],
	},
];

/* ── Example prompts ──────────────────────────────────────────── */

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

/* ── FAQ ──────────────────────────────────────────────────────── */

const faqs = [
	{ q: "Do I need editing experience?", a: "No. If you can type a sentence, you can edit video. The AI handles cuts, transitions, timing, effects \u2014 everything." },
	{ q: "How fast is it?", a: "Most edits happen in seconds. A full video that takes 4 hours in Premiere takes about 5 minutes here." },
	{ q: "What if the AI gets it wrong?", a: "Just tell it. \u201CMake the text bigger\u201D or \u201Cundo that.\u201D It\u2019s a conversation. You can edit any previous message to redo from that point." },
	{ q: "What formats are supported?", a: "Import: MP4, MOV, WebM, PSD, LUT, SRT, EDL, Premiere XML, and more. Export: YouTube, TikTok, Instagram, Twitter presets built in." },
	{ q: "How do credits work?", a: "1 credit per AI message, 5 per render. Buy packs, use anytime. Credits never expire. No subscriptions." },
	{ q: "Can I cancel?", a: "Nothing to cancel. You buy credit packs when you need them. No recurring charges." },
];

/* ── Marquee ──────────────────────────────────────────────────── */

const marqueeText = "MP4 \u00B7 MOV \u00B7 WebM \u00B7 PSD \u00B7 LUT \u00B7 SRT \u00B7 EDL \u00B7 XML \u00B7 Lottie \u00B7 ZIP \u00B7 TTF \u00B7 WOFF2";

/* ── Components ───────────────────────────────────────────────── */

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

/* ── Page ─────────────────────────────────────────────────────── */

export default function Home() {
	const heroRef = useRef<HTMLDivElement>(null);
	const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
	const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
	const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

	return (
		<div className="min-h-screen bg-[#08080c] text-white overflow-x-hidden">
			<MarketingNav />

			{/* ════════════════════ HERO ═══════════════════════════ */}
			<section ref={heroRef} className="relative overflow-hidden">
				{/* BG gradient blobs */}
				<div className="absolute inset-0">
					<div className="absolute -top-[30%] -left-[15%] w-[60%] h-[60%] rounded-full bg-violet-600/20 blur-[120px]" />
					<div className="absolute -bottom-[20%] -right-[15%] w-[50%] h-[50%] rounded-full bg-fuchsia-600/15 blur-[120px]" />
					<div className="absolute top-[30%] right-[5%] w-[30%] h-[30%] rounded-full bg-cyan-500/10 blur-[80px]" />
					<div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
				</div>

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
						<span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">in minutes, not hours</span>
					</motion.h1>

					{/* Sub — readable, NOT faded out */}
					<motion.p
						className="mt-6 text-xl sm:text-2xl text-white/80 max-w-2xl mx-auto leading-relaxed font-medium"
						initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}
					>
						Drop your files. Describe the edit. Get a finished video.
						<br className="hidden sm:block" />
						<span className="text-white/50">No timeline. No learning curve. No $50/month software.</span>
					</motion.p>

					{/* CTAs */}
					<motion.div
						className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
						initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }}
					>
						<Link href="/register" className="group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-600 px-8 py-4 text-lg font-bold text-white shadow-[0_0_40px_hsl(262_83%_58%/0.35)] hover:shadow-[0_0_60px_hsl(262_83%_58%/0.5)] transition-all duration-300 hover:scale-[1.02]">
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

			{/* ═══════════ PAIN BREAKDOWN ═════════════════════════ */}
			<section className="py-28 px-6 border-t border-white/[0.05]">
				<div className="mx-auto max-w-3xl">
					<AnimatedSection className="text-center mb-14">
						<h2 className="text-4xl sm:text-5xl font-black font-[family-name:var(--font-display)] tracking-tight text-white">
							Traditional editing is a{" "}
							<span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">time sink</span>
						</h2>
						<p className="mt-4 text-lg text-white/60">Here&apos;s where your hours go. Every. Single. Video.</p>
					</AnimatedSection>

					<StaggerChildren className="space-y-2">
						{painList.map((p) => (
							<StaggerItem key={p.task}>
								<div className="flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-3.5 hover:bg-red-500/[0.04] hover:border-red-500/15 transition-colors">
									<X className="h-4 w-4 text-red-400 shrink-0" />
									<span className="text-[15px] text-white/80 flex-1">{p.task}</span>
									<span className="text-sm font-bold text-red-400 font-mono shrink-0">{p.hours}</span>
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
						<div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] p-6">
							<div className="text-4xl font-black font-[family-name:var(--font-display)] bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">5 minutes. Done.</div>
							<p className="text-base text-white/50 mt-1">&ldquo;Add captions, cut the intro, export for TikTok.&rdquo; That&apos;s the whole edit.</p>
						</div>
					</AnimatedSection>
				</div>
			</section>

			{/* ═══════════ OUTCOMES ════════════════════════════════ */}
			<section className="py-20 px-6">
				<div className="mx-auto max-w-5xl">
					<StaggerChildren className="grid gap-5 sm:grid-cols-3">
						{[
							{ metric: "90%", label: "less time editing", detail: "4 hours \u2192 5 minutes." },
							{ metric: "5x", label: "more output", detail: "More videos = more reach = more growth." },
							{ metric: "$0", label: "software cost", detail: "No Premiere. No After Effects. Just credits." },
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

			{/* ═══════════ HOW IT WORKS ════════════════════════════ */}
			<section className="py-28 px-6 border-t border-white/[0.05]">
				<div className="mx-auto max-w-3xl">
					<AnimatedSection className="text-center mb-14">
						<p className="text-violet-400 font-bold uppercase tracking-widest text-sm mb-3">How it works</p>
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

			{/* ═══════════ WHAT CAN YOU SAY? ══════════════════════ */}
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

			{/* ═══════════ PRICING ═════════════════════════════════ */}
			<section className="py-28 px-6 border-t border-white/[0.05]">
				<div className="mx-auto max-w-4xl">
					<AnimatedSection className="text-center mb-14">
						<p className="text-violet-400 font-bold uppercase tracking-widest text-sm mb-3">Pricing</p>
						<h2 className="text-4xl sm:text-5xl font-black font-[family-name:var(--font-display)] tracking-tight text-white">
							Pay for what you use
						</h2>
						<p className="mt-4 text-lg text-white/60">No subscriptions. No monthly fees. Credits never expire.</p>
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
									<div className="mt-4">
										<span className="text-5xl font-black font-[family-name:var(--font-display)] text-white">${p.price}</span>
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
						<span className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> No subscription</span>
						<span className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Credits never expire</span>
						<span className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Nothing to cancel</span>
					</div>
				</div>
			</section>

			{/* ═══════════ FAQ ═════════════════════════════════════ */}
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

			{/* ═══════════ FINAL CTA ══════════════════════════════ */}
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
						<Link href="/register" className="group inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-600 px-10 py-5 text-lg font-bold text-white shadow-[0_0_40px_hsl(262_83%_58%/0.35)] hover:shadow-[0_0_60px_hsl(262_83%_58%/0.5)] transition-all duration-300 hover:scale-[1.02]">
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

			<MarketingFooter />
		</div>
	);
}
