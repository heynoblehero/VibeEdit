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
	Sparkles, Zap, ChevronDown, ArrowRight, Star, Check,
	Timer, DollarSign, Shield, Clock, X,
} from "lucide-react";
import { useState, useRef } from "react";

/* ── The pain list (ShipFast style) ────────────────────────────── */

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
const totalPainHours = "17+";

/* ── Outcomes people get ───────────────────────────────────────── */

const outcomes = [
	{ metric: "90%", label: "less time editing", detail: "What took 4 hours now takes 5 minutes." },
	{ metric: "5x", label: "more videos published", detail: "More output = more reach = more growth." },
	{ metric: "$0", label: "editing software cost", detail: "No Premiere. No After Effects. No subscriptions." },
];

/* ── Testimonials with specific results ────────────────────────── */

const testimonials = [
	{
		text: "I was spending every Sunday editing my YouTube videos. Now I describe what I want and it\u2019s done before my coffee gets cold. Published 3x more videos this month.",
		name: "Sarah K.", role: "YouTuber, 45K subs", avatar: "S",
	},
	{
		text: "Zero editing experience. I just said \u2018cut the dead air, add captions, make it vertical\u2019 and got a TikTok-ready clip in 2 minutes. My first video got 12K views.",
		name: "Marcus T.", role: "First-time creator", avatar: "M",
	},
	{
		text: "We used to hire a freelance editor for $500/video. Now our marketing team does it themselves in minutes. Saved us $4,000 last month alone.",
		name: "Priya R.", role: "Marketing Lead, Series B startup", avatar: "P",
	},
];

/* ── Pricing ───────────────────────────────────────────────────── */

const pricing = [
	{ name: "Starter", price: 5, credits: 100, desc: "Try it out. Edit a few videos.", popular: false },
	{ name: "Pro", price: 20, credits: 500, desc: "For regular creators. Most popular.", popular: true },
	{ name: "Studio", price: 50, credits: 1500, desc: "For teams and agencies.", popular: false },
];

/* ── FAQ ───────────────────────────────────────────────────────── */

const faqs = [
	{ q: "Do I need any editing experience?", a: "No. If you can describe what you want in a sentence, you can edit video. \u201CCut the boring intro, add captions, export for TikTok.\u201D That\u2019s it. The AI handles the technical work." },
	{ q: "How fast is it really?", a: "Most edits happen in seconds. A full video that would take 4 hours in Premiere takes about 5 minutes with VibeEdit. The demo above is running in real-time \u2014 that\u2019s the actual speed." },
	{ q: "What if the AI gets it wrong?", a: "Just tell it. \u201CMake the text bigger\u201D or \u201Cundo that.\u201D It\u2019s a conversation, not a one-shot. You can also edit any previous message to redo from that point." },
	{ q: "What formats do you support?", a: "Import: MP4, MOV, WebM, PSD, LUT, SRT subtitles, EDL edit lists, Premiere XML, and more. Export: YouTube, TikTok, Instagram Reels, Twitter \u2014 all presets built in." },
	{ q: "How do credits work?", a: "Each AI action costs credits (1 credit per message, 5 per render). Buy packs, use at your own pace. Credits never expire. No recurring charges." },
	{ q: "Can I cancel anytime?", a: "There\u2019s nothing to cancel. You buy credit packs when you need them. No subscription. No commitment. No auto-renewal." },
];

/* ── Components ─────────────────────────────────────────────────── */

