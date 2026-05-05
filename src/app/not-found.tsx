import Link from "next/link";

/**
 * Catch-all 404 surface. Routes that don't match a defined segment
 * land here instead of Next's default. Aim is to keep users in flow
 * — show the brand mark, a one-line explainer, and one CTA back to
 * a useful surface.
 */
export default function NotFound() {
	return (
		<main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100 px-6">
			<div className="max-w-md w-full text-center space-y-4">
				<div className="text-[64px] leading-none font-bold text-emerald-400/40">
					404
				</div>
				<h1 className="text-2xl font-semibold">Nothing here</h1>
				<p className="text-sm text-neutral-400 leading-relaxed">
					The URL you followed doesn't match any project or surface in VibeEdit.
					If you got here from a link, it might be from a renamed or trashed
					project.
				</p>
				<Link
					href="/dashboard"
					className="inline-block px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-400 text-neutral-950 text-sm font-semibold"
				>
					Go to dashboard
				</Link>
			</div>
		</main>
	);
}
