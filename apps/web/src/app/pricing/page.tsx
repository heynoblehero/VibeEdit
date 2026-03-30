"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trackEvent } from "@/lib/analytics";
import Link from "next/link";
import { MessageSquare, Film, Mic, Captions, Check, Sparkles } from "lucide-react";
import { MarketingNav } from "@/components/marketing/nav";
import { MarketingFooter } from "@/components/marketing/footer";
import { AnimatedSection } from "@/components/ui/motion/animated-section";
import { GlassCard } from "@/components/ui/motion/glass-card";
import { NeonBadge } from "@/components/ui/motion/neon-badge";
import { StaggerChildren, StaggerItem } from "@/components/ui/motion/stagger-children";

const packs = [
	{
		id: "starter", name: "Starter", price: 5, period: "/mo", credits: 100, perCredit: "$0.05", popular: false,
		features: ["100 credits/month", "~100 AI edits", "~20 video exports", "Auto-captions", "All import formats"],
	},
	{
		id: "pro", name: "Pro", price: 20, period: "/mo", credits: 500, perCredit: "$0.04", popular: true,
		includesLabel: "Everything in Starter, plus:",
		features: ["500 credits/month", "~500 AI edits", "~100 video exports", "AI Storyboard", "Priority support"],
	},
	{
		id: "studio", name: "Studio", price: 50, period: "/mo", credits: 1500, perCredit: "$0.033", popular: false,
		includesLabel: "Everything in Pro, plus:",
		features: ["1,500 credits/month", "~1,500 AI edits", "~300 video exports", "Team collaboration", "Custom presets"],
	},
];

const creditBreakdown = [
	{ icon: MessageSquare, label: "AI Chat Message", cost: "1 credit" },
	{ icon: Film, label: "Video Render (1 min)", cost: "10 credits" },
	{ icon: Mic, label: "Voice Generation", cost: "5 credits" },
	{ icon: Captions, label: "Caption Generation", cost: "5 credits" },
];

export default function PricingPage() {
	const router = useRouter();
	const [loading, setLoading] = useState<string | null>(null);

	async function handleBuy(packId: string) {
		setLoading(packId);
		trackEvent("checkout_started", { pack: packId });
		try {
			const resp = await fetch("/api/checkout", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ packId }),
			});

			if (resp.status === 401) {
				router.push(`/register?redirect=/pricing`);
				return;
			}

			const data = await resp.json();
			if (data.url) {
				window.location.href = data.url;
			}
		} catch {
			// If checkout fails, redirect to register
			router.push("/register");
		} finally {
			setLoading(null);
		}
	}

	return (
		<div className="min-h-screen bg-[#08080c] text-white">
			<MarketingNav />

			{/* Hero */}
			<section className="relative py-28 px-6 overflow-hidden">
				<div className="absolute -top-[30%] -left-[15%] w-[50%] h-[50%] rounded-full bg-violet-600/15 blur-[100px]" />
				<div className="absolute -bottom-[20%] -right-[15%] w-[40%] h-[40%] rounded-full bg-fuchsia-600/10 blur-[100px]" />
				<AnimatedSection className="relative z-10 mx-auto max-w-3xl text-center">
					<h1 className="text-4xl sm:text-5xl font-black tracking-tight font-[family-name:var(--font-display)]">
						Simple, predictable pricing
					</h1>
					<p className="mt-4 text-lg text-white/60">
						Pick a plan. Get credits every month. Cancel anytime.
					</p>
				</AnimatedSection>
			</section>

			{/* Pricing Cards */}
			<section className="px-6 pb-24">
				<StaggerChildren className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-3">
					{packs.map((pack) => (
						<StaggerItem key={pack.id}>
							<GlassCard
								className={`relative flex flex-col p-8 h-full border-white/[0.08] bg-white/[0.03] ${
									pack.popular ? "ring-2 ring-violet-500/50 bg-white/[0.05]" : ""
								}`}
								glow={pack.popular}
							>
								{pack.popular && (
									<NeonBadge className="absolute -top-3 left-1/2 -translate-x-1/2">Most Popular</NeonBadge>
								)}

								<h2 className="text-xl font-black font-[family-name:var(--font-display)]">{pack.name}</h2>

								<div className="mt-4 flex items-baseline gap-1">
									<span className="text-5xl font-black font-[family-name:var(--font-display)]">${pack.price}</span>
									<span className="text-lg text-white/40 font-medium">{pack.period}</span>
								</div>
								<p className="mt-1 text-sm text-white/50">{pack.credits} credits every month</p>

								<div className="mt-6 flex-1 space-y-2.5">
									{pack.includesLabel && <p className="text-xs text-white/40 font-medium">{pack.includesLabel}</p>}
									{pack.features.map((f) => (
										<div key={f} className="flex items-center gap-2.5">
											<Check className="h-4 w-4 text-emerald-400 shrink-0" />
											<span className="text-sm text-white/70">{f}</span>
										</div>
									))}
								</div>

								<button
									onClick={() => handleBuy(pack.id)}
									disabled={loading === pack.id}
									className={`mt-8 w-full rounded-full py-3.5 text-sm font-bold transition-all duration-300 disabled:opacity-50 ${
										pack.popular
											? "bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white hover:shadow-[0_0_25px_hsl(262_83%_58%/0.3)] hover:scale-[1.02]"
											: "border border-white/15 text-white hover:bg-white/5"
									}`}
								>
									{loading === pack.id ? "Redirecting..." : `Subscribe to ${pack.name}`}
								</button>
							</GlassCard>
						</StaggerItem>
					))}
				</StaggerChildren>

				<div className="mt-10 flex items-center justify-center gap-8 text-sm text-white/40 font-medium">
					<span className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Cancel anytime</span>
					<span className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> Credits refresh monthly</span>
					<span className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-400" /> No long-term contracts</span>
				</div>
			</section>

			{/* Credit Breakdown */}
			<section className="border-t border-white/[0.05] py-20 px-6">
				<AnimatedSection className="mx-auto max-w-3xl text-center mb-10">
					<h2 className="text-2xl font-bold font-[family-name:var(--font-display)]">How credits are used</h2>
				</AnimatedSection>
				<StaggerChildren className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
					{creditBreakdown.map((item) => (
						<StaggerItem key={item.label}>
							<div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
								<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
									<item.icon className="h-4 w-4 text-violet-400" />
								</div>
								<div>
									<p className="text-sm font-medium text-white/80">{item.label}</p>
									<p className="text-xs text-white/40">{item.cost}</p>
								</div>
							</div>
						</StaggerItem>
					))}
				</StaggerChildren>
			</section>

			<MarketingFooter />
		</div>
	);
}
