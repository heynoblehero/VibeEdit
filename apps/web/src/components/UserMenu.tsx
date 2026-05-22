"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";

type MenuItem =
	| { kind: "link"; href: string; label: string; sub?: string }
	| { kind: "sep" };

function buildItems(): MenuItem[] {
	const items: MenuItem[] = [
		{ kind: "link", href: "/app/projects", label: "Projects" },
		{ kind: "link", href: "/app/renders", label: "Renders" },
		{ kind: "link", href: "/app/templates", label: "Templates" },
		{ kind: "link", href: "/app/snippets", label: "Snippets" },
		{ kind: "link", href: "/app/batch", label: "Batch" },
		{ kind: "sep" },
		{ kind: "link", href: "/app/settings/account", label: "Account" },
		{ kind: "link", href: "/app/settings/brand", label: "Brand kit" },
		{ kind: "link", href: "/app/settings/worker", label: "Render worker" },
		{ kind: "link", href: "/app/settings/api-keys", label: "API keys" },
		{ kind: "link", href: "/app/billing", label: "Billing" },
	];
	if (
		process.env.NEXT_PUBLIC_AFFILIATE_ENABLED === "1" ||
		process.env.NEXT_PUBLIC_AFFILIATE_ENABLED === "true"
	) {
		items.push({ kind: "link", href: "/app/affiliate", label: "Affiliate" });
	}
	items.push(
		{ kind: "sep" },
		{ kind: "link", href: "/help", label: "Help & docs" },
		{ kind: "link", href: "/changelog", label: "What's new" },
	);
	return items;
}

const ITEMS: MenuItem[] = buildItems();

export function UserMenu() {
	const router = useRouter();
	const { data: session } = useSession();
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) return;
		function onPointer(event: MouseEvent) {
			if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
		}
		function onKey(event: KeyboardEvent) {
			if (event.key === "Escape") setOpen(false);
		}
		window.addEventListener("mousedown", onPointer);
		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener("mousedown", onPointer);
			window.removeEventListener("keydown", onKey);
		};
	}, [open]);

	if (!session?.user) return null;

	const user = session.user;
	const initials = initialsFor(user.name || user.email || "?");

	async function handleSignOut() {
		await signOut();
		router.replace("/");
	}

	return (
		<div ref={rootRef} className="relative">
			<button
				onClick={() => setOpen((v) => !v)}
				className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] py-1 pl-1 pr-2 text-xs hover:border-[var(--color-fg-muted)]"
				aria-haspopup="menu"
				aria-expanded={open}
				title={user.email || ""}
			>
				<span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-accent)] text-[10px] font-bold uppercase text-black">
					{initials}
				</span>
				<span className="hidden max-w-[120px] truncate text-[var(--color-fg)] sm:inline">
					{user.name || user.email}
				</span>
				<span className="text-[var(--color-fg-muted)]">▾</span>
			</button>
			{open && (
				<div
					role="menu"
					className="absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
				>
					<div className="border-b border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
						<div className="truncate text-sm font-semibold text-[var(--color-fg)]">
							{user.name || "—"}
						</div>
						<div className="truncate text-[11px] text-[var(--color-fg-muted)]">
							{user.email}
						</div>
					</div>
					<ul className="py-1">
						{ITEMS.map((item, index) =>
							item.kind === "sep" ? (
								<li
									key={`sep-${index}`}
									className="my-1 border-t border-[var(--color-border)]"
								/>
							) : (
								<li key={item.href}>
									<Link
										href={item.href}
										onClick={() => setOpen(false)}
										className="block px-3 py-1.5 text-sm text-[var(--color-fg)] hover:bg-[var(--color-bg-2)]"
									>
										{item.label}
									</Link>
								</li>
							),
						)}
						<li className="my-1 border-t border-[var(--color-border)]" />
						<li>
							<button
								onClick={handleSignOut}
								className="block w-full px-3 py-1.5 text-left text-sm text-[var(--color-danger)] hover:bg-[var(--color-bg-2)]"
							>
								Sign out
							</button>
						</li>
					</ul>
				</div>
			)}
		</div>
	);
}

function initialsFor(input: string): string {
	const parts = input.trim().split(/\s+/);
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return (parts[0][0] + (parts[1][0] || "")).toUpperCase();
}
