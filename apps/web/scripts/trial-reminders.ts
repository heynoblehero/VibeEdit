#!/usr/bin/env tsx
// Daily cron: send T-3 / T-1 / T-0 reminder emails to users on a trial.
//
// Cron suggestion: 0 9 * * * cd /path/to/apps/web && bun run scripts/trial-reminders.ts

import { eq } from "drizzle-orm";
import { db } from "../src/lib/db";
import { subscriptions, user, usageEvents } from "../src/lib/db/schema";
import { sendEmail } from "../src/lib/email/send";
import { trialEndingEmail } from "../src/lib/email/templates";
import { planFor } from "../src/lib/billing/plans";
import { nanoid } from "nanoid";

const HORIZONS_DAYS = [3, 1, 0];

async function main() {
	const now = Date.now();
	const rows = db
		.select({
			userId: subscriptions.userId,
			plan: subscriptions.plan,
			status: subscriptions.status,
			trialEndsAt: subscriptions.trialEndsAt,
		})
		.from(subscriptions)
		.where(eq(subscriptions.status, "trialing"))
		.all();

	let sent = 0;
	for (const row of rows) {
		if (!row.trialEndsAt) continue;
		const endMs = new Date(row.trialEndsAt).getTime();
		const msLeft = endMs - now;
		const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));
		if (!HORIZONS_DAYS.includes(daysLeft)) continue;

		const kind = `trial-reminder-d${daysLeft}`;
		// Idempotency — have we already sent this reminder for this user?
		const already = db
			.select()
			.from(usageEvents)
			.where(eq(usageEvents.userId, row.userId))
			.all()
			.find(
				(event) =>
					event.kind === kind &&
					event.meta &&
					JSON.parse(event.meta).trialEndsAt === row.trialEndsAt?.toISOString(),
			);
		if (already) continue;

		const owner = db
			.select()
			.from(user)
			.where(eq(user.id, row.userId))
			.get();
		if (!owner?.email) continue;

		const planLabel = planFor(row.plan).name;
		await sendEmail({
			to: owner.email,
			subject:
				daysLeft === 0
					? `Your trial ends today`
					: `Your ${planLabel} trial ends in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
			html: trialEndingEmail({ daysLeft: Math.max(0, daysLeft), plan: planLabel }),
		});

		db.insert(usageEvents)
			.values({
				id: nanoid(12),
				userId: row.userId,
				kind,
				amount: 1,
				meta: JSON.stringify({
					trialEndsAt: row.trialEndsAt.toISOString(),
				}),
				createdAt: new Date(),
			})
			.run();
		sent++;
	}
	console.log(`[trial-reminders] sent ${sent} reminder(s) over ${rows.length} trialing users`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
