"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/ui";
import { Sparkles } from "lucide-react";

export function MarketingNav() {
	const pathname = usePathname();

	return (
		<nav className="fixed top-0 left-0 right-0 z-50">
			<div className="mx-auto max-w-6xl px-6 py-4">
				<div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-black/40 backdrop-blur-2xl px-5 py-2.5 shadow-lg">
					<Link href="/" className="flex items-center gap-2.5 group">
						<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-[0_0_12px_hsl(262_83%_58%/0.3)]">
							<Sparkles className="h-4 w-4 text-white" />
						</div>
						<span className="text-base font-bold tracking-tight font-[family-name:var(--font-display)] text-white">
							VibeEdit
						</span>
					</Link>
					<div className="flex items-center gap-1">
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
						<Link
							href="/login"
							className="rounded-full px-4 py-1.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all duration-200"
						>
							Login
						</Link>
						<Link
							href="/register"
							className="ml-1 rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-600 px-5 py-1.5 text-sm font-semibold text-white hover:shadow-[0_0_20px_hsl(262_83%_58%/0.4)] transition-all duration-300"
						>
							Get Started
						</Link>
					</div>
				</div>
			</div>
		</nav>
	);
}
