"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";
import { Wordmark } from "@/components/Wordmark";

export default function AccountPage() {
	const router = useRouter();
	const { data: session, isPending } = useSession();
	const [deleting, setDeleting] = useState(false);

	useEffect(() => {
		if (!isPending && !session) router.replace("/app/login");
	}, [isPending, session, router]);

	async function deleteAccount() {
		const confirmation = window.prompt(
			'This will permanently delete your account, all projects, all renders, and all chat history. Type "DELETE" to confirm.',
		);
		if (confirmation !== "DELETE") return;
		setDeleting(true);
		await fetch("/api/account/me", { method: "DELETE" });
		await signOut();
		setDeleting(false);
		router.push("/");
	}

	if (isPending || !session) return null;

	return (
		<main className="mx-auto max-w-3xl p-4 sm:p-8">
			<header className="mb-8 flex flex-wrap items-center justify-between gap-3 sm:mb-10">
				<Link href="/app/projects">
					<Wordmark size="md" />
				</Link>
				<nav className="flex flex-wrap gap-3 text-sm">
					<Link
						href="/app/projects"
						className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
					>
						Projects
					</Link>
					<Link
						href="/app/settings/brand"
						className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
					>
						Brand kit
					</Link>
					<Link
						href="/app/settings/account"
						className="text-[var(--color-accent)]"
					>
						Account
					</Link>
				</nav>
			</header>

			<h1 className="mb-6 text-2xl font-bold sm:text-3xl">Account</h1>

			<section className="mb-8 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
				<h2 className="mb-3 text-sm font-semibold uppercase tracking-wider">
					Profile
				</h2>
				<dl className="space-y-2 text-sm">
					<div className="flex flex-wrap justify-between gap-2">
						<dt className="text-[var(--color-fg-muted)]">Name</dt>
						<dd className="break-all">{session.user.name}</dd>
					</div>
					<div className="flex flex-wrap justify-between gap-2">
						<dt className="text-[var(--color-fg-muted)]">Email</dt>
						<dd className="break-all">{session.user.email}</dd>
					</div>
				</dl>
			</section>

			<section className="rounded-xl border border-[var(--color-danger)] bg-[var(--color-surface)] p-4 sm:p-6">
				<h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-danger)]">
					Danger zone
				</h2>
				<p className="mb-4 text-sm text-[var(--color-fg-muted)]">
					Delete your account, all projects, all renders, all chat history.
					This cannot be undone.
				</p>
				<button
					onClick={deleteAccount}
					disabled={deleting}
					className="rounded-md border border-[var(--color-danger)] px-4 py-2 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger)] hover:text-white disabled:opacity-50"
				>
					{deleting ? "Deleting..." : "Delete my account"}
				</button>
			</section>
		</main>
	);
}
