"use client";

import Link from "next/link";
import { MessageSquare, Film, Mic, Captions, ShieldCheck, Clock, CreditCard } from "lucide-react";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { FloatingOrbs } from "@/components/ui/motion/floating-orbs";
import { NeonBadge } from "@/components/ui/motion/neon-badge";
import { GlassCard } from "@/components/ui/motion/glass-card";
import { AnimatedSection } from "@/components/ui/motion/animated-section";
import { AnimatedCounter } from "@/components/ui/motion/animated-counter";
import { StaggerChildren, StaggerItem } from "@/components/ui/motion/stagger-children";
import { GradientButton } from "@/components/ui/motion/gradient-button";

const creditPacks = [
	{
		name: "Starter",
		price: 5,
		credits: 100,
		perCredit: "$0.05",
		popular: false,
		includes: [
			"~100 AI chat messages",
			"~20 video renders (1 min each)",
			"~20 voice generations",
			"~50 caption generations",
		],
	},
	{
		name: "Pro",
		price: 20,
		credits: 500,
		perCredit: "$0.04",
		popular: true,
		includes: [
			"~500 AI chat messages",
			"~100 video renders (1 min each)",
			"~100 voice generations",
			"~250 caption generations",
		],
	},
	{
		name: "Studio",
		price: 50,
		credits: 1500,
		perCredit: "$0.033",
		popular: false,
		includes: [
			"~1500 AI chat messages",
			"~300 video renders (1 min each)",
			"~300 voice generations",
			"~750 caption generations",
		],
	},
];

const creditBreakdown = [
	{
		icon: MessageSquare,
		label: "AI Chat Message",
		cost: "~1 credit per message",
	},
	{
		icon: Film,
		label: "Video Render (1 min)",
		cost: "~5 credits per render",
	},
	{
		icon: Mic,
		label: "Voice Generation",
		cost: "~5 credits per generation",
	},
	{
		icon: Captions,
		label: "Caption Generation",
		cost: "~2 credits per generation",
	},
];

const trustBadges = [
	{ icon: Clock, label: "Credits never expire" },
	{ icon: CreditCard, label: "No subscription required" },
	{ icon: ShieldCheck, label: "Cancel anytime" },
];

export default function PricingPage() {
	return (
		<div className="min-h-screen bg-background text-foreground">
			<MarketingNav />

			{/* Hero Header */}
			<section className="relative py-24 px-6 overflow-hidden">
				<FloatingOrbs />
				<AnimatedSection className="relative z-10 mx-auto max-w-3xl text-center">
					<h1 className="text-4xl font-bold tracking-tight sm:text-5xl font-[family-name:var(--font-display)]">
						Simple{" "}
						<span className="gradient-text">Credit Packs</span>
					</h1>
					<p className="mt-4 text-lg text-muted-foreground">
						Buy credits, use them whenever you want. No subscriptions, no monthly fees.
						Credits never expire.
					</p>
				</AnimatedSection>
			</section>

			{/* Pricing Cards */}
			<section className="px-6 pb-24">
				<StaggerChildren className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-3" staggerDelay={0.12}>
					{creditPacks.map((pack) => (
						<StaggerItem key={pack.name}>
							<GlassCard
								className={`relative flex flex-col p-8 h-full ${
									pack.popular
										? "ring-2 ring-primary/40"
										: ""
								}`}
								glow={pack.popular}
							>
								{pack.popular && (
									<div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
										<NeonBadge variant="purple">Most Popular</NeonBadge>
									</div>
								)}

								<h2 className="text-xl font-bold font-[family-name:var(--font-display)]">
									{pack.name}
								</h2>

								<div className="mt-4 flex items-baseline gap-1">
									<AnimatedCounter
										value={pack.price}
										prefix="$"
										className="text-4xl font-bold"
									/>
								</div>

								<p className="mt-1 text-sm text-muted-foreground">
									{pack.credits} credits
								</p>
								<p className="text-xs text-muted-foreground">
									{pack.perCredit} per credit
								</p>

								<div className="mt-6 flex-1">
									<p className="text-sm font-medium mb-3">What you can do:</p>
									<ul className="space-y-2">
										{pack.includes.map((item) => (
											<li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
												<span className="mt-0.5 text-primary">&#10003;</span>
												{item}
											</li>
										))}
									</ul>
								</div>

								<div className="mt-8">
									{pack.popular ? (
										<GradientButton href="/register" variant="gradient" className="w-full">
											Buy {pack.name}
										</GradientButton>
									) : (
										<GradientButton href="/register" variant="outline" className="w-full">
											Buy {pack.name}
										</GradientButton>
									)}
								</div>
							</GlassCard>
						</StaggerItem>
					))}
				</StaggerChildren>
			</section>

			{/* Credit Breakdown */}
			<section className="border-t border-border/40 py-20 px-6">
				<AnimatedSection className="mx-auto max-w-3xl text-center">
					<h2 className="text-2xl font-bold mb-4 font-[family-name:var(--font-display)]">
						How credits are used
					</h2>
					<p className="text-sm text-muted-foreground mb-8">
						Different actions cost different amounts of credits. Here is a rough guide.
					</p>
				</AnimatedSection>
				<StaggerChildren className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2" staggerDelay={0.08}>
					{creditBreakdown.map((item) => (
						<StaggerItem key={item.label}>
							<GlassCard className="flex items-start gap-3 p-4" hover={false}>
								<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
									<item.icon className="h-4.5 w-4.5 text-primary" />
								</div>
								<div>
									<p className="text-sm font-medium">{item.label}</p>
									<p className="text-xs text-muted-foreground mt-1">{item.cost}</p>
								</div>
							</GlassCard>
						</StaggerItem>
					))}
				</StaggerChildren>
			</section>

			{/* Trust Badges */}
			<section className="py-16 px-6">
				<AnimatedSection className="mx-auto max-w-3xl">
					<div className="flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10">
						{trustBadges.map((badge) => (
							<div key={badge.label} className="flex items-center gap-2 text-sm text-muted-foreground">
								<badge.icon className="h-4 w-4 text-primary" />
								<span>{badge.label}</span>
							</div>
						))}
					</div>
				</AnimatedSection>
			</section>

			<MarketingFooter />
		</div>
	);
}
