"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type BillingInfo = {
	plan: { id: string; name: string };
	usage: {
		renders: { used: number; limit: number };
		chatTurns: { used: number; limit: number };
	};
};

export function UsageMeter({ compact = false }: { compact?: boolean }) {
	const [info, setInfo] = useState<BillingInfo | null>(null);

	useEffect(() => {
		fetch("/api/billing/me")
			.then((r) => (r.ok ? r.json() : null))
			.then(setInfo);
	}, []);

	if (!info) return null;
	const { renders } = info.usage;
	const pct =
		renders.limit === -1 ? 0 : Math.min(100, (renders.used / renders.limit) * 100);
	const warn = pct >= 80;

	if (compact) {
		return (
			<Link
				href="/app/billing"
				className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 font-mono text-[10px] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)]"
				title={`${info.plan.name} plan — ${renders.used} of ${renders.limit === -1 ? "∞" : renders.limit} renders this month`}
			>
				{info.plan.name.toUpperCase()} ·{" "}
				<span className={warn ? "text-[var(--color-accent-2)]" : ""}>
					{renders.used}/{renders.limit === -1 ? "∞" : renders.limit}
				</span>
			</Link>
		);
	}

	return (
		<div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm">
			<div className="mb-2 flex items-center justify-between">
				<div>
					<span className="font-semibold">{info.plan.name}</span>
					<span className="ml-2 text-xs text-[var(--color-fg-muted)]">
						plan
					</span>
				</div>
				<Link
					href="/app/billing"
					className="rounded-md border border-[var(--color-border)] px-3 py-1 text-xs hover:bg-[var(--color-bg)]"
				>
					Manage
				</Link>
			</div>
			<div className="mb-1 flex items-baseline justify-between text-xs text-[var(--color-fg-muted)]">
				<span>Renders this month</span>
				<span className={warn ? "text-[var(--color-accent-2)]" : ""}>
					{renders.used} / {renders.limit === -1 ? "∞" : renders.limit}
				</span>
			</div>
			<div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-bg)]">
				<div
					className="h-full bg-[var(--color-accent)] transition-[width]"
					style={{ width: `${pct}%` }}
				/>
			</div>
		</div>
	);
}
