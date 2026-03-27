import Link from "next/link";

const features = [
	{
		title: "AI Chat Editor",
		description: "Describe your edits in plain English. The AI understands cuts, transitions, overlays, and more.",
	},
	{
		title: "27 AI Tools",
		description: "Text, video, keyframes, effects, cuts, color grading, and more — all driven by AI.",
	},
	{
		title: "Remotion Effects",
		description: "Custom motion graphics written by AI using Remotion's React-based rendering engine.",
	},
	{
		title: "Import Anything",
		description: "PSD, LUT, Lottie, ZIP packs, SRT, EDL, Premiere XML — bring your existing assets.",
	},
	{
		title: "Auto-Captions",
		description: "Generate captions from your audio automatically with accurate timing and formatting.",
	},
	{
		title: "Export Everywhere",
		description: "One-click export presets for YouTube, Instagram, TikTok, and Twitter.",
	},
];

const steps = [
	{
		number: "1",
		title: "Upload your media",
		description: "Drag and drop your files or attach them directly in the chat.",
	},
	{
		number: "2",
		title: "Describe your edit",
		description: '"Add intro as main, overlay logo 2-5s, fade in" — just say what you want.',
	},
	{
		number: "3",
		title: "Export and share",
		description: "One-click render for any platform. Download or share directly.",
	},
];

const pricingPlans = [
	{
		name: "Starter",
		price: "$5",
		credits: "100",
		detail: "~100 AI messages or ~20 video renders",
		popular: false,
	},
	{
		name: "Pro",
		price: "$20",
		credits: "500",
		detail: "~500 AI messages or ~100 video renders",
		popular: true,
	},
	{
		name: "Studio",
		price: "$50",
		credits: "1500",
		detail: "~1500 AI messages or ~300 video renders",
		popular: false,
	},
];

const faqs = [
	{
		question: "What is VibeEdit?",
		answer: "VibeEdit is an AI-powered video editor. You describe your edits in plain English, and the AI builds your video using 27 tools, Remotion effects, and smart automation.",
	},
	{
		question: "How do credits work?",
		answer: "Each AI action costs credits — sending a message, generating captions, rendering a video. Buy credit packs and use them at your own pace. They never expire.",
	},
	{
		question: "What formats can I import?",
		answer: "MP4, MOV, WebM, PSD, LUT, Lottie animations, ZIP asset packs, SRT subtitles, EDL edit decision lists, and Premiere XML project files.",
	},
	{
		question: "Can I use my own API keys?",
		answer: "Yes. Connect your own ElevenLabs, Stability AI, and other provider keys in settings to use your own accounts and quotas.",
	},
	{
		question: "Is my data secure?",
		answer: "All processing happens on our servers with encrypted storage. Your media files are private and never shared or used for training.",
	},
];

export default function Home() {
	return (
		<div className="min-h-screen bg-background text-foreground">
			{/* Nav */}
			<nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
				<div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
					<Link href="/" className="text-lg font-bold tracking-tight">
						VibeEdit
					</Link>
					<div className="flex items-center gap-6 text-sm">
						<Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
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

			{/* Hero */}
			<section className="py-24 px-6">
				<div className="mx-auto max-w-3xl text-center">
					<h1 className="text-5xl font-bold tracking-tight sm:text-6xl">VibeEdit</h1>
					<p className="mt-4 text-xl text-muted-foreground sm:text-2xl">
						Edit videos by talking to AI.
					</p>
					<p className="mt-4 text-base text-muted-foreground max-w-xl mx-auto">
						Upload your media, describe your vision, and watch it come to life.
						27 AI tools. Remotion effects. Export everywhere.
					</p>
					<div className="mt-8 flex items-center justify-center gap-4">
						<Link
							href="/register"
							className="rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
						>
							Get Started Free
						</Link>
						<Link
							href="/pricing"
							className="rounded-xl border border-border px-6 py-3 text-sm font-medium text-foreground hover:bg-card transition-colors"
						>
							See Pricing
						</Link>
					</div>
				</div>
			</section>

			{/* Features Grid */}
			<section className="py-20 px-6 bg-card/50">
				<div className="mx-auto max-w-6xl">
					<h2 className="text-3xl font-bold text-center mb-12">Everything you need to edit</h2>
					<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{features.map((feature) => (
							<div
								key={feature.title}
								className="rounded-2xl border border-border bg-card p-6 shadow-sm"
							>
								<h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
								<p className="text-sm text-muted-foreground leading-relaxed">
									{feature.description}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* How It Works */}
			<section className="py-24 px-6">
				<div className="mx-auto max-w-4xl">
					<h2 className="text-3xl font-bold text-center mb-16">How it works</h2>
					<div className="grid gap-12 sm:grid-cols-3">
						{steps.map((step) => (
							<div key={step.number} className="text-center">
								<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-bold">
									{step.number}
								</div>
								<h3 className="text-lg font-semibold mb-2">{step.title}</h3>
								<p className="text-sm text-muted-foreground leading-relaxed">
									{step.description}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Pricing */}
			<section className="py-24 px-6 bg-card/50">
				<div className="mx-auto max-w-5xl">
					<h2 className="text-3xl font-bold text-center mb-4">Simple credit-based pricing</h2>
					<p className="text-center text-muted-foreground mb-12">
						Buy credits, use them whenever. No subscriptions, no surprises.
					</p>
					<div className="grid gap-6 sm:grid-cols-3">
						{pricingPlans.map((plan) => (
							<div
								key={plan.name}
								className={`relative rounded-2xl border p-6 shadow-sm ${
									plan.popular
										? "border-primary bg-card ring-2 ring-primary/20"
										: "border-border bg-card"
								}`}
							>
								{plan.popular && (
									<span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
										POPULAR
									</span>
								)}
								<h3 className="text-lg font-semibold">{plan.name}</h3>
								<div className="mt-2 flex items-baseline gap-1">
									<span className="text-3xl font-bold">{plan.price}</span>
								</div>
								<p className="mt-1 text-sm text-muted-foreground">
									{plan.credits} credits
								</p>
								<p className="mt-3 text-xs text-muted-foreground leading-relaxed">
									{plan.detail}
								</p>
								<Link
									href="/register"
									className={`mt-6 block w-full rounded-xl py-2.5 text-center text-sm font-medium transition-colors ${
										plan.popular
											? "bg-primary text-primary-foreground hover:bg-primary/90"
											: "border border-border text-foreground hover:bg-muted"
									}`}
								>
									Get Started
								</Link>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* FAQ */}
			<section className="py-24 px-6">
				<div className="mx-auto max-w-3xl">
					<h2 className="text-3xl font-bold text-center mb-12">Frequently asked questions</h2>
					<div className="space-y-6">
						{faqs.map((faq) => (
							<div key={faq.question} className="rounded-2xl border border-border bg-card p-6">
								<h3 className="font-semibold mb-2">{faq.question}</h3>
								<p className="text-sm text-muted-foreground leading-relaxed">
									{faq.answer}
								</p>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="border-t border-border py-8 px-6">
				<div className="mx-auto flex max-w-6xl items-center justify-between text-sm text-muted-foreground">
					<span>VibeEdit &copy; 2026</span>
					<div className="flex items-center gap-6">
						<Link href="/pricing" className="hover:text-foreground transition-colors">
							Pricing
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
