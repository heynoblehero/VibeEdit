#!/usr/bin/env tsx
/*
 * Daily cron: re-engagement emails.
 *
 *   - Day 7  + no project at all   → "still curious about VibeEdit?"
 *   - Day 14 + project exists but no successful render → "ship one video"
 *
 * Idempotent: each lifecycle send is recorded as a usageEvents row with kind
 * "lifecycle_email_<stage>", so reruns on the same day won't double-send.
 *
 * Cron suggestion (Dokku):
 *   dokku cron:add vibeedit "cd /app/apps/web && bun run scripts/lifecycle-emails.ts" "0 16 * * *"
 *
 * Or external cron (cron-job.org / GH Actions) → curl POST a webhook that
 * spawns this script. We chose to run inside the container instead so the DB
 * is local + we don't have to expose an auth-gated trigger endpoint.
 */

import { and, eq, gte, lt, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../src/lib/db";
import {
	user,
	projects,
	renderJobs,
	usageEvents,
} from "../src/lib/db/schema";
import { sendEmail } from "../src/lib/email/send";
import {
	reengageNoProjectEmail,
	reengageNoRenderEmail,
} from "../src/lib/email/templates";

const DAY_MS = 24 * 60 * 60 * 1000;

type Stage = "day7_no_project" | "day14_no_render";

async function alreadySent(userId: string, stage: Stage): Promise<boolean> {
	const row = db
		.select({ id: usageEvents.id })
		.from(usageEvents)
		.where(
			and(
				eq(usageEvents.userId, userId),
				eq(usageEvents.kind, `lifecycle_email_${stage}`),
			),
		)
		.get();
	return !!row;
}

function markSent(userId: string, stage: Stage, email: string): void {
	db.insert(usageEvents)
		.values({
			id: nanoid(12),
			userId,
			kind: `lifecycle_email_${stage}`,
			amount: 1,
			meta: JSON.stringify({ email }),
			createdAt: new Date(),
		})
		.run();
}

async function sendDay7NoProject(): Promise<number> {
	// Signed up between 7 and 8 days ago, no project yet.
	const now = Date.now();
	const start = new Date(now - 8 * DAY_MS);
	const end = new Date(now - 7 * DAY_MS);
	const candidates = db
		.select({
			id: user.id,
			email: user.email,
			name: user.name,
		})
		.from(user)
		.where(and(gte(user.createdAt, start), lt(user.createdAt, end)))
		.all();
	let sent = 0;
	for (const candidate of candidates) {
		if (await alreadySent(candidate.id, "day7_no_project")) continue;
		const projectCount = db
			.select({ count: sql<number>`count(*)` })
			.from(projects)
			.where(eq(projects.userId, candidate.id))
			.get()?.count;
		if (projectCount && projectCount > 0) continue;
		try {
			await sendEmail({
				to: candidate.email,
				subject: "Still curious about VibeEdit? (try a sample prompt)",
				html: reengageNoProjectEmail({
					name: candidate.name || candidate.email,
				}),
			});
			markSent(candidate.id, "day7_no_project", candidate.email);
			sent++;
			console.log(`[lifecycle] day7_no_project → ${candidate.email}`);
		} catch (error) {
			console.error(
				`[lifecycle] day7_no_project FAILED → ${candidate.email}`,
				(error as Error).message,
			);
		}
	}
	return sent;
}

async function sendDay14NoRender(): Promise<number> {
	// Signed up between 14 and 15 days ago, has a project but no done render.
	const now = Date.now();
	const start = new Date(now - 15 * DAY_MS);
	const end = new Date(now - 14 * DAY_MS);
	const candidates = db
		.select({
			id: user.id,
			email: user.email,
			name: user.name,
		})
		.from(user)
		.where(and(gte(user.createdAt, start), lt(user.createdAt, end)))
		.all();
	let sent = 0;
	for (const candidate of candidates) {
		if (await alreadySent(candidate.id, "day14_no_render")) continue;
		const projectCount = db
			.select({ count: sql<number>`count(*)` })
			.from(projects)
			.where(eq(projects.userId, candidate.id))
			.get()?.count;
		if (!projectCount || projectCount === 0) continue;
		const renderCount = db
			.select({ count: sql<number>`count(*)` })
			.from(renderJobs)
			.where(
				and(
					eq(renderJobs.userId, candidate.id),
					eq(renderJobs.status, "done"),
				),
			)
			.get()?.count;
		if (renderCount && renderCount > 0) continue;
		try {
			await sendEmail({
				to: candidate.email,
				subject: "Ship one video this week — let's get you there",
				html: reengageNoRenderEmail({
					name: candidate.name || candidate.email,
				}),
			});
			markSent(candidate.id, "day14_no_render", candidate.email);
			sent++;
			console.log(`[lifecycle] day14_no_render → ${candidate.email}`);
		} catch (error) {
			console.error(
				`[lifecycle] day14_no_render FAILED → ${candidate.email}`,
				(error as Error).message,
			);
		}
	}
	return sent;
}

async function main() {
	const startedAt = Date.now();
	const day7 = await sendDay7NoProject();
	const day14 = await sendDay14NoRender();
	const took = ((Date.now() - startedAt) / 1000).toFixed(1);
	console.log(
		`[lifecycle] done in ${took}s — day7_no_project=${day7}, day14_no_render=${day14}`,
	);
}

main().catch((error) => {
	console.error("[lifecycle] fatal", error);
	process.exit(1);
});