function FAQItem({ q, a }: { q: string; a: string }) {
	const [open, setOpen] = useState(false);
	return (
		<button onClick={() => setOpen((v) => !v)} className="w-full rounded-2xl border border-white/[0.06] bg-white/[0.02] text-left transition-all duration-200 hover:bg-white/[0.04]">
			<div className="flex items-center justify-between p-5">
				<span className="font-semibold font-[family-name:var(--font-display)] text-white/90 pr-4">{q}</span>
				<ChevronDown className={`h-4 w-4 text-white/30 shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
			</div>
			<div className="overflow-hidden transition-all duration-300" style={{ maxHeight: open ? "200px" : "0" }}>
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

			{/* ═══════════════════ HERO ═══════════════════════════ */}
			<section ref={heroRef} className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
				<GradientMesh />
				<motion.div className="relative z-10 mx-auto max-w-6xl px-6 pt-24 pb-8 text-center" style={{ y: heroY, opacity: heroOpacity }}>
					<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
						<NeonBadge variant="purple" className="mb-8">
							<Sparkles className="h-3 w-3" />
							1,200+ creators edit faster
						</NeonBadge>
					</motion.div>

					<motion.h1
						className="text-5xl sm:text-6xl lg:text-[5.5rem] font-extrabold tracking-tight font-[family-name:var(--font-display)] leading-[0.95]"
						initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
					>
						Edit your videos in
						<br />
						<span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">minutes, not hours</span>
					</motion.h1>

					<motion.p
						className="mt-6 text-lg sm:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed"
						initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
					>
						Drop your files. Describe the edit in plain English. Done.
						<br className="hidden sm:block" />
						No timeline. No learning curve. No $50/month software.
					</motion.p>

					<motion.div
						className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
						initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
					>
						<Link href="/register" className="group relative inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-600 px-8 py-4 text-base font-semibold text-white shadow-[0_0_30px_hsl(262_83%_58%/0.3)] hover:shadow-[0_0_50px_hsl(262_83%_58%/0.5)] transition-all duration-300">
							Get VibeEdit — it&apos;s free
							<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
						</Link>
					</motion.div>

					{/* Social proof row */}
					<motion.div className="mt-8 flex items-center justify-center gap-3 text-sm text-white/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
						<div className="flex -space-x-2">
							{["S","M","P","A","J"].map((l, i) => (
								<div key={l} className="w-7 h-7 rounded-full border-2 border-[#08080c] bg-gradient-to-br from-violet-400 to-fuchsia-500 flex items-center justify-center text-[9px] font-bold text-white" style={{ opacity: 1 - i * 0.1 }}>{l}</div>
							))}
						</div>
						<span><span className="text-white/70 font-semibold">1,200+</span> creators</span>
						<div className="flex items-center gap-0.5 text-amber-400">
							{[...Array(5)].map((_, i) => <Star key={i} className="h-3 w-3 fill-current" />)}
						</div>
						<span className="text-white/30">4.9/5</span>
					</motion.div>

					{/* Live demo */}
					<div id="demo"><LiveDemo /></div>
				</motion.div>
			</section>

			{/* ═══════════════ PAIN BREAKDOWN (ShipFast style) ═══ */}
			<section className="py-24 px-6 border-t border-white/[0.04]">
				<div className="mx-auto max-w-3xl">
					<AnimatedSection className="text-center mb-14">
						<h2 className="text-3xl sm:text-4xl font-extrabold font-[family-name:var(--font-display)] tracking-tight">
							Traditional video editing is a <span className="bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent">time sink</span>
						</h2>
						<p className="mt-3 text-white/40">Here&apos;s where your hours go every single video:</p>
					</AnimatedSection>

					<StaggerChildren className="space-y-2">
						{painList.map((p) => (
							<StaggerItem key={p.task}>
								<div className="flex items-center gap-4 rounded-xl border border-white/[0.04] bg-white/[0.015] px-5 py-3 group hover:bg-red-500/[0.03] hover:border-red-500/10 transition-colors">
									<X className="h-4 w-4 text-red-400/60 shrink-0" />
									<span className="text-sm text-white/60 flex-1">{p.task}</span>
									<span className="text-sm font-semibold text-red-400/80 font-mono shrink-0">{p.hours}</span>
								</div>
							</StaggerItem>
						))}
					</StaggerChildren>

					{/* Total */}
					<AnimatedSection delay={0.3} className="mt-6 rounded-2xl border border-red-500/15 bg-red-500/[0.04] p-6 text-center">
						<div className="text-3xl font-extrabold font-[family-name:var(--font-display)] text-red-400">{totalPainHours} hours of headaches</div>
						<p className="text-sm text-white/40 mt-1">...per video. Every single time.</p>
					</AnimatedSection>

					{/* The flip */}
					<AnimatedSection delay={0.4} className="mt-10 text-center">
						<p className="text-white/40 text-sm mb-4">With VibeEdit:</p>
						<div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-6">
							<div className="text-3xl font-extrabold font-[family-name:var(--font-display)] bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">5 minutes. Done.</div>
							<p className="text-sm text-white/40 mt-1">&ldquo;Add captions, cut the intro, export for TikTok.&rdquo; That&apos;s the whole edit.</p>
						</div>
					</AnimatedSection>
				</div>
			</section>

			{/* ═══════════════ OUTCOMES ═══════════════════════════ */}
			<section className="py-24 px-6">
				<div className="mx-auto max-w-5xl">
					<StaggerChildren className="grid gap-5 sm:grid-cols-3">
						{outcomes.map((o) => (
							<StaggerItem key={o.label}>
								<GlassCard className="p-7 text-center h-full border-white/[0.06] bg-white/[0.02]">
									<div className="text-4xl font-extrabold font-[family-name:var(--font-display)] bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">{o.metric}</div>
									<p className="text-sm font-semibold text-white/70 mt-2">{o.label}</p>
									<p className="text-xs text-white/35 mt-1 leading-relaxed">{o.detail}</p>
								</GlassCard>
							</StaggerItem>
						))}
					</StaggerChildren>
				</div>
			</section>

			{/* ═══════════════ HOW IT WORKS ═══════════════════════ */}
			<section className="py-24 px-6 border-t border-white/[0.04]">
				<div className="mx-auto max-w-3xl">
					<AnimatedSection className="text-center mb-14">
						<h2 className="text-3xl sm:text-4xl font-extrabold font-[family-name:var(--font-display)] tracking-tight">
							It&apos;s embarrassingly simple
						</h2>
					</AnimatedSection>

					<StaggerChildren className="space-y-4">
						{[
							{ n: "1", title: "Drop your files in", desc: "Videos, images, audio — any format. Drag them into the chat or click to upload." },
							{ n: "2", title: "Tell AI what to do", desc: "\"Cut the boring intro, add captions, overlay my logo at 2 seconds, export for TikTok.\" That's it." },
							{ n: "3", title: "Download your video", desc: "One click. Done. YouTube, TikTok, Instagram, Twitter — every format built in." },
						].map((s) => (
							<StaggerItem key={s.n}>
								<div className="flex items-start gap-5 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6">
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-sm font-extrabold font-[family-name:var(--font-display)]">{s.n}</div>
									<div>
										<h3 className="font-bold font-[family-name:var(--font-display)] text-white/90">{s.title}</h3>
										<p className="text-sm text-white/40 mt-1 leading-relaxed">{s.desc}</p>
									</div>
								</div>
							</StaggerItem>
						))}
					</StaggerChildren>
				</div>
			</section>

			{/* ═══════════════ TESTIMONIALS ═══════════════════════ */}
			<section className="py-24 px-6">
				<div className="mx-auto max-w-5xl">
					<AnimatedSection className="text-center mb-14">
						<h2 className="text-3xl sm:text-4xl font-extrabold font-[family-name:var(--font-display)] tracking-tight">
							Real people. Real results.
						</h2>
					</AnimatedSection>

					<StaggerChildren className="grid gap-5 sm:grid-cols-3">
						{testimonials.map((t) => (
							<StaggerItem key={t.name}>
								<GlassCard className="p-6 h-full border-white/[0.06] bg-white/[0.02] flex flex-col" hover={false}>
									<div className="flex items-center gap-0.5 mb-4 text-amber-400">
										{[...Array(5)].map((_, i) => <Star key={i} className="h-3 w-3 fill-current" />)}
									</div>
									<p className="text-sm text-white/60 leading-relaxed flex-1">&ldquo;{t.text}&rdquo;</p>
									<div className="flex items-center gap-3 pt-4 mt-4 border-t border-white/[0.06]">
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

			{/* ═══════════════ PRICING ════════════════════════════ */}
			<section className="py-24 px-6 border-t border-white/[0.04]">
				<div className="mx-auto max-w-4xl">
					<AnimatedSection className="text-center mb-14">
						<h2 className="text-3xl sm:text-4xl font-extrabold font-[family-name:var(--font-display)] tracking-tight">
							Pay for what you use. That&apos;s it.
						</h2>
						<p className="mt-3 text-white/40">No subscriptions. No monthly fees. Credits never expire.</p>
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
									<div className="mt-4"><span className="text-4xl font-extrabold font-[family-name:var(--font-display)]">${p.price}</span></div>
									<p className="text-xs text-white/35 mt-1">{p.credits} credits</p>
									<Link href="/register" className={`mt-6 block w-full rounded-full py-3 text-center text-sm font-semibold transition-all duration-300 ${p.popular ? "bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white hover:shadow-[0_0_25px_hsl(262_83%_58%/0.3)]" : "border border-white/10 text-white/70 hover:bg-white/5 hover:text-white"}`}>
										Get VibeEdit
									</Link>
								</GlassCard>
							</StaggerItem>
						))}
					</StaggerChildren>

					<div className="mt-8 flex items-center justify-center gap-8 text-xs text-white/30">
						<span className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-400" /> No subscription</span>
						<span className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-400" /> Credits never expire</span>
						<span className="flex items-center gap-1.5"><Check className="h-3 w-3 text-emerald-400" /> Nothing to cancel</span>
					</div>
				</div>
			</section>

			{/* ═══════════════ FAQ ════════════════════════════════ */}
			<section className="py-24 px-6">
				<div className="mx-auto max-w-2xl">
					<AnimatedSection className="text-center mb-12">
						<h2 className="text-3xl sm:text-4xl font-extrabold font-[family-name:var(--font-display)] tracking-tight">Frequently asked</h2>
					</AnimatedSection>
					<StaggerChildren className="space-y-3">
						{faqs.map((f) => <StaggerItem key={f.q}><FAQItem {...f} /></StaggerItem>)}
					</StaggerChildren>
				</div>
			</section>

			{/* ═══════════════ FINAL CTA ══════════════════════════ */}
			<section className="relative py-32 px-6 overflow-hidden">
				<GradientMesh />
				<AnimatedSection className="relative z-10 mx-auto max-w-2xl text-center">
					<h2 className="text-4xl sm:text-5xl font-extrabold font-[family-name:var(--font-display)] tracking-tight">
						Stop wasting weekends editing
					</h2>
					<p className="mt-4 text-lg text-white/40">10 free credits. No card required. Start in 30 seconds.</p>
					<div className="mt-8">
						<Link href="/register" className="group inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-600 px-10 py-4 text-base font-semibold text-white shadow-[0_0_30px_hsl(262_83%_58%/0.3)] hover:shadow-[0_0_50px_hsl(262_83%_58%/0.5)] transition-all duration-300">
							<Zap className="h-5 w-5" />
							Get VibeEdit — it&apos;s free
							<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
						</Link>
					</div>
					<div className="mt-8 flex items-center justify-center gap-8 text-sm text-white/30">
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
