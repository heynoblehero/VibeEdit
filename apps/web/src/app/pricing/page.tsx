"use client";

import Link from "next/link";

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

export default function PricingPage() {
	return (
		<div className="min-h-screen bg-background text-foreground">
			{/* Nav */}
			<nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
				<div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
					<Link href="/" className="text-lg font-bold tracking-tight">
						VibeEdit
					</Link>
					<div className="flex items-center gap-6 text-sm">
						<Link href="/pricing" className="text-foreground font-medium">
							Pricing
						</Link>
						<Link href="/login" className="text-muted-foreground hover:text-foreground transition-colors">
							Login
						</Link>
						<Link
							href="/register"
							className="rounded-lg bg-primary px-4 py-2 text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
						>
							Sign up
						</Link>
					</div>
				</div>
			</nav>

			{/* Header */}
			<section className="py-20 px-6">
				<div className="mx-auto max-w-3xl text-center">
					<h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Credit Packs</h1>
					<p className="mt-4 text-lg text-muted-foreground">
						Buy credits, use them whenever you want. No subscriptions, no monthly fees.
						Credits never expire.
					</p>
				</div>
			</section>

			{/* Pricing Cards */}
			<section className="px-6 pb-24">
				<div className="mx-auto grid max-w-5xl gap-8 sm:grid-cols-3">
					{creditPacks.map((pack) => (
						<div
							key={pack.name}
							className={`relative flex flex-col rounded-2xl border p-8 shadow-sm hover:scale-[1.02] transition-transform ${
								pack.popular
									? "border-primary bg-card ring-2 ring-primary/20"
									: "border-border bg-card"
							}`}
						>
							{pack.popular && (
								<span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-semibold text-primary-foreground">
									Most Popular
								</span>
							)}

							<h2 className="text-xl font-bold">{pack.name}</h2>

							<div className="mt-4 flex items-baseline gap-1">
								<span className="text-4xl font-bold">${pack.price}</span>
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

							<Link
								href="/register"
								className={`mt-8 block w-full rounded-xl py-3 text-center text-sm font-medium transition-colors ${
									pack.popular
										? "bg-primary text-primary-foreground hover:bg-primary/90"
										: "border border-border text-foreground hover:bg-muted"
								}`}
							>
								Buy {pack.name}
							</Link>
						</div>
					))}
				</div>
			</section>

			{/* Credit Breakdown */}
			<section className="border-t border-border py-20 px-6">
				<div className="mx-auto max-w-3xl text-center">
					<h2 className="text-2xl font-bold mb-4">How credits are used</h2>
					<p className="text-sm text-muted-foreground mb-8">
						Different actions cost different amounts of credits. Here is a rough guide.
					</p>
					<div className="grid gap-4 sm:grid-cols-2 text-left">
						<div className="rounded-xl border border-border bg-card p-4">
							<p className="text-sm font-medium">AI Chat Message</p>
							<p className="text-xs text-muted-foreground mt-1">~1 credit per message</p>
						</div>
						<div className="rounded-xl border border-border bg-card p-4">
							<p className="text-sm font-medium">Video Render (1 min)</p>
							<p className="text-xs text-muted-foreground mt-1">~5 credits per render</p>
						</div>
						<div className="rounded-xl border border-border bg-card p-4">
							<p className="text-sm font-medium">Voice Generation</p>
							<p className="text-xs text-muted-foreground mt-1">~5 credits per generation</p>
						</div>
						<div className="rounded-xl border border-border bg-card p-4">
							<p className="text-sm font-medium">Caption Generation</p>
							<p className="text-xs text-muted-foreground mt-1">~2 credits per generation</p>
						</div>
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="border-t border-border py-8 px-6">
				<div className="mx-auto flex max-w-6xl items-center justify-between text-sm text-muted-foreground">
					<span>VibeEdit &copy; 2026</span>
					<div className="flex items-center gap-6">
						<Link href="/" className="hover:text-foreground transition-colors">
							Home
						</Link>
						<Link href="/login" className="hover:text-foreground transition-colors">
							Login
						</Link>
						<Link href="/register" className="hover:text-foreground transition-colors">
							Register
						</Link>
					</div>
				</div>
			</footer>
		</div>
	);
}
