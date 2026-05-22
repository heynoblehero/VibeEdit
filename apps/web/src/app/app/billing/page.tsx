"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "@/lib/auth-client";
import { Wordmark } from "@/components/Wordmark";

// Next 15's static prerender bails out if a client component reads search
// params without a Suspense boundary above. Wrap the body so prerender can
// emit a shell + hydrate the real query-driven UI on the client.
export default function BillingPageWrapper() {
	return (
		<Suspense
			fallback={
				<main className="flex min-h-screen items-center justify-center text-[var(--color-fg-muted)]">
					Loading…
				</main>
			}
		>
			<BillingPage />
		</Suspense>
	);
}

type Plan = {
	id: string;
	name: string;
	priceLabel: string;
	renderLimit: number;
	chatTurnLimit: number;
	resolution: string;
	watermark: boolean;
};

type Info = {
	plan: Plan;
	subscription: {
		plan: string;
		status: string;
		stripeCustomerId: string | null;
		polarCustomerId: string | null;
		currentPeriodEnd: string | null;
		trialEndsAt: string | null;
		cancelAtPeriodEnd: boolean;
	};
	usage: {
		renders: { used: number; limit: number };
		chatTurns: { used: number; limit: number };
	};
	availablePlans: Plan[];
};

function BillingPage() {
	const router = useRouter();
	const params = useSearchParams();
	const { data: session, isPending } = useSession();
	const [info, setInfo] = useState<Info | null>(null);
	const [busy, setBusy] = useState<string | null>(null);

	useEffect(() => {
		if (!isPending && !session) router.replace("/app/login");
	}, [isPending, session, router]);

	async function refresh() {
		const r = await fetch("/api/billing/me");
		if (!r.ok) return;
		setInfo(await r.json());
	}

	useEffect(() => {
		if (session) refresh();
	}, [session]);

	async function startCheckout(planId: string) {
		setBusy(planId);
		const result = await fetch("/api/billing/checkout", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ plan: planId }),
		});
		setBusy(null);
		if (!result.ok) {
			alert(`Checkout failed: ${await result.text()}`);
			return;
		}
		const data = (await result.json()) as { url: string; devMode?: boolean };
		if (data.devMode) {
			alert(
				"Stripe is not configured — plan switched in dev mode for testing.",
			);
			refresh();
			return;
		}
		window.location.href = data.url;
	}

	async function openPortal() {
		setBusy("portal");
		const result = await fetch("/api/billing/portal", { method: "POST" });
		setBusy(null);
		if (!result.ok) {
			alert("No Stripe customer yet — subscribe first.");
			return;
		}
		const data = (await result.json()) as { url: string };
		window.location.href = data.url;
	}

	if (isPending || !session || !info) {
		return (
			<main className="flex min-h-screen items-center justify-center text-[var(--color-fg-muted)]">
				Loading...
			</main>
		);
	}

	const status = params.get("status");

	return (
		<main className="mx-auto max-w-5xl p-4 sm:p-8">
			<header className="mb-8 flex flex-wrap items-center justify-between gap-3 sm:mb-10">
				<Link href="/">
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
						href="/app/templates"
						className="hidden text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] sm:inline"
					>
						Templates
					</Link>
					<Link
						href="/app/renders"
						className="text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
					>
						Renders
					</Link>
					<Link
						href="/app/billing"
						className="text-[var(--color-accent)]"
					>
						Billing
					</Link>
				</nav>
			</header>

			<h1 className="mb-6 text-2xl font-bold sm:text-3xl">Billing</h1>

			{status === "success" && (
				<div className="mb-6 rounded-lg border border-[var(--color-success)] bg-[var(--color-success)]/10 p-4 text-sm">
					Subscription activated. Welcome aboard.
				</div>
			)}
			{status === "cancelled" && (
				<div className="mb-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm">
					Checkout cancelled. No charge was made.
				</div>
			)}

			{info.plan.id === "free" && (
				<div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--color-accent)] bg-[var(--color-bg-2)] p-4">
					<div className="flex-1 text-sm">
						<div className="font-semibold text-[var(--color-fg)]">
							Your renders show a <span className="text-[var(--color-accent-2)]">VibeEdit watermark</span> and cap at 720p.
						</div>
						<div className="mt-0.5 text-xs text-[var(--color-fg-muted)]">
							Creator removes the watermark + unlocks 1080p. Studio adds 4K + priority queue.
						</div>
					</div>
					<button
						onClick={() => startCheckout("creator")}
						disabled={busy === "creator"}
						className="rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
					>
						{busy === "creator"
							? "Redirecting…"
							: "Upgrade to Creator · $19/mo"}
					</button>
				</div>
			)}

			<section className="mb-10 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
				<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
					<div>
						<div className="text-xs uppercase tracking-wider text-[var(--color-fg-muted)]">
							Current plan
						</div>
						<div className="mt-1 flex flex-wrap items-baseline gap-2 sm:gap-3">
							<span className="text-2xl font-bold sm:text-3xl">{info.plan.name}</span>
							<span className="text-[var(--color-fg-muted)]">
								· {info.plan.priceLabel}/mo
							</span>
							{info.subscription.status === "trialing" && (
								<span className="rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-xs font-semibold text-black">
									Trial
								</span>
							)}
						</div>
					</div>
					{(info.subscription.polarCustomerId ||
						info.subscription.stripeCustomerId) && (
						<button
							onClick={openPortal}
							disabled={busy === "portal"}
							className="rounded-md border border-[var(--color-border)] px-3 py-2 text-sm hover:bg-[var(--color-bg)] disabled:opacity-50"
						>
							{busy === "portal" ? "Opening..." : "Manage subscription"}
						</button>
					)}
				</div>
				<div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
					<UsageBar
						label="Renders this month"
						used={info.usage.renders.used}
						limit={info.usage.renders.limit}
					/>
					<UsageBar
						label="Agent messages this month"
						used={info.usage.chatTurns.used}
						limit={info.usage.chatTurns.limit}
					/>
				</div>
				{info.subscription.currentPeriodEnd && (
					<div className="mt-4 text-xs text-[var(--color-fg-muted)]">
						Renews{" "}
						{new Date(info.subscription.currentPeriodEnd).toLocaleDateString()}
						{info.subscription.cancelAtPeriodEnd &&
							" — cancels at period end"}
					</div>
				)}
			</section>

			<h2 className="mb-4 text-lg font-semibold">Switch plan</h2>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
				{info.availablePlans.map((plan) => {
					const isCurrent = plan.id === info.plan.id;
					return (
						<div
							key={plan.id}
							className={`rounded-2xl border p-5 ${
								isCurrent
									? "border-[var(--color-accent)]"
									: "border-[var(--color-border)]"
							} bg-[var(--color-surface)]`}
						>
							<div className="mb-1 flex items-baseline justify-between">
								<h3 className="text-lg font-bold">{plan.name}</h3>
								{isCurrent && (
									<span className="text-xs text-[var(--color-accent)]">
										Current
									</span>
								)}
							</div>
							<div className="mb-3 text-3xl font-black">
								{plan.priceLabel}
								<span className="ml-1 text-sm font-normal text-[var(--color-fg-muted)]">
									/mo
								</span>
							</div>
							<ul className="mb-4 space-y-1 text-xs text-[var(--color-fg-muted)]">
								<li>
									Renders:{" "}
									{plan.renderLimit === -1
										? "Unlimited"
										: `${plan.renderLimit}/mo`}
								</li>
								<li>
									Agent messages:{" "}
									{plan.chatTurnLimit === -1
										? "Unlimited"
										: `${plan.chatTurnLimit}/mo`}
								</li>
								<li>Resolution: {plan.resolution}</li>
								<li>Watermark: {plan.watermark ? "yes" : "no"}</li>
							</ul>
							{!isCurrent && plan.id !== "free" && (
								<button
									onClick={() => startCheckout(plan.id)}
									disabled={busy === plan.id}
									className="w-full rounded-md bg-[var(--color-accent)] py-2 font-semibold text-black hover:opacity-90 disabled:opacity-50"
								>
									{busy === plan.id
										? "Redirecting..."
										: info.plan.id === "free"
											? `Subscribe · ${plan.priceLabel}/mo`
											: "Switch"}
								</button>
							)}
							{!isCurrent && plan.id === "free" && (
								<button
									disabled
									className="w-full cursor-not-allowed rounded-md border border-[var(--color-border)] py-2 text-sm text-[var(--color-fg-muted)]"
								>
									Downgrade in customer portal
								</button>
							)}
						</div>
					);
				})}
			</div>
		</main>
	);
}

function UsageBar({
	label,
	used,
	limit,
}: {
	label: string;
	used: number;
	limit: number;
}) {
	const pct = limit === -1 ? 0 : Math.min(100, (used / limit) * 100);
	const warn = pct >= 80 && limit !== -1;
	return (
		<div>
			<div className="mb-1 flex items-baseline justify-between text-xs text-[var(--color-fg-muted)]">
				<span>{label}</span>
				<span className={warn ? "text-[var(--color-accent-2)]" : ""}>
					{used} / {limit === -1 ? "∞" : limit}
				</span>
			</div>
			<div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg)]">
				<div
					className="h-full bg-[var(--color-accent)]"
					style={{ width: `${pct}%` }}
				/>
			</div>
		</div>
	);
}
