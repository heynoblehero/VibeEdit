import Link from "next/link";
import { CHANGELOG } from "@/lib/changelog";

export const metadata = {
	title: "Changelog",
	description: "What's new in VibeEdit.",
};

export default function ChangelogPage() {
	return (
		<main className="mx-auto max-w-2xl px-6 py-16 text-neutral-200">
			<header className="mb-10">
				<Link
					href="/dashboard"
					className="text-[12px] text-neutral-500 hover:text-white"
				>
					← Back to dashboard
				</Link>
				<h1 className="mt-4 text-3xl font-semibold tracking-tight">Changelog</h1>
				<p className="mt-2 text-[14px] text-neutral-400">
					What we've shipped, newest first. Versions roll up the work from
					the prior couple of weeks; the dates are when they reached
					production.
				</p>
			</header>

			<div className="space-y-12">
				{CHANGELOG.map((entry) => (
					<section key={entry.version} className="space-y-3">
						<div className="flex items-baseline gap-3">
							<h2 className="text-xl font-semibold text-white">
								{entry.title}
							</h2>
							<span className="text-[11px] font-mono tabular-nums text-emerald-300/80">
								v{entry.version}
							</span>
							<span className="text-[11px] text-neutral-500">{entry.date}</span>
						</div>
						<ul className="list-disc list-outside pl-5 space-y-1.5 text-[13px] text-neutral-300 leading-relaxed">
							{entry.highlights.map((h) => (
								<li key={h}>{h}</li>
							))}
						</ul>
					</section>
				))}
			</div>
		</main>
	);
}
