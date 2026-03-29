import Link from "next/link";
import { Sparkles } from "lucide-react";

const links = {
	product: [
		{ href: "/pricing", label: "Pricing" },
		{ href: "/register", label: "Get Started" },
		{ href: "/dashboard", label: "Dashboard" },
	],
	legal: [
		{ href: "/terms", label: "Terms" },
		{ href: "/privacy", label: "Privacy" },
	],
};

export function MarketingFooter() {
	return (
		<footer className="border-t border-border/20 bg-card/20">
			<div className="mx-auto max-w-6xl px-6 py-16">
				<div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
					<div className="flex flex-col gap-4 max-w-xs">
						<div className="flex items-center gap-2.5">
							<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600">
								<Sparkles className="h-4 w-4 text-white" />
							</div>
							<span className="text-base font-bold tracking-tight font-[family-name:var(--font-display)]">
								VibeEdit
							</span>
						</div>
						<p className="text-sm text-muted-foreground leading-relaxed">
							The AI-powered video editor. Describe your vision, watch it come to life.
						</p>
					</div>

					<div className="flex gap-20">
						<div>
							<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Product</h4>
							<ul className="space-y-3">
								{links.product.map((l) => (
									<li key={l.href}>
										<Link href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{l.label}</Link>
									</li>
								))}
							</ul>
						</div>
						<div>
							<h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">Legal</h4>
							<ul className="space-y-3">
								{links.legal.map((l) => (
									<li key={l.href}>
										<Link href={l.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">{l.label}</Link>
									</li>
								))}
							</ul>
						</div>
					</div>
				</div>

				<div className="mt-12 pt-8 border-t border-border/20 flex items-center justify-between text-xs text-muted-foreground/60">
					<span>&copy; {new Date().getFullYear()} VibeEdit</span>
					<span>Built with AI, for creators.</span>
				</div>
			</div>
		</footer>
	);
}
