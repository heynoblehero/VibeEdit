"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/ui";
import { Sparkles, Menu, X } from "lucide-react";

export function MarketingNav() {
	const pathname = usePathname();
	const [mobileOpen, setMobileOpen] = useState(false);

	return (
		<nav className="fixed top-0 left-0 right-0 z-50">
			<div className="mx-auto max-w-6xl px-4 sm:px-6 py-3 sm:py-4">
				<div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-black/40 backdrop-blur-2xl px-4 sm:px-5 py-2.5 shadow-lg">
					<Link href="/" className="flex items-center gap-2 sm:gap-2.5">
						<div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-[0_0_12px_hsl(262_83%_58%/0.3)]">
							<Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-white" />
						</div>
						<span className="text-sm sm:text-base font-bold tracking-tight font-[family-name:var(--font-display)] text-white">
							VibeEdit
						</span>
					</Link>

					{/* Desktop nav */}
					<div className="hidden sm:flex items-center gap-1">
						<Link
							href="/pricing"
							className={cn(
								"rounded-full px-4 py-1.5 text-sm transition-all duration-200",
								pathname === "/pricing"
									? "text-white font-medium bg-white/10"
									: "text-white/60 hover:text-white hover:bg-white/5",
							)}
						>
							Pricing
						</Link>
						<Link href="/login" className="rounded-full px-4 py-1.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all duration-200">
							Login
						</Link>
						<Link href="/register" className="ml-1 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-600 px-5 py-1.5 text-sm font-semibold text-white hover:shadow-[0_0_20px_hsl(262_83%_58%/0.4)] transition-all duration-300">
							Get Started
						</Link>
					</div>

					{/* Mobile hamburger */}
					<button onClick={() => setMobileOpen(v => !v)} className="sm:hidden rounded-lg p-1.5 text-white/60 hover:text-white hover:bg-white/10 transition-colors">
						{mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
					</button>
				</div>

				{/* Mobile dropdown */}
				{mobileOpen && (
					<div className="sm:hidden mt-2 rounded-2xl border border-white/[0.08] bg-black/80 backdrop-blur-2xl p-4 space-y-2 shadow-lg">
						<Link href="/pricing" onClick={() => setMobileOpen(false)} className="block rounded-xl px-4 py-3 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors">
							Pricing
						</Link>
						<Link href="/login" onClick={() => setMobileOpen(false)} className="block rounded-xl px-4 py-3 text-sm text-white/70 hover:bg-white/5 hover:text-white transition-colors">
							Login
						</Link>
						<Link href="/register" onClick={() => setMobileOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-semibold text-center bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white">
							Get Started Free
						</Link>
					</div>
				)}
			</div>
		</nav>
	);
}
