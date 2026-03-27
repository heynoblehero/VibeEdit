import Link from "next/link";

const features = [
	{
		icon: "\u{1F916}",
		title: "AI Chat Editor",
		description: "Describe your edits in plain English. The AI understands cuts, transitions, overlays, and more.",
	},
	{
		icon: "\u{1F6E0}\uFE0F",
		title: "27 AI Tools",
		description: "Text, video, keyframes, effects, cuts, color grading, and more — all driven by AI.",
	},
	{
		icon: "\u2728",
		title: "Remotion Effects",
		description: "Custom motion graphics written by AI using Remotion's React-based rendering engine.",
	},
	{
		icon: "\u{1F4E6}",
		title: "Import Anything",
		description: "PSD, LUT, Lottie, ZIP packs, SRT, EDL, Premiere XML — bring your existing assets.",
	},
	{
		icon: "\u{1F4AC}",
		title: "Auto-Captions",
		description: "Generate captions from your audio automatically with accurate timing and formatting.",
	},
	{
		icon: "\u{1F680}",
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

					{/* Editor Mockup */}
					<div className="mt-16 mx-auto max-w-4xl">
						<div className="rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
							{/* Fake browser chrome */}
							<div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/50">
								<div className="flex gap-1.5">
									<div className="w-3 h-3 rounded-full bg-red-400" />
									<div className="w-3 h-3 rounded-full bg-yellow-400" />
									<div className="w-3 h-3 rounded-full bg-green-400" />
								</div>
								<div className="flex-1 text-center text-xs text-muted-foreground">vibeedit.app/editor</div>
							</div>
							{/* Fake editor layout */}
							<div className="flex" style={{ height: 320 }}>
								{/* Chat side */}
								<div className="w-[60%] border-r border-border p-4 flex flex-col gap-3">
									<div className="flex items-center gap-2 mb-2">
										<div className="w-6 h-6 rounded-full bg-ring/15 flex items-center justify-center">
											<span className="text-[8px] font-bold text-ring">AI</span>
										</div>
										<span className="text-xs font-medium text-foreground">VibeEdit AI</span>
									</div>
									{/* Fake messages */}
									<div className="flex justify-end">
										<div className="bg-secondary rounded-xl rounded-tr-sm px-3 py-1.5 text-xs text-foreground max-w-[70%]">
											add intro_clip as the main video
										</div>
									</div>
									<div className="flex gap-2">
										<div className="w-5 h-5 rounded-full bg-ring/15 shrink-0 mt-0.5" />
										<div className="bg-card border border-border rounded-xl rounded-tl-sm px-3 py-1.5 text-xs text-foreground">
											Done! Added intro_clip.mp4 to the main track.
											<span className="block mt-1 text-[10px] text-emerald-500">{"\u2713"} insert_video</span>
										</div>
									</div>
									<div className="flex justify-end">
										<div className="bg-secondary rounded-xl rounded-tr-sm px-3 py-1.5 text-xs text-foreground max-w-[70%]">
											overlay logo from 2s to 5s with fade in
										</div>
									</div>
									<div className="flex gap-2">
										<div className="w-5 h-5 rounded-full bg-ring/15 shrink-0 mt-0.5" />
										<div className="bg-card border border-border rounded-xl rounded-tl-sm px-3 py-1.5 text-xs text-foreground">
											Added logo overlay with fade-in animation!
											<span className="block mt-1 text-[10px] text-emerald-500">{"\u2713"} insert_image {"\u2713"} upsert_keyframe</span>
										</div>
									</div>
									<div className="mt-auto">
										<div className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
											<span className="text-muted-foreground text-xs">{"\u{1F4CE}"}</span>
											<span className="text-xs text-muted-foreground flex-1">Describe your edit...</span>
											<div className="w-6 h-6 rounded bg-primary flex items-center justify-center">
												<span className="text-[10px] text-primary-foreground">{"\u27A4"}</span>
											</div>
										</div>
									</div>
								</div>
								{/* Preview side */}
								<div className="w-[40%] flex flex-col">
									<div className="px-3 py-2 border-b border-border flex justify-between items-center">
										<span className="text-[10px] text-muted-foreground">Assets (3) {"\u25BC"}</span>
										<span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded">Render</span>
									</div>
									<div className="flex-1 bg-black flex items-center justify-center">
										<div className="text-center">
											<div className="text-white/80 text-sm font-bold">MY VIDEO</div>
											<div className="text-white/40 text-[10px] mt-1">1920{"\u00D7"}1080 {"\u2022"} 30fps</div>
										</div>
									</div>
									<div className="px-3 py-2 border-t border-border flex items-center gap-2">
										<span className="text-[10px] text-muted-foreground">{"\u25B6"}</span>
										<div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
											<div className="h-full w-[35%] bg-primary rounded-full" />
										</div>
										<span className="text-[10px] text-muted-foreground tabular-nums">1:23 / 4:55</span>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Trust bar */}
			<div className="border-y border-border bg-muted/30 py-6">
				<div className="max-w-5xl mx-auto px-6 flex items-center justify-center gap-8 text-muted-foreground text-sm">
					<span>{"\u{1F3AC}"} 27 AI Tools</span>
					<span className="text-border">|</span>
					<span>{"\u{1F4E6}"} 15+ Import Formats</span>
					<span className="text-border">|</span>
					<span>{"\u{1F512}"} Secure & Private</span>
					<span className="text-border">|</span>
					<span>{"\u26A1"} Instant Rendering</span>
				</div>
			</div>

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
								<div className="text-2xl mb-3">{feature.icon}</div>
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
						<Link href="/terms" className="hover:text-foreground transition-colors">
							Terms
						</Link>
						<Link href="/privacy" className="hover:text-foreground transition-colors">
							Privacy
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
