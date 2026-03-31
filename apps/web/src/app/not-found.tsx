import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Page Not Found",
};

export default function NotFound() {
	return (
		<div className="min-h-screen bg-[#08080c] text-white flex items-center justify-center px-6">
			<div className="text-center max-w-md">
				<p className="text-7xl font-black font-[family-name:var(--font-display)] bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
					404
				</p>
				<h1 className="mt-4 text-2xl font-bold font-[family-name:var(--font-display)]">
					Page not found
				</h1>
				<p className="mt-3 text-white/60">
					The page you&apos;re looking for doesn&apos;t exist or has been moved.
				</p>
				<div className="mt-8 flex items-center justify-center gap-4">
					<Link
						href="/"
						className="rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-600 px-6 py-3 text-sm font-bold text-white hover:shadow-[0_0_25px_hsl(262_83%_58%/0.3)] transition-all"
					>
						Go home
					</Link>
					<Link
						href="/pricing"
						className="rounded-full border border-white/15 px-6 py-3 text-sm font-semibold text-white/80 hover:bg-white/5 transition-all"
					>
						View pricing
					</Link>
				</div>
			</div>
		</div>
	);
}
