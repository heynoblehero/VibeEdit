import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/lib/db";
import {
	messages,
	projects,
	user,
	userPreferences,
} from "@/lib/db/schema";
import { ensureProjectDir } from "@/lib/storage/fs";
import { requireServerSession } from "@/lib/server-session";
import { sendEmail } from "@/lib/email/send";
import { welcomeEmail } from "@/lib/email/templates";

// Niche → starter prompt seeded into the first project. Picked to match the
// editor's sample-prompt cards so the experience is consistent.
const STARTER_PROMPTS: Record<string, { name: string; prompt: string }> = {
	comic: {
		name: "My first comic hook",
		prompt:
			"Make a 30-second 1080x1920 comic-book facts hook. Red + yellow palette, halftone backdrop, big chromatic title, one glass-crack on the title beat. Generic comic energy — no real publishers or characters.",
	},
	anime: {
		name: "My first anime Short",
		prompt:
			"30-second 1080x1920 anime facts Short. Pink + cyan chromatic palette, speed-line backdrop, tilted kicker text, big chromatic-split title, scale-pulse on the title.",
	},
	scifi: {
		name: "My first sci-fi declassified",
		prompt:
			"30-second 1080x1920 sci-fi 'declassified file' Short. Cyan-on-black, grid + scanlines, mono tags, glowing case-file number that pulses. Ominous tone.",
	},
	history: {
		name: "My first history Short",
		prompt:
			"60-second 1080x1920 history Short about the ancient pyramids. Sepia palette, serif title type, slow ken-burns backgrounds, no flashes. End with a question that hooks the next video.",
	},
	finance: {
		name: "My first finance hook",
		prompt:
			"20-second 1920x1080 intro for a finance long-form video. Black + neon-green palette, big animated counters, a sharp line chart drawing in, scanline overlay.",
	},
	sleep: {
		name: "My first sleep-story intro",
		prompt:
			"30-second 1920x1080 calm sleep-story intro. Indigo gradient, very slow ken-burns, soft serif type, no FX. Title: 'Ancient Stars'.",
	},
	scary: {
		name: "My first scary story Short",
		prompt:
			"45-second 1080x1920 scary story Short. Deep blue/purple gradient, slow fades only, candle-flicker grain. Soft serif title 'THE BASEMENT TAPE' that pulses.",
	},
	tech: {
		name: "My first tech tutorial intro",
		prompt:
			"15-second 1920x1080 tutorial intro for a coding channel. Dark gray + cyan accent, monospace type, three rotating code snippets, end on the channel name 'devloop'.",
	},
};

const NICHES = [
	"comic",
	"anime",
	"scifi",
	"history",
	"finance",
	"sleep",
	"scary",
	"tech",
	"other",
] as const;
const FORMATS = ["16:9", "9:16", "both"] as const;
const FREQUENCIES = ["daily", "weekly", "occasional", "experimenting"] as const;

export async function GET() {
	const session = await requireServerSession().catch((r) => r);
	if (session instanceof Response) return session;
	const userId = session.user.id;
	const row = db
		.select()
		.from(userPreferences)
		.where(eq(userPreferences.userId, userId))
		.get();
	if (!row) {
		return NextResponse.json({
			niche: null,
			formatPreference: null,
			postFrequency: null,
			onboardingCompleted: false,
			tourCompleted: false,
		});
	}
	return NextResponse.json(row);
}

export async function PATCH(req: Request) {
	const session = await requireServerSession().catch((r) => r);
	if (session instanceof Response) return session;
	const userId = session.user.id;
	const body = (await req.json().catch(() => ({}))) as {
		niche?: string;
		formatPreference?: string;
		postFrequency?: string;
		onboardingCompleted?: boolean;
		tourCompleted?: boolean;
	};

	const niche =
		body.niche && NICHES.includes(body.niche as (typeof NICHES)[number])
			? body.niche
			: undefined;
	const formatPreference =
		body.formatPreference &&
		FORMATS.includes(body.formatPreference as (typeof FORMATS)[number])
			? body.formatPreference
			: undefined;
	const postFrequency =
		body.postFrequency &&
		FREQUENCIES.includes(
			body.postFrequency as (typeof FREQUENCIES)[number],
		)
			? body.postFrequency
			: undefined;

	const existing = db
		.select()
		.from(userPreferences)
		.where(eq(userPreferences.userId, userId))
		.get();

	const now = new Date();
	const wasAlreadyOnboarded = !!existing?.onboardingCompleted;
	if (existing) {
		const updates: Record<string, unknown> = { updatedAt: now };
		if (niche !== undefined) updates.niche = niche;
		if (formatPreference !== undefined)
			updates.formatPreference = formatPreference;
		if (postFrequency !== undefined) updates.postFrequency = postFrequency;
		if (body.onboardingCompleted !== undefined)
			updates.onboardingCompleted = body.onboardingCompleted;
		if (body.tourCompleted !== undefined)
			updates.tourCompleted = body.tourCompleted;
		db.update(userPreferences)
			.set(updates)
			.where(eq(userPreferences.userId, userId))
			.run();
	} else {
		db.insert(userPreferences)
			.values({
				userId,
				niche: niche || null,
				formatPreference: formatPreference || null,
				postFrequency: postFrequency || null,
				onboardingCompleted: body.onboardingCompleted ?? false,
				tourCompleted: body.tourCompleted ?? false,
				updatedAt: now,
			})
			.run();
	}

	// On first onboarding completion: auto-create a niche-seeded starter project
	// so the user lands in an editor with a prompt already queued.
	let firstProjectId: string | null = null;
	if (!wasAlreadyOnboarded && body.onboardingCompleted === true) {
		const startNiche = niche || existing?.niche || null;
		const starter = startNiche ? STARTER_PROMPTS[startNiche] : null;
		if (starter) {
			const id = nanoid(10);
			db.insert(projects)
				.values({
					id,
					userId,
					name: starter.name,
					createdAt: now,
					updatedAt: now,
				})
				.run();
			ensureProjectDir(userId, id);
			// Chat reads message content as a JSON-encoded string or array.
			// JSON.stringify("foo") → `"foo"` which parses back to "foo" — that
			// matches how the chat route stores user messages.
			db.insert(messages)
				.values({
					id: nanoid(12),
					projectId: id,
					role: "user",
					content: JSON.stringify(starter.prompt),
					createdAt: now,
				})
				.run();
			firstProjectId = id;
		}
	}

	// Fire welcome email on first onboarding completion only — fire-and-forget
	if (!wasAlreadyOnboarded && body.onboardingCompleted === true) {
		void (async () => {
			try {
				const owner = db
					.select()
					.from(user)
					.where(eq(user.id, userId))
					.get();
				if (owner?.email) {
					await sendEmail({
						to: owner.email,
						subject: "Welcome to VibeEdit Video",
						html: welcomeEmail({
							name: owner.name?.split(" ")[0] || "there",
						}),
					});
				}
			} catch (error) {
				console.error("[onboarding] welcome email failed:", error);
			}
		})();
	}

	return NextResponse.json({ ok: true, firstProjectId });
}
