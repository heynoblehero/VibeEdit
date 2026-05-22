"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

const LINKS: Array<{ href: string; label: string }> = [
	{ href: "/#how", label: "How it works" },
	{ href: "/#pricing", label: "Pricing" },
	{ href: "/showcase", label: "Showcase" },
	{ href: "/#faq", label: "FAQ" },
];

export function MarketingNav() {
	const [open, setOpen] = useState(false);

	useEffect(() => {
		if (!open) return;
		const previous = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		function onEsc(event: KeyboardEvent) {
			if (event.key === "Escape") setOpen(false);
		}
		window.addEventListener("keydown", onEsc);
		return () => {
			document.body.style.overflow = previous;
			window.removeEventListener("keydown", onEsc);
		};
	}, [open]);

	return (
		<header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 sm:py-6">
			<Link href="/" aria-label="VibeEdit Video home">
				<Wordmark size="md" />
			</Link>
			<nav className="hidden items-center gap-2 text-sm md:flex">
				{LINKS.map((link) => (
					<Link
						key={link.href}
						href={link.href}
						className="rounded-md px-3 py-2 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
					>
						{link.label}
					</Link>
				))}
				<Link
					href="/app/login"
					className="rounded-md px-3 py-2 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
				>
					Sign in
				</Link>
				<Link
					href="/app/signup"
					className="rounded-md bg-[var(--color-accent)] px-4 py-2 font-semibold text-black hover:opacity-90"
				>
					Start free
				</Link>
			</nav>
			<div className="flex items-center gap-2 md:hidden">
				<Link
					href="/app/signup"
					className="rounded-md bg-[var(--color-accent)] px-3 py-2 text-sm font-semibold text-black"
				>
					Start
				</Link>
				<button
					onClick={() => setOpen(true)}
					aria-label="Open menu"
					className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-fg)]"
				>
					<svg
						width="18"
						height="14"
						viewBox="0 0 18 14"
						fill="none"
						aria-hidden="true"
					>
						<path
							d="M1 1h16M1 7h16M1 13h16"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
						/>
					</svg>
				</button>
			</div>
			{open && (
				<div
					onClick={() => setOpen(false)}
					className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm md:hidden"
				>
					<div
						onClick={(event) => event.stopPropagation()}
						className="ml-auto flex h-full w-full max-w-xs flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] p-6"
					>
						<div className="mb-8 flex items-center justify-between">
							<Wordmark size="sm" />
							<button
								onClick={() => setOpen(false)}
								aria-label="Close menu"
								className="text-2xl text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
							>
								✕
							</button>
						</div>
						<div className="flex flex-col gap-1">
							{LINKS.map((link) => (
								<Link
									key={link.href}
									href={link.href}
									onClick={() => setOpen(false)}
									className="rounded-md px-3 py-3 text-base text-[var(--color-fg)] hover:bg-[var(--color-bg-2)]"
								>
									{link.label}
								</Link>
							))}
							<Link
								href="/changelog"
								onClick={() => setOpen(false)}
								className="rounded-md px-3 py-3 text-base text-[var(--color-fg)] hover:bg-[var(--color-bg-2)]"
							>
								Changelog
							</Link>
							<Link
								href="/help"
								onClick={() => setOpen(false)}
								className="rounded-md px-3 py-3 text-base text-[var(--color-fg)] hover:bg-[var(--color-bg-2)]"
							>
								Help
							</Link>
							<Link
								href="/app/login"
								onClick={() => setOpen(false)}
								className="rounded-md px-3 py-3 text-base text-[var(--color-fg)] hover:bg-[var(--color-bg-2)]"
							>
								Sign in
							</Link>
						</div>
						<Link
							href="/app/signup"
							onClick={() => setOpen(false)}
							className="mt-auto rounded-md bg-[var(--color-accent)] px-4 py-3 text-center font-semibold text-black"
						>
							Start free — $1 trial
						</Link>
					</div>
				</div>
			)}
		</header>
	);
}
