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
	Sparkles, Zap, Shield, Clock, ChevronDown,
	ArrowRight, Star, Check, Timer, DollarSign, BrainCircuit,
} from "lucide-react";
import { useState, useRef } from "react";

/* ── Data ───────────────────────────────────────────────────────── */

const painPoints = [
	{
		before: "4 hours",
		after: "4 minutes",
		label: "Average edit time",
		detail: "No more dragging clips on a timeline. Just say what you want.",
	},
	{
		before: "$300/mo",
		after: "$20/mo",
		label: "Software cost",
		detail: "No Premiere subscription. No After Effects. Just credits you use.",
	},
	{
		before: "Weeks",
		after: "Today",
		label: "Time to learn",
		detail: "If you can describe what you want, you can edit video.",
	},
];

const testimonials = [
	{ name: "Sarah K.", role: "YouTuber", text: "I used to spend my entire Sunday editing. Now I describe what I want and it's done in minutes.", avatar: "S" },
	{ name: "Marcus T.", role: "Content Creator", text: "Went from zero editing skills to publishing 5 videos a week. This thing is magic.", avatar: "M" },
	{ name: "Priya R.", role: "Marketing Lead", text: "Our team cut video production costs by 80%. The AI handles what used to take a whole editor.", avatar: "P" },
];

const howItWorks = [
	{ step: "01", title: "Drop your files in", desc: "Drag videos, images, audio — any format. VibeEdit handles the rest." },
	{ step: "02", title: "Tell AI what to do", desc: "\"Cut the boring intro, add captions, make it vertical for TikTok.\" Done." },
	{ step: "03", title: "Export and post", desc: "One click. YouTube, TikTok, Instagram, Twitter — all formats, all sizes." },
];

const pricing = [
	{ name: "Starter", price: 5, credits: 100, desc: "For trying it out", popular: false },
	{ name: "Pro", price: 20, credits: 500, desc: "For regular creators", popular: true },
	{ name: "Studio", price: 50, credits: 1500, desc: "For teams & agencies", popular: false },
];

const faqs = [
	{ q: "Do I need editing experience?", a: "No. If you can type a sentence, you can edit video. The AI handles all the technical work — cuts, transitions, timing, effects." },
	{ q: "How fast is it really?", a: "Most edits happen in seconds. A full video that would take 4 hours in Premiere takes about 5 minutes with VibeEdit." },
	{ q: "What if the AI gets it wrong?", a: "Just tell it. \"Make the text bigger\" or \"undo that\". It's a conversation, not a one-shot." },
	{ q: "What formats do you support?", a: "Import: MP4, MOV, WebM, PSD, LUT, SRT, EDL, Premiere XML, and more. Export: every major platform preset." },
	{ q: "How do credits work?", a: "Each AI action costs credits. Buy packs, use at your pace. Credits never expire. No subscriptions." },
];

/* ── Components ─────────────────────────────────────────────────── */

function FAQItem({ q, a }: { q: string; a: string }) {
	const [open, setOpen] = useState(false);
	return (
		<button onClick={() => setOpen((v) => !v)} className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.02] text-left transition-all duration-200 hover:bg-white/[0.04] hover:border-white/[0.1]">
			<div className="flex items-center justify-between p-5">
				<span className="font-semibold font-[family-name:var(--font-display)] text-white/90 pr-4">{q}</span>
				<ChevronDown className={`h-4 w-4 text-white/30 shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
			</div>
			<div className="overflow-hidden transition-all duration-300" style={{ maxHeight: open ? "200px" : "0px" }}>
				<p className="px-5 pb-5 text-sm text-white/50 leading-relaxed">{a}</p>
			</div>
		</button>
	);
}

function GradientMesh() {
	return (
		<div className="absolute inset-0 overflow-hidden">
			<div className="absolute -top-[40%] -left-[20%] w-[70%] h-[70%] rounded-full bg-gradient-to-br from-violet-600/20 via-purple-600/10 to-transparent blur-[100px] animate-[float_20s_ease-in-out_infinite]" />
			<div className="absolute -bottom-[30%] -right-[20%] w-[60%] h-[60%] rounded-full bg-gradient-to-tl from-fuchsia-600/15 via-pink-600/8 to-transparent blur-[100px] animate-[float_25s_ease-in-out_infinite_reverse]" />
			<div className="absolute top-[20%] right-[10%] w-[40%] h-[40%] rounded-full bg-gradient-to-bl from-cyan-500/10 via-blue-500/5 to-transparent blur-[80px] animate-[float_18s_ease-in-out_infinite_2s]" />
			<div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:60px_60px] [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
		</div>
	);
}

/* ── Page ────────────────────────────────────────────────────────── */

export default function Home() {
	const heroRef = useRef<HTMLDivElement>(null);
	const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
	const heroY = useTransform(scrollYProgress, [0, 1], ["0%", "30%"]);
	const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

	return (
		<div className="min-h-screen bg-[#08080c] text-white overflow-x-hidden">
			<MarketingNav />

			{/* ── Hero ────────────────────────────────────────────── */}
			<section ref={heroRef} className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
				<GradientMesh />

				<motion.div className="relative z-10 mx-auto max-w-6xl px-6 pt-24 pb-8 text-center" style={{ y: heroY, opacity: heroOpacity }}>
					<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
						<NeonBadge variant="purple" className="mb-8">
							<Sparkles className="h-3 w-3" />
							Stop editing. Start describing.
						</NeonBadge>
					</motion.div>

					<motion.h1
						className="text-5xl sm:text-6xl lg:text-[5.5rem] font-extrabold tracking-tight font-[family-name:var(--font-display)] leading-[0.95]"
						initial={{ opacity: 0, y: 30 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.6, delay: 0.1 }}
					>
						Video editing that
						<br />
						<span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">takes minutes, not hours</span>
					</motion.h1>

					<motion.p
						className="mt-6 text-lg sm:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5, delay: 0.2 }}
					>
						Drop your files. Tell the AI what you want. Get a finished video.
						<br className="hidden sm:block" />
						No timeline. No learning curve. No wasted weekends.
					</motion.p>

					<motion.div
						className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.5, delay: 0.3 }}
					>
						<Link
							href="/register"
							className="group relative inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-600 px-8 py-4 text-base font-semibold text-white shadow-[0_0_30px_hsl(262_83%_58%/0.3)] hover:shadow-[0_0_50px_hsl(262_83%_58%/0.5)] transition-all duration-300"
						>
							Try it free
							<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
						</Link>
						<a
							href="#demo"
							className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-8 py-4 text-base font-medium text-white/70 hover:text-white hover:bg-white/[0.06] transition-all duration-300"
						>
							Watch it work
						</a>
					</motion.div>

					{/* Social proof */}
					<motion.div
						className="mt-10 flex items-center justify-center gap-3 text-sm text-white/40"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						transition={{ delay: 0.5 }}
					>
						<div className="flex -space-x-2">
							{["S", "M", "P", "A", "J"].map((l, i) => (
								<div key={l} className="w-7 h-7 rounded-full border-2 border-[#08080c] bg-gradient-to-br from-violet-400 to-fuchsia-500 flex items-center justify-center text-[9px] font-bold text-white" style={{ opacity: 1 - i * 0.1 }}>{l}</div>
							))}
						</div>
						<span>Loved by <span className="text-white/70 font-medium">1,200+</span> creators</span>
						<div className="flex items-center gap-0.5 text-amber-400">
							{[...Array(5)].map((_, i) => <Star key={i} className="h-3 w-3 fill-current" />)}
						</div>
					</motion.div>

					{/* ── LIVE DEMO ──────────────────────────────── */}
					<div id="demo">
						<LiveDemo />
					</div>
				</motion.div>
			</section>

			{/* ── Pain → Solution ─────────────────────────────────── */}
			<section className="py-24 px-6 border-t border-white/[0.04]">
				<div className="mx-auto max-w-5xl">
					<AnimatedSection className="text-center mb-16">
						<p className="text-violet-400 text-sm font-semibold uppercase tracking-wider mb-3">The problem</p>
						<h2 className="text-4xl sm:text-5xl font-extrabold font-[family-name:var(--font-display)] tracking-tight">
							Video editing is <span className="text-white/30 line-through">broken</span> <span className="bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">fixed</span>
						</h2>
					</AnimatedSection>

					<StaggerChildren className="grid gap-6 sm:grid-cols-3">
						{painPoints.map((p) => (
							<StaggerItem key={p.label}>
								<GlassCard className="p-6 text-center h-full border-white/[0.06] bg-white/[0.02]">
									<div className="flex items-center justify-center gap-3 mb-4">
										<span className="text-2xl font-bold text-white/25 line-through">{p.before}</span>
										<ArrowRight className="h-4 w-4 text-violet-400" />
										<span className="text-2xl font-extrabold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">{p.after}</span>
									</div>
									<p className="text-sm font-semibold text-white/70 mb-1">{p.label}</p>
									<p className="text-xs text-white/40 leading-relaxed">{p.detail}</p>
								</GlassCard>
							</StaggerItem>
						))}
					</StaggerChildren>
				</div>
			</section>

			{/* ── How It Works ────────────────────────────────────── */}
			<section className="py-24 px-6">
				<div className="mx-auto max-w-4xl">
					<AnimatedSection className="text-center mb-16">
						<p className="text-violet-400 text-sm font-semibold uppercase tracking-wider mb-3">How it works</p>
						<h2 className="text-4xl sm:text-5xl font-extrabold font-[family-name:var(--font-display)] tracking-tight">
							Stupidly simple
						</h2>
					</AnimatedSection>

					<StaggerChildren className="space-y-6">
						{howItWorks.map((s, i) => (
							<StaggerItem key={s.step}>
								<div className="flex items-start gap-6 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 hover:bg-white/[0.04] transition-colors">
									<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-lg font-extrabold font-[family-name:var(--font-display)]">
										{s.step}
									</div>
									<div>
										<h3 className="text-lg font-bold font-[family-name:var(--font-display)]">{s.title}</h3>
										<p className="text-sm text-white/45 mt-1 leading-relaxed">{s.desc}</p>
									</div>
								</div>
							</StaggerItem>
						))}
					</StaggerChildren>
				</div>
			</section>

			{/* ── Testimonials ────────────────────────────────────── */}
			<section className="py-24 px-6 border-t border-white/[0.04]">
				<div className="mx-auto max-w-5xl">
					<AnimatedSection className="text-center mb-14">
						<p className="text-violet-400 text-sm font-semibold uppercase tracking-wider mb-3">Real results</p>
						<h2 className="text-4xl sm:text-5xl font-extrabold font-[family-name:var(--font-display)] tracking-tight">
							Creators love it
						</h2>
					</AnimatedSection>

					<StaggerChildren className="grid gap-5 sm:grid-cols-3">
						{testimonials.map((t) => (
							<StaggerItem key={t.name}>
								<GlassCard className="p-6 h-full border-white/[0.06] bg-white/[0.02]" hover={false}>
									<div className="flex items-center gap-0.5 mb-4 text-amber-400">
										{[...Array(5)].map((_, i) => <Star key={i} className="h-3 w-3 fill-current" />)}
									</div>
									<p className="text-sm text-white/60 leading-relaxed mb-4">&ldquo;{t.text}&rdquo;</p>
									<div className="flex items-center gap-3 pt-3 border-t border-white/[0.06]">
										<div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 flex items-center justify-center text-xs font-bold">{t.avatar}</div>
										<div>
											<div className="text-xs font-semibold text-white/80">{t.name}</div>
											<div className="text-[10px] text-white/30">{t.role}</div>
										</div>
									</div>
								</GlassCard>
							</StaggerItem>
						))}
					</StaggerChildren>
				</div>
			</section>

			{/* ── Pricing ─────────────────────────────────────────── */}
			<section className="py-24 px-6">
				<div className="mx-auto max-w-4xl">
					<AnimatedSection className="text-center mb-14">
						<p className="text-violet-400 text-sm font-semibold uppercase tracking-wider mb-3">Pricing</p>
						<h2 className="text-4xl sm:text-5xl font-extrabold font-[family-name:var(--font-display)] tracking-tight">
							Pay for what you use
						</h2>
						<p className="mt-3 text-white/40">No subscriptions. Credits never expire.</p>
					</AnimatedSection>

					<StaggerChildren className="grid gap-5 sm:grid-cols-3">
						{pricing.map((p) => (
							<StaggerItem key={p.name}>
								<GlassCard
									className={`relative p-7 h-full flex flex-col border-white/[0.06] bg-white/[0.02] ${p.popular ? "ring-1 ring-violet-500/40 shadow-[0_0_30px_hsl(262_83%_58%/0.08)]" : ""}`}
									glow={p.popular}
								>
									{p.popular && <NeonBadge className="absolute -top-3 left-1/2 -translate-x-1/2">Most Popular</NeonBadge>}
									<h3 className="text-lg font-bold font-[family-name:var(--font-display)]">{p.name}</h3>
									<p className="text-xs text-white/35 mt-1">{p.desc}</p>
									<div className="mt-4 flex items-baseline gap-1">
										<span className="text-4xl font-extrabold font-[family-name:var(--font-display)]">${p.price}</span>
									</div>
									<p className="text-xs text-white/35 mt-1">{p.credits} credits</p>
									<Link
										href="/register"
										className={`mt-6 block w-full rounded-full py-3 text-center text-sm font-semibold transition-all duration-300 ${
											p.popular
												? "bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white hover:shadow-[0_0_25px_hsl(262_83%_58%/0.3)]"
												: "border border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
										}`}
									>
										Get Started
									</Link>
								</GlassCard>
							</StaggerItem>
						))}
					</StaggerChildren>

					<div className="mt-8 flex items-center justify-center gap-8 text-xs text-white/30">
						<span className="flex items-center gap-1.5"><Check className="h-3 w-3 text-violet-400" /> No subscription</span>
						<span className="flex items-center gap-1.5"><Check className="h-3 w-3 text-violet-400" /> Credits never expire</span>
						<span className="flex items-center gap-1.5"><Check className="h-3 w-3 text-violet-400" /> Cancel anytime</span>
					</div>
				</div>
			</section>

			{/* ── FAQ ──────────────────────────────────────────────── */}
			<section className="py-24 px-6 border-t border-white/[0.04]">
				<div className="mx-auto max-w-2xl">
					<AnimatedSection className="text-center mb-12">
						<h2 className="text-3xl sm:text-4xl font-extrabold font-[family-name:var(--font-display)] tracking-tight">
							Questions
						</h2>
					</AnimatedSection>
					<StaggerChildren className="space-y-3">
						{faqs.map((f) => <StaggerItem key={f.q}><FAQItem {...f} /></StaggerItem>)}
					</StaggerChildren>
				</div>
			</section>

			{/* ── CTA ─────────────────────────────────────────────── */}
			<section className="relative py-32 px-6 overflow-hidden">
				<GradientMesh />
				<AnimatedSection className="relative z-10 mx-auto max-w-2xl text-center">
					<h2 className="text-4xl sm:text-5xl font-extrabold font-[family-name:var(--font-display)] tracking-tight">
						Stop wasting time editing
					</h2>
					<p className="mt-4 text-lg text-white/40">
						10 free credits on signup. No card required.
					</p>
					<div className="mt-8">
						<Link
							href="/register"
							className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-600 px-10 py-4 text-base font-semibold text-white shadow-[0_0_30px_hsl(262_83%_58%/0.3)] hover:shadow-[0_0_50px_hsl(262_83%_58%/0.5)] transition-all duration-300"
						>
							<Zap className="h-5 w-5" />
							Start Creating Free
							<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
						</Link>
					</div>
					<div className="mt-8 flex items-center justify-center gap-8 text-sm text-white/30">
						<span className="flex items-center gap-2"><Timer className="h-4 w-4" /> 30 sec setup</span>
						<span className="flex items-center gap-2"><Shield className="h-4 w-4" /> No card needed</span>
						<span className="flex items-center gap-2"><DollarSign className="h-4 w-4" /> 10 free credits</span>
					</div>
				</AnimatedSection>
			</section>

			<MarketingFooter />
		</div>
	);
}
